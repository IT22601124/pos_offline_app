import type { PosCustomer } from "../../components/AddCustomerModal";
export type { PosCustomer };
import {
  offlineAddBrand,
  offlineAddCategory,
  offlineAddCustomer,
  offlineAddProduct,
  offlineAddUnit,
  offlineCreateSale,
  offlineDeleteProduct,
  offlineGetBrands,
  offlineGetCategories,
  offlineGetCustomers,
  offlineGetProducts,
  offlineGetSales,
  offlineGetSuppliers,
  offlineGetUnits,
  offlineUpdateProduct
} from "../../offline/offlineAdapter";
import { db } from "../../offline/db";



export interface PosProduct {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  categoryId?: number;
  brandId?: number;
  unitId?: number;
  unit_name?: string;
  unit?: string;
  price: number;
  stock: number;
  minimumStock: number;
  taxRate: number;
  is_weighted?: boolean;
  status: "Active" | "Low stock" | "Inactive";
}

export interface PosCategory {
  id: number;
  name: string;
  description: string;
  status: boolean;
}

export interface PosSupplier {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  status: boolean;
}

export interface PosBrand {
  id: number;
  name: string;
  description: string;
  status: boolean;
}

export interface PosUnit {
  id: number;
  name: string;
  shortName: string;
  status: boolean;
}

export interface CreateProductPayload {
  product_code: string;
  barcode: string;
  name: string;
  description: string;
  category_id: number;
  brand_id: number;
  unit_id: number;
  supplier_id?: number;
  unit_name?: string;
  cost_price: number;
  selling_price: number;
  wholesale_price: number;
  stock_quantity: number;
  minimum_stock: number;
  tax_rate: number;
  discount_rate: number;
  image: string;
  weight: number;
  is_weighted: boolean;
  status: boolean;
}

export interface CreateCategoryPayload {
  name: string;
  description: string;
  status: boolean;
}

export type PosMasterRecord = Record<string, string | number | boolean | null | undefined>;

export interface PosSaleItemPayload {
  product_id: number;
  variant_id?: number;
  product_name: string;
  product_code: string;
  barcode: string;
  unit_price: number;
  quantity: number;
  qty?: number;
  discount_amount: number;
  discount?: number;
  tax_amount: number;
  tax?: number;
  line_total: number;
}

export interface PosSalePaymentPayload {
  method: string;
  amount: number;
  reference_no?: string;
}

export interface PosSalePayload {
  id?: number;
  sale_no: string;
  status: "completed" | "held" | "voided" | "refunded";
  customer_name: string;
  customer_id?: number | null;
  cashier_id?: number | null;
  cashier_name: string;
  cashier_role: string;
  register_no: string;
  shift_code: string;
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  discount_total?: number;
  taxable_amount: number;
  tax_amount: number;
  tax_total?: number;
  total_amount: number;
  grand_total?: number;
  paid_amount: number;
  change_amount: number;
  balance_amount?: number;
  credit_amount: number;
  due_days?: number | null;
  notes: string;
  sold_at: string;
  items: PosSaleItemPayload[];
  payments: PosSalePaymentPayload[];
}

export interface PosPaymentMethodSetting {
  key: string;
  label: string;
  enabled: boolean;
}

export interface PosReceiptSetting {
  header: string;
  footer: string;
  show_logo: boolean;
  show_cashier: boolean;
  show_tax_breakdown: boolean;
}

export interface PosDiscountRuleSetting {
  cashier_discount_enabled: boolean;
  max_cashier_discount_percent: number;
  manager_approval_above_percent: number;
  allow_bill_discount: boolean;
}

export interface PosSettingsPayload {
  payment_methods: PosPaymentMethodSetting[];
  receipt: PosReceiptSetting;
  discount_rules: PosDiscountRuleSetting;
}



