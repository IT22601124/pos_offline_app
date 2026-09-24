import React, { useState } from 'react';
import {
  createBrand,
  createCategory,
  createProduct,
  createSupplier,
  createUnit,
  type CreateProductPayload,
  type PosBrand,
  type PosCategory,
  type PosProduct,
  type PosSupplier,
  type PosUnit,
} from '../hooks/pos/pos_controller';

interface ProductImportModalProps {
  categories: PosCategory[];
  brands: PosBrand[];
  units: PosUnit[];
  suppliers?: PosSupplier[];
  onClose: () => void;
  onImported: (
    products: PosProduct[],
    createdCategories?: PosCategory[],
    createdBrands?: PosBrand[],
    createdUnits?: PosUnit[],
    createdSuppliers?: PosSupplier[],
  ) => void;
}

interface ImportRow {
  rowNumber: number;
  source: Record<string, string>;
  payload: CreateProductPayload;
  rawCategoryName: string;
  rawBrandName: string;
  rawUnitName: string;
  rawSupplierName: string;
  isNewCategory: boolean;
  isNewBrand: boolean;
  isNewUnit: boolean;
  isNewSupplier: boolean;
  errors: string[];
}

const SAMPLE_HEADERS = [
  'product_code',
  'barcode',
  'name',
  'description',
  'category',
  'brand',
  'unit',
  'supplier',
  'cost_price',
  'selling_price',
  'wholesale_price',
  'stock_quantity',
  'minimum_stock',
  'tax_rate',
  'discount_rate',
  'image',
  'weight',
  'is_weighted',
  'status',
];

const normalizeHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, '')
    .replace(/[\s\-_]+/g, '_');

