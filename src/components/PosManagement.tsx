import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  createPosMasterRecord,
  deleteCategory,
  deleteCustomer,
  deleteProduct,
  exportProductsToExcel,
  deletePosMasterRecord,
  getAllCategories,
  getAllBrands,
  getAllCustomers,
  getAllProducts,
  getAllSuppliers,
  getAllUnits,
  getPosSales,
  getPosSettings,
  getPosMasterRecords,
  createCustomer,
  DEFAULT_POS_SETTINGS,
  updatePosDiscountRules,
  updatePosPaymentMethods,
  updatePosReceipt,
  updatePosMasterRecord,
  updateCustomer,
  updateProduct,
  updatePosSale,
  type PosMasterRecord,
  type PosBrand,
  type PosCategory,
  type PosProduct,
  type PosSalePayload,
  type PosSettingsPayload,
  type PosSupplier,
  type PosUnit,
} from '../hooks/pos/pos_controller';
import API_RESOURCES from '../api/api_resources';
import apiClient from '../api/clients';
import AddCategoryModal from './AddCategoryModal';
import AddCustomerModal, { type PosCustomer } from './AddCustomerModal';
import AddProductModal from './AddProductModal';
import ProductImportModal from './ProductImportModal';
import PosResourceModal, { type ResourceField } from './PosResourceModal';

type PosManagementSection =
  | 'products'
  | 'stock'
  | 'categories'
  | 'brands'
  | 'units'
  | 'suppliers'
  | 'productSuppliers'
  | 'stockMovements'
  | 'productBatches'
  | 'productImages'
  | 'taxes'
  | 'discounts'
  | 'productVariants'
  | 'customers'
  | 'salesBills'
  | 'reports'
  | 'settings';

type ManagedResourceId =
  | 'brands'
  | 'units'
  | 'suppliers'
  | 'productSuppliers'
  | 'stockMovements'
  | 'productBatches'
  | 'productImages'
  | 'taxes'
  | 'discounts'
  | 'productVariants';

interface ResourceMeta {
  id: ManagedResourceId;
  label: string;
  icon: string;
  endpoint: string;
  listKey: string;
  singleKey: string;
  description: string;
  columns: string[];
}

type StockMovementType = 'purchase' | 'sale' | 'adjustment' | 'return';
type ReportTab = 'summary' | 'sales' | 'cashiers' | 'products' | 'items' | 'inventory' | 'payments' | 'taxDiscounts' | 'credit';

const SECTIONS: Array<{ id: PosManagementSection; label: string; icon: string }> = [
  { id: 'products', label: 'Products', icon: 'ti-package' },
  { id: 'stock', label: 'Stock Management', icon: 'ti-packages' },
  { id: 'categories', label: 'Categories', icon: 'ti-category' },
  { id: 'brands', label: 'Brands', icon: 'ti-award' },
  { id: 'units', label: 'Units', icon: 'ti-ruler-measure' },
  { id: 'suppliers', label: 'Suppliers', icon: 'ti-truck-delivery' },
  { id: 'productSuppliers', label: 'Product suppliers', icon: 'ti-link' },
  { id: 'stockMovements', label: 'Stock movements', icon: 'ti-arrows-exchange' },
  { id: 'productBatches', label: 'Batches', icon: 'ti-layers-linked' },
  { id: 'productImages', label: 'Images', icon: 'ti-photo' },
  { id: 'taxes', label: 'Taxes', icon: 'ti-receipt-tax' },
  { id: 'discounts', label: 'Discounts', icon: 'ti-discount' },
  { id: 'productVariants', label: 'Variants', icon: 'ti-versions' },
  { id: 'customers', label: 'Customers', icon: 'ti-users' },
  { id: 'salesBills', label: 'Sales Bill Management', icon: 'ti-file-invoice' },
  { id: 'reports', label: 'Reports', icon: 'ti-report-analytics' },
  { id: 'settings', label: 'Settings', icon: 'ti-adjustments' },
];

const RESOURCE_META: Record<ManagedResourceId, ResourceMeta> = {
  brands: {
    id: 'brands',
    label: 'Brands',
    icon: 'ti-award',
    endpoint: API_RESOURCES.BRANDS,
    listKey: 'brands',
    singleKey: 'brand',
    description: 'Manage product brands used by the catalog.',
    columns: ['name', 'description', 'status'],
  },
  units: {
    id: 'units',
    label: 'Units',
    icon: 'ti-ruler-measure',
    endpoint: API_RESOURCES.UNITS,
    listKey: 'units',
    singleKey: 'unit',
    description: 'Manage sellable units such as piece, kilogram, and liter.',
    columns: ['name', 'short_name', 'status'],
  },
  suppliers: {
    id: 'suppliers',
    label: 'Suppliers',
    icon: 'ti-truck-delivery',
    endpoint: API_RESOURCES.SUPPLIERS,
    listKey: 'suppliers',
    singleKey: 'supplier',
    description: 'Manage supplier contact and purchasing details.',
    columns: ['name', 'contact_person', 'phone', 'email', 'status'],
  },
  productSuppliers: {
    id: 'productSuppliers',
    label: 'Product suppliers',
    icon: 'ti-link',
    endpoint: API_RESOURCES.PRODUCT_SUPPLIERS,
    listKey: 'productSuppliers',
    singleKey: 'productSupplier',
    description: 'Connect products to one or more suppliers with supplier pricing.',
    columns: ['product_id', 'supplier_id', 'supplier_price'],
  },
  stockMovements: {
    id: 'stockMovements',
    label: 'Stock movements',
    icon: 'ti-arrows-exchange',
    endpoint: API_RESOURCES.STOCK_MOVEMENTS,
    listKey: 'stockMovements',
    singleKey: 'stockMovement',
    description: 'Track purchases, sales, adjustments, returns, and stock corrections.',
    columns: ['product_id', 'type', 'quantity', 'reference_type', 'reference_id', 'remarks'],
  },
  productBatches: {
    id: 'productBatches',
    label: 'Product batches',
    icon: 'ti-layers-linked',
    endpoint: API_RESOURCES.PRODUCT_BATCHES,
    listKey: 'productBatches',
    singleKey: 'productBatch',
    description: 'Manage batch numbers, expiry dates, and batch quantities.',
    columns: ['product_id', 'batch_no', 'purchase_price', 'selling_price', 'quantity', 'expiry_date'],
  },
  productImages: {
    id: 'productImages',
    label: 'Product images',
    icon: 'ti-photo',
    endpoint: API_RESOURCES.PRODUCT_IMAGES,
    listKey: 'productImages',
    singleKey: 'productImage',
    description: 'Attach one or more images to products.',
    columns: ['product_id', 'image_path'],
  },
  taxes: {
    id: 'taxes',
    label: 'Taxes',
    icon: 'ti-receipt-tax',
    endpoint: API_RESOURCES.TAXES,
    listKey: 'taxes',
    singleKey: 'tax',
    description: 'Configure tax names and percentages.',
    columns: ['name', 'percentage', 'status'],
  },
  discounts: {
    id: 'discounts',
    label: 'Discounts',
    icon: 'ti-discount',
    endpoint: API_RESOURCES.DISCOUNTS,
    listKey: 'discounts',
    singleKey: 'discount',
    description: 'Configure fixed or percentage discounts by date range.',
    columns: ['name', 'discount_type', 'value', 'start_date', 'end_date', 'status'],
  },
  productVariants: {
    id: 'productVariants',
    label: 'Product variants',
    icon: 'ti-versions',
    endpoint: API_RESOURCES.PRODUCT_VARIANTS,
    listKey: 'productVariants',
    singleKey: 'productVariant',
    description: 'Manage size, color, cost, selling price, and stock for product variants.',
    columns: ['product_id', 'variant_name', 'barcode', 'cost_price', 'selling_price', 'stock_quantity', 'status'],
  },
};

const createEmptyResourceRows = (): Record<ManagedResourceId, PosMasterRecord[]> =>
  Object.keys(RESOURCE_META).reduce((rows, resourceId) => {
    rows[resourceId as ManagedResourceId] = [];
    return rows;
  }, {} as Record<ManagedResourceId, PosMasterRecord[]>);

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(value);

const sumSales = (sales: PosSalePayload[], selector: (sale: PosSalePayload) => number) =>
  sales.reduce((sum, sale) => sum + selector(sale), 0);