export const DEFAULT_POS_SETTINGS: PosSettingsPayload = {
  payment_methods: [
    { key: "cash", label: "Cash", enabled: true },
    { key: "card", label: "Card", enabled: true },
    { key: "credit", label: "Credit", enabled: true },
    { key: "wallet", label: "Wallet", enabled: false },
  ],
  receipt: {
    header: "",
    footer: "",
    show_logo: true,
    show_cashier: true,
    show_tax_breakdown: true,
  },
  discount_rules: {
    cashier_discount_enabled: true,
    max_cashier_discount_percent: 0,
    manager_approval_above_percent: 0,
    allow_bill_discount: true,
  },
};


export const getAllProducts = async (): Promise<PosProduct[]> => {
  return await offlineGetProducts();
};

export const createProduct = async (payload: CreateProductPayload): Promise<PosProduct> => {
  return await offlineAddProduct(payload);
};

export const updateProduct = async (
  productId: number,
  payload: CreateProductPayload,
): Promise<PosProduct> => {
  await offlineUpdateProduct(productId, {
    name: payload.name,
    sku: payload.product_code,
    barcode: payload.barcode,
    price: payload.selling_price,
    stock: payload.stock_quantity,
    minimumStock: payload.minimum_stock,
    taxRate: payload.tax_rate,
    status: payload.status ? 'Active' : 'Inactive',
  });
  const products = await offlineGetProducts();
  const found = products.find((p) => p.id === productId);
  return found || { id: productId, name: payload.name, sku: payload.product_code, barcode: payload.barcode, category: 'General', price: payload.selling_price, stock: payload.stock_quantity, minimumStock: payload.minimum_stock, taxRate: payload.tax_rate, status: 'Active' };
};

export const deleteProduct = async (productId: number): Promise<void> => {
  await offlineDeleteProduct(productId);
};

export const getAllCategories = async (): Promise<PosCategory[]> => {
  return await offlineGetCategories();
};

export const createCategory = async (payload: CreateCategoryPayload): Promise<PosCategory> => {
  return await offlineAddCategory(payload);
};

export const updateCategory = async (
  categoryId: number,
  payload: CreateCategoryPayload,
): Promise<PosCategory> => {
  await db.categories.update(categoryId, payload);
  return { id: categoryId, ...payload };
};

export const deleteCategory = async (categoryId: number): Promise<void> => {
  await db.categories.delete(categoryId);
};

export const getAllSuppliers = async (): Promise<PosSupplier[]> => {
  return await offlineGetSuppliers();
};

export const getAllBrands = async (): Promise<PosBrand[]> => {
  return await offlineGetBrands();
};

export const createBrand = async (name: string): Promise<PosBrand> => {
  return await offlineAddBrand({ name: name.trim(), description: '', status: true });
};

export const getAllUnits = async (): Promise<PosUnit[]> => {
  return await offlineGetUnits();
};

export const createUnit = async (name: string): Promise<PosUnit> => {
  return await offlineAddUnit({ name: name.trim(), shortName: name.trim(), status: true });
};

export const getAllCustomers = async (): Promise<PosCustomer[]> => {
  return await offlineGetCustomers();
};

export const createCustomer = async (payload: Omit<PosCustomer, "id">): Promise<PosCustomer> => {
  return await offlineAddCustomer(payload);
};

export const updateCustomer = async (
  customerId: number,
  payload: Omit<PosCustomer, "id">,
): Promise<PosCustomer> => {
  await db.customers.update(customerId, payload as any);
  return { id: customerId, ...payload };
};

export const deleteCustomer = async (customerId: number): Promise<void> => {
  await db.customers.delete(customerId);
};


export const getPosMasterRecords = async (
  endpoint: string,
  _listKey: string,
): Promise<PosMasterRecord[]> => {
  if (endpoint.includes('categories')) return await db.categories.toArray() as any;
  if (endpoint.includes('brands')) return await db.brands.toArray() as any;
  if (endpoint.includes('units')) return await db.units.toArray() as any;
  if (endpoint.includes('suppliers')) return await db.suppliers.toArray() as any;
  if (endpoint.includes('customers')) return await db.customers.toArray() as any;
  if (endpoint.includes('products')) return await db.products.toArray() as any;
  return [];
};

