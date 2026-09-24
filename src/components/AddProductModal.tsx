import React, { useEffect, useState } from 'react';
import {
  createProduct,
  updateProduct,
  createCategory,
  createPosMasterRecord,
  type CreateProductPayload,
  type PosBrand,
  type PosCategory,
  type PosProduct,
  type PosSupplier,
  type PosUnit,
} from '../hooks/pos/pos_controller';
import API_RESOURCES from '../api/api_resources';

interface AddProductModalProps {
  onClose: () => void;
  onSaved: (product: PosProduct) => void;
  product?: PosProduct | null;
  categories: PosCategory[];
  brands: PosBrand[];
  units: PosUnit[];
  suppliers?: PosSupplier[];
  onCategoryCreated?: (category: PosCategory) => void;
  onBrandCreated?: (brand: PosBrand) => void;
  onUnitCreated?: (unit: PosUnit) => void;
  onSupplierCreated?: (supplier: PosSupplier) => void;
}

const initialForm: CreateProductPayload = {
  product_code: '',
  barcode: '',
  name: '',
  description: '',
  category_id: 0,
  brand_id: 0,
  unit_id: 0,
  cost_price: 0,
  selling_price: 0,
  wholesale_price: 0,
  stock_quantity: 0,
  minimum_stock: 0,
  tax_rate: 0,
  discount_rate: 0,
  image: '',
  weight: 0,
  is_weighted: false,
  status: true,
};

const generateProductCode = () => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `PRD-${Date.now().toString().slice(-4)}${randomNum}`;
};

const generateRandomBarcode = () => {
  const randomNum = Math.floor(100000000000 + Math.random() * 900000000000);
  return `${randomNum}`;
};


const getInitialForm = (
  product: PosProduct | null | undefined,
  categories: PosCategory[],
  brands: PosBrand[],
  units: PosUnit[],
): CreateProductPayload => {
  if (!product) {
    return {
      ...initialForm,
      product_code: generateProductCode(),
      category_id: 0,
      brand_id: 0,
      unit_id: 0,
    };
  }

  return {
    ...initialForm,
    product_code: product.sku || generateProductCode(),
    barcode: product.barcode,
    name: product.name,
    category_id: product.categoryId ?? categories[0]?.id ?? 1,
    brand_id: product.brandId ?? brands[0]?.id ?? 1,
    unit_id: product.unitId ?? units[0]?.id ?? 1,
    unit_name: product.unit_name ?? product.unit ?? 'kg',
    selling_price: product.price,
    wholesale_price: product.price,
    stock_quantity: product.stock,
    minimum_stock: product.minimumStock,
    tax_rate: product.taxRate,
    is_weighted: Boolean(product.is_weighted),
    status: product.status !== 'Inactive',
  };
};