const formatDateTime = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type ReportDateFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const PosManagement: React.FC = () => {
  const location = useLocation();

  const [activeSection, setActiveSection] = useState<PosManagementSection>(() => {
    const stateSec = (location.state as { section?: PosManagementSection })?.section;
    if (stateSec) return stateSec;
    const searchParams = new URLSearchParams(location.search);
    const paramSec = searchParams.get('section') as PosManagementSection;
    if (paramSec) return paramSec;
    return 'products';
  });

  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pos_mgmt_nav_collapsed') === 'true';
  });

  const toggleNavCollapse = () => {
    setIsNavCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pos_mgmt_nav_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const stateSec = (location.state as { section?: PosManagementSection })?.section;
    if (stateSec) {
      setActiveSection(stateSec);
    } else {
      const searchParams = new URLSearchParams(location.search);
      const paramSec = searchParams.get('section') as PosManagementSection;
      if (paramSec) {
        setActiveSection(paramSec);
      }
    }
  }, [location]);

  const [stockMovementView, setStockMovementView] = useState<'movements' | 'remaining'>('movements');
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('summary');
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [reportDateFilter, setReportDateFilter] = useState<ReportDateFilter>('all');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');
  const [reportLivePayload, setReportLivePayload] = useState<any>(null);
  const [isReportLoading, setIsReportLoading] = useState<boolean>(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [brands, setBrands] = useState<PosBrand[]>([]);
  const [units, setUnits] = useState<PosUnit[]>([]);
  const [suppliers, setSuppliers] = useState<PosSupplier[]>([]);
  const [resourceRows, setResourceRows] = useState<Record<ManagedResourceId, PosMasterRecord[]>>(() => createEmptyResourceRows());
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [salesReportRows, setSalesReportRows] = useState<PosSalePayload[]>([]);
  const [heldReportRows, setHeldReportRows] = useState<PosSalePayload[]>([]);

  // Sales Bills Management state
  const [salesBillSearch, setSalesBillSearch] = useState<string>('');
  const [salesBillStatusFilter, setSalesBillStatusFilter] = useState<'all' | 'completed' | 'held' | 'voided' | 'refunded'>('all');
  const [editingBill, setEditingBill] = useState<PosSalePayload | null>(null);
  const [viewingBillItems, setViewingBillItems] = useState<PosSalePayload | null>(null);
  const [editBillCustomerId, setEditBillCustomerId] = useState<number | ''>('');
  const [editBillPaymentMethod, setEditBillPaymentMethod] = useState<string>('cash');
  const [editBillStatus, setEditBillStatus] = useState<'completed' | 'held' | 'voided' | 'refunded'>('completed');
  const [editBillGrandTotal, setEditBillGrandTotal] = useState<number>(0);
  const [editBillPaidAmount, setEditBillPaidAmount] = useState<number>(0);
  const [editBillNotes, setEditBillNotes] = useState<string>('');
  const [isSavingBill, setIsSavingBill] = useState<boolean>(false);

  const openEditBillModal = (sale: PosSalePayload) => {
    setEditingBill(sale);
    setEditBillCustomerId(sale.customer_id ?? '');
    setEditBillPaymentMethod(sale.payment_method ?? 'cash');
    setEditBillStatus((sale.status as any) ?? 'completed');
    setEditBillGrandTotal(sale.total_amount ?? sale.grand_total ?? 0);
    setEditBillPaidAmount(sale.paid_amount ?? 0);
    setEditBillNotes(sale.notes ?? '');
  };

  const handleSaveBillChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill || !editingBill.id) return;
    setIsSavingBill(true);
    try {
      const updated = await updatePosSale(editingBill.id, {
        customer_id: editBillCustomerId === '' ? null : Number(editBillCustomerId),
        payment_method: editBillPaymentMethod,
        status: editBillStatus,
        grand_total: Number(editBillGrandTotal),
        paid_amount: Number(editBillPaidAmount),
        notes: editBillNotes,
      });

      setSalesReportRows((prev) =>
        prev.map((s) => (s.id && s.id === editingBill.id ? { ...s, ...updated } : s)),
      );
      setReportRefreshKey((val) => val + 1);
      setEditingBill(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to update bill');
    } finally {
      setIsSavingBill(false);
    }
  };
  const [posSettings, setPosSettings] = useState<PosSettingsPayload>(DEFAULT_POS_SETTINGS);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showImportProducts, setShowImportProducts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PosProduct | null>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PosCategory | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<PosCustomer | null>(null);
  const [resourceQuery, setResourceQuery] = useState('');
  const [resourceModal, setResourceModal] = useState<{
    resourceId: ManagedResourceId;
    record?: PosMasterRecord | null;
  } | null>(null);
  const [stockQuery, setStockQuery] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'All' | 'Low' | 'Out' | 'In'>('All');
  const [stockAdjustProduct, setStockAdjustProduct] = useState<PosProduct | null>(null);
  const [stockAdjustMode, setStockAdjustMode] = useState<'add' | 'remove' | 'set'>('add');
  const [stockAdjustQty, setStockAdjustQty] = useState<number>(0);
  const [stockAdjustRemarks, setStockAdjustRemarks] = useState('');
  const [isSavingStockAdjustment, setIsSavingStockAdjustment] = useState(false);

  const [customerFilter, setCustomerFilter] = useState<'all' | 'credit' | 'zero' | 'blocked'>('all');
  const [settlingCustomer, setSettlingCustomer] = useState<PosCustomer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<PosCustomer | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'Card' | 'Bank Transfer'>('Cash');
  const [settleNotes, setSettleNotes] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadManagementData = async () => {
      setIsLoading(true);
      setLoadError('');
      let hadLoadError = false;
      const safeLoad = async <T,>(loader: () => Promise<T>, fallback: T) => {
        try {
          return await loader();
        } catch {
          hadLoadError = true;
          return fallback;
        }
      };

      try {
        const [
          apiProducts,
          apiCategories,
          apiSuppliers,
          apiBrands,
          apiUnits,
          apiCustomers,
          apiSales,
          apiHeldSales,
          apiPosSettings,
        ] = await Promise.all([
          safeLoad(getAllProducts, []),
          safeLoad(getAllCategories, []),
          safeLoad(getAllSuppliers, []),
          safeLoad(getAllBrands, []),
          safeLoad(getAllUnits, []),
          safeLoad(getAllCustomers, []),
          safeLoad(() => getPosSales(), []),
          safeLoad(() => getPosSales('held'), []),
          safeLoad(getPosSettings, DEFAULT_POS_SETTINGS),
        ]);
        const resourceResults = await Promise.all(
          Object.values(RESOURCE_META).map(async (resource) => {
            try {
              const records = await getPosMasterRecords(resource.endpoint, resource.listKey);
              return [resource.id, records] as const;
            } catch {
              hadLoadError = true;
              return [resource.id, []] as const;
            }
          }),
        );

        if (isMounted) {
          setProducts(apiProducts);
          setCategories(apiCategories);
          setSuppliers(apiSuppliers);
          setBrands(apiBrands);
          setUnits(apiUnits);
          setCustomers(apiCustomers);
          setSalesReportRows(apiSales);
          setHeldReportRows(apiHeldSales);
          setPosSettings(apiPosSettings);
          setResourceRows(Object.fromEntries(resourceResults) as Record<ManagedResourceId, PosMasterRecord[]>);
          if (hadLoadError) {
            setLoadError('Some POS management data could not be loaded from the backend.');
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoadError('Some POS management data could not be loaded from the backend.');
          setIsLoading(false);
        }
      }
    };

    loadManagementData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReportSales = async () => {
      try {
        const [apiSales, apiHeldSales] = await Promise.all([getPosSales(), getPosSales('held')]);
        if (isMounted) {
          setSalesReportRows(apiSales);
          setHeldReportRows(apiHeldSales);
        }
      } catch {
        if (isMounted) {
          setLoadError('Unable to refresh POS reports from the backend.');
        }
      }
    };

    if (reportRefreshKey > 0) {
      loadReportSales();
    }

    return () => {
      isMounted = false;
    };
  }, [reportRefreshKey]);

  useEffect(() => {
    if (activeSection !== 'reports') return;

    let isMounted = true;
    const fetchLiveReport = async () => {
      setIsReportLoading(true);
      const now = new Date();
      let from: string | undefined;
      let to: string | undefined;
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      if (reportDateFilter === 'daily') {
        from = formatDate(now);
        to = formatDate(now);
      } else if (reportDateFilter === 'weekly') {
        const dayOfWeek = now.getDay();
        const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const firstDay = new Date(now);
        firstDay.setDate(now.getDate() - distanceToMonday);
        from = formatDate(firstDay);
        to = formatDate(now);
      } else if (reportDateFilter === 'monthly') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        from = formatDate(firstDay);
        to = formatDate(now);
      } else if (reportDateFilter === 'yearly') {
        const firstDay = new Date(now.getFullYear(), 0, 1);
        from = formatDate(firstDay);
        to = formatDate(now);
      } else if (reportDateFilter === 'custom') {
        if (customFromDate) from = customFromDate;
        if (customToDate) to = customToDate;
      }

      const endpointMap: Record<ReportTab, string> = {
        summary: 'pos-sales/reports/summary',
        sales: 'pos-sales/reports/sales',
        cashiers: 'pos-sales/reports/cashiers',
        products: 'pos-sales/reports/products',
        items: 'pos-sales/reports/items',
        inventory: 'pos-sales/reports/inventory',
        payments: 'pos-sales/reports/payments',
        taxDiscounts: 'pos-sales/reports/tax-discounts',
        credit: 'pos-sales/reports/credit',
      };

      const targetEndpoint = endpointMap[activeReportTab];
      try {
        const response = await apiClient.get(targetEndpoint, {
          params: { from, to },
        });
        if (isMounted) setReportLivePayload(response.data);
      } catch (err) {
        if (isMounted) setReportLivePayload(null);
      } finally {
        if (isMounted) setIsReportLoading(false);
      }
    };

    fetchLiveReport();
    return () => {
      isMounted = false;
    };
  }, [activeSection, activeReportTab, reportDateFilter, customFromDate, customToDate, reportRefreshKey]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return products.filter(
      (product) => {
        const brandName = brands.find((brand) => brand.id === product.brandId)?.name ?? '';
        const unitName = units.find((unit) => unit.id === product.unitId)?.name ?? '';

        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.sku.toLowerCase().includes(normalizedQuery) ||
          product.barcode.toLowerCase().includes(normalizedQuery) ||
          product.category.toLowerCase().includes(normalizedQuery) ||
          brandName.toLowerCase().includes(normalizedQuery) ||
          unitName.toLowerCase().includes(normalizedQuery)
        );
      },
    );
  }, [brands, products, query, units]);

  const stockFilteredProducts = useMemo(() => {
    const normalizedQuery = stockQuery.toLowerCase();
    return products.filter((product) => {
      const matchesCategory = stockCategoryFilter === 'All' || product.category === stockCategoryFilter;
      const matchesQuery =
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.sku.toLowerCase().includes(normalizedQuery) ||
        product.barcode.toLowerCase().includes(normalizedQuery);

      let matchesStatus = true;
      if (stockStatusFilter === 'Low') {
        matchesStatus = product.stock > 0 && product.stock <= product.minimumStock;
      } else if (stockStatusFilter === 'Out') {
        matchesStatus = product.stock <= 0;
      } else if (stockStatusFilter === 'In') {
        matchesStatus = product.stock > product.minimumStock;
      }

      return matchesCategory && matchesQuery && matchesStatus;
    });
  }, [products, stockCategoryFilter, stockQuery, stockStatusFilter]);

  const handleSaveStockAdjustment = async () => {
    if (!stockAdjustProduct) return;
    const currentStock = stockAdjustProduct.stock;
    let newStock = currentStock;

    if (stockAdjustMode === 'add') {
      newStock = currentStock + stockAdjustQty;
    } else if (stockAdjustMode === 'remove') {
      newStock = currentStock - stockAdjustQty;
    } else if (stockAdjustMode === 'set') {
      newStock = stockAdjustQty;
    }

    setIsSavingStockAdjustment(true);

    try {
      const isProductActive = stockAdjustProduct.status === 'Inactive' && newStock <= 0 ? false : true;
      await updateProduct(stockAdjustProduct.id, {
        product_code: stockAdjustProduct.sku,
        barcode: stockAdjustProduct.barcode,
        name: stockAdjustProduct.name,
        description: '',
        category_id: stockAdjustProduct.categoryId || 1,
        brand_id: stockAdjustProduct.brandId || 1,
        unit_id: stockAdjustProduct.unitId || 1,
        cost_price: 0,
        selling_price: stockAdjustProduct.price,
        wholesale_price: stockAdjustProduct.price,
        stock_quantity: newStock,
        minimum_stock: stockAdjustProduct.minimumStock,
        tax_rate: stockAdjustProduct.taxRate,
        discount_rate: 0,
        image: '',
        weight: 0,
        is_weighted: Boolean(stockAdjustProduct.is_weighted),
        status: isProductActive,
      });

      try {
        await createPosMasterRecord(
          API_RESOURCES.STOCK_MOVEMENTS,
          {
            product_id: stockAdjustProduct.id,
            type: stockAdjustMode === 'add' ? 'purchase' : 'adjustment',
            quantity: Math.abs(newStock - currentStock),
            reference_type: 'manual_adjustment',
            remarks: stockAdjustRemarks || `Manual stock adjustment (${stockAdjustMode})`,
          },
          'stockMovement',
        );
      } catch (err) {
        console.warn('Stock movement log notice:', err);
      }

      // Re-fetch all products from local database to ensure perfect sync
      const refreshedProducts = await getAllProducts();
      setProducts(refreshedProducts);

      setStockAdjustProduct(null);
      setStockAdjustQty(0);
      setStockAdjustRemarks('');
    } catch {
      setLoadError('Unable to update product stock. Please check backend connection.');
    } finally {
      setIsSavingStockAdjustment(false);
    }
  };

  const filteredCategories = useMemo(() => {
    const normalizedQuery = (categoryQuery || '').toLowerCase();
    return categories.filter(
      (category) =>
        (category?.name || '').toLowerCase().includes(normalizedQuery) ||
        (category?.description || '').toLowerCase().includes(normalizedQuery),
    );
  }, [categories, categoryQuery]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = (customerQuery || '').toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery =
        (customer?.name || '').toLowerCase().includes(normalizedQuery) ||
        (customer?.phone || '').toLowerCase().includes(normalizedQuery) ||
        (customer?.email || '').toLowerCase().includes(normalizedQuery);

      const matchesFilter =
        customerFilter === 'all'
          ? true
          : customerFilter === 'credit'
            ? (customer?.balance || 0) > 0
            : customerFilter === 'zero'
              ? (customer?.balance || 0) === 0
              : customer?.status === 'Blocked';

      return matchesQuery && matchesFilter;
    });
  }, [customers, customerQuery, customerFilter]);


  const activeProducts = products.filter((product) => product.status === 'Active').length;
  const lowStockProducts = products.filter((product) => product.status === 'Low stock').length;
  const inventoryValue = products.reduce((sum, product) => sum + product.price * product.stock, 0);
  const activeCategories = categories.filter((category) => category.status).length;
  const activeCustomers = customers.filter((customer) => customer.status === 'Active').length;
  const totalCreditLimit = customers.reduce((sum, customer) => sum + customer.creditLimit, 0);
  const totalCreditBalance = customers.reduce((sum, customer) => sum + customer.balance, 0);

  const productOptions = products.map((product) => ({ value: product.id, label: product.name }));
  const supplierOptions = suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }));

  const getResourceFields = (resourceId: ManagedResourceId): ResourceField[] => {
    const productField: ResourceField = {
      name: 'product_id',
      label: 'Product',
      type: 'select',
      required: true,
      options: productOptions.length ? productOptions : [{ value: 1, label: 'Product 1' }],
    };
    const supplierField: ResourceField = {
      name: 'supplier_id',
      label: 'Supplier',
      type: 'select',
      required: true,
      options: supplierOptions.length ? supplierOptions : [{ value: 1, label: 'Supplier 1' }],
    };

    const fields: Record<ManagedResourceId, ResourceField[]> = {
      brands: [
        { name: 'name', label: 'Brand name', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'status', label: 'Status', type: 'boolean' },
      ],
      units: [
        { name: 'name', label: 'Unit name', type: 'text', required: true },
        { name: 'short_name', label: 'Short name', type: 'text', required: true },
        { name: 'status', label: 'Status', type: 'boolean' },
      ],
      suppliers: [
        { name: 'name', label: 'Supplier name', type: 'text', required: true },
        { name: 'contact_person', label: 'Contact person', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'status', label: 'Status', type: 'boolean' },
      ],
      productSuppliers: [
        productField,
        supplierField,
        { name: 'supplier_price', label: 'Supplier price', type: 'number', required: true },
      ],
      stockMovements: [
        productField,
        {
          name: 'type',
          label: 'Movement type',
          type: 'select',
          required: true,
          options: ['purchase', 'sale', 'adjustment', 'return'].map((type) => ({ value: type, label: type })),
        },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        {
          name: 'reference_type',
          label: 'Reference type',
          type: 'select',
          options: [
            { value: '', label: 'None' },
            { value: 'purchase_order', label: 'Purchase order' },
            { value: 'sale_invoice', label: 'Sale invoice' },
            { value: 'stock_count', label: 'Stock count' },
            { value: 'return_note', label: 'Return note' },
          ],
        },
        { name: 'reference_id', label: 'Reference ID', type: 'number' },
        { name: 'movement_date', label: 'Movement date', type: 'date' },
        { name: 'remarks', label: 'Remarks', type: 'textarea' },
      ],
      productBatches: [
        productField,
        { name: 'batch_no', label: 'Batch no', type: 'text', required: true },
        { name: 'purchase_price', label: 'Purchase price', type: 'number', required: true },
        { name: 'selling_price', label: 'Selling price', type: 'number', required: true },
        { name: 'quantity', label: 'Quantity', type: 'number', required: true },
        { name: 'manufacture_date', label: 'Manufacture date', type: 'date' },
        { name: 'expiry_date', label: 'Expiry date', type: 'date' },
      ],
      productImages: [
        productField,
        { name: 'image_path', label: 'Image path', type: 'text', required: true },
      ],
      taxes: [
        { name: 'name', label: 'Tax name', type: 'text', required: true },
        { name: 'percentage', label: 'Percentage', type: 'number', required: true },
        { name: 'status', label: 'Status', type: 'boolean' },
      ],
      discounts: [
        { name: 'name', label: 'Discount name', type: 'text', required: true },
        {
          name: 'discount_type',
          label: 'Discount type',
          type: 'select',
          required: true,
          options: [
            { value: 'fixed', label: 'Fixed' },
            { value: 'percentage', label: 'Percentage' },
          ],
        },
        { name: 'value', label: 'Value', type: 'number', required: true },
        { name: 'start_date', label: 'Start date', type: 'date', required: true },
        { name: 'end_date', label: 'End date', type: 'date', required: true },
        { name: 'status', label: 'Status', type: 'boolean' },
      ],
      productVariants: [
        productField,
        { name: 'variant_name', label: 'Variant name (e.g. Size L / Red)', type: 'text', required: true },
        { name: 'barcode', label: 'Variant barcode / SKU', type: 'text' },
        { name: 'cost_price', label: 'Cost price', type: 'number' },
        { name: 'selling_price', label: 'Selling price', type: 'number', required: true },
        { name: 'stock_quantity', label: 'Stock quantity', type: 'number', required: true },
        { name: 'status', label: 'Status', type: 'boolean' },
      ],
    };

    return fields[resourceId];
  };

  const handleDeleteProduct = async (product: PosProduct) => {
    const confirmed = window.confirm(`Delete ${product.name}?`);
    if (!confirmed) return;

    try {
      await deleteProduct(product.id);
      setProducts((previous) => previous.filter((item) => item.id !== product.id));
    } catch {
      setLoadError('Unable to delete product. Please check backend connection.');
    }
  };

  const handleDeleteCategory = async (category: PosCategory) => {
    const confirmed = window.confirm(`Delete ${category.name}?`);
    if (!confirmed) return;

    try {
      await deleteCategory(category.id);
      setCategories((previous) => previous.filter((item) => item.id !== category.id));
    } catch {
      setLoadError('Unable to delete category. Please check backend connection.');
    }
  };

  const handleSaveCustomer = async (customer: PosCustomer) => {
    try {
      const { id, ...payload } = customer;
      const savedCustomer = editingCustomer
        ? await updateCustomer(id, payload)
        : await createCustomer(payload);

      setCustomers((previous) => {
        const exists = previous.some((item) => item.id === savedCustomer.id);
        return exists
          ? previous.map((item) => (item.id === savedCustomer.id ? savedCustomer : item))
          : [savedCustomer, ...previous];
      });
    } catch {
      setLoadError('Unable to save customer. Please check backend connection.');
      throw new Error('Unable to save customer');
    }
  };

  const handleDeleteCustomer = async (customer: PosCustomer) => {
    const confirmed = window.confirm(`Delete ${customer.name}?`);
    if (!confirmed) return;

    try {
      await deleteCustomer(customer.id);
      setCustomers((previous) => previous.filter((item) => item.id !== customer.id));
    } catch {
      setLoadError('Unable to delete customer. Please check backend connection.');
    }
  };

  const refreshOptionResource = async (resourceId: ManagedResourceId) => {
    if (resourceId === 'brands') setBrands(await getAllBrands());
    if (resourceId === 'units') setUnits(await getAllUnits());
    if (resourceId === 'suppliers') setSuppliers(await getAllSuppliers());
  };

  const handleSaveResource = async (
    resourceId: ManagedResourceId,
    payload: PosMasterRecord,
    record?: PosMasterRecord | null,
  ) => {
    const resource = RESOURCE_META[resourceId];
    const recordId = Number(record?.id);
    const savedRecord = record?.id
      ? await updatePosMasterRecord(resource.endpoint, recordId, payload, resource.singleKey)
      : await createPosMasterRecord(resource.endpoint, payload, resource.singleKey);
    const normalizedRecord = { ...payload, ...savedRecord, id: savedRecord.id ?? record?.id ?? Date.now() };

    setResourceRows((previous) => {
      const rows = previous[resourceId] ?? [];
      const exists = rows.some((item) => item.id === normalizedRecord.id);
      return {
        ...previous,
        [resourceId]: exists
          ? rows.map((item) => (item.id === normalizedRecord.id ? normalizedRecord : item))
          : [normalizedRecord, ...rows],
      };
    });
    await refreshOptionResource(resourceId);
  };

  const handleDeleteResource = async (resourceId: ManagedResourceId, record: PosMasterRecord) => {
    const resource = RESOURCE_META[resourceId];
    const recordId = Number(record.id);
    if (!recordId) return;

    const confirmed = window.confirm(`Delete this ${resource.label.toLowerCase()} record?`);
    if (!confirmed) return;

    try {
      await deletePosMasterRecord(resource.endpoint, recordId);
      setResourceRows((previous) => ({
        ...previous,
        [resourceId]: (previous[resourceId] ?? []).filter((item) => item.id !== record.id),
      }));
      await refreshOptionResource(resourceId);
    } catch {
      setLoadError(`Unable to delete ${resource.label.toLowerCase()} record. Please check backend connection.`);
    }
  };

  const handleTogglePaymentMethod = (methodKey: string) => {
    setSettingsMessage('');
    setPosSettings((previous) => ({
      ...previous,
      payment_methods: previous.payment_methods.map((method) =>
        method.key === methodKey ? { ...method, enabled: !method.enabled } : method,
      ),
    }));
  };

  const handleReceiptChange = <K extends keyof PosSettingsPayload['receipt']>(
    key: K,
    value: PosSettingsPayload['receipt'][K],
  ) => {
    setSettingsMessage('');
    setPosSettings((previous) => ({
      ...previous,
      receipt: { ...previous.receipt, [key]: value },
    }));
  };

  const handleDiscountRuleChange = <K extends keyof PosSettingsPayload['discount_rules']>(
    key: K,
    value: PosSettingsPayload['discount_rules'][K],
  ) => {
    setSettingsMessage('');
    setPosSettings((previous) => ({
      ...previous,
      discount_rules: { ...previous.discount_rules, [key]: value },
    }));
  };

  const savePaymentMethods = async () => {
    try {
      const paymentMethods = await updatePosPaymentMethods(posSettings.payment_methods);
      setPosSettings((previous) => ({ ...previous, payment_methods: paymentMethods }));
      setSettingsMessage('Payment methods saved.');
    } catch {
      setSettingsMessage('Unable to save payment methods.');
    }
  };

  const saveReceiptSettings = async () => {
    try {
      const receipt = await updatePosReceipt(posSettings.receipt);
      setPosSettings((previous) => ({ ...previous, receipt }));
      setSettingsMessage('Receipt settings saved.');
    } catch {
      setSettingsMessage('Unable to save receipt settings.');
    }
  };

  const saveDiscountRules = async () => {
    try {
      const discountRules = await updatePosDiscountRules(posSettings.discount_rules);
      setPosSettings((previous) => ({ ...previous, discount_rules: discountRules }));
      setSettingsMessage('Discount rules saved.');
    } catch {
      setSettingsMessage('Unable to save discount rules.');
    }
  };

  const getLookupLabel = (key: string, value: PosMasterRecord[string]) => {
    if (key === 'product_id') {
      return products.find((product) => product.id === Number(value))?.name ?? value;
    }
    if (key === 'supplier_id') {
      return suppliers.find((supplier) => supplier.id === Number(value))?.name ?? value;
    }
    return value;
  };

  const getProductById = (productId: PosMasterRecord[string]) =>
    products.find((product) => product.id === Number(productId));

  const getMovementType = (movement: PosMasterRecord): StockMovementType => {
    const type = String(movement.type ?? '').toLowerCase();
    if (type === 'purchase' || type === 'sale' || type === 'adjustment' || type === 'return') return type;
    return 'adjustment';
  };

  const getMovementQuantity = (movement: PosMasterRecord) => {
    const quantity = Number(movement.quantity ?? 0);
    return Number.isFinite(quantity) ? Math.abs(quantity) : 0;
  };

  const getMovementSignedQuantity = (movement: PosMasterRecord) => {
    const quantity = getMovementQuantity(movement);
    const type = getMovementType(movement);
    if (type === 'sale') return -quantity;
    return quantity;
  };

  const getMovementDate = (movement: PosMasterRecord) => {
    const rawDate = movement.created_at ?? movement.createdAt ?? movement.movement_date;
    if (!rawDate) return '-';

    const parsedDate = new Date(String(rawDate));
    if (Number.isNaN(parsedDate.getTime())) return String(rawDate);

    return parsedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMovementReference = (movement: PosMasterRecord) => {
    const referenceType = movement.reference_type;
    const referenceId = movement.reference_id;
    if (!referenceType && !referenceId) return '-';
    if (!referenceType) return `#${referenceId}`;
    if (!referenceId) return String(referenceType);
    return `${referenceType} #${referenceId}`;
  };

  const getMovementTypeStyle = (type: StockMovementType) => {
    if (type === 'purchase' || type === 'return') return styles.badgeActive;
    if (type === 'sale') return styles.badgeDanger;
    return styles.badgeWarning;
  };

  const formatMovementType = (type: StockMovementType) =>
    type.charAt(0).toUpperCase() + type.slice(1);

  const toRecordNumber = (value: PosMasterRecord[string], fallback = 0) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const isRecordActive = (record: PosMasterRecord) => record.status !== false;

  const formatRecordDate = (value: PosMasterRecord[string]) => {
    if (!value) return '-';

    const parsedDate = new Date(String(value));
    if (Number.isNaN(parsedDate.getTime())) return String(value);

    return parsedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isDiscountRunning = (discount: PosMasterRecord) => {
    if (!isRecordActive(discount)) return false;

    const now = new Date();
    const startDate = discount.start_date ? new Date(String(discount.start_date)) : null;
    const endDate = discount.end_date ? new Date(String(discount.end_date)) : null;
    const startsInFuture = startDate && !Number.isNaN(startDate.getTime()) && startDate > now;
    const ended = endDate && !Number.isNaN(endDate.getTime()) && endDate < now;

    return !startsInFuture && !ended;
  };

  const getDiscountWindowLabel = (discount: PosMasterRecord) => {
    if (!isRecordActive(discount)) return 'Inactive';
    if (isDiscountRunning(discount)) return 'Running';

    const now = new Date();
    const startDate = discount.start_date ? new Date(String(discount.start_date)) : null;
    const endDate = discount.end_date ? new Date(String(discount.end_date)) : null;

    if (startDate && !Number.isNaN(startDate.getTime()) && startDate > now) return 'Upcoming';
    if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) return 'Expired';
    return 'Scheduled';
  };

  const getDiscountWindowStyle = (discount: PosMasterRecord) => {
    const label = getDiscountWindowLabel(discount);
    if (label === 'Running') return styles.badgeActive;
    if (label === 'Upcoming' || label === 'Scheduled') return styles.badgeWarning;
    return styles.badgeDanger;
  };

  const formatDiscountValue = (discount: PosMasterRecord) => {
    const value = toRecordNumber(discount.value);
    return discount.discount_type === 'percentage' ? `${value}%` : formatMoney(value);
  };

  const getProductBrandName = (product: PosProduct) =>
    brands.find((brand) => brand.id === product.brandId)?.name ?? 'Unassigned';

  const getProductUnitName = (product: PosProduct) => {
    const unit = units.find((item) => item.id === product.unitId);
    if (!unit) return 'Unit';
    return unit.shortName ? `${unit.name} (${unit.shortName})` : unit.name;
  };

  const getProductStatusStyle = (product: PosProduct) => {
    if (product.status === 'Inactive') return styles.badgeDanger;
    if (product.status === 'Low stock') return styles.badgeWarning;
    return styles.badgeActive;
  };

  const getProductStockStyle = (product: PosProduct) => {
    if (product.stock <= 0 || product.status === 'Inactive') return styles.negativeText;
    if (product.stock <= product.minimumStock) return styles.warningText;
    return styles.positiveText;
  };

  const formatResourceLabel = (key: string) =>
    key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const renderResourceValue = (key: string, value: PosMasterRecord[string]) => {
    if (typeof value === 'boolean') {
      return (
        <span style={{ ...styles.badge, ...(value ? styles.badgeActive : styles.badgeDanger) }}>
          {value ? 'Active' : 'Inactive'}
        </span>
      );
    }

    const lookupValue = getLookupLabel(key, value);
    if (typeof lookupValue === 'number' && /price|value|percentage/i.test(key)) {
      return key === 'percentage' ? `${lookupValue}%` : formatMoney(lookupValue);
    }

    return String(lookupValue ?? '-');
  };

  const renderManagedResourceSection = (resourceId: ManagedResourceId) => {
    const resource = RESOURCE_META[resourceId];
    const rows = resourceRows[resourceId] ?? [];
    const normalizedQuery = resourceQuery.toLowerCase();
    const filteredRows = rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)),
    );

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>{resource.label}</h2>
            <p style={styles.panelSub}>{resource.description}</p>
          </div>
          <button
            style={styles.primaryBtn}
            onClick={() => setResourceModal({ resourceId, record: null })}
          >
            <i className={`ti ${resource.icon}`} aria-hidden="true" />
            Add {resource.label.toLowerCase()}
          </button>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Records</span>
            <strong style={styles.statValue}>{rows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Endpoint</span>
            <strong style={styles.statSmallValue}>/{resource.endpoint}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Fields</span>
            <strong style={styles.statValue}>{getResourceFields(resourceId).length}</strong>
          </div>
        </div>

        <div style={styles.searchRow}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            style={styles.searchInput}
            value={resourceQuery}
            onChange={(event) => setResourceQuery(event.target.value)}
            placeholder={`Search ${resource.label.toLowerCase()}`}
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {resource.columns.map((column) => (
                  <th key={column} style={styles.th}>{formatResourceLabel(column)}</th>
                ))}
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={String(row.id ?? index)} style={styles.tr}>
                  {resource.columns.map((column) => (
                    <td key={column} style={styles.td}>
                      {renderResourceValue(column, row[column])}
                    </td>
                  ))}
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        style={styles.iconBtn}
                        title={`Edit ${resource.label}`}
                        onClick={() => setResourceModal({ resourceId, record: row })}
                      >
                        <i className="ti ti-edit" aria-hidden="true" />
                      </button>
                      <button
                        style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                        title={`Delete ${resource.label}`}
                        onClick={() => handleDeleteResource(resourceId, row)}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={resource.columns.length + 1}>
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderStockMovementSection = () => {
    const resource = RESOURCE_META.stockMovements;
    const rows = resourceRows.stockMovements ?? [];
    const normalizedQuery = resourceQuery.toLowerCase();
    const remainingStockRows = products.filter(
      (product) =>
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.sku.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery),
    );
    const filteredRows = rows.filter((row) => {
      const product = getProductById(row.product_id);
      return (
        product?.name.toLowerCase().includes(normalizedQuery) ||
        product?.sku.toLowerCase().includes(normalizedQuery) ||
        Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
      );
    });
    const inboundQuantity = rows.reduce((sum, movement) => {
      const type = getMovementType(movement);
      return type === 'purchase' || type === 'return' ? sum + getMovementQuantity(movement) : sum;
    }, 0);
    const outboundQuantity = rows.reduce((sum, movement) => {
      const type = getMovementType(movement);
      return type === 'sale' ? sum + getMovementQuantity(movement) : sum;
    }, 0);
    const adjustments = rows.filter((movement) => getMovementType(movement) === 'adjustment').length;
    const totalRemainingStock = products.reduce((sum, product) => sum + product.stock, 0);
    const remainingStockValue = products.reduce((sum, product) => sum + product.stock * product.price, 0);

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>
              <i className="ti ti-arrows-exchange" style={{ marginRight: 8, color: 'var(--app-accent, #27AE4F)' }} aria-hidden="true" />
              Stock movements
            </h2>
            <p style={styles.panelSub}>Record inventory in, sales out, returns, and stock corrections.</p>
          </div>
          <button
            style={styles.primaryBtn}
            onClick={() => setResourceModal({ resourceId: 'stockMovements', record: null })}
          >
            <i className="ti ti-arrows-exchange" aria-hidden="true" />
            Add movement
          </button>
        </div>

        <div style={styles.segmentRow}>
          <button
            type="button"
            style={{
              ...styles.segmentBtn,
              ...(stockMovementView === 'movements' ? styles.segmentBtnActive : {}),
            }}
            onClick={() => setStockMovementView('movements')}
          >
            <i className="ti ti-history" aria-hidden="true" />
            Movement history
          </button>
          <button
            type="button"
            style={{
              ...styles.segmentBtn,
              ...(stockMovementView === 'remaining' ? styles.segmentBtnActive : {}),
            }}
            onClick={() => setStockMovementView('remaining')}
          >
            <i className="ti ti-packages" aria-hidden="true" />
            Remaining stock
          </button>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>{stockMovementView === 'remaining' ? 'Products' : 'Movements'}</span>
            <strong style={styles.statValue}>{stockMovementView === 'remaining' ? products.length : rows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>{stockMovementView === 'remaining' ? 'Remaining qty' : 'Stock in'}</span>
            <strong style={styles.statValue}>{stockMovementView === 'remaining' ? totalRemainingStock : `+${inboundQuantity}`}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>{stockMovementView === 'remaining' ? 'Stock value' : 'Stock out'}</span>
            <strong style={styles.statValue}>{stockMovementView === 'remaining' ? formatMoney(remainingStockValue) : `-${outboundQuantity}`}</strong>
          </div>
        </div>

        <div style={styles.creditSummaryBar}>
          {stockMovementView === 'remaining' ? (
            <>
              <span>Low stock: <strong>{lowStockProducts}</strong></span>
              <span>Active products: <strong>{activeProducts}</strong></span>
            </>
          ) : (
            <span>Adjustments: <strong>{adjustments}</strong></span>
          )}
          <span>Endpoint: <strong>/{resource.endpoint}</strong></span>
          <span>
            {stockMovementView === 'remaining' ? 'Products listed' : 'Products tracked'}:{' '}
            <strong>{stockMovementView === 'remaining' ? remainingStockRows.length : new Set(rows.map((movement) => movement.product_id)).size}</strong>
          </span>
        </div>

        <div style={styles.searchRow}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            style={styles.searchInput}
            value={resourceQuery}
            onChange={(event) => setResourceQuery(event.target.value)}
            placeholder={
              stockMovementView === 'remaining'
                ? 'Search product, SKU, or category'
                : 'Search product, SKU, type, reference, or remarks'
            }
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              {stockMovementView === 'remaining' ? (
                <tr>
                  {['Product', 'SKU', 'Category', 'Remaining stock', 'Minimum stock', 'Stock value', 'Status'].map((heading) => (
                    <th key={heading} style={styles.th}>{heading}</th>
                  ))}
                </tr>
              ) : (
                <tr>
                  {['Date', 'Product', 'Type', 'Quantity', 'Stock after', 'Reference', 'Remarks', ''].map((heading) => (
                    <th key={heading} style={styles.th}>{heading}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {stockMovementView === 'remaining' ? (
                <>
                  {remainingStockRows.map((product) => (
                    <tr key={product.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{product.name}</strong>
                      </td>
                      <td style={styles.tdMuted}>{product.sku}</td>
                      <td style={styles.td}>{product.category}</td>
                      <td style={styles.td}>
                        <strong style={product.stock <= product.minimumStock ? styles.negativeText : styles.positiveText}>
                          {product.is_weighted ? product.stock.toFixed(3) : product.stock} {product.unit_name || (product.is_weighted ? 'kg' : 'pcs')}
                        </strong>
                      </td>
                      <td style={styles.td}>{product.minimumStock}</td>
                      <td style={styles.td}>{formatMoney(product.stock * product.price)}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(product.status === 'Low stock' ? styles.badgeWarning : product.status === 'Inactive' ? styles.badgeDanger : styles.badgeActive),
                          }}
                        >
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {remainingStockRows.length === 0 && (
                    <tr>
                      <td style={styles.emptyCell} colSpan={7}>
                        No remaining stock records found
                      </td>
                    </tr>
                  )}
                </>
              ) : filteredRows.map((movement, index) => {
                const product = getProductById(movement.product_id);
                const type = getMovementType(movement);
                const signedQuantity = getMovementSignedQuantity(movement);
                const stockAfter = movement.stock_after ?? movement.balance_after ?? movement.current_stock;

                return (
                  <tr key={String(movement.id ?? index)} style={styles.tr}>
                    <td style={styles.tdMuted}>{getMovementDate(movement)}</td>
                    <td style={styles.td}>
                      <strong>{product?.name ?? `Product ${movement.product_id ?? '-'}`}</strong>
                      <div style={styles.cellSubText}>{product?.sku ?? 'No SKU'}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...getMovementTypeStyle(type) }}>
                        {formatMovementType(type)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong style={signedQuantity < 0 ? styles.negativeText : styles.positiveText}>
                        {signedQuantity > 0 ? '+' : ''}{signedQuantity}
                      </strong>
                    </td>
                    <td style={styles.td}>{String(stockAfter ?? '-')}</td>
                    <td style={styles.tdMuted}>{getMovementReference(movement)}</td>
                    <td style={styles.tdDescription}>{String(movement.remarks ?? '-')}</td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <button
                          style={styles.iconBtn}
                          title="Edit stock movement"
                          onClick={() => setResourceModal({ resourceId: 'stockMovements', record: movement })}
                        >
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                        <button
                          style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                          title="Delete stock movement"
                          onClick={() => handleDeleteResource('stockMovements', movement)}
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stockMovementView === 'movements' && filteredRows.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={8}>
                    No stock movements found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderTaxSection = () => {
    const resource = RESOURCE_META.taxes;
    const rows = resourceRows.taxes ?? [];
    const normalizedQuery = resourceQuery.toLowerCase();
    const filteredRows = rows.filter((tax) =>
      String(tax.name ?? '').toLowerCase().includes(normalizedQuery) ||
      String(tax.percentage ?? '').toLowerCase().includes(normalizedQuery),
    );
    const activeRows = rows.filter(isRecordActive);
    const averageRate = activeRows.length
      ? activeRows.reduce((sum, tax) => sum + toRecordNumber(tax.percentage), 0) / activeRows.length
      : 0;
    const highestRate = rows.reduce((highest, tax) => Math.max(highest, toRecordNumber(tax.percentage)), 0);

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Taxes</h2>
            <p style={styles.panelSub}>Maintain tax labels and percentages used by products and receipts.</p>
          </div>
          <button
            style={styles.primaryBtn}
            onClick={() => setResourceModal({ resourceId: 'taxes', record: null })}
          >
            <i className="ti ti-receipt-tax" aria-hidden="true" />
            Add tax
          </button>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Tax rules</span>
            <strong style={styles.statValue}>{rows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Active</span>
            <strong style={styles.statValue}>{activeRows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Avg rate</span>
            <strong style={styles.statValue}>{averageRate.toFixed(2)}%</strong>
          </div>
        </div>

        <div style={styles.creditSummaryBar}>
          <span>Highest rate: <strong>{highestRate}%</strong></span>
          <span>Inactive: <strong>{rows.length - activeRows.length}</strong></span>
          <span>Endpoint: <strong>/{resource.endpoint}</strong></span>
        </div>

        <div style={styles.searchRow}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            style={styles.searchInput}
            value={resourceQuery}
            onChange={(event) => setResourceQuery(event.target.value)}
            placeholder="Search tax name or percentage"
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Tax name', 'Percentage', 'Status', ''].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((tax, index) => (
                <tr key={String(tax.id ?? index)} style={styles.tr}>
                  <td style={styles.td}><strong>{String(tax.name ?? 'Unnamed tax')}</strong></td>
                  <td style={styles.td}><strong>{toRecordNumber(tax.percentage)}%</strong></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(isRecordActive(tax) ? styles.badgeActive : styles.badgeDanger) }}>
                      {isRecordActive(tax) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        style={styles.iconBtn}
                        title="Edit tax"
                        onClick={() => setResourceModal({ resourceId: 'taxes', record: tax })}
                      >
                        <i className="ti ti-edit" aria-hidden="true" />
                      </button>
                      <button
                        style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                        title="Delete tax"
                        onClick={() => handleDeleteResource('taxes', tax)}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={4}>No taxes found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderDiscountSection = () => {
    const resource = RESOURCE_META.discounts;
    const rows = resourceRows.discounts ?? [];
    const normalizedQuery = resourceQuery.toLowerCase();
    const filteredRows = rows.filter((discount) =>
      Object.values(discount).some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)),
    );
    const activeRows = rows.filter(isRecordActive);
    const runningRows = rows.filter(isDiscountRunning);
    const percentageRows = rows.filter((discount) => discount.discount_type === 'percentage').length;

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Discounts</h2>
            <p style={styles.panelSub}>Control fixed and percentage discounts with start and end dates.</p>
          </div>
          <button
            style={styles.primaryBtn}
            onClick={() => setResourceModal({ resourceId: 'discounts', record: null })}
          >
            <i className="ti ti-discount" aria-hidden="true" />
            Add discount
          </button>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Discounts</span>
            <strong style={styles.statValue}>{rows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Running</span>
            <strong style={styles.statValue}>{runningRows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Active</span>
            <strong style={styles.statValue}>{activeRows.length}</strong>
          </div>
        </div>

        <div style={styles.creditSummaryBar}>
          <span>Percentage rules: <strong>{percentageRows}</strong></span>
          <span>Fixed rules: <strong>{rows.length - percentageRows}</strong></span>
          <span>Endpoint: <strong>/{resource.endpoint}</strong></span>
        </div>

        <div style={styles.searchRow}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            style={styles.searchInput}
            value={resourceQuery}
            onChange={(event) => setResourceQuery(event.target.value)}
            placeholder="Search discount name, type, value, or dates"
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Discount', 'Type', 'Value', 'Start', 'End', 'Window', 'Status', ''].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((discount, index) => (
                <tr key={String(discount.id ?? index)} style={styles.tr}>
                  <td style={styles.td}><strong>{String(discount.name ?? 'Unnamed discount')}</strong></td>
                  <td style={styles.td}>{String(discount.discount_type ?? '-')}</td>
                  <td style={styles.td}><strong>{formatDiscountValue(discount)}</strong></td>
                  <td style={styles.tdMuted}>{formatRecordDate(discount.start_date)}</td>
                  <td style={styles.tdMuted}>{formatRecordDate(discount.end_date)}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...getDiscountWindowStyle(discount) }}>
                      {getDiscountWindowLabel(discount)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(isRecordActive(discount) ? styles.badgeActive : styles.badgeDanger) }}>
                      {isRecordActive(discount) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        style={styles.iconBtn}
                        title="Edit discount"
                        onClick={() => setResourceModal({ resourceId: 'discounts', record: discount })}
                      >
                        <i className="ti ti-edit" aria-hidden="true" />
                      </button>
                      <button
                        style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                        title="Delete discount"
                        onClick={() => handleDeleteResource('discounts', discount)}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={8}>No discounts found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderVariantSection = () => {
    const resource = RESOURCE_META.productVariants;
    const rows = resourceRows.productVariants ?? [];
    const normalizedQuery = resourceQuery.toLowerCase();
    const filteredRows = rows.filter((variant) => {
      const product = getProductById(variant.product_id);
      return (
        product?.name.toLowerCase().includes(normalizedQuery) ||
        product?.sku.toLowerCase().includes(normalizedQuery) ||
        Object.values(variant).some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
      );
    });
    const totalVariantStock = rows.reduce((sum, variant) => sum + toRecordNumber(variant.stock_quantity), 0);
    const variantValue = rows.reduce(
      (sum, variant) => sum + toRecordNumber(variant.stock_quantity) * toRecordNumber(variant.selling_price),
      0,
    );
    const productsWithVariants = new Set(rows.map((variant) => variant.product_id)).size;

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Product variants</h2>
            <p style={styles.panelSub}>Manage alternate barcodes, prices, and stock for product variants.</p>
          </div>
          <button
            style={styles.primaryBtn}
            onClick={() => setResourceModal({ resourceId: 'productVariants', record: null })}
          >
            <i className="ti ti-versions" aria-hidden="true" />
            Add variant
          </button>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Variants</span>
            <strong style={styles.statValue}>{rows.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Variant stock</span>
            <strong style={styles.statValue}>{totalVariantStock}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Stock value</span>
            <strong style={styles.statValue}>{formatMoney(variantValue)}</strong>
          </div>
        </div>

        <div style={styles.creditSummaryBar}>
          <span>Products with variants: <strong>{productsWithVariants}</strong></span>
          <span>Endpoint: <strong>/{resource.endpoint}</strong></span>
          <span>Listed: <strong>{filteredRows.length}</strong></span>
        </div>

        <div style={styles.searchRow}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            style={styles.searchInput}
            value={resourceQuery}
            onChange={(event) => setResourceQuery(event.target.value)}
            placeholder="Search product, variant, barcode, or price"
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Product', 'Variant Name', 'Barcode / SKU', 'Cost Price', 'Selling Price', 'Stock Qty', 'Total Value', 'Status', ''].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((variant, index) => {
                const product = getProductById(variant.product_id);
                const stock = toRecordNumber(variant.stock_quantity);
                const costPrice = toRecordNumber(variant.cost_price);
                const sellingPrice = toRecordNumber(variant.selling_price);
                const isActive = isRecordActive(variant);

                return (
                  <tr key={String(variant.id ?? index)} style={styles.tr}>
                    <td style={styles.td}>
                      <strong>{product?.name ?? `Product ${variant.product_id ?? '-'}`}</strong>
                      <div style={styles.cellSubText}>{product?.sku ?? 'No SKU'}</div>
                    </td>
                    <td style={styles.td}><strong>{String(variant.variant_name ?? '-')}</strong></td>
                    <td style={styles.tdMuted}>{String(variant.barcode ?? '-')}</td>
                    <td style={styles.tdMuted}>{formatMoney(costPrice)}</td>
                    <td style={styles.td}><strong>{formatMoney(sellingPrice)}</strong></td>
                    <td style={styles.td}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 36,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#ffffff',
                          background: stock <= 0 ? '#EF4444' : stock <= 5 ? '#F59E0B' : '#27AE4F',
                        }}
                      >
                        {stock}
                      </span>
                    </td>
                    <td style={styles.td}><strong>{formatMoney(stock * sellingPrice)}</strong></td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(isActive ? styles.badgeActive : styles.badgeDanger),
                        }}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <button
                          style={styles.iconBtn}
                          title="Edit variant"
                          onClick={() => setResourceModal({ resourceId: 'productVariants', record: variant })}
                        >
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                        <button
                          style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                          title="Delete variant"
                          onClick={() => handleDeleteResource('productVariants', variant)}
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={9}>No variants found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderProductSection = () => {
    const inactiveProducts = products.filter((product) => product.status === 'Inactive').length;
    const outOfStockProducts = products.filter((product) => product.stock <= 0).length;
    const averageSellingPrice = products.length
      ? products.reduce((sum, product) => sum + product.price, 0) / products.length
      : 0;

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Products</h2>
            <p style={styles.panelSub}>Create, price, track stock, and organize sellable items.</p>
          </div>
          <div style={styles.headerButtonGroup}>
            <button
              style={styles.secondaryBtn}
              onClick={() => exportProductsToExcel(filteredProducts.length ? filteredProducts : products)}
              title="Export Products List to Excel Sheet (.xlsx / .csv)"
            >
              <i className="ti ti-file-export" aria-hidden="true" />
              Export Excel
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => setShowImportProducts(true)}
              title="Import Products from Excel Sheet (.xlsx / .csv)"
            >
              <i className="ti ti-file-spreadsheet" aria-hidden="true" />
              Import Excel
            </button>
            <button
              style={styles.primaryBtn}
              onClick={() => {
                setEditingProduct(null);
                setShowAddProduct(true);
              }}
            >
              <i className="ti ti-plus" aria-hidden="true" />
              Add product
            </button>
          </div>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Products</span>
            <strong style={styles.statValue}> : {products.length}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Stock value</span>
            <strong style={styles.statValue}> : {formatMoney(inventoryValue)}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Avg price</span>
            <strong style={styles.statValue}> : {formatMoney(averageSellingPrice)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px 4px', flexWrap: 'wrap' }}>
          <div style={{ ...styles.searchRow, flex: 1, minWidth: 260, margin: 0 }}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              style={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product, SKU, barcode, category, brand, or unit"
            />
          </div>

          <div style={{ ...styles.creditSummaryBar, margin: 0, flexShrink: 0 }}>
            <span>Active: <strong>{activeProducts}</strong></span>
            <span>Low stock: <strong>{lowStockProducts}</strong></span>
            <span>Out of stock: <strong>{outOfStockProducts}</strong></span>
            <span>Inactive: <strong>{inactiveProducts}</strong></span>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Product', 'SKU', 'Category', 'Brand', 'Unit', 'Price', 'Stock', 'Min', 'Value', 'Tax', 'Status', ''].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{product.name}</strong>
                    <div style={styles.cellSubText}>{product.barcode || 'No barcode'}</div>
                  </td>
                  <td style={styles.tdMuted}>{product.sku}</td>
                  <td style={styles.td}>{product.category}</td>
                  <td style={styles.td}>{getProductBrandName(product)}</td>
                  <td style={styles.td}>{getProductUnitName(product)}</td>
                  <td style={styles.td}>{formatMoney(product.price)}</td>
                  <td style={styles.td}>
                    <strong style={getProductStockStyle(product)}>{product.stock}</strong>
                  </td>
                  <td style={styles.tdMuted}>{product.minimumStock}</td>
                  <td style={styles.td}>{formatMoney(product.price * product.stock)}</td>
                  <td style={styles.tdMuted}>{product.taxRate}%</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...getProductStatusStyle(product) }}>
                      {product.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        style={styles.iconBtn}
                        title="Edit product"
                        onClick={() => {
                          setEditingProduct(product);
                          setShowAddProduct(true);
                        }}
                      >
                        <i className="ti ti-edit" aria-hidden="true" />
                      </button>
                      <button
                        style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                        title="Delete product"
                        onClick={() => handleDeleteProduct(product)}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={12}>
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderStockSection = () => {
    const totalItems = products.length;
    const inStockCount = products.filter((p) => p.stock > p.minimumStock).length;
    const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minimumStock).length;
    const outOfStockCount = products.filter((p) => p.stock <= 0).length;
    const totalValuation = products.reduce((sum, p) => sum + p.price * p.stock, 0);

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Stock Management</h2>
            <p style={styles.panelSub}>Monitor inventory stock levels, track low stock alerts, and perform stock adjustments.</p>
          </div>
          <div style={styles.headerButtonGroup}>
            <button
              style={styles.secondaryBtn}
              onClick={() => exportProductsToExcel(stockFilteredProducts.length ? stockFilteredProducts : products)}
              title="Export Stock List to Excel Sheet"
            >
              <i className="ti ti-file-export" aria-hidden="true" />
              Export Stock Excel
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => setActiveSection('stockMovements')}
              title="View Stock Movement Audit Logs"
            >
              <i className="ti ti-arrows-transfer-up" aria-hidden="true" />
              Stock Movements Log
            </button>
          </div>
        </div>

        <div style={styles.miniStatsGrid}>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Total Products</span>
            <strong style={styles.statValue}> : {totalItems}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>In Stock</span>
            <strong style={{ ...styles.statValue, color: 'var(--app-accent, #27AE4F)' }}> : {inStockCount}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Low Stock Alert</span>
            <strong style={{ ...styles.statValue, color: lowStockCount > 0 ? 'var(--app-warning, #946200)' : 'inherit' }}> : {lowStockCount}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Out of Stock</span>
            <strong style={{ ...styles.statValue, color: outOfStockCount > 0 ? 'var(--app-danger, #b42318)' : 'inherit' }}> : {outOfStockCount}</strong>
          </div>
          <div style={styles.miniStat}>
            <span style={styles.statLabel}>Stock Valuation</span>
            <strong style={styles.statValue}> : {formatMoney(totalValuation)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ ...styles.searchRow, flex: 1, minWidth: 260, margin: 0 }}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              style={styles.searchInput}
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              placeholder="Search product by name, code, barcode..."
            />
          </div>

          <select
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--app-border, #d0d5dd)',
              background: 'var(--app-input-bg, #ffffff)',
              color: 'var(--app-input-text, #1f2937)',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
            value={stockCategoryFilter}
            onChange={(e) => setStockCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 6, background: 'var(--app-surface-soft, #f9fafb)', padding: 3, borderRadius: 8, border: '1px solid var(--app-border, #d0d5dd)' }}>
            {(['All', 'In', 'Low', 'Out'] as const).map((filterOpt) => (
              <button
                key={filterOpt}
                type="button"
                onClick={() => setStockStatusFilter(filterOpt)}
                style={{
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: stockStatusFilter === filterOpt ? 'var(--app-accent, #27AE4F)' : 'transparent',
                  color: stockStatusFilter === filterOpt ? '#ffffff' : 'var(--app-muted, #667085)',
                  transition: 'all 0.15s ease',
                }}
              >
                {filterOpt === 'All' && 'All Items'}
                {filterOpt === 'In' && `In Stock (${inStockCount})`}
                {filterOpt === 'Low' && `Low Stock (${lowStockCount})`}
                {filterOpt === 'Out' && `Out of Stock (${outOfStockCount})`}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Code / SKU', 'Product Name', 'Category', 'Current Stock', 'Min Stock', 'Unit', 'Price', 'Stock Value', 'Stock Status', 'Quick Actions'].map((heading) => (
                  <th key={heading} style={styles.th}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stockFilteredProducts.map((product) => {
                const isOut = product.stock <= 0;
                const isLow = !isOut && product.stock <= product.minimumStock;
                const statusLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock Alert' : 'In Stock';
                const statusStyle = isOut
                  ? { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--app-danger, #b42318)', border: '1px solid rgba(239, 68, 68, 0.3)' }
                  : isLow
                    ? { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--app-warning, #946200)', border: '1px solid rgba(245, 158, 11, 0.3)' }
                    : { background: 'rgba(39, 174, 79, 0.15)', color: 'var(--app-accent, #27AE4F)', border: '1px solid rgba(39, 174, 79, 0.3)' };

                return (
                  <tr key={product.id} style={styles.tr}>
                    <td style={styles.tdMuted}>{product.sku}</td>
                    <td style={styles.td}>
                      <strong>{product.name}</strong>
                      <div style={styles.cellSubText}>{product.barcode || 'No barcode'}</div>
                    </td>
                    <td style={styles.td}>{product.category}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 38,
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 800,
                          color: '#ffffff',
                          background: isOut ? '#EF4444' : isLow ? '#F59E0B' : '#27AE4F',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td style={styles.tdMuted}>{product.minimumStock}</td>
                    <td style={styles.td}>{getProductUnitName(product)}</td>
                    <td style={styles.td}>{formatMoney(product.price)}</td>
                    <td style={styles.td}>
                      <strong>{formatMoney(product.price * product.stock)}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, ...statusStyle }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          style={{
                            border: '1px solid var(--app-border, #d0d5dd)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'rgba(39, 174, 79, 0.12)',
                            color: 'var(--app-accent-strong, #16834f)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onClick={() => {
                            setStockAdjustProduct(product);
                            setStockAdjustMode('add');
                            setStockAdjustQty(10);
                            setStockAdjustRemarks('');
                          }}
                          title="Add Stock (+)"
                        >
                          <i className="ti ti-plus" aria-hidden="true" />
                          In
                        </button>
                        <button
                          type="button"
                          style={{
                            border: '1px solid var(--app-border, #d0d5dd)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: 'var(--app-danger, #b42318)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onClick={() => {
                            setStockAdjustProduct(product);
                            setStockAdjustMode('remove');
                            setStockAdjustQty(1);
                            setStockAdjustRemarks('');
                          }}
                          title="Reduce Stock (-)"
                        >
                          <i className="ti ti-minus" aria-hidden="true" />
                          Out
                        </button>
                        <button
                          type="button"
                          style={{
                            border: '1px solid var(--app-border, #d0d5dd)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            fontSize: 12,
                            fontWeight: 700,
                            background: 'var(--app-button-bg, #ffffff)',
                            color: 'var(--app-button-text, #344054)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onClick={() => {
                            setStockAdjustProduct(product);
                            setStockAdjustMode('set');
                            setStockAdjustQty(product.stock);
                            setStockAdjustRemarks('');
                          }}
                          title="Set Exact Quantity"
                        >
                          <i className="ti ti-adjustments" aria-hidden="true" />
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stockFilteredProducts.length === 0 && (
                <tr>
                  <td style={styles.emptyCell} colSpan={10}>
                    No products match the selected stock filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderReportSection = () => {
    const filterByDateRange = (sale: PosSalePayload) => {
      if (reportDateFilter === 'all') return true;
      if (!sale.sold_at) return true;

      const saleDate = new Date(sale.sold_at);
      const now = new Date();

      if (reportDateFilter === 'daily') {
        return (
          saleDate.getFullYear() === now.getFullYear() &&
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getDate() === now.getDate()
        );
      }

      if (reportDateFilter === 'weekly') {
        const dayOfWeek = now.getDay();
        const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - distanceToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        return saleDate >= startOfWeek;
      }

      if (reportDateFilter === 'monthly') {
        return (
          saleDate.getFullYear() === now.getFullYear() &&
          saleDate.getMonth() === now.getMonth()
        );
      }

      if (reportDateFilter === 'yearly') {
        return saleDate.getFullYear() === now.getFullYear();
      }

      if (reportDateFilter === 'custom') {
        const from = customFromDate ? new Date(customFromDate + 'T00:00:00') : null;
        const to = customToDate ? new Date(customToDate + 'T23:59:59.999') : null;
        if (from && saleDate < from) return false;
        if (to && saleDate > to) return false;
        return true;
      }

      return true;
    };

    const completedSales = salesReportRows.filter((sale) => sale.status === 'completed' && filterByDateRange(sale));
    const allSales = [...completedSales, ...heldReportRows];
    const grossSales = sumSales(completedSales, (sale) => sale.total_amount);
    const totalDiscounts = sumSales(completedSales, (sale) => sale.discount_amount);
    const totalTax = sumSales(completedSales, (sale) => sale.tax_amount);
    const totalCredit = sumSales(completedSales, (sale) => sale.credit_amount);
    const totalPaid = sumSales(completedSales, (sale) => sale.paid_amount);
    const unitsSold = completedSales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const averageBill = completedSales.length ? grossSales / completedSales.length : 0;
    const stockValue = products.reduce((sum, product) => sum + product.price * product.stock, 0);
    const stockMovementRows = resourceRows.stockMovements ?? [];
    const taxRows = resourceRows.taxes ?? [];
    const discountRows = resourceRows.discounts ?? [];

    const groupBy = <T,>(items: T[], keySelector: (item: T) => string) =>
      items.reduce<Record<string, T[]>>((groups, item) => {
        const key = keySelector(item);
        groups[key] = [...(groups[key] ?? []), item];
        return groups;
      }, {});

    const salesByCashier = Object.entries(groupBy(completedSales, (sale) => sale.cashier_name || 'Unknown cashier'))
      .map(([cashier, sales]) => ({
        cashier,
        count: sales.length,
        total: sumSales(sales, (sale) => sale.total_amount),
        credit: sumSales(sales, (sale) => sale.credit_amount),
      }))
      .sort((a, b) => b.total - a.total);

    const productReport = Object.values(
      completedSales.flatMap((sale) => sale.items).reduce<Record<string, {
        product: string;
        sku: string;
        quantity: number;
        total: number;
        tax: number;
        discount: number;
      }>>((rows, item) => {
        const key = String(item.product_id);
        const previous = rows[key] ?? {
          product: item.product_name,
          sku: item.product_code,
          quantity: 0,
          total: 0,
          tax: 0,
          discount: 0,
        };

        rows[key] = {
          ...previous,
          quantity: previous.quantity + item.quantity,
          total: previous.total + item.line_total,
          tax: previous.tax + item.tax_amount,
          discount: previous.discount + item.discount_amount,
        };
        return rows;
      }, {}),
    ).sort((a, b) => b.total - a.total);

    const paymentReport = Object.entries(groupBy(completedSales, (sale) => sale.payment_method || 'Unknown'))
      .map(([method, sales]) => ({
        method,
        count: sales.length,
        paid: sumSales(sales, (sale) => sale.paid_amount),
        total: sumSales(sales, (sale) => sale.total_amount),
      }))
      .sort((a, b) => b.total - a.total);

    const lowStockRows = products
      .filter((product) => product.status === 'Low stock' || product.stock <= product.minimumStock)
      .sort((a, b) => a.stock - b.stock);

    const reportTabs: Array<{ id: ReportTab; label: string; icon: string }> = [
      { id: 'summary', label: 'Summary', icon: 'ti-chart-bar' },
      { id: 'sales', label: 'Sales', icon: 'ti-receipt' },
      { id: 'cashiers', label: 'Cashiers', icon: 'ti-user-dollar' },
      { id: 'products', label: 'Products', icon: 'ti-package' },
      { id: 'items', label: 'Line items', icon: 'ti-list-check' },
      { id: 'inventory', label: 'Inventory', icon: 'ti-building-warehouse' },
      { id: 'payments', label: 'Payments', icon: 'ti-credit-card' },
      { id: 'taxDiscounts', label: 'Tax & discounts', icon: 'ti-percentage' },
      { id: 'credit', label: 'Credit', icon: 'ti-user-credit-card' },
    ];

    const exportReportToCsv = (title: string, headers: string[], rows: (string | number)[][]) => {
      const csvContent = [
        `"Report: ${title}"`,
        `"Filter: ${reportDateFilter.toUpperCase()} (${customFromDate || 'Start'} to ${customToDate || 'Today'})"`,
        `"Generated At: ${new Date().toLocaleString()}"`,
        '',
        headers.map((h) => `"${h}"`).join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.csv`;
      link.click();
    };

    const exportReportToPdf = (title: string, headers: string[], rows: (string | number)[][], kpis?: [string, string | number][]) => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const kpiHtml = kpis
        ? `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
            ${kpis
          .map(
            ([label, val]) => `
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 14px; border-radius: 8px;">
                <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">${label}</div>
                <div style="font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 2px;">${val}</div>
              </div>
            `
          )
          .join('')}
          </div>`
        : '';

      const tableHeaderHtml = headers.map((h) => `<th style="padding: 10px 12px; background: #0F172A; color: #ffffff; text-align: left; font-size: 12px; font-weight: 800;">${h}</th>`).join('');

      const tableBodyHtml = rows
        .map(
          (row, idx) => `
        <tr style="background: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}; border-bottom: 1px solid #E2E8F0;">
          ${row.map((cell) => `<td style="padding: 9px 12px; font-size: 12px; font-weight: 600; color: #334155;">${cell ?? '-'}</td>`).join('')}
        </tr>
      `
        )
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title} - Nova POS Report</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 24px; color: #0F172A; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 20px; }
              .title { font-size: 22px; font-weight: 900; color: #0F172A; }
              .meta { font-size: 12px; color: #64748B; text-align: right; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="title">NOVA POS - ${title}</div>
                <div style="font-size: 13px; font-weight: 700; color: #2563EB; margin-top: 2px;">Date Range: ${reportDateFilter.toUpperCase()} (${customFromDate || 'Start'} to ${customToDate || 'Today'})</div>
              </div>
              <div class="meta">
                <div>Generated: <strong>${new Date().toLocaleString()}</strong></div>
                <div>Report Category: <strong>/api/pos-sales/reports/${activeReportTab}</strong></div>
              </div>
            </div>
            ${kpiHtml}
            <table>
              <thead><tr>${tableHeaderHtml}</tr></thead>
              <tbody>${tableBodyHtml}</tbody>
            </table>
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    const renderReportBody = () => {
      // Extract backend API live payload data if present
      const liveData = reportLivePayload;

      if (activeReportTab === 'summary') {
        const liveKpis: [string, string | number][] = [
          ['Net sales', formatMoney(liveData?.netSales ?? grossSales)],
          ['Total Bills', liveData?.count ?? completedSales.length],
          ['Units sold', liveData?.unitsSold ?? unitsSold],
          ['Average bill', formatMoney(liveData?.averageBill ?? averageBill)],
          ['Paid cash/card', formatMoney(liveData?.paidTotal ?? totalPaid)],
          ['Credit balance', formatMoney(liveData?.creditTotal ?? totalCredit)],
          ['Tax collected', formatMoney(liveData?.totalTax ?? totalTax)],
          ['Discounts', formatMoney(liveData?.totalDiscount ?? totalDiscounts)],
        ];

        return (
          <>
            <div style={styles.reportKpiGrid}>
              {liveKpis.map(([label, value]) => (
                <div key={label} style={styles.reportKpi}>
                  <span style={styles.statLabel}>{label}</span>
                  <strong style={styles.statValue}>{value}</strong>
                </div>
              ))}
            </div>
            <div style={styles.reportGridTwo}>
              {renderSimpleReportTable('Top products', ['Product', 'Qty', 'Sales'], (liveData?.topProducts || productReport).slice(0, 6).map((row: any) => [row.product || row.name || row.product_name, row.quantity || row.qty || 0, formatMoney(row.total || row.total_sales || 0)]))}
              {renderSimpleReportTable('Cashier performance', ['Cashier', 'Bills', 'Sales'], (liveData?.cashiers || salesByCashier).slice(0, 6).map((row: any) => [row.cashier || row.cashier_name, row.count || row.sales_count || 0, formatMoney(row.total || row.total_sales || 0)]))}
            </div>
          </>
        );
      }

      if (activeReportTab === 'sales') {
        const salesList = liveData?.sales || allSales;
        const headers = ['Sale no', 'Time', 'Customer', 'Cashier', 'Payment', 'Total', 'Status'];
        const rows = salesList.map((sale: any) => [
          sale.sale_no,
          formatDateTime(sale.sold_at || sale.createdAt),
          sale.customer_name || sale.customer?.name || 'Walk-in Customer',
          sale.cashier_name || sale.cashier?.full_name || 'Cashier',
          sale.payment_method,
          formatMoney(sale.total_amount),
          sale.status,
        ]);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Sales Ledger Report', headers, rows)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Sales Ledger Report', headers, rows)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            {renderSimpleReportTable('Sales ledger', headers, rows)}
          </div>
        );
      }

      if (activeReportTab === 'cashiers') {
        const cashierList = liveData?.cashiers || salesByCashier;
        const headers = ['Cashier', 'Bills', 'Sales', 'Credit', 'Average Bill'];
        const rows = cashierList.map((row: any) => [
          row.cashier || row.cashier_name,
          row.count || row.sales_count || 0,
          formatMoney(row.total || row.total_sales || 0),
          formatMoney(row.credit || row.credit_amount || 0),
          formatMoney(row.count ? (row.total || row.total_sales || 0) / row.count : 0),
        ]);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Cashier Performance Report', headers, rows)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Cashier Performance Report', headers, rows)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            {renderSimpleReportTable('Cashier performance report', headers, rows)}
          </div>
        );
      }

      if (activeReportTab === 'products') {
        const prodList = liveData?.products || productReport;
        const headers = ['Product', 'SKU', 'Qty Sold', 'Discount', 'Tax', 'Total Sales'];
        const rows = prodList.map((row: any) => [
          row.product || row.name || row.product_name,
          row.sku || row.product_code || '-',
          row.quantity || row.qty || 0,
          formatMoney(row.discount || 0),
          formatMoney(row.tax || 0),
          formatMoney(row.total || row.total_sales || 0),
        ]);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Product Sales Report', headers, rows)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Product Sales Report', headers, rows)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            {renderSimpleReportTable('Product sales report', headers, rows)}
          </div>
        );
      }

      if (activeReportTab === 'items') {
        const itemList = liveData?.products || productReport;
        const headers = ['Line Item', 'Product SKU', 'Units Sold', 'Avg Unit Price', 'Total Sales'];
        const rows = itemList.map((row: any) => [
          row.product || row.name || row.product_name,
          row.sku || row.product_code || '-',
          row.quantity || row.qty || 0,
          formatMoney(row.quantity ? (row.total || 0) / row.quantity : 0),
          formatMoney(row.total || row.total_sales || 0),
        ]);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Line Items Report', headers, rows)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Line Items Report', headers, rows)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            {renderSimpleReportTable('Line items sold report', headers, rows)}
          </div>
        );
      }

      if (activeReportTab === 'inventory') {
        const invProducts = liveData?.products || lowStockRows;
        const lowStockHeaders = ['Product', 'SKU', 'Stock Qty', 'Minimum Stock', 'Stock Value'];
        const lowStockData = invProducts.map((p: any) => [
          p.name || p.product,
          p.sku || '-',
          p.stock ?? p.quantity ?? 0,
          p.minimumStock ?? p.min_stock ?? 5,
          formatMoney((p.stock ?? p.quantity ?? 0) * (p.price ?? 0)),
        ]);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Inventory Report', lowStockHeaders, lowStockData)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Inventory Report', lowStockHeaders, lowStockData)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            <div style={styles.reportGridTwo}>
              {renderSimpleReportTable('Low stock alerts', lowStockHeaders, lowStockData)}
              {renderSimpleReportTable(
                'Recent stock movements',
                ['Product', 'Type', 'Qty', 'Reference'],
                stockMovementRows.slice(0, 10).map((movement) => [
                  getLookupLabel('product_id', movement.product_id),
                  movement.type ?? '-',
                  movement.quantity ?? 0,
                  movement.reference_id ?? '-',
                ]),
              )}
            </div>
            <div style={styles.reportSummaryBand}>
              <span>Total Inventory Valuation</span>
              <strong>{formatMoney(liveData?.totalStockValue ?? stockValue)}</strong>
            </div>
          </div>
        );
      }

      if (activeReportTab === 'payments') {
        const pList = liveData?.paymentMethods || paymentReport;
        const headers = ['Payment Method', 'Transactions', 'Total Collected'];
        const rows = pList.map((row: any) => [
          row.method || row.name || 'Cash',
          row.count || row.sales_count || 0,
          formatMoney(row.total || row.total_amount || row.paid || 0),
        ]);

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Payment Methods Report', headers, rows)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Payment Methods Report', headers, rows)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            {renderSimpleReportTable('Payment method breakdown', headers, rows)}
          </div>
        );
      }

      if (activeReportTab === 'taxDiscounts') {
        const taxDataList = Array.isArray(liveData?.taxes) ? liveData.taxes : taxRows;
        const discountDataList = Array.isArray(liveData?.discounts) ? liveData.discounts : discountRows;

        const taxHeaders = ['Tax Name', 'Percentage Rate', 'Status'];
        const taxTableRows = taxDataList.map((tax: any) => [tax.name ?? '-', `${tax.percentage ?? tax.rate ?? 0}%`, tax.status === false ? 'Inactive' : 'Active']);

        const collectedTaxVal = liveData?.tax?.tax_amount ?? liveData?.totalTax ?? totalTax;
        const totalDiscountVal = liveData?.discounts?.discount_amount ?? liveData?.totalDiscount ?? totalDiscounts;

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Tax & Discounts Report', taxHeaders, taxTableRows)}>
                <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
              </button>
              <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Tax & Discounts Report', taxHeaders, taxTableRows)}>
                <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
              </button>
            </div>
            <div style={styles.reportGridTwo}>
              {renderSimpleReportTable('Tax configuration report', taxHeaders, taxTableRows)}
              {renderSimpleReportTable(
                'Discount rules report',
                ['Discount', 'Type', 'Value', 'Status'],
                discountDataList.map((discount: any) => [
                  discount.name ?? '-',
                  discount.discount_type ?? '-',
                  discount.discount_type === 'percentage' ? `${discount.value ?? 0}%` : formatMoney(Number(discount.value ?? 0)),
                  discount.status === false ? 'Inactive' : 'Active',
                ]),
              )}
            </div>
            <div style={styles.reportSummaryBand}>
              <span>Collected Tax / Total Discounts Given</span>
              <strong>{formatMoney(collectedTaxVal)} / {formatMoney(totalDiscountVal)}</strong>
            </div>
          </div>
        );
      }

      // Credit report tab
      const creditList = liveData?.creditSales || completedSales.filter((sale) => sale.credit_amount > 0);
      const creditHeaders = ['Bill No', 'Customer Name', 'Cashier', 'Credit Outstanding', 'Due Days'];
      const creditRows = creditList.map((sale: any) => [
        sale.sale_no,
        sale.customer_name || sale.customer?.name || 'Customer',
        sale.cashier_name || sale.cashier?.full_name || 'Cashier',
        formatMoney(sale.credit_amount || sale.credit_balance || 0),
        sale.due_days ?? 30,
      ]);

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToPdf('Customer Credit Report', creditHeaders, creditRows)}>
              <i className="ti ti-file-text" style={{ marginRight: 6 }} aria-hidden="true" /> Print / Export PDF
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={() => exportReportToCsv('Customer Credit Report', creditHeaders, creditRows)}>
              <i className="ti ti-file-spreadsheet" style={{ marginRight: 6 }} aria-hidden="true" /> Export Excel CSV
            </button>
          </div>
          <div style={styles.reportGridTwo}>
            {renderSimpleReportTable('Customer credit outstanding report', creditHeaders, creditRows)}
            {renderSimpleReportTable(
              'Held orders summary',
              ['Sale no', 'Customer', 'Cashier', 'Total'],
              heldReportRows.map((sale) => [
                sale.sale_no,
                sale.customer_name,
                sale.cashier_name,
                formatMoney(sale.total_amount),
              ]),
            )}
          </div>
        </div>
      );
    };

    return (
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Reports & Analytics Dashboard</h2>
            <p style={styles.panelSub}>Comprehensive reports for sales, cashiers, stock, payment methods, tax, discounts, and credit.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isReportLoading && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', background: 'rgba(37, 99, 235, 0.1)', padding: '4px 10px', borderRadius: 6 }}>
                ⏳ Syncing Live API...
              </span>
            )}
            <button
              style={styles.secondaryBtn}
              onClick={() => setReportRefreshKey((value) => value + 1)}
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* Date Range Filter Preset Selector Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 6 }}>
              📅 Date Range:
            </span>
            {[
              ['all', 'All Time'],
              ['daily', 'Today'],
              ['weekly', 'This Week'],
              ['monthly', 'This Month'],
              ['yearly', 'This Year'],
              ['custom', 'Custom Range'],
            ].map(([id, label]) => {
              const isSelected = reportDateFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    border: isSelected ? '1.5px solid #1D4ED8' : '1px solid #CBD5E1',
                    background: isSelected ? '#2563EB' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#475569',
                    boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                    transform: isSelected ? 'scale(1.02)' : 'none',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => setReportDateFilter(id as ReportDateFilter)}
                >
                  {isSelected && <i className="ti ti-check" style={{ fontSize: 13, fontWeight: 900 }} aria-hidden="true" />}
                  {label}
                </button>
              );
            })}
          </div>

          {reportDateFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                From:
                <input
                  type="date"
                  style={{ border: '1px solid #CBD5E1', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 700, background: '#ffffff', color: '#0F172A' }}
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                To:
                <input
                  type="date"
                  style={{ border: '1px solid #CBD5E1', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 700, background: '#ffffff', color: '#0F172A' }}
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {/* 9 Category Report Tab Switcher */}
        <div style={styles.reportTabBar}>
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              style={{
                ...styles.reportTab,
                ...(activeReportTab === tab.id ? styles.reportTabActive : {}),
              }}
              onClick={() => setActiveReportTab(tab.id)}
            >
              <i className={`ti ${tab.icon}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
        <div style={styles.reportBody}>
          {renderReportBody()}
        </div>
      </section>
    );
  };

  const renderSettingsSection = () => (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.panelTitle}>Settings</h2>
          <p style={styles.panelSub}>Manage payment methods, receipt printing, and cashier discount rules.</p>
        </div>
      </div>

      {settingsMessage && <div style={styles.settingsMessage}>{settingsMessage}</div>}

      <div style={styles.settingsGrid}>
        <article style={styles.settingsCard}>
          <div style={styles.settingsCardHeader}>
            <div>
              <h3 style={styles.settingsTitle}>Payment methods</h3>
              <p style={styles.settingsSub}>Enable methods available at checkout.</p>
            </div>
            <button type="button" style={styles.secondaryBtn} onClick={() => void savePaymentMethods()}>
              Save
            </button>
          </div>

          <div style={styles.optionGrid}>
            {posSettings.payment_methods.map((method) => (
              <label key={method.key} style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={method.enabled}
                  onChange={() => handleTogglePaymentMethod(method.key)}
                />
                <span>{method.label}</span>
              </label>
            ))}
          </div>
        </article>

        <article style={styles.settingsCard}>
          <div style={styles.settingsCardHeader}>
            <div>
              <h3 style={styles.settingsTitle}>Receipt setup</h3>
              <p style={styles.settingsSub}>Control printed receipt text, logo, and hardware options.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href="/settings"
                style={{
                  ...styles.secondaryBtn,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <i className="ti ti-printer" aria-hidden="true" />
                Hardware & Printing Options
              </a>
              <button type="button" style={styles.secondaryBtn} onClick={() => void saveReceiptSettings()}>
                Save
              </button>
            </div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.formFieldWide}>
              <span style={styles.formLabel}>Header</span>
              <input
                style={styles.formInput}
                value={posSettings.receipt.header}
                onChange={(event) => handleReceiptChange('header', event.target.value)}
              />
            </label>
            <label style={styles.formFieldWide}>
              <span style={styles.formLabel}>Footer</span>
              <textarea
                style={{ ...styles.formInput, ...styles.formTextarea }}
                value={posSettings.receipt.footer}
                onChange={(event) => handleReceiptChange('footer', event.target.value)}
              />
            </label>
            {[
              ['show_logo', 'Show logo'],
              ['show_cashier', 'Show cashier'],
              ['show_tax_breakdown', 'Show tax breakdown'],
            ].map(([key, label]) => (
              <label key={key} style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={Boolean(posSettings.receipt[key as keyof PosSettingsPayload['receipt']])}
                  onChange={(event) =>
                    handleReceiptChange(
                      key as keyof PosSettingsPayload['receipt'],
                      event.target.checked as never,
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </article>

        <article style={styles.settingsCard}>
          <div style={styles.settingsCardHeader}>
            <div>
              <h3 style={styles.settingsTitle}>Discount rules</h3>
              <p style={styles.settingsSub}>Set cashier discount limits and approval thresholds.</p>
            </div>
            <button type="button" style={styles.secondaryBtn} onClick={() => void saveDiscountRules()}>
              Save
            </button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={posSettings.discount_rules.cashier_discount_enabled}
                onChange={(event) => handleDiscountRuleChange('cashier_discount_enabled', event.target.checked)}
              />
              <span>Cashier discounts</span>
            </label>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={posSettings.discount_rules.allow_bill_discount}
                onChange={(event) => handleDiscountRuleChange('allow_bill_discount', event.target.checked)}
              />
              <span>Bill discount</span>
            </label>
            <label style={styles.formField}>
              <span style={styles.formLabel}>Max cashier discount %</span>
              <input
                style={styles.formInput}
                type="number"
                min={0}
                value={posSettings.discount_rules.max_cashier_discount_percent}
                onChange={(event) => handleDiscountRuleChange('max_cashier_discount_percent', Number(event.target.value) || 0)}
              />
            </label>
            <label style={styles.formField}>
              <span style={styles.formLabel}>Manager approval above %</span>
              <input
                style={styles.formInput}
                type="number"
                min={0}
                value={posSettings.discount_rules.manager_approval_above_percent}
                onChange={(event) => handleDiscountRuleChange('manager_approval_above_percent', Number(event.target.value) || 0)}
              />
            </label>
          </div>
        </article>
      </div>
    </section>
  );

  const renderSimpleReportTable = (
    title: string,
    headings: string[],
    rows: Array<Array<React.ReactNode>>,
  ) => (
    <div style={styles.reportTableCard}>
      <div style={styles.reportTableTitle}>{title}</div>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {headings.map((heading) => (
                <th key={heading} style={styles.th}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} style={styles.tr}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${index}-${cellIndex}`} style={cellIndex === 0 ? styles.td : styles.tdMuted}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={styles.emptyCell} colSpan={headings.length}>
                  No report data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContent = () => {
    if (activeSection === 'products') {
      return renderProductSection();
    }

    if (activeSection === 'stock') {
      return renderStockSection();
    }

    if (activeSection === 'categories') {
      return (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Categories</h2>
              <p style={styles.panelSub}>Create, edit, and control product category visibility.</p>
            </div>
            <button
              style={styles.primaryBtn}
              onClick={() => {
                setEditingCategory(null);
                setShowAddCategory(true);
              }}
            >
              <i className="ti ti-category-plus" aria-hidden="true" />
              Add category
            </button>
          </div>

          <div style={styles.miniStatsGrid}>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Total categories</span>
              <strong style={styles.statValue}>{categories.length}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Active</span>
              <strong style={styles.statValue}>{activeCategories}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Inactive</span>
              <strong style={styles.statValue}>{categories.length - activeCategories}</strong>
            </div>
          </div>

          <div style={styles.searchRow}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              style={styles.searchInput}
              value={categoryQuery}
              onChange={(event) => setCategoryQuery(event.target.value)}
              placeholder="Search categories or descriptions"
            />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Category', 'Description', 'Products', 'Status', ''].map((heading) => (
                    <th key={heading} style={styles.th}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => {
                  const productCount = products.filter((product) => product.category === category.name).length;

                  return (
                    <tr key={category.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{category.name}</strong>
                      </td>
                      <td style={styles.tdDescription}>
                        {category.description || 'No description'}
                      </td>
                      <td style={styles.td}>{productCount}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(category.status ? styles.badgeActive : styles.badgeDanger),
                          }}
                        >
                          {category.status ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionGroup}>
                          <button
                            style={styles.iconBtn}
                            title="Edit category"
                            onClick={() => {
                              setEditingCategory(category);
                              setShowAddCategory(true);
                            }}
                          >
                            <i className="ti ti-edit" aria-hidden="true" />
                          </button>
                          <button
                            style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                            title="Delete category"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td style={styles.emptyCell} colSpan={5}>
                      No categories found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    if (activeSection === 'stockMovements') {
      return renderStockMovementSection();
    }

    if (activeSection === 'taxes') {
      return renderTaxSection();
    }

    if (activeSection === 'discounts') {
      return renderDiscountSection();
    }

    if (activeSection === 'productVariants') {
      return renderVariantSection();
    }

    if (activeSection in RESOURCE_META) {
      return renderManagedResourceSection(activeSection as ManagedResourceId);
    }

    if (activeSection === 'customers') {

      const handleSettlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settlingCustomer) return;
        const payAmt = Number(settleAmount) || 0;
        if (payAmt <= 0) return;

        const newBalance = Math.max(0, settlingCustomer.balance - payAmt);
        const updatedCustomer: PosCustomer = {
          ...settlingCustomer,
          balance: newBalance,
        };

        try {
          await updatePosMasterRecord(
            API_RESOURCES.CUSTOMERS,
            settlingCustomer.id,
            {
              name: updatedCustomer.name,
              phone: updatedCustomer.phone,
              email: updatedCustomer.email,
              address: updatedCustomer.address,
              credit_limit: updatedCustomer.creditLimit,
              current_balance: newBalance,
              current_credit: newBalance,
              balance: newBalance,
              status: updatedCustomer.status === 'Active',
            },
            'customer',
          );
        } catch { }

        try {
          await createPosMasterRecord(
            API_RESOURCES.CUSTOMER_CREDIT_TRANSACTIONS,
            {
              customer_id: settlingCustomer.id,
              type: 'payment',
              amount: -payAmt,
              remarks: `Debt payment received (${settleMethod}) ${settleNotes ? `- ${settleNotes}` : ''}`,
            },
            'customerCreditTransaction',
          );
        } catch { }

        setCustomers((prev) => prev.map((c) => (c.id === settlingCustomer.id ? updatedCustomer : c)));
        setSettlingCustomer(null);
        setSettleAmount('');
        setSettleNotes('');
      };

      return (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Customers & Credited Accounts</h2>
              <p style={styles.panelSub}>Manage customer profiles, credit limits, outstanding balances, and receive debt payments.</p>
            </div>
            <button
              style={styles.primaryBtn}
              onClick={() => {
                setEditingCustomer(null);
                setShowAddCustomer(true);
              }}
            >
              <i className="ti ti-user-plus" aria-hidden="true" />
              Add customer
            </button>
          </div>

          <div style={styles.miniStatsGrid}>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Customers</span>
              <strong style={styles.statValue}>{customers.length}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Active</span>
              <strong style={styles.statValue}>{activeCustomers}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Total Credited Debt</span>
              <strong style={{ ...styles.statValue, color: '#EF4444' }}>{formatMoney(totalCreditBalance)}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Total Credit Limit</span>
              <strong style={styles.statValue}>{formatMoney(totalCreditLimit)}</strong>
            </div>
          </div>

          <div style={styles.creditSummaryBar}>
            <span>Available credit: <strong>{formatMoney(Math.max(totalCreditLimit - totalCreditBalance, 0))}</strong></span>
            <span>Customers with debt: <strong>{customers.filter((c) => c.balance > 0).length}</strong></span>
            <span>Blocked: <strong>{customers.length - activeCustomers}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'all', label: `All (${customers.length})` },
                { key: 'credit', label: `Has Debt (${customers.filter((c) => c.balance > 0).length})` },
                { key: 'zero', label: `Zero Balance (${customers.filter((c) => c.balance === 0).length})` },
                { key: 'blocked', label: `Blocked (${customers.filter((c) => c.status === 'Blocked').length})` },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid var(--app-border, #d0d5dd)',
                    background: customerFilter === filter.key ? 'var(--app-accent, #27AE4F)' : 'var(--app-surface, #ffffff)',
                    color: customerFilter === filter.key ? '#ffffff' : 'var(--app-text, #1f2937)',
                  }}
                  onClick={() => setCustomerFilter(filter.key as any)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.searchRow}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              style={styles.searchInput}
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Search customer name, phone, or email"
            />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Customer', 'Phone', 'Email', 'Credit Limit', 'Credited Amount (Debt)', 'Available', 'Status', ''].map((heading) => (
                    <th key={heading} style={styles.th}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const available = customer.creditLimit - customer.balance;

                  return (
                    <tr key={customer.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{customer.name}</strong>
                        {customer.address && <div style={styles.cellSubText}>{customer.address}</div>}
                      </td>
                      <td style={styles.tdMuted}>{customer.phone}</td>
                      <td style={styles.tdMuted}>{customer.email || '-'}</td>
                      <td style={styles.td}>{formatMoney(customer.creditLimit)}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 44,
                            padding: '3px 10px',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 800,
                            color: '#ffffff',
                            background: customer.balance > 0 ? '#EF4444' : '#27AE4F',
                          }}
                        >
                          {formatMoney(customer.balance)}
                        </span>
                      </td>
                      <td style={styles.td}>{formatMoney(Math.max(available, 0))}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(customer.status === 'Blocked' ? styles.badgeDanger : styles.badgeActive),
                          }}
                        >
                          {customer.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionGroup}>
                          <button
                            style={styles.iconBtn}
                            title="View Customer Credit History & Invoices"
                            onClick={() => setHistoryCustomer(customer)}
                          >
                            <i className="ti ti-file-text" aria-hidden="true" />
                          </button>
                          {customer.balance > 0 && (
                            <button
                              style={{ ...styles.iconBtn, color: '#27AE4F' }}
                              title="Receive Payment / Settle Debt"
                              onClick={() => {
                                setSettlingCustomer(customer);
                                setSettleAmount(String(customer.balance));
                              }}
                            >
                              <i className="ti ti-cash-banknote" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            style={styles.iconBtn}
                            title="Edit customer"
                            onClick={() => {
                              setEditingCustomer(customer);
                              setShowAddCustomer(true);
                            }}
                          >
                            <i className="ti ti-edit" aria-hidden="true" />
                          </button>
                          <button
                            style={{ ...styles.iconBtn, ...styles.dangerIconBtn }}
                            title="Delete customer"
                            onClick={() => handleDeleteCustomer(customer)}
                          >
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td style={styles.emptyCell} colSpan={8}>
                      No customers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {settlingCustomer && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSettlingCustomer(null);
              }}
            >
              <form
                onSubmit={handleSettlePayment}
                style={{
                  width: 460,
                  maxWidth: '100%',
                  background: 'var(--app-surface, #ffffff)',
                  color: 'var(--app-text, #1f2937)',
                  border: '1px solid var(--app-border, #d0d5dd)',
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong, #101828)', margin: 0 }}>
                      Settle Customer Credit / Debt
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--app-muted, #667085)', marginTop: 2 }}>
                      Receiving debt payment for <strong>{settlingCustomer.name}</strong>
                    </p>
                  </div>
                  <button type="button" style={styles.iconBtn} onClick={() => setSettlingCustomer(null)}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>Current Credited Debt:</span>
                  <strong style={{ fontSize: 20, color: '#EF4444' }}>{formatMoney(settlingCustomer.balance)}</strong>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text-strong, #101828)' }}>
                    Payment Received Amount (LKR) *
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={settlingCustomer.balance}
                    required
                    autoFocus
                    style={{
                      border: '1.5px solid var(--app-accent, #27AE4F)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 18,
                      fontWeight: 800,
                      background: 'var(--app-input-bg, #ffffff)',
                      color: 'var(--app-input-text, #1f2937)',
                    }}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #667085)' }}>Payment Method</span>
                  <select
                    style={{
                      border: '1px solid var(--app-border, #d0d5dd)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: 'var(--app-input-bg, #ffffff)',
                      color: 'var(--app-input-text, #1f2937)',
                    }}
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as any)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card / POS Terminal</option>
                    <option value="Bank Transfer">Bank Transfer / Online</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #667085)' }}>Receipt / Payment Reference</span>
                  <input
                    type="text"
                    style={{
                      border: '1px solid var(--app-border, #d0d5dd)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'var(--app-input-bg, #ffffff)',
                      color: 'var(--app-input-text, #1f2937)',
                    }}
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    placeholder="e.g. Cheque #49281 or Cash Receipt"
                  />
                </label>

                {Number(settleAmount) > 0 && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'var(--app-surface-soft, #f9fafb)', border: '1px solid var(--app-border, #d0d5dd)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Remaining Balance After Payment:</span>
                    <strong style={{ color: Math.max(0, settlingCustomer.balance - Number(settleAmount)) === 0 ? '#27AE4F' : '#EF4444' }}>
                      {formatMoney(Math.max(0, settlingCustomer.balance - Number(settleAmount)))}
                    </strong>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="button" style={{ ...styles.secondaryBtn, flex: 1 }} onClick={() => setSettlingCustomer(null)}>
                    Cancel
                  </button>
                  <button type="submit" style={{ ...styles.primaryBtn, flex: 1, background: '#27AE4F' }}>
                    <i className="ti ti-check" aria-hidden="true" /> Save Payment
                  </button>
                </div>
              </form>
            </div>
          )}

          {historyCustomer && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setHistoryCustomer(null);
              }}
            >
              <div
                style={{
                  width: 680,
                  maxWidth: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  background: 'var(--app-surface, #ffffff)',
                  color: 'var(--app-text, #1f2937)',
                  border: '1px solid var(--app-border, #d0d5dd)',
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong, #101828)', margin: 0 }}>
                      Customer Credit Statement & History
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--app-muted, #667085)', marginTop: 2 }}>
                      {historyCustomer.name} • {historyCustomer.phone} • {historyCustomer.email || 'No email'}
                    </p>
                  </div>
                  <button type="button" style={styles.iconBtn} onClick={() => setHistoryCustomer(null)}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--app-surface-soft, #f9fafb)', border: '1px solid var(--app-border, #d0d5dd)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-muted, #667085)', textTransform: 'uppercase' }}>Credit Limit</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong, #101828)', marginTop: 2 }}>{formatMoney(historyCustomer.creditLimit)}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase' }}>Current Credited Debt</span>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', marginTop: 2 }}>{formatMoney(historyCustomer.balance)}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'rgba(39, 174, 79, 0.1)', border: '1px solid rgba(39, 174, 79, 0.3)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#16834F', textTransform: 'uppercase' }}>Available Credit</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#27AE4F', marginTop: 2 }}>{formatMoney(Math.max(0, historyCustomer.creditLimit - historyCustomer.balance))}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--app-text-strong, #101828)' }}>
                    Sales & Credit Invoices ({salesReportRows.filter((s: PosSalePayload) => s.customer_id === historyCustomer.id || s.customer_name === historyCustomer.name).length})
                  </h4>
                  {historyCustomer.balance > 0 && (
                    <button
                      type="button"
                      style={styles.primaryBtn}
                      onClick={() => {
                        setSettlingCustomer(historyCustomer);
                        setSettleAmount(String(historyCustomer.balance));
                        setHistoryCustomer(null);
                      }}
                    >
                      <i className="ti ti-cash-banknote" aria-hidden="true" /> Settle Credit Debt
                    </button>
                  )}
                </div>

                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Date', 'Sale No', 'Payment Method', 'Total Amount', 'Credited Debt'].map((heading) => (
                          <th key={heading} style={styles.th}>{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesReportRows
                        .filter((s: PosSalePayload) => s.customer_id === historyCustomer.id || s.customer_name === historyCustomer.name)
                        .map((sale: PosSalePayload, idx: number) => (
                          <tr key={sale.sale_no || idx} style={styles.tr}>
                            <td style={styles.tdMuted}>{new Date(sale.sold_at || Date.now()).toLocaleString()}</td>
                            <td style={styles.td}><strong>{sale.sale_no}</strong></td>
                            <td style={styles.td}>
                              <span style={{ ...styles.badge, background: sale.payment_method === 'Credit' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(39, 174, 79, 0.15)', color: sale.payment_method === 'Credit' ? '#EF4444' : '#27AE4F' }}>
                                {sale.payment_method}
                              </span>
                            </td>
                            <td style={styles.td}><strong>{formatMoney(sale.total_amount)}</strong></td>
                            <td style={styles.td}>
                              <strong style={{ color: sale.credit_amount > 0 ? '#EF4444' : 'inherit' }}>
                                {formatMoney(sale.credit_amount || 0)}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      {salesReportRows.filter((s: PosSalePayload) => s.customer_id === historyCustomer.id || s.customer_name === historyCustomer.name).length === 0 && (
                        <tr>
                          <td style={styles.emptyCell} colSpan={5}>
                            No recorded sales history for this customer
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeSection === 'salesBills') {
      const filteredBills = salesReportRows.filter((sale) => {
        const q = salesBillSearch.toLowerCase();
        const matchesSearch =
          !q ||
          sale.sale_no.toLowerCase().includes(q) ||
          (sale.customer_name || '').toLowerCase().includes(q) ||
          (sale.cashier_name || '').toLowerCase().includes(q);

        const matchesStatus =
          salesBillStatusFilter === 'all' || sale.status === salesBillStatusFilter;

        return matchesSearch && matchesStatus;
      });

      const completedCount = salesReportRows.filter((s) => s.status === 'completed').length;
      const heldCount = salesReportRows.filter((s) => s.status === 'held').length;
      const totalRevenue = sumSales(salesReportRows.filter((s) => s.status === 'completed'), (s) => s.total_amount);

      return (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Sales Bill Management</h2>
              <p style={styles.panelSub}>View, edit, search, and manage POS sales bills, customer assignments, payment methods, and statuses.</p>
            </div>
            <button
              style={styles.secondaryBtn}
              onClick={() => setReportRefreshKey((val) => val + 1)}
            >
              <i className="ti ti-refresh" aria-hidden="true" style={{ marginRight: 6 }} /> Refresh Bills List
            </button>
          </div>

          {/* Mini KPI Cards */}
          <div style={styles.miniStatsGrid}>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Total Bills</span>
              <strong style={styles.statValue}>{salesReportRows.length}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Completed Bills</span>
              <strong style={{ ...styles.statValue, color: '#27AE4F' }}>{completedCount}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Held Orders</span>
              <strong style={{ ...styles.statValue, color: '#EAB308' }}>{heldCount}</strong>
            </div>
            <div style={styles.miniStat}>
              <span style={styles.statLabel}>Total Sales Volume</span>
              <strong style={{ ...styles.statValue, color: '#2563EB' }}>{formatMoney(totalRevenue)}</strong>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16, marginTop: 16 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--app-muted)', fontSize: 16 }} aria-hidden="true" />
              <input
                type="text"
                style={{ ...styles.formInput, paddingLeft: 36, width: '100%' }}
                placeholder="Search by Bill No (e.g. SALE-000001), Customer, Cashier..."
                value={salesBillSearch}
                onChange={(e) => setSalesBillSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['all', 'All Bills'],
                ['completed', 'Completed'],
                ['held', 'Held Orders'],
                ['voided', 'Voided'],
                ['refunded', 'Refunded'],
              ].map(([st, label]) => {
                const active = salesBillStatusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      border: active ? '1.5px solid #1D4ED8' : '1px solid var(--app-border)',
                      background: active ? '#2563EB' : 'var(--app-surface)',
                      color: active ? '#FFFFFF' : 'var(--app-text)',
                      cursor: 'pointer',
                      boxShadow: active ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                    }}
                    onClick={() => setSalesBillStatusFilter(st as any)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bills Data Table */}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tr}>
                  {['Bill No', 'Date & Time', 'Customer', 'Cashier', 'Payment Method', 'Grand Total', 'Paid / Balance', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((sale) => (
                  <tr key={sale.id} style={styles.tr}>
                    <td style={styles.td}>
                      <strong style={{ color: '#2563EB' }}>{sale.sale_no}</strong>
                    </td>
                    <td style={styles.tdMuted}>{formatDateTime(sale.sold_at)}</td>
                    <td style={styles.td}>
                      <strong>{sale.customer_name || 'Walk-in Customer'}</strong>
                    </td>
                    <td style={styles.tdMuted}>{sale.cashier_name || 'Cashier'}</td>
                    <td style={styles.td}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 700, background: 'var(--app-surface-soft)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--app-border-soft)' }}>
                        {sale.payment_method || 'Cash'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong style={{ fontSize: 14 }}>{formatMoney(sale.total_amount)}</strong>
                    </td>
                    <td style={styles.tdMuted}>
                      {formatMoney(sale.paid_amount)} / <span style={{ color: (sale.balance_amount ?? 0) > 0 ? '#EF4444' : '#27AE4F', fontWeight: 800 }}>{formatMoney(sale.balance_amount ?? 0)}</span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(sale.status === 'completed'
                            ? styles.badgeActive
                            : sale.status === 'held'
                              ? styles.badgeWarning
                              : styles.badgeDanger),
                        }}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <button
                          type="button"
                          style={{ ...styles.iconBtn, color: '#2563EB' }}
                          title="Edit Sales Bill Details"
                          onClick={() => openEditBillModal(sale)}
                        >
                          <i className="ti ti-edit" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          style={styles.iconBtn}
                          title="View Line Items"
                          onClick={() => setViewingBillItems(sale)}
                        >
                          <i className="ti ti-eye" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr>
                    <td style={styles.emptyCell} colSpan={9}>
                      No sales bills found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* EDIT SALES BILL MODAL */}
          {editingBill && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setEditingBill(null);
              }}
            >
              <form
                onSubmit={handleSaveBillChanges}
                style={{
                  width: 520,
                  maxWidth: '95vw',
                  background: 'var(--app-surface, #202329)',
                  color: 'var(--app-text, #f2f4f7)',
                  border: '1px solid var(--app-border, #353b46)',
                  borderRadius: 16,
                  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '18px 24px',
                    background: 'var(--app-surface-soft, #252932)',
                    borderBottom: '1px solid var(--app-border-soft, #2f3540)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--app-text-strong, #ffffff)', margin: 0 }}>
                      ✏️ Edit Sales Bill: {editingBill.sale_no}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--app-muted, #a5adba)', marginTop: 2, margin: 0 }}>
                      Modify bill customer assignment, payment method, amounts, and status.
                    </p>
                  </div>
                  <button
                    type="button"
                    style={{
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
                    }}
                    onClick={() => setEditingBill(null)}
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>

                {/* Body */}
                <div
                  style={{
                    padding: '20px 24px',
                    background: 'var(--app-surface, #202329)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={styles.formGrid}>
                    <label style={styles.formFieldWide}>
                      <span style={styles.formLabel}>Assigned Customer</span>
                      <select
                        style={styles.formInput}
                        value={editBillCustomerId}
                        onChange={(e) => setEditBillCustomerId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">Walk-in Customer (Unassigned)</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.formField}>
                      <span style={styles.formLabel}>Payment Method</span>
                      <select
                        style={styles.formInput}
                        value={editBillPaymentMethod}
                        onChange={(e) => setEditBillPaymentMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="credit">Credit / Account</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="mobile">Mobile Payment</option>
                      </select>
                    </label>

                    <label style={styles.formField}>
                      <span style={styles.formLabel}>Bill Status</span>
                      <select
                        style={styles.formInput}
                        value={editBillStatus}
                        onChange={(e) => setEditBillStatus(e.target.value as any)}
                      >
                        <option value="completed">Completed</option>
                        <option value="held">Held Order</option>
                        <option value="voided">Voided</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </label>

                    <label style={styles.formField}>
                      <span style={styles.formLabel}>Grand Total ($)</span>
                      <input
                        type="number"
                        step="0.01"
                        style={styles.formInput}
                        value={editBillGrandTotal}
                        onChange={(e) => setEditBillGrandTotal(Number(e.target.value))}
                      />
                    </label>

                    <label style={styles.formField}>
                      <span style={styles.formLabel}>Paid Amount ($)</span>
                      <input
                        type="number"
                        step="0.01"
                        style={styles.formInput}
                        value={editBillPaidAmount}
                        onChange={(e) => setEditBillPaidAmount(Number(e.target.value))}
                      />
                    </label>

                    <label style={styles.formFieldWide}>
                      <span style={styles.formLabel}>Notes / Remarks</span>
                      <textarea
                        style={{ ...styles.formInput, ...styles.formTextarea }}
                        placeholder="Enter optional bill update notes..."
                        value={editBillNotes}
                        onChange={(e) => setEditBillNotes(e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: '16px 24px',
                    background: 'var(--app-surface-soft, #252932)',
                    borderTop: '1px solid var(--app-border-soft, #2f3540)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      border: '1px solid var(--app-border, #353b46)',
                      borderRadius: 8,
                      background: 'var(--app-button-bg, #252932)',
                      color: 'var(--app-button-text, #e4e7ec)',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onClick={() => setEditingBill(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingBill}
                    style={{
                      border: 'none',
                      borderRadius: 8,
                      background: 'var(--app-accent, #32c862)',
                      color: '#ffffff',
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {isSavingBill ? 'Saving Changes...' : 'Save Bill Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW LINE ITEMS MODAL */}
          {viewingBillItems && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setViewingBillItems(null);
              }}
            >
              <div
                style={{
                  width: 680,
                  maxWidth: '95vw',
                  background: 'var(--app-surface, #202329)',
                  color: 'var(--app-text, #f2f4f7)',
                  border: '1px solid var(--app-border, #353b46)',
                  borderRadius: 16,
                  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '18px 24px',
                    background: 'var(--app-surface-soft, #252932)',
                    borderBottom: '1px solid var(--app-border-soft, #2f3540)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--app-text-strong, #ffffff)', margin: 0 }}>
                      📋 Sales Bill Items: {viewingBillItems.sale_no}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--app-muted, #a5adba)', marginTop: 2, margin: 0 }}>
                      Customer: <strong style={{ color: 'var(--app-text-strong, #ffffff)' }}>{viewingBillItems.customer_name || 'Walk-in Customer'}</strong> • Cashier: <strong style={{ color: 'var(--app-text-strong, #ffffff)' }}>{viewingBillItems.cashier_name || 'Cashier'}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    style={{
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
                    }}
                    onClick={() => setViewingBillItems(null)}
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>

                {/* Body */}
                <div
                  style={{
                    padding: '20px 24px',
                    background: 'var(--app-surface, #202329)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.tr}>
                          {['Product Name', 'SKU', 'Qty', 'Price', 'Discount', 'Tax', 'Total'].map((h) => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingBillItems.items || []).map((item: any, idx: number) => (
                          <tr key={idx} style={styles.tr}>
                            <td style={styles.td}><strong>{item.product_name}</strong></td>
                            <td style={styles.tdMuted}>{item.product_code || '-'}</td>
                            <td style={styles.td}><strong>{item.quantity}</strong></td>
                            <td style={styles.tdMuted}>{formatMoney(item.unit_price)}</td>
                            <td style={styles.tdMuted}>{formatMoney(item.discount_amount)}</td>
                            <td style={styles.tdMuted}>{formatMoney(item.tax_amount)}</td>
                            <td style={styles.td}><strong>{formatMoney(item.line_total)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--app-surface-soft, #252932)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--app-border-soft, #2f3540)' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-muted, #a5adba)' }}>Payment Method: </span>
                      <strong style={{ textTransform: 'capitalize', color: 'var(--app-text-strong, #ffffff)' }}>{viewingBillItems.payment_method || 'Cash'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-muted, #a5adba)', marginRight: 6 }}>Bill Total:</span>
                      <strong style={{ fontSize: 18, color: 'var(--app-accent, #32c862)' }}>{formatMoney(viewingBillItems.total_amount)}</strong>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: '16px 24px',
                    background: 'var(--app-surface-soft, #252932)',
                    borderTop: '1px solid var(--app-border-soft, #2f3540)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      border: '1px solid var(--app-border, #353b46)',
                      borderRadius: 8,
                      background: 'var(--app-button-bg, #252932)',
                      color: 'var(--app-button-text, #e4e7ec)',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onClick={() => setViewingBillItems(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      );
    }

    if (activeSection === 'reports') {
      return renderReportSection();
    }

    return renderSettingsSection();
  };

  return (
    <div style={styles.container}>

      {isLoading && <div style={styles.infoBar}>Loading POS management data from API...</div>}
      {loadError && <div style={styles.warningBar}>{loadError}</div>}

      {/* <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Products</span>
          <strong style={styles.statValue}>{products.length}</strong>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Active</span>
          <strong style={styles.statValue}>{activeProducts}</strong>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Low stock</span>
          <strong style={styles.statValue}>{lowStockProducts}</strong>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Inventory value</span>
          <strong style={styles.statValue}>{formatMoney(inventoryValue)}</strong>
        </div>
      </div> */}

      <div
        style={{
          ...styles.layout,
          gridTemplateColumns: isNavCollapsed ? '64px minmax(0, 1fr)' : '230px minmax(0, 1fr)',
          transition: 'grid-template-columns 0.2s ease',
        }}
      >
        <nav
          style={{
            ...styles.sectionNav,
            padding: isNavCollapsed ? '8px 6px' : 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isNavCollapsed ? 'center' : 'space-between',
              padding: isNavCollapsed ? '4px 0 8px' : '4px 8px 8px',
              borderBottom: '1px solid var(--app-border-soft, rgba(0,0,0,0.08))',
              marginBottom: 4,
            }}
          >
            {!isNavCollapsed && (
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--app-muted)', letterSpacing: '0.05em' }}>
                Navigation
              </span>
            )}
            <button
              type="button"
              onClick={toggleNavCollapse}
              title={isNavCollapsed ? 'Expand navigation bar' : 'Minimize navigation bar'}
              style={{
                border: 'none',
                background: 'var(--app-surface-soft, rgba(0,0,0,0.04))',
                color: 'var(--app-muted, #667085)',
                borderRadius: 6,
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <i className={`ti ${isNavCollapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`} style={{ fontSize: 16 }} />
            </button>
          </div>

          {SECTIONS.map((section) => (
            <button
              key={section.id}
              title={isNavCollapsed ? section.label : undefined}
              style={{
                ...styles.sectionNavItem,
                ...(activeSection === section.id ? styles.sectionNavItemActive : {}),
                ...(isNavCollapsed
                  ? {
                    justifyContent: 'center',
                    padding: '10px 0',
                    borderLeft: activeSection === section.id ? '4px solid #2F80ED' : '4px solid transparent',
                  }
                  : {}),
              }}
              onClick={() => setActiveSection(section.id)}
            >
              <i className={`ti ${section.icon}`} style={{ fontSize: 16, minWidth: isNavCollapsed ? 'auto' : 20, textAlign: 'center' }} aria-hidden="true" />
              {!isNavCollapsed && <span>{section.label}</span>}
            </button>
          ))}
        </nav>

        {renderContent()}
      </div>

      {showAddProduct && (
        <AddProductModal
          product={editingProduct}
          categories={categories}
          brands={brands}
          units={units}
          suppliers={suppliers}
          onClose={() => {
            setShowAddProduct(false);
            setEditingProduct(null);
          }}
          onSaved={(product) => {
            setProducts((previous) => {
              const exists = previous.some((item) => item.id === product.id);
              return exists
                ? previous.map((item) => (item.id === product.id ? product : item))
                : [product, ...previous];
            });
          }}
          onCategoryCreated={(category) => {
            setCategories((previous) => [category, ...previous]);
          }}
          onBrandCreated={(brand) => {
            setBrands((previous) => [brand, ...previous]);
          }}
          onUnitCreated={(unit) => {
            setUnits((previous) => [unit, ...previous]);
          }}
          onSupplierCreated={(supplier) => {
            setSuppliers((previous) => [supplier, ...previous]);
          }}
        />
      )}

      {showImportProducts && (
        <ProductImportModal
          categories={categories}
          brands={brands}
          units={units}
          onClose={() => setShowImportProducts(false)}
          onImported={(importedProducts, createdCategories = [], createdBrands = [], createdUnits = []) => {
            if (createdCategories.length) {
              setCategories((previous) => {
                const byId = new Map(previous.map((item) => [item.id, item]));
                createdCategories.forEach((item) => byId.set(item.id, item));
                return Array.from(byId.values());
              });
            }

            if (createdBrands.length) {
              setBrands((previous) => {
                const byId = new Map(previous.map((item) => [item.id, item]));
                createdBrands.forEach((item) => byId.set(item.id, item));
                return Array.from(byId.values());
              });
            }

            if (createdUnits.length) {
              setUnits((previous) => {
                const byId = new Map(previous.map((item) => [item.id, item]));
                createdUnits.forEach((item) => byId.set(item.id, item));
                return Array.from(byId.values());
              });
            }

            setProducts((previous) => {
              const byId = new Map(previous.map((product) => [product.id, product]));
              importedProducts.forEach((product) => byId.set(product.id, product));
              return Array.from(byId.values()).sort((first, second) => second.id - first.id);
            });
          }}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          category={editingCategory}
          onClose={() => {
            setShowAddCategory(false);
            setEditingCategory(null);
          }}
          onSaved={(category) => {
            setCategories((previous) => {
              const exists = previous.some((item) => item.id === category.id);
              return exists
                ? previous.map((item) => (item.id === category.id ? category : item))
                : [category, ...previous];
            });
          }}
        />
      )}

      {showAddCustomer && (
        <AddCustomerModal
          customer={editingCustomer}
          onClose={() => {
            setShowAddCustomer(false);
            setEditingCustomer(null);
          }}
          onSaved={(customer) => {
            void handleSaveCustomer(customer);
          }}
        />
      )}

      {resourceModal && (
        <PosResourceModal
          title={RESOURCE_META[resourceModal.resourceId].label}
          fields={getResourceFields(resourceModal.resourceId)}
          record={resourceModal.record}
          onClose={() => setResourceModal(null)}
          onSubmit={(payload) =>
            handleSaveResource(resourceModal.resourceId, payload, resourceModal.record)
          }
        />
      )}

      {stockAdjustProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setStockAdjustProduct(null);
          }}
        >
          <div
            style={{
              width: 480,
              maxWidth: '95vw',
              background: 'var(--app-surface, #202329)',
              color: 'var(--app-text, #f2f4f7)',
              border: '1px solid var(--app-border, #353b46)',
              borderRadius: 14,
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                background: 'var(--app-surface-soft, #252932)',
                borderBottom: '1px solid var(--app-border-soft, #2f3540)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--app-text-strong, #ffffff)', margin: 0 }}>
                  Adjust Product Stock
                </h3>
                <p style={{ fontSize: 12, color: 'var(--app-muted, #a5adba)', marginTop: 2, margin: 0 }}>
                  {stockAdjustProduct.name} ({stockAdjustProduct.sku})
                </p>
              </div>
              <button
                type="button"
                style={{
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
                }}
                onClick={() => setStockAdjustProduct(null)}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: '20px 24px',
                background: 'var(--app-surface, #202329)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--app-surface-soft, #252932)', border: '1px solid var(--app-border, #353b46)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--app-text, #f2f4f7)' }}>
                <span>Current Stock: <strong style={{ color: '#ffffff', background: stockAdjustProduct.stock <= 0 ? '#EF4444' : stockAdjustProduct.stock <= stockAdjustProduct.minimumStock ? '#F59E0B' : '#27AE4F', padding: '2px 8px', borderRadius: 6, marginLeft: 4 }}>{stockAdjustProduct.stock}</strong></span>
                <span>Min Stock: <strong style={{ color: 'var(--app-text-strong, #ffffff)' }}>{stockAdjustProduct.minimumStock}</strong></span>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #a5adba)' }}>Adjustment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setStockAdjustMode('add')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: stockAdjustMode === 'add' ? '1px solid var(--app-accent, #32c862)' : '1px solid var(--app-border, #353b46)',
                      background: stockAdjustMode === 'add' ? 'var(--app-accent, #32c862)' : 'var(--app-surface-soft, #252932)',
                      color: stockAdjustMode === 'add' ? '#ffffff' : 'var(--app-text, #f2f4f7)',
                    }}
                  >
                    <i className="ti ti-plus" aria-hidden="true" /> Add (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockAdjustMode('remove')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: stockAdjustMode === 'remove' ? '1px solid var(--app-danger, #ff8585)' : '1px solid var(--app-border, #353b46)',
                      background: stockAdjustMode === 'remove' ? 'var(--app-danger, #ff8585)' : 'var(--app-surface-soft, #252932)',
                      color: stockAdjustMode === 'remove' ? '#ffffff' : 'var(--app-text, #f2f4f7)',
                    }}
                  >
                    <i className="ti ti-minus" aria-hidden="true" /> Reduce (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockAdjustMode('set')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: stockAdjustMode === 'set' ? '1px solid var(--app-accent-strong, #27ae4f)' : '1px solid var(--app-border, #353b46)',
                      background: stockAdjustMode === 'set' ? 'var(--app-accent-strong, #27ae4f)' : 'var(--app-surface-soft, #252932)',
                      color: stockAdjustMode === 'set' ? '#ffffff' : 'var(--app-text, #f2f4f7)',
                    }}
                  >
                    <i className="ti ti-equal" aria-hidden="true" /> Set Exact (=)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #a5adba)' }}>
                  {stockAdjustMode === 'add' ? 'Quantity to Add' : stockAdjustMode === 'remove' ? 'Quantity to Reduce' : 'Exact New Stock Quantity'}
                </label>
                <input
                  type="number"
                  min="0"
                  style={{
                    border: '1px solid var(--app-border, #353b46)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    background: 'var(--app-input-bg, #1b1e24)',
                    color: 'var(--app-input-text, #f2f4f7)',
                    outline: 'none',
                  }}
                  value={stockAdjustQty}
                  onChange={(e) => setStockAdjustQty(stockAdjustMode === 'set' ? Number(e.target.value) || 0 : Math.max(0, Number(e.target.value) || 0))}
                />
              </div>

              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--app-accent-soft, rgba(50, 200, 98, 0.14))', border: '1px solid var(--app-border-soft, #2f3540)', color: 'var(--app-accent, #32c862)', fontSize: 13, fontWeight: 700 }}>
                New Projected Stock: {
                  stockAdjustMode === 'add'
                    ? stockAdjustProduct.stock + stockAdjustQty
                    : stockAdjustMode === 'remove'
                      ? stockAdjustProduct.stock - stockAdjustQty
                      : stockAdjustQty
                }
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-muted, #a5adba)' }}>Reason / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Received shipment, Damaged goods, Audit count"
                  style={{
                    border: '1px solid var(--app-border, #353b46)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 13,
                    background: 'var(--app-input-bg, #1b1e24)',
                    color: 'var(--app-input-text, #f2f4f7)',
                    outline: 'none',
                  }}
                  value={stockAdjustRemarks}
                  onChange={(e) => setStockAdjustRemarks(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                background: 'var(--app-surface-soft, #252932)',
                borderTop: '1px solid var(--app-border-soft, #2f3540)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                style={{
                  border: '1px solid var(--app-border, #353b46)',
                  borderRadius: 8,
                  background: 'var(--app-button-bg, #252932)',
                  color: 'var(--app-button-text, #e4e7ec)',
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onClick={() => setStockAdjustProduct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  border: 'none',
                  borderRadius: 8,
                  background: 'var(--app-accent, #32c862)',
                  color: '#ffffff',
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onClick={handleSaveStockAdjustment}
                disabled={isSavingStockAdjustment}
              >
                {isSavingStockAdjustment ? 'Updating Stock...' : 'Save Stock Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    height: '100%',
    minHeight: 0,
    boxSizing: 'border-box',
    background: 'var(--app-bg)',
    color: 'var(--app-text)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--app-text-strong)',
  },
  pageSub: {
    fontSize: 13,
    color: 'var(--app-muted)',
    marginTop: 2,
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: 'none',
    borderRadius: 8,
    background: '#27AE4F',
    color: '#fff',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  headerButtonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  warningBar: {
    marginBottom: 16,
    borderRadius: 8,
    background: '#FFF3D6',
    color: '#946200',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  infoBar: {
    marginBottom: 16,
    borderRadius: 8,
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 16,
  },
  miniStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    padding: 12,
    borderBottom: '1px solid var(--app-border-soft)',
  },
  statCard: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 6,
  },
  miniStat: {
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    padding: 12,
    gap: 5,
    background: 'var(--app-surface-soft)',
  },
  statLabel: {
    fontSize: 14,
    color: 'var(--app-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  statValue: {
    fontSize: 16,
    color: 'var(--app-text-strong)',
  },
  statSmallValue: {
    fontSize: 13,
    color: 'var(--app-text-strong)',
    wordBreak: 'break-word',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '230px minmax(0, 1fr)',
    gap: 16,
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  sectionNav: {
    maxHeight: '100%',
    overflowY: 'auto',
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: 8,
    display: 'grid',
    gap: 4,
    alignContent: 'start',
  },
  sectionNavItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: 'none',
    borderLeft: '4px solid transparent',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--app-muted)',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 400,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  sectionNavItemActive: {
    background: 'var(--app-accent-soft, rgba(47, 128, 237, 0.14))',
    color: 'var(--app-accent-strong, #2F80ED)',
    fontWeight: 700,
    borderLeft: '4px solid #2F80ED',
  },

  panel: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    overflowY: 'auto',
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--app-shadow, 0 4px 20px rgba(0, 0, 0, 0.12))',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '18px 20px',
    background: 'linear-gradient(90deg, var(--app-accent-soft, rgba(47, 128, 237, 0.14)), var(--app-surface-soft, #252932) 45%)',
    borderLeft: '5px solid var(--app-accent-strong, #2F80ED)',
    borderBottom: '1px solid var(--app-border)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--app-text-strong)',
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  panelSub: {
    fontSize: 13,
    color: 'var(--app-muted)',
    marginTop: 3,
    fontWeight: 500,
  },
  segmentRow: {
    display: 'inline-flex',
    gap: 4,
    margin: '16px 16px 0',
    padding: 4,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
  },
  segmentBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--app-muted)',
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  segmentBtnActive: {
    background: '#2F80ED',
    color: '#ffffff',
    fontWeight: 700,
    boxShadow: '0 2px 6px rgba(47, 128, 237, 0.35)',
  },

  searchRow: {
    margin: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--app-muted)',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'transparent',
    color: 'var(--app-input-text)',
  },
  creditSummaryBar: {
    margin: '0px 12px 0',
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    padding: '10px 12px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 18,
    color: 'var(--app-muted)',
    fontSize: 13,
  },
  tableWrap: {
    overflowX: 'auto',
    padding: '0 12px 12px',
    background: 'linear-gradient(180deg, rgba(39,174,79,0.04), transparent 140px)',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 8px',
    minWidth: 820,
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    textAlign: 'left',
    padding: '12px 16px',
    color: 'var(--app-accent-strong)',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderTop: '1px solid rgba(39,174,79,0.3)',
    borderBottom: '2px solid var(--app-accent, #1f99beff)',
    background: '#000000',
    opacity: 1,
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
  },
  tr: {
    background: 'linear-gradient(90deg, rgba(39,174,79,0.16), var(--app-surface-soft) 34px)',
    boxShadow: '0 1px 0 var(--app-border-soft), 0 6px 14px rgba(15,23,42,0.04)',
  },
  td: {
    padding: '14px 16px',
    fontSize: 13,
    color: 'var(--app-text)',
    whiteSpace: 'nowrap',
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid rgba(20, 146, 177, 0.25)',
    background: 'transparent',
  },
  tdMuted: {
    padding: '14px 16px',
    fontSize: 13,
    color: 'var(--app-muted)',
    whiteSpace: 'nowrap',
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid rgba(20, 146, 177, 0.25)',
    background: 'transparent',
  },
  tdDescription: {
    padding: '14px 16px',
    fontSize: 13,
    color: 'var(--app-muted)',
    minWidth: 280,
    whiteSpace: 'normal',
    lineHeight: 1.45,
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid rgba(39, 174, 79, 0.25)',
    background: 'transparent',
  },
  cellSubText: {
    marginTop: 3,
    fontSize: 11,
    color: 'var(--app-muted)',
    fontWeight: 500,
  },
  positiveText: {
    color: '#16834F',
  },
  warningText: {
    color: '#946200',
  },
  negativeText: {
    color: '#B42318',
  },
  badge: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 800,
    border: '1px solid transparent',
  },
  badgeActive: {
    background: 'rgba(39,174,79,0.14)',
    color: '#16834F',
    borderColor: 'rgba(39,174,79,0.28)',
  },
  badgeWarning: {
    background: 'rgba(245,158,11,0.16)',
    color: '#946200',
    borderColor: 'rgba(245,158,11,0.34)',
  },
  badgeDanger: {
    background: 'rgba(239,68,68,0.14)',
    color: '#B42318',
    borderColor: 'rgba(239,68,68,0.30)',
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    color: 'var(--app-button-text)',
    cursor: 'pointer',
  },
  actionGroup: {
    display: 'flex',
    gap: 6,
  },
  dangerIconBtn: {
    color: '#B42318',
    borderColor: '#FCA5A5',
    background: '#FFF1F1',
  },
  emptyCell: {
    padding: '42px 16px',
    textAlign: 'center',
    color: 'var(--app-muted)',
    fontSize: 13,
    background: 'var(--app-surface-soft)',
    border: '1px dashed var(--app-border)',
    borderRadius: 8,
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    padding: 16,
  },
  settingsMessage: {
    margin: 16,
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    color: 'var(--app-text)',
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 700,
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
    padding: 16,
  },
  settingsCard: {
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    padding: 16,
    display: 'grid',
    gap: 16,
    background: 'var(--app-surface)',
  },
  settingsCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  settingsSub: {
    fontSize: 12,
    color: 'var(--app-muted)',
    marginTop: 2,
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: 700,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  formField: {
    display: 'grid',
    gap: 6,
  },
  formFieldWide: {
    display: 'grid',
    gap: 6,
    gridColumn: '1 / -1',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--app-muted)',
  },
  formInput: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-input-bg)',
    color: 'var(--app-input-text)',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
  },
  formTextarea: {
    minHeight: 82,
    resize: 'vertical',
  },
  featureCard: {
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    padding: 16,
    display: 'grid',
    gap: 10,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--app-text-strong)',
  },
  featureBody: {
    fontSize: 12,
    color: 'var(--app-muted)',
    lineHeight: 1.5,
    minHeight: 36,
  },
  reportTabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    borderBottom: '1px solid var(--app-border-soft)',
  },
  reportTab: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-button-bg)',
    color: 'var(--app-button-text)',
    padding: '9px 11px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  reportTabActive: {
    background: '#2563EB',
    color: '#FFFFFF',
    borderColor: '#1D4ED8',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
    fontWeight: 800,
  },
  reportBody: {
    display: 'grid',
    gap: 16,
    padding: 16,
  },
  reportKpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  reportKpi: {
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 6,
    background: 'var(--app-surface-soft)',
  },
  reportGridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
  },
  reportTableCard: {
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--app-surface)',
  },
  reportTableTitle: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--app-border-soft)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  reportSummaryBand: {
    gridColumn: '1 / -1',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-accent-soft)',
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    color: 'var(--app-accent-strong)',
    fontSize: 14,
    fontWeight: 700,
  },
  secondaryBtn: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-button-bg)',
    color: 'var(--app-button-text)',
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default PosManagement;