export const createPosMasterRecord = async (
  endpoint: string,
  payload: PosMasterRecord,
  _singleKey: string,
): Promise<PosMasterRecord> => {
  let tableName: 'categories' | 'brands' | 'units' | 'suppliers' | 'customers' | 'products' = 'categories';
  if (endpoint.includes('brands')) tableName = 'brands';
  else if (endpoint.includes('units')) tableName = 'units';
  else if (endpoint.includes('suppliers')) tableName = 'suppliers';
  else if (endpoint.includes('customers')) tableName = 'customers';
  else if (endpoint.includes('products')) tableName = 'products';

  const id = await (db[tableName] as any).add(payload);
  return { ...payload, id };
};

export const updatePosMasterRecord = async (
  endpoint: string,
  recordId: number,
  payload: PosMasterRecord,
  _singleKey: string,
): Promise<PosMasterRecord> => {
  let tableName: 'categories' | 'brands' | 'units' | 'suppliers' | 'customers' | 'products' = 'categories';
  if (endpoint.includes('brands')) tableName = 'brands';
  else if (endpoint.includes('units')) tableName = 'units';
  else if (endpoint.includes('suppliers')) tableName = 'suppliers';
  else if (endpoint.includes('customers')) tableName = 'customers';
  else if (endpoint.includes('products')) tableName = 'products';

  await (db[tableName] as any).update(recordId, payload);
  return { ...payload, id: recordId };
};

export const deletePosMasterRecord = async (endpoint: string, recordId: number): Promise<void> => {
  let tableName: 'categories' | 'brands' | 'units' | 'suppliers' | 'customers' | 'products' = 'categories';
  if (endpoint.includes('brands')) tableName = 'brands';
  else if (endpoint.includes('units')) tableName = 'units';
  else if (endpoint.includes('suppliers')) tableName = 'suppliers';
  else if (endpoint.includes('customers')) tableName = 'customers';
  else if (endpoint.includes('products')) tableName = 'products';

  await (db[tableName] as any).delete(recordId);
};