const toNumber = (value: string | undefined, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toBoolean = (value: string | undefined, fallback = false) => {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['true', 'yes', '1', 'active'].includes(normalized);
};

const parseCsv = (content: string): string[][] => {
  if (!content || typeof content !== 'string') return [];
  const cleanContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanContent.split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];

  const firstLine = lines[0] || '';
  let delimiter = ',';
  if (!firstLine.includes(',') && firstLine.includes(';')) delimiter = ';';
  else if (!firstLine.includes(',') && firstLine.includes('\t')) delimiter = '\t';
  else if (!firstLine.includes(',') && firstLine.includes('|')) delimiter = '|';

  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < cleanContent.length; index += 1) {
    const char = cleanContent[index];

    if (char === '"') {
      if (inQuotes && cleanContent[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
};

const findByName = <T extends { id: number; name: string }>(
  items: T[] | undefined | null,
  value: string | undefined | null,
) => {
  if (!value || !Array.isArray(items)) return undefined;
  const normalizedValue = String(value).trim().toLowerCase();
  return items.find(
    (item) => item && item.name && String(item.name).trim().toLowerCase() === normalizedValue,
  );
};

const getValue = (source: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    if (source[normalizedKey] !== undefined && source[normalizedKey] !== '') return source[normalizedKey];
    if (source[key] !== undefined && source[key] !== '') return source[key];
  }

  return '';
};

const buildImportRowsFromMatrix = (
  matrix: any[][],
  categories: PosCategory[] = [],
  brands: PosBrand[] = [],
  units: PosUnit[] = [],
  suppliers: PosSupplier[] = [],
): ImportRow[] => {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeBrands = Array.isArray(brands) ? brands : [];
  const safeUnits = Array.isArray(units) ? units : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];

  if (!Array.isArray(matrix) || !matrix.length) return [];
  const [headerRow, ...bodyRows] = matrix;
  if (!Array.isArray(headerRow)) return [];

  const headers = headerRow.map((h) => normalizeHeader(String(h ?? '')));

  return bodyRows
    .filter(
      (columns) =>
        Array.isArray(columns) &&
        columns.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''),
    )
    .map((columns: any[], index) => {
      const source = headers.reduce<Record<string, string>>((record, header, columnIndex) => {
        if (header) {
          const val = columns[columnIndex];
          record[header] = val !== null && val !== undefined ? String(val).trim() : '';
        }
        return record;
      }, {});

      const productCode = getValue(source, ['product_code', 'code', 'sku', 'item_code', 'product_id']);
      const barcode = getValue(source, ['barcode', 'bar_code', 'upc', 'ean']);
      const name = getValue(source, ['name', 'product_name', 'item_name', 'title']);
      const description = getValue(source, ['description', 'details', 'desc']);
      const rawCategoryName = getValue(source, ['category', 'category_name', 'cat', 'category_id']);
      const rawBrandName = getValue(source, ['brand', 'brand_name', 'make', 'manufacturer', 'brand_id']);
      const rawUnitName = getValue(source, ['unit', 'unit_name', 'uom', 'unit_of_measure', 'unit_id']);
      const rawSupplierName = getValue(source, ['supplier', 'supplier_name', 'vendor', 'supplier_id']);

      const category = findByName(safeCategories, rawCategoryName);
      const brand = findByName(safeBrands, rawBrandName);
      const unit = findByName(safeUnits, rawUnitName);
      const supplier = findByName(safeSuppliers, rawSupplierName);

      const isNewCategory = Boolean(rawCategoryName) && !category && !Number(rawCategoryName);
      const isNewBrand = Boolean(rawBrandName) && !brand && !Number(rawBrandName);
      const isNewUnit = Boolean(rawUnitName) && !unit && !Number(rawUnitName);
      const isNewSupplier = Boolean(rawSupplierName) && !supplier && !Number(rawSupplierName);

      const categoryId = Number(rawCategoryName) || category?.id || safeCategories[0]?.id || 1;
      const brandId = Number(rawBrandName) || brand?.id || safeBrands[0]?.id || 1;
      const unitId = Number(rawUnitName) || unit?.id || safeUnits[0]?.id || 1;
      const supplierId = Number(rawSupplierName) || supplier?.id || safeSuppliers[0]?.id || 1;

      const sellingPrice = toNumber(
        getValue(source, ['selling_price', 'price', 'sell_price', 'sale_price', 'retail_price']),
      );
      const stockQuantity = toNumber(
        getValue(source, ['stock_quantity', 'stock', 'qty', 'quantity', 'current_stock', 'in_stock']),
      );
      const costPrice = toNumber(
        getValue(source, ['cost_price', 'cost', 'cost_rate', 'buy_price', 'purchase_price']),
      );
      const wholesalePrice = toNumber(
        getValue(source, ['wholesale_price', 'wholesale', 'trade_price']),
        sellingPrice,
      );
      const minimumStock = toNumber(
        getValue(source, ['minimum_stock', 'min_stock', 'reorder_level', 'alert_qty']),
      );
      const taxRate = toNumber(getValue(source, ['tax_rate', 'tax', 'tax_percent', 'vat']));
      const discountRate = toNumber(getValue(source, ['discount_rate', 'discount', 'discount_percent']));
      const image = getValue(source, ['image', 'image_url', 'photo', 'picture']);
      const weight = toNumber(getValue(source, ['weight', 'item_weight', 'net_weight']));
      const isWeighted = toBoolean(getValue(source, ['is_weighted', 'weighted', 'by_weight']));
      const status = toBoolean(getValue(source, ['status', 'active', 'is_active']), true);

      const errors: string[] = [];

      if (!productCode) errors.push('Product code is required');
      if (!name) errors.push('Product name is required');
      if (sellingPrice < 0) errors.push('Selling price cannot be negative');
      if (stockQuantity < 0) errors.push('Stock cannot be negative');

      return {
        rowNumber: index + 2,
        source,
        errors,
        rawCategoryName,
        rawBrandName,
        rawUnitName,
        rawSupplierName,
        isNewCategory,
        isNewBrand,
        isNewUnit,
        isNewSupplier,
        payload: {
          product_code: productCode,
          barcode,
          name,
          description,
          category_id: categoryId,
          brand_id: brandId,
          unit_id: unitId,
          supplier_id: supplierId,
          cost_price: costPrice,
          selling_price: sellingPrice,
          wholesale_price: wholesalePrice,
          stock_quantity: stockQuantity,
          minimum_stock: minimumStock,
          tax_rate: taxRate,
          discount_rate: discountRate,
          image,
          weight,
          is_weighted: isWeighted,
          status,
        },
      };
    });
};