const AddProductModal: React.FC<AddProductModalProps> = ({
  onClose,
  onSaved,
  product,
  categories,
  brands,
  units,
  suppliers = [],
  onCategoryCreated,
  onBrandCreated,
  onUnitCreated,
  onSupplierCreated,
}) => {
  const [form, setForm] = useState<CreateProductPayload>(() => getInitialForm(product, categories, brands, units));
  const [localCategories, setLocalCategories] = useState<PosCategory[]>(categories);
  const [localBrands, setLocalBrands] = useState<PosBrand[]>(brands);
  const [localUnits, setLocalUnits] = useState<PosUnit[]>(units);
  const [localSuppliers, setLocalSuppliers] = useState<PosSupplier[]>(suppliers);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = Boolean(product);

  const [quickAddType, setQuickAddType] = useState<'category' | 'brand' | 'unit' | 'supplier' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddShortName, setQuickAddShortName] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  useEffect(() => {
    setLocalBrands(brands);
  }, [brands]);

  useEffect(() => {
    setLocalUnits(units);
  }, [units]);

  useEffect(() => {
    setLocalSuppliers(suppliers);
  }, [suppliers]);

  const updateField = <K extends keyof CreateProductPayload>(
    key: K,
    value: CreateProductPayload[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    const payload: CreateProductPayload = {
      ...form,
      product_code: form.product_code.trim() || generateProductCode(),
      category_id: form.category_id || localCategories[0]?.id || 1,
      brand_id: form.brand_id || localBrands[0]?.id || 1,
      unit_id: form.unit_id || localUnits[0]?.id || 1,
    };

    setIsSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const savedProduct = product
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);

      if (form.supplier_id) {
        try {
          await createPosMasterRecord(
            API_RESOURCES.PRODUCT_SUPPLIERS,
            {
              product_id: savedProduct.id,
              supplier_id: form.supplier_id,
              supplier_price: form.cost_price || form.selling_price,
            },
            'productSupplier',
          );
        } catch {}
      }

      onSaved(savedProduct);
      onClose();
    } catch {
      setError(`Unable to ${isEditMode ? 'update' : 'create'} product. Please check connection.`);
    } finally {
      setIsSaving(false);
    }
  };



  const handleQuickAddSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim()) {
      setQuickAddError('Name is required.');
      return;
    }
    setIsQuickAdding(true);
    setQuickAddError('');

    try {
      if (quickAddType === 'category') {
        const created = await createCategory({ name: quickAddName.trim(), description: '', status: true });
        setLocalCategories((prev) => [created, ...prev]);
        updateField('category_id', created.id);
        if (onCategoryCreated) onCategoryCreated(created);
      } else if (quickAddType === 'brand') {
        const createdRecord = await createPosMasterRecord(API_RESOURCES.BRANDS, { name: quickAddName.trim(), description: '', status: true }, 'brand');
        const createdBrand: PosBrand = { id: Number(createdRecord.id || Date.now()), name: String(createdRecord.name || quickAddName.trim()), description: '', status: true };
        setLocalBrands((prev) => [createdBrand, ...prev]);
        updateField('brand_id', createdBrand.id);
        if (onBrandCreated) onBrandCreated(createdBrand);
      } else if (quickAddType === 'unit') {
        const createdRecord = await createPosMasterRecord(API_RESOURCES.UNITS, { name: quickAddName.trim(), short_name: quickAddShortName.trim() || quickAddName.trim().slice(0, 3).toLowerCase(), status: true }, 'unit');
        const createdUnit: PosUnit = { id: Number(createdRecord.id || Date.now()), name: String(createdRecord.name || quickAddName.trim()), shortName: String(createdRecord.short_name || quickAddShortName.trim()), status: true };
        setLocalUnits((prev) => [createdUnit, ...prev]);
        updateField('unit_id', createdUnit.id);
        if (onUnitCreated) onUnitCreated(createdUnit);
      } else if (quickAddType === 'supplier') {
        const createdRecord = await createPosMasterRecord(API_RESOURCES.SUPPLIERS, { name: quickAddName.trim(), contact_person: '', phone: '', email: '', status: true }, 'supplier');
        const createdSupplier: PosSupplier = { id: Number(createdRecord.id || Date.now()), name: String(createdRecord.name || quickAddName.trim()), contactPerson: '', phone: '', email: '', address: '', status: true };
        setLocalSuppliers((prev) => [createdSupplier, ...prev]);
        updateField('supplier_id', createdSupplier.id);
        if (onSupplierCreated) onSupplierCreated(createdSupplier);
      }
      setQuickAddType(null);
      setQuickAddName('');
      setQuickAddShortName('');
    } catch {
      setQuickAddError('Unable to create item. Please check backend connection.');
    } finally {
      setIsQuickAdding(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <form style={styles.modal} onSubmit={handleSubmit}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{isEditMode ? 'Edit product' : 'Add product'}</h2>
            <p style={styles.subtitle}>
              {isEditMode ? 'Update product details in the POS catalog.' : 'Create a sellable product for the POS catalog.'}
            </p>
          </div>
          <button type="button" style={styles.iconBtn} onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div style={styles.body}>
          {successMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(46, 204, 113, 0.15)', color: '#27ae60', fontSize: 13, fontWeight: 600, gridColumn: '1 / -1' }}>
              ✓ {successMsg}
            </div>
          )}

          <div style={styles.field}>
            <span style={styles.label}>Barcode</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                value={form.barcode}
                onChange={(event) => updateField('barcode', event.target.value)}
                placeholder="123456789"
              />
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: '1px solid var(--app-border, #d0d5dd)',
                  background: 'var(--app-bg-secondary, #f9fafb)',
                  color: 'var(--app-text, #344054)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Generate random barcode"
                onClick={() => updateField('barcode', generateRandomBarcode())}
              >
                <i className="ti ti-barcode" aria-hidden="true" style={{ fontSize: 16 }} />
                Generate
              </button>
            </div>
          </div>


          <label style={styles.fieldWide}>
            <span style={styles.label}>Product name</span>
            <input
              style={styles.input}
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Coca Cola 1L"
            />
          </label>

          <SelectField
            label="Category"
            value={form.category_id}
            placeholderLabel="Select Category"
            options={localCategories.map((category) => ({ value: category.id, label: category.name }))}
            fallbackLabel="Select Category"
            onChange={(value) => updateField('category_id', value)}
            onAddClick={() => {
              setQuickAddType('category');
              setQuickAddName('');
              setQuickAddError('');
            }}
          />
          <SelectField
            label="Brand"
            value={form.brand_id}
            placeholderLabel="Select Brand"
            options={localBrands.map((brand) => ({ value: brand.id, label: brand.name }))}
            fallbackLabel="Select Brand"
            onChange={(value) => updateField('brand_id', value)}
            onAddClick={() => {
              setQuickAddType('brand');
              setQuickAddName('');
              setQuickAddError('');
            }}
          />
          <SelectField
            label="Unit"
            value={form.unit_id}
            placeholderLabel="Select Unit"
            options={localUnits.map((unit) => ({
              value: unit.id,
              label: unit.shortName ? `${unit.name} (${unit.shortName})` : unit.name,
            }))}
            fallbackLabel="Select Unit"
            onChange={(value) => updateField('unit_id', value)}
            onAddClick={() => {
              setQuickAddType('unit');
              setQuickAddName('');
              setQuickAddShortName('');
              setQuickAddError('');
            }}
          />
          <SelectField
            label="Supplier"
            value={form.supplier_id || 0}
            placeholderLabel="Select Supplier (Optional)"
            options={localSuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
            fallbackLabel="Select Supplier"
            onChange={(value) => updateField('supplier_id', value)}
            onAddClick={() => {
              setQuickAddType('supplier');
              setQuickAddName('');
              setQuickAddError('');
            }}
          />
          <NumberField label="Cost price" value={form.cost_price} onChange={(value) => updateField('cost_price', value)} />
          <NumberField label="Selling price" value={form.selling_price} onChange={(value) => updateField('selling_price', value)} />
          <NumberField label="Wholesale price" value={form.wholesale_price} onChange={(value) => updateField('wholesale_price', value)} />
          <NumberField label="Stock quantity" value={form.stock_quantity} onChange={(value) => updateField('stock_quantity', value)} />
          <NumberField label="Minimum stock" value={form.minimum_stock} onChange={(value) => updateField('minimum_stock', value)} />
          <NumberField label="Tax rate" value={form.tax_rate} onChange={(value) => updateField('tax_rate', value)} />
          <NumberField label="Discount rate" value={form.discount_rate} onChange={(value) => updateField('discount_rate', value)} />

          <label style={styles.checkField}>
            <input
              type="checkbox"
              checked={form.is_weighted}
              onChange={(event) => updateField('is_weighted', event.target.checked)}
            />
            <b>Sold by Weight?</b> (Item is sold by weight e.g. kg, g, lb)
          </label>

          {form.is_weighted && (
            <label style={styles.field}>
              <span style={styles.label}>Unit of Measure (unit_name)</span>
              <select
                style={styles.input}
                value={form.unit_name || 'kg'}
                onChange={(event) => updateField('unit_name', event.target.value)}
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="g">Grams (g)</option>
                <option value="lb">Pounds (lb)</option>
                <option value="pcs">Pieces (pcs)</option>
              </select>
            </label>
          )}

          <label style={styles.checkField}>
            <input
              type="checkbox"
              checked={form.status}
              onChange={(event) => updateField('status', event.target.checked)}
            />
            Active
          </label>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={styles.primaryBtn} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEditMode ? 'Update product' : 'Create product'}
          </button>
        </div>
      </form>

      {/* Quick Add Inline Modal Overlay */}
      {quickAddType && (
        <div style={styles.quickAddOverlay} role="dialog" aria-modal="true">
          <form style={styles.quickAddCard} onSubmit={handleQuickAddSave}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--app-text-strong, #101828)' }}>
                Add New {quickAddType === 'category' ? 'Category' : quickAddType === 'brand' ? 'Brand' : quickAddType === 'unit' ? 'Unit' : 'Supplier'}
              </h4>
              <button
                type="button"
                style={styles.iconBtn}
                onClick={() => {
                  setQuickAddType(null);
                  setQuickAddError('');
                }}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {quickAddError && (
              <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--app-danger, #b42318)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                {quickAddError}
              </div>
            )}

            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #667085)' }}>
                {quickAddType === 'category' ? 'Category Name' : quickAddType === 'brand' ? 'Brand Name' : 'Unit Name'}
              </span>
              <input
                style={styles.input}
                autoFocus
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder={`Enter new ${quickAddType}...`}
              />
            </label>

            {quickAddType === 'unit' && (
              <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #667085)' }}>
                  Short Name / Abbreviation (e.g. kg, g, pcs, L)
                </span>
                <input
                  style={styles.input}
                  value={quickAddShortName}
                  onChange={(e) => setQuickAddShortName(e.target.value)}
                  placeholder="kg"
                />
              </label>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => {
                  setQuickAddType(null);
                  setQuickAddError('');
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.primaryBtn}
                disabled={isQuickAdding}
              >
                {isQuickAdding ? 'Saving...' : 'Save & Select'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({ label, value, onChange }) => (
  <label style={styles.field}>
    <span style={styles.label}>{label}</span>
    <input
      style={styles.input}
      type="number"
      step="any"
      min={0}
      placeholder="0"
      value={value === 0 ? '' : value}
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        const val = event.target.value;
        onChange(val === '' ? 0 : Number(val) || 0);
      }}
    />
  </label>
);

interface SelectFieldProps {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  fallbackLabel: string;
  placeholderLabel?: string;
  onChange: (value: number) => void;
  onAddClick?: () => void;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  fallbackLabel,
  placeholderLabel = 'Select One',
  onChange,
  onAddClick,
}) => {
  return (
    <div style={styles.field}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={styles.label}>{label}</span>
        {onAddClick && (
          <button
            type="button"
            style={styles.addInlineBtn}
            onClick={onAddClick}
            title={`Add new ${label.toLowerCase()}`}
          >
            <i className="ti ti-plus" style={{ fontSize: 11 }} aria-hidden="true" />
            <span>Add</span>
          </button>
        )}
      </div>
      <select
        style={styles.input}
        value={value || 0}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      >
        <option value={0} disabled style={{ color: 'var(--app-muted)' }}>
          {placeholderLabel}
        </option>
        {options.length > 0 ? (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option value={1}>{fallbackLabel}</option>
        )}
      </select>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    background: 'rgba(0, 0, 0, 0.68)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  modal: {
    width: '28vw',
    minWidth: 400,
    maxWidth: '95vw',
    height: '100vh',
    maxHeight: '100vh',
    background: 'var(--app-surface, #202329)',
    color: 'var(--app-text, #f2f4f7)',
    borderRadius: '16px 0 0 16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.5)',
    borderLeft: '1px solid var(--app-border, #353b46)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--app-border-soft, #2f3540)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: 'var(--app-surface-soft, #252932)',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--app-text-strong, #ffffff)',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--app-muted, #a5adba)',
    marginTop: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--app-border, #353b46)',
    background: 'var(--app-surface-soft, #252932)',
    color: 'var(--app-text, #f2f4f7)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    flex: 1,
    background: 'var(--app-surface, #202329)',
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  fieldWide: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: 'var(--app-muted, #a5adba)',
    fontWeight: 600,
  },
  input: {
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    background: 'var(--app-input-bg, #1b1e24)',
    color: 'var(--app-input-text, #f2f4f7)',
  },
  textarea: {
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    minHeight: 74,
    background: 'var(--app-input-bg, #1b1e24)',
    color: 'var(--app-input-text, #f2f4f7)',
  },
  checkField: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--app-text, #f2f4f7)',
  },
  error: {
    margin: '0 24px 12px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: 'var(--app-danger, #ff8585)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  footer: {
    padding: '18px 24px',
    borderTop: '1px solid var(--app-border-soft, #2f3540)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    background: 'var(--app-surface-soft, #252932)',
  },
  secondaryBtn: {
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
    color: '#ffffff',
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addInlineBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 6,
    background: 'var(--app-accent-soft, rgba(50, 200, 98, 0.16))',
    color: 'var(--app-accent, #32c862)',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  quickAddOverlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10050,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  quickAddCard: {
    width: 'min(380px, 90vw)',
    background: 'var(--app-surface, #202329)',
    color: 'var(--app-text, #f2f4f7)',
    borderRadius: 12,
    border: '1px solid var(--app-border, #353b46)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
};

export default AddProductModal;