export const mapPosSale = (raw: Record<string, unknown>): PosSalePayload => {
  const toNumber = (val: unknown) => {
    const num = Number(val || 0);
    return Number.isFinite(num) ? num : 0;
  };

  const formatIsoDate = (val: unknown): string => {
    if (!val) return new Date().toISOString();
    const str = String(val).trim();
    const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  const cashierObj = (raw.cashier || {}) as Record<string, unknown>;
  const cashierRoleObj = (cashierObj.role || {}) as Record<string, unknown>;
  const customerObj = (raw.customer || {}) as Record<string, unknown>;

  const paymentsRaw = Array.isArray(raw.payments) ? raw.payments : [];
  const payments: PosSalePaymentPayload[] = paymentsRaw.map((p: any) => ({
    method: String(p.method || 'Cash'),
    amount: toNumber(p.amount),
    reference_no: p.reference_no ? String(p.reference_no) : undefined,
  }));

  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const items: PosSaleItemPayload[] = itemsRaw.map((item: any) => {
    const prodObj = (item.product || {}) as Record<string, unknown>;
    return {
      product_id: Number(item.product_id || prodObj.id || 0),
      product_name: String(item.product_name || prodObj.name || 'Unnamed Product'),
      product_code: String(item.product_code || prodObj.product_code || ''),
      barcode: String(item.barcode || prodObj.barcode || ''),
      unit_price: toNumber(item.unit_price),
      quantity: toNumber(item.quantity ?? item.qty),
      discount_amount: toNumber(item.discount_amount ?? item.discount),
      tax_amount: toNumber(item.tax_amount ?? item.tax),
      line_total: toNumber(item.line_total),
    };
  });

  const totalAmount = toNumber(raw.total_amount ?? raw.grand_total);
  const paidAmount = toNumber(raw.paid_amount);
  const discountAmount = toNumber(raw.discount_amount ?? raw.discount_total);
  const taxAmount = toNumber(raw.tax_amount ?? raw.tax_total);
  const subtotal = toNumber(raw.subtotal);

  const creditPayment = payments.find((p) => String(p.method).toLowerCase() === 'credit');
  const creditAmount = creditPayment
    ? creditPayment.amount
    : toNumber(raw.credit_amount ?? Math.max(totalAmount - paidAmount, 0));

  const primaryPayment = payments.length > 1
    ? 'Mixed'
    : payments[0]?.method
      ? payments[0].method.charAt(0).toUpperCase() + payments[0].method.slice(1)
      : String(raw.payment_method || 'Cash');

  return {
    id: raw.id ? Number(raw.id) : undefined,
    sale_no: String(raw.sale_no || ''),
    status: (raw.status as PosSalePayload['status']) || 'completed',
    customer_name: String(raw.customer_name || customerObj.name || 'Walk-in customer'),
    customer_id: raw.customer_id ? Number(raw.customer_id) : null,
    cashier_id: raw.cashier_id ? Number(raw.cashier_id) : null,
    cashier_name: String(raw.cashier_name || cashierObj.name || 'Unknown Cashier'),
    cashier_role: String(raw.cashier_role || cashierRoleObj.name || 'Cashier'),
    register_no: String(raw.register_no || 'Register 01'),
    shift_code: String(raw.shift_code || raw.shift_no || 'Shift A'),
    payment_method: primaryPayment,
    subtotal,
    discount_amount: discountAmount,
    taxable_amount: toNumber(raw.taxable_amount ?? (subtotal - discountAmount)),
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    change_amount: toNumber(raw.change_amount ?? raw.balance_amount),
    credit_amount: creditAmount,
    due_days: raw.due_days ? Number(raw.due_days) : null,
    notes: String(raw.notes || ''),
    sold_at: formatIsoDate(raw.sold_at || raw.created_at),
    items,
    payments,
  };
};

export const createPosSale = async (payload: PosSalePayload): Promise<PosSalePayload | PosMasterRecord> => {
  const saleRecord = {
    invoice_number: payload.sale_no || `INV-${Date.now().toString().slice(-6)}`,
    customer_id: payload.customer_id || 1,
    customer_name: payload.customer_name || 'Walk-in customer',
    user_name: payload.cashier_name || 'Cashier',
    subtotal: payload.subtotal,
    discount_amount: payload.discount_amount,
    tax_amount: payload.tax_amount,
    grand_total: payload.total_amount,
    paid_amount: payload.paid_amount,
    change_amount: payload.change_amount,
    payment_method: payload.payment_method || 'Cash',
    notes: payload.notes,
    status: 'Completed' as const,
    created_at: payload.sold_at || new Date().toISOString(),
    items: (payload.items || []).map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      product_code: i.product_code,
      barcode: i.barcode,
      unit_price: i.unit_price,
      quantity: i.quantity || i.qty || 1,
      discount_amount: i.discount_amount || i.discount || 0,
      tax_amount: i.tax_amount || i.tax || 0,
      line_total: i.line_total || ((i.unit_price * (i.quantity || 1))),
    })),
  };

  const created = await offlineCreateSale(saleRecord);
  return {
    ...payload,
    id: created.id,
    sale_no: created.invoice_number,
  };
};

export const getPosSales = async (
  _status?: PosSalePayload["status"],
  _scope?: 'all' | 'own',
  _from?: string,
  _to?: string,
): Promise<PosSalePayload[]> => {
  const localSales = await offlineGetSales();
  return localSales.map((s) => ({
    id: s.id,
    sale_no: s.invoice_number,
    status: (s.status.toLowerCase() as any) || 'completed',
    customer_name: s.customer_name || 'Walk-in customer',
    customer_id: s.customer_id || null,
    cashier_id: null,
    cashier_name: s.user_name || 'Cashier',
    cashier_role: 'Cashier',
    register_no: 'Register 01',
    shift_code: 'Shift A',
    payment_method: s.payment_method || 'Cash',
    subtotal: s.subtotal,
    discount_amount: s.discount_amount,
    taxable_amount: s.subtotal - s.discount_amount,
    tax_amount: s.tax_amount,
    total_amount: s.grand_total,
    paid_amount: s.paid_amount,
    change_amount: s.change_amount,
    credit_amount: 0,
    notes: s.notes || '',
    sold_at: s.created_at,
    items: s.items || [],
    payments: [{ method: s.payment_method || 'Cash', amount: s.paid_amount }],
  }));
};