const loadXLSX = async (): Promise<any> => {
  if ((window as any).XLSX) return (window as any).XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error('SheetJS loader failed'));
    document.head.appendChild(script);
  });
};

const ProductImportModal: React.FC<ProductImportModalProps> = ({
  categories,
  brands,
  units,
  suppliers = [],
  onClose,
  onImported,
}) => {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'errors'>('all');

  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.length - validRows.length;

  const filteredRows = rows.filter((r) => {
    if (filterStatus === 'valid') return r.errors.length === 0;
    if (filterStatus === 'errors') return r.errors.length > 0;
    return true;
  });

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredRows.length / (pageSize as number)) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const displayedRows =
    pageSize === 'all'
      ? filteredRows
      : filteredRows.slice((activePage - 1) * (pageSize as number), activePage * (pageSize as number));

  const newCategoryNames = Array.from(
    new Set(validRows.filter((r) => r.isNewCategory).map((r) => r.rawCategoryName)),
  );
  const newBrandNames = Array.from(
    new Set(validRows.filter((r) => r.isNewBrand).map((r) => r.rawBrandName)),
  );
  const newUnitNames = Array.from(
    new Set(validRows.filter((r) => r.isNewUnit).map((r) => r.rawUnitName)),
  );
  const newSupplierNames = Array.from(
    new Set(validRows.filter((r) => r.isNewSupplier).map((r) => r.rawSupplierName)),
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setMessage('');
    setCurrentPage(1);
    setFilterStatus('all');
    setIsReadingFile(true);
    setProgressPercent(10);
    setProgressLabel(`Reading file ${file.name}... 10%`);

    const lowerName = file.name.toLowerCase();
    let matrix: any[][] = [];

    try {
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        setProgressPercent(25);
        setProgressLabel('Loading Excel parser... 25%');
        let XLSX: any;
        try {
          XLSX = await loadXLSX();
        } catch {
          throw new Error('OFFLINE_EXCEL_FAILED');
        }

        setProgressPercent(50);
        setProgressLabel('Reading workbook contents... 50%');
        const arrayBuffer = await file.arrayBuffer();

        setProgressPercent(75);
        setProgressLabel('Parsing sheets into data grid... 75%');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      } else {
        setProgressPercent(50);
        setProgressLabel('Reading CSV text content... 50%');
        const csvContent = await file.text();
        matrix = parseCsv(csvContent);
      }

      setProgressPercent(90);
      setProgressLabel('Validating & building import rows... 90%');
      await new Promise((r) => setTimeout(r, 60));

      const parsedRows = buildImportRowsFromMatrix(matrix, categories, brands, units, suppliers);
      setRows(parsedRows);

      setProgressPercent(100);
      setProgressLabel('File loaded 100%');
      await new Promise((r) => setTimeout(r, 120));

      setMessage(parsedRows.length ? '' : 'No product rows found in this file.');
    } catch (err: any) {
      if (err?.message === 'OFFLINE_EXCEL_FAILED') {
        setRows([]);
        setMessage('Offline mode: Please save or export your Excel file as CSV (.csv) before uploading.');
      } else {
        try {
          const csvContent = await file.text();
          matrix = parseCsv(csvContent);
          const parsedRows = buildImportRowsFromMatrix(matrix, categories, brands, units, suppliers);
          setRows(parsedRows);
          setMessage(parsedRows.length ? '' : 'No product rows found in this file.');
        } catch (fallbackErr) {
          console.error('File parsing error:', err, fallbackErr);
          setRows([]);
          setMessage('Unable to parse file. Please use CSV format or download the sample template.');
        }
      }
    } finally {
      setIsReadingFile(false);
      setProgressPercent(0);
      setProgressLabel('');
    }
  };

  const handleDownloadTemplate = () => {
    const csvHeader = SAMPLE_HEADERS.join(',');
    const sampleRow1 = 'P001,123456789,Coca Cola 1L,Refreshing Cold Beverage,Beverages,Coca Cola,Bottle,ABC Traders,250,350,330,20,5,8,0,,1.0,false,true';
    const sampleRow2 = 'P002,987654321,Lays Potato Chips 50g,Crunchy salted chips,Snacks,Lays,Packet,Global Foods,100,150,140,50,10,0,0,,0.05,false,true';
    const csvContent = '\uFEFF' + `${csvHeader}\n${sampleRow1}\n${sampleRow2}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!validRows.length) {
      setMessage('Choose a valid CSV or Excel file before importing.');
      return;
    }

    setIsImporting(true);
    setProgressPercent(1);
    setProgressLabel('Preparing import & master records... 1%');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeBrands = Array.isArray(brands) ? brands : [];
    const safeUnits = Array.isArray(units) ? units : [];
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];

    const categoryMap = new Map<string, number>(
      safeCategories.filter((c) => c && c.name).map((c) => [String(c.name).toLowerCase(), c.id]),
    );
    const brandMap = new Map<string, number>(
      safeBrands.filter((b) => b && b.name).map((b) => [String(b.name).toLowerCase(), b.id]),
    );
    const unitMap = new Map<string, number>(
      safeUnits.filter((u) => u && u.name).map((u) => [String(u.name).toLowerCase(), u.id]),
    );
    const supplierMap = new Map<string, number>(
      safeSuppliers.filter((s) => s && s.name).map((s) => [String(s.name).toLowerCase(), s.id]),
    );

    const createdCategoriesList: PosCategory[] = [];
    const createdBrandsList: PosBrand[] = [];
    const createdUnitsList: PosUnit[] = [];
    const createdSuppliersList: PosSupplier[] = [];

    const totalMasterItems =
      newCategoryNames.length + newBrandNames.length + newUnitNames.length + newSupplierNames.length;
    const totalSteps = totalMasterItems + validRows.length;
    let completedSteps = 0;

    const updateProgress = async (label: string) => {
      completedSteps += 1;
      const pct = Math.min(100, Math.round((completedSteps / totalSteps) * 100));
      setProgressPercent(pct);
      setProgressLabel(`${label} ${pct}%`);
    };

    // Auto-create missing categories
    for (const catName of newCategoryNames) {
      try {
        const created = await createCategory({
          name: catName,
          description: 'Auto-created during product import',
          status: true,
        });
        categoryMap.set(catName.toLowerCase(), created.id);
        createdCategoriesList.push(created);
      } catch (err) {
        console.warn(`Failed to auto-create category "${catName}":`, err);
      }
      await updateProgress(`Creating category "${catName}"...`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Auto-create missing brands
    for (const brandName of newBrandNames) {
      try {
        const created = await createBrand(brandName);
        brandMap.set(brandName.toLowerCase(), created.id);
        createdBrandsList.push(created);
      } catch (err) {
        console.warn(`Failed to auto-create brand "${brandName}":`, err);
      }
      await updateProgress(`Creating brand "${brandName}"...`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Auto-create missing units
    for (const unitName of newUnitNames) {
      try {
        const created = await createUnit(unitName);
        unitMap.set(unitName.toLowerCase(), created.id);
        createdUnitsList.push(created);
      } catch (err) {
        console.warn(`Failed to auto-create unit "${unitName}":`, err);
      }
      await updateProgress(`Creating unit "${unitName}"...`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Auto-create missing suppliers
    for (const supplierName of newSupplierNames) {
      try {
        const created = await createSupplier(supplierName);
        supplierMap.set(supplierName.toLowerCase(), created.id);
        createdSuppliersList.push(created);
      } catch (err) {
        console.warn(`Failed to auto-create supplier "${supplierName}":`, err);
      }
      await updateProgress(`Creating supplier "${supplierName}"...`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const importedProducts: PosProduct[] = [];
    const failedRows: number[] = [];

    for (let index = 0; index < validRows.length; index += 1) {
      const row = validRows[index];
      try {
        const finalCategoryId =
          categoryMap.get(row.rawCategoryName.toLowerCase()) ||
          (Number(row.rawCategoryName) || row.payload.category_id);
        const finalBrandId =
          brandMap.get(row.rawBrandName.toLowerCase()) ||
          (Number(row.rawBrandName) || row.payload.brand_id);
        const finalUnitId =
          unitMap.get(row.rawUnitName.toLowerCase()) ||
          (Number(row.rawUnitName) || row.payload.unit_id);
        const finalSupplierId =
          supplierMap.get(row.rawSupplierName.toLowerCase()) ||
          (Number(row.rawSupplierName) || row.payload.supplier_id);

        const finalPayload: CreateProductPayload = {
          ...row.payload,
          category_id: finalCategoryId,
          brand_id: finalBrandId,
          unit_id: finalUnitId,
          supplier_id: finalSupplierId,
        };

        const product = await createProduct(finalPayload);
        importedProducts.push(product);
      } catch {
        failedRows.push(row.rowNumber);
      }

      await updateProgress(`Importing product ${index + 1} of ${validRows.length}...`);

      if (validRows.length <= 10 || (index + 1) % 5 === 0 || index === validRows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    setIsImporting(false);
    setProgressPercent(100);
    setProgressLabel('Import completed 100%');

    if (
      importedProducts.length ||
      createdCategoriesList.length ||
      createdBrandsList.length ||
      createdUnitsList.length ||
      createdSuppliersList.length
    ) {
      onImported(
        importedProducts,
        createdCategoriesList,
        createdBrandsList,
        createdUnitsList,
        createdSuppliersList,
      );
    }

    const createdSummary: string[] = [];
    if (createdCategoriesList.length) createdSummary.push(`${createdCategoriesList.length} categories`);
    if (createdBrandsList.length) createdSummary.push(`${createdBrandsList.length} brands`);
    if (createdUnitsList.length) createdSummary.push(`${createdUnitsList.length} units`);
    if (createdSuppliersList.length) createdSummary.push(`${createdSuppliersList.length} suppliers`);

    const masterMsg = createdSummary.length ? ` (Auto-created: ${createdSummary.join(', ')})` : '';

    setMessage(
      failedRows.length
        ? `${importedProducts.length} products imported${masterMsg}. Failed rows: ${failedRows.join(', ')}.`
        : `${importedProducts.length} products imported successfully${masterMsg}.`,
    );
  };

  const newMasterSummary = [
    newCategoryNames.length && `${newCategoryNames.length} Category(ies)`,
    newBrandNames.length && `${newBrandNames.length} Brand(s)`,
    newUnitNames.length && `${newUnitNames.length} Unit(s)`,
    newSupplierNames.length && `${newSupplierNames.length} Supplier(s)`,
  ].filter(Boolean);

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Import products</h2>
            <p style={styles.subtitle}>Upload an Excel (.xlsx / .xls) or CSV spreadsheet file to create products in bulk.</p>
          </div>
          <button type="button" style={styles.iconBtn} onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.uploadBox}>
            <i className="ti ti-file-spreadsheet" style={styles.uploadIcon} aria-hidden="true" />
            <strong style={{ color: 'var(--app-text-strong, #101828)', fontSize: 16, fontWeight: 700 }}>
              Select Excel or CSV File
            </strong>
            <span style={{ color: 'var(--app-muted, #667085)', fontSize: 12 }}>
              Supports .xlsx, .xls, and .csv with category, brand, and unit auto-creation.
            </span>
            <input
              style={styles.fileInput}
              type="file"
              disabled={isReadingFile || isImporting}
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={handleFileChange}
            />
            {fileName && (
              <div
                style={{
                  background: 'var(--app-accent-soft, rgba(39, 174, 79, 0.15))',
                  color: 'var(--app-accent, #27AE4F)',
                  border: '1px solid var(--app-accent, #27AE4F)',
                  padding: '6px 14px',
                  borderRadius: 16,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <i className="ti ti-file-check" aria-hidden="true" />
                {fileName}
              </div>
            )}
          </div>

          <div style={styles.importSide}>
            <button type="button" style={styles.secondaryBtn} onClick={handleDownloadTemplate}>
              <i className="ti ti-download" aria-hidden="true" />
              Download template
            </button>
            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <strong style={styles.statVal}>{rows.length}</strong>
                <small style={styles.statLbl}>Rows</small>
              </div>
              <div style={styles.statCard}>
                <strong style={{ ...styles.statVal, color: 'var(--app-accent, #27AE4F)' }}>{validRows.length}</strong>
                <small style={styles.statLbl}>Valid</small>
              </div>
              <div style={styles.statCard}>
                <strong style={{ ...styles.statVal, color: invalidRows > 0 ? 'var(--app-danger, #b42318)' : 'var(--app-muted, #667085)' }}>
                  {invalidRows}
                </strong>
                <small style={styles.statLbl}>Errors</small>
              </div>
            </div>
          </div>
        </div>

        {(isReadingFile || isImporting) && (
          <div
            style={{
              margin: '0 18px 12px',
              padding: '12px 16px',
              borderRadius: 10,
              background: 'var(--app-surface-soft, #252932)',
              border: '1px solid var(--app-border, #353b46)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--app-accent, #32c862)', fontWeight: 700, fontSize: 13 }}>
                <i className="ti ti-loader spin" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
                <span>{progressLabel || (isReadingFile ? 'Reading file...' : 'Importing products...')}</span>
              </div>
              <strong style={{ color: 'var(--app-accent, #32c862)', fontSize: 14, fontWeight: 800 }}>
                {progressPercent}%
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: 8,
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #32c862, #27ae4f)',
                  borderRadius: 4,
                  transition: 'width 0.2s ease-in-out',
                }}
              />
            </div>
          </div>
        )}

        {newMasterSummary.length > 0 && (
          <div
            style={{
              margin: '0 18px 10px',
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#2563EB',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i className="ti ti-sparkles" aria-hidden="true" />
            <span>
              New master records will be automatically created during import: <strong>{newMasterSummary.join(', ')}</strong>
            </span>
          </div>
        )}

        {message && <div style={styles.message}>{message}</div>}

        {rows.length > 0 && (
          <div
            style={{
              padding: '8px 18px',
              background: 'var(--app-surface-soft, #252932)',
              borderTop: '1px solid var(--app-border-soft, #2f3540)',
              borderBottom: '1px solid var(--app-border-soft, #2f3540)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-muted, #a5adba)', marginRight: 4 }}>
                Filter:
              </span>
              <button
                type="button"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--app-border, #353b46)',
                  background: filterStatus === 'all' ? 'var(--app-accent, #32c862)' : 'var(--app-surface, #202329)',
                  color: filterStatus === 'all' ? '#ffffff' : 'var(--app-text, #f2f4f7)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setFilterStatus('all');
                  setCurrentPage(1);
                }}
              >
                All ({rows.length})
              </button>
              <button
                type="button"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--app-border, #353b46)',
                  background: filterStatus === 'valid' ? 'var(--app-accent, #32c862)' : 'var(--app-surface, #202329)',
                  color: filterStatus === 'valid' ? '#ffffff' : 'var(--app-text, #f2f4f7)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setFilterStatus('valid');
                  setCurrentPage(1);
                }}
              >
                Valid ({validRows.length})
              </button>
              {invalidRows > 0 && (
                <button
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--app-border, #353b46)',
                    background: filterStatus === 'errors' ? 'var(--app-danger, #b42318)' : 'var(--app-surface, #202329)',
                    color: filterStatus === 'errors' ? '#ffffff' : 'var(--app-danger, #ff8585)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setFilterStatus('errors');
                    setCurrentPage(1);
                  }}
                >
                  Errors ({invalidRows})
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--app-text, #f2f4f7)' }}>
                Showing <strong>{filteredRows.length > 0 ? (activePage - 1) * (pageSize === 'all' ? filteredRows.length : (pageSize as number)) + 1 : 0}</strong> - <strong>{pageSize === 'all' ? filteredRows.length : Math.min(activePage * (pageSize as number), filteredRows.length)}</strong> of <strong>{filteredRows.length}</strong>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--app-muted, #a5adba)' }}>Show:</span>
                <select
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--app-border, #353b46)',
                    background: 'var(--app-input-bg, #1b1e24)',
                    color: 'var(--app-text, #f2f4f7)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={250}>250 per page</option>
                  <option value={500}>500 per page</option>
                  <option value="all">Show All ({filteredRows.length})</option>
                </select>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    disabled={activePage <= 1}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--app-border, #353b46)',
                      background: 'var(--app-surface, #202329)',
                      color: 'var(--app-text, #f2f4f7)',
                      fontSize: 12,
                      cursor: activePage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: activePage <= 1 ? 0.5 : 1,
                    }}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--app-muted, #a5adba)', padding: '0 4px' }}>
                    {activePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={activePage >= totalPages}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--app-border, #353b46)',
                      background: 'var(--app-surface, #202329)',
                      color: 'var(--app-text, #f2f4f7)',
                      fontSize: 12,
                      cursor: activePage >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: activePage >= totalPages ? 0.5 : 1,
                    }}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={styles.previewWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  'Row',
                  'Code',
                  'Barcode',
                  'Product',
                  'Category',
                  'Brand',
                  'Supplier',
                  'Unit',
                  'Cost',
                  'Price',
                  'Stock',
                  'Min Stock',
                  'Tax %',
                  'Discount %',
                  'Weighted',
                  'Validation',
                ].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, index) => (
                <tr key={row.rowNumber} style={{ ...styles.tr, ...(index % 2 ? styles.trAlt : {}) }}>
                  <td style={styles.td}>{row.rowNumber}</td>
                  <td style={styles.td}>{row.payload.product_code}</td>
                  <td style={styles.td}>{row.payload.barcode || '-'}</td>
                  <td style={styles.td}>{row.payload.name}</td>
                  <td style={styles.td}>
                    {row.rawCategoryName || 'Default'}
                    {row.isNewCategory && <span style={styles.newBadge}>+New</span>}
                  </td>
                  <td style={styles.td}>
                    {row.rawBrandName || 'Default'}
                    {row.isNewBrand && <span style={styles.newBadge}>+New</span>}
                  </td>
                  <td style={styles.td}>
                    {row.rawSupplierName || 'Default'}
                    {row.isNewSupplier && <span style={styles.newBadge}>+New</span>}
                  </td>
                  <td style={styles.td}>
                    {row.rawUnitName || 'Default'}
                    {row.isNewUnit && <span style={styles.newBadge}>+New</span>}
                  </td>
                  <td style={styles.td}>{row.payload.cost_price}</td>
                  <td style={styles.td}>{row.payload.selling_price}</td>
                  <td style={styles.td}>{row.payload.stock_quantity}</td>
                  <td style={styles.td}>{row.payload.minimum_stock}</td>
                  <td style={styles.td}>{row.payload.tax_rate}%</td>
                  <td style={styles.td}>{row.payload.discount_rate}%</td>
                  <td style={styles.td}>{row.payload.is_weighted ? 'Yes' : 'No'}</td>
                  <td style={styles.td}>
                    {row.errors.length ? (
                      <span style={styles.errorBadge}>{row.errors.join(', ')}</span>
                    ) : (
                      <span style={styles.okBadge}>Ready</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td style={styles.emptyCell} colSpan={16}>
                    Upload a CSV or Excel file to preview product rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryBtn} onClick={onClose} disabled={isImporting || isReadingFile}>
            Close
          </button>
          <button
            type="button"
            style={{
              ...styles.primaryBtn,
              opacity: isImporting || isReadingFile || !validRows.length ? 0.65 : 1,
              cursor: isImporting || isReadingFile || !validRows.length ? 'not-allowed' : 'pointer',
            }}
            onClick={handleImport}
            disabled={isImporting || isReadingFile || !validRows.length}
          >
            {isImporting ? `Importing... (${progressPercent}%)` : isReadingFile ? `Reading file... (${progressPercent}%)` : `Import ${validRows.length} products`}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: 1320,
    maxWidth: '96vw',
    maxHeight: 'calc(100vh - 48px)',
    background: 'var(--app-surface, #202329)',
    color: 'var(--app-text, #f2f4f7)',
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
  },
  header: {
    padding: '18px 24px',
    borderBottom: '1px solid var(--app-border-soft, #2f3540)',
    background: 'var(--app-surface-soft, #252932)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    color: 'var(--app-text-strong, #ffffff)',
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    color: 'var(--app-muted, #a5adba)',
    fontSize: 13,
    marginTop: 3,
    margin: 0,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--app-border, #353b46)',
    background: 'var(--app-surface-soft, #252932)',
    color: 'var(--app-text, #f2f4f7)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 240px',
    gap: 14,
    padding: 20,
    background: 'var(--app-surface, #202329)',
  },
  uploadBox: {
    border: '2px dashed var(--app-accent, #32c862)',
    borderRadius: 12,
    padding: 24,
    display: 'grid',
    justifyItems: 'center',
    gap: 8,
    textAlign: 'center',
    background: 'var(--app-accent-soft, rgba(50, 200, 98, 0.14))',
    boxShadow: '0 4px 16px rgba(35, 193, 107, 0.10)',
    position: 'relative',
    transition: 'all 0.25s ease',
  },
  uploadIcon: {
    fontSize: 42,
    color: 'var(--app-accent, #32c862)',
  },
  fileInput: {
    width: '100%',
    maxWidth: 340,
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    padding: 10,
    background: 'var(--app-input-bg, #1b1e24)',
    color: 'var(--app-input-text, #f2f4f7)',
  },
  importSide: {
    display: 'grid',
    alignContent: 'start',
    gap: 12,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statCard: {
    background: 'var(--app-surface-soft, #252932)',
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    padding: '12px 8px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    color: 'var(--app-text-strong, #ffffff)',
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  statLbl: {
    color: 'var(--app-muted, #a5adba)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  message: {
    margin: '0 18px 12px',
    borderRadius: 8,
    padding: '10px 14px',
    background: 'var(--app-surface-soft, #252932)',
    border: '1px solid var(--app-border, #353b46)',
    color: 'var(--app-text-strong, #ffffff)',
    fontSize: 13,
  },
  previewWrap: {
    overflow: 'auto',
    padding: '0 18px 18px',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 6px',
    minWidth: 720,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderTop: '1px solid var(--app-border, #353b46)',
    borderBottom: '1px solid var(--app-border, #353b46)',
    background: '#000000',
    color: 'var(--app-accent, #32c862)',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  tr: {
    background: 'var(--app-surface, #202329)',
    boxShadow: '0 1px 0 var(--app-border-soft, #2f3540)',
  },
  trAlt: {
    background: 'var(--app-surface-soft, #252932)',
  },
  td: {
    padding: '12px 14px',
    borderTop: '1px solid var(--app-border-soft, #2f3540)',
    borderBottom: '1px solid var(--app-border-soft, #2f3540)',
    color: 'var(--app-text, #f2f4f7)',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  newBadge: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 800,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'rgba(59, 130, 246, 0.15)',
    color: '#2563EB',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  okBadge: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '3px 9px',
    background: 'rgba(50, 200, 98, 0.15)',
    color: 'var(--app-accent, #32c862)',
    fontSize: 11,
    fontWeight: 800,
    border: '1px solid rgba(50, 200, 98, 0.3)',
  },
  errorBadge: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '3px 9px',
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--app-danger, #ff8585)',
    fontSize: 11,
    fontWeight: 800,
    border: '1px solid rgba(239, 68, 68, 0.3)',
    whiteSpace: 'normal',
  },
  emptyCell: {
    padding: '32px 12px',
    textAlign: 'center',
    color: 'var(--app-muted, #a5adba)',
    fontSize: 13,
  },
  footer: {
    padding: '16px 22px',
    borderTop: '1px solid var(--app-border-soft, #2f3540)',
    background: 'var(--app-surface-soft, #252932)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    background: 'var(--app-button-bg, #252932)',
    color: 'var(--app-button-text, #e4e7ec)',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    border: 'none',
    borderRadius: 8,
    background: 'var(--app-accent, #32c862)',
    color: '#FFFFFF',
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(50, 200, 98, 0.25)',
  },
};

export default ProductImportModal;