export const getPosSettings = async (): Promise<PosSettingsPayload> => {
  const storedMethods = await db.pos_settings.get('payment_methods');
  const storedReceipt = await db.pos_settings.get('receipt');
  const storedDiscounts = await db.pos_settings.get('discount_rules');

  return {
    payment_methods: storedMethods ? storedMethods.value : DEFAULT_POS_SETTINGS.payment_methods,
    receipt: storedReceipt ? storedReceipt.value : DEFAULT_POS_SETTINGS.receipt,
    discount_rules: storedDiscounts ? storedDiscounts.value : DEFAULT_POS_SETTINGS.discount_rules,
  };
};

export const updatePosPaymentMethods = async (
  paymentMethods: PosPaymentMethodSetting[],
): Promise<PosPaymentMethodSetting[]> => {
  await db.pos_settings.put({ key: 'payment_methods', value: paymentMethods });
  return paymentMethods;
};

export const updatePosReceipt = async (receipt: PosReceiptSetting): Promise<PosReceiptSetting> => {
  await db.pos_settings.put({ key: 'receipt', value: receipt });
  return receipt;
};

export const updatePosDiscountRules = async (
  discountRules: PosDiscountRuleSetting,
): Promise<PosDiscountRuleSetting> => {
  await db.pos_settings.put({ key: 'discount_rules', value: discountRules });
  return discountRules;
};


export const exportProductsToExcel = (products: PosProduct[], filename = 'products-export.csv') => {
  const headers = [
    'SKU',
    'Barcode',
    'Product Name',
    'Category',
    'Unit',
    'Selling Price',
    'Stock Quantity',
    'Min Stock',
    'Tax Rate (%)',
    'Status',
  ];

  const rows = products.map((p) => [
    `"${(p.sku || '').replace(/"/g, '""')}"`,
    `"${(p.barcode || '').replace(/"/g, '""')}"`,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.category || '').replace(/"/g, '""')}"`,
    `"${(p.unit || p.unit_name || '').replace(/"/g, '""')}"`,
    p.price ?? 0,
    p.stock ?? 0,
    p.minimumStock ?? 0,
    p.taxRate ?? 0,
    `"${p.status || 'Active'}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const updatePosSale = async (
  id: number,
  payload: {
    customer_id?: number | null;
    payment_method?: string;
    status?: 'completed' | 'held' | 'voided' | 'refunded';
    notes?: string | null;
    grand_total?: number;
    paid_amount?: number;
  },
): Promise<PosSalePayload> => {
  await db.pos_sales.update(id, {
    ...(payload.customer_id ? { customer_id: payload.customer_id } : {}),
    ...(payload.payment_method ? { payment_method: payload.payment_method } : {}),
    ...(payload.status ? { status: payload.status === 'completed' ? 'Completed' : payload.status === 'refunded' ? 'Refunded' : 'Cancelled' } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes || '' } : {}),
    ...(payload.grand_total !== undefined ? { grand_total: payload.grand_total } : {}),
    ...(payload.paid_amount !== undefined ? { paid_amount: payload.paid_amount } : {}),
  });
  const allSales = await getPosSales();
  return allSales.find((s) => s.id === id) || ({} as PosSalePayload);
};

export const updatePosSaleStatus = async (
  id: number,
  status: 'completed' | 'held' | 'voided' | 'refunded',
  notes?: string,
): Promise<PosSalePayload> => {
  return await updatePosSale(id, { status, notes });
};

