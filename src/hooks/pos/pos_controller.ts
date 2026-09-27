import type { PosCustomer } from "../../components/AddCustomerModal";
export type { PosCustomer };
import {
  offlineAddBrand,
  offlineAddCategory,
  offlineAddCustomer,
  offlineAddProduct,
  offlineAddSupplier,
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
import {
  db,
  type PosPurchaseRecord,
  type PosPurchaseLineRecord,
  type PosStockMovementRecord,
  type PosSupplierTransactionRecord,
  type SupplierPurchasePaymentMethod,
  type PosCustomerReturnLine,
  type PosCustomerReturnRecord,
} from "../../offline/db";

export type {
  PosPurchaseRecord,
  PosPurchaseLineRecord,
  PosStockMovementRecord,
  PosSupplierTransactionRecord,
  SupplierPurchasePaymentMethod,
  PosCustomerReturnLine,
  PosCustomerReturnRecord,
};



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
  cost_price?: number;
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

export interface ReceiveSupplierStockPayload {
  supplier: PosSupplier;
  lines: PosPurchaseLineRecord[];
  payment_method: SupplierPurchasePaymentMethod;
  paid_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  freight_amount?: number;
  reference_no?: string;
  notes?: string;
  received_at?: string;
}

export type SupplierPaymentMethod = Exclude<SupplierPurchasePaymentMethod, 'Credit'>;

export interface SupplierPaymentPayload {
  supplier: PosSupplier;
  amount: number;
  payment_method: SupplierPaymentMethod;
  purchase_id?: number;
  reference_no?: string;
  notes?: string;
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

export const getSupplierPurchases = async (): Promise<PosPurchaseRecord[]> => {
  return (await db.pos_purchases.orderBy('received_at').reverse().toArray());
};

export const getSupplierTransactions = async (): Promise<PosSupplierTransactionRecord[]> => {
  return (await db.pos_supplier_transactions.orderBy('created_at').reverse().toArray());
};

export const paySupplierCredit = async (payload: SupplierPaymentPayload): Promise<PosSupplierTransactionRecord> => {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid supplier payment amount.');

  let paymentId: number | undefined;

  await db.transaction('rw', db.pos_supplier_transactions, db.pos_purchases, async () => {
    const transactions = await db.pos_supplier_transactions.where('supplier_id').equals(payload.supplier.id).toArray();
    const balance = transactions.reduce((total, transaction) => total + (transaction.type === 'purchase' ? transaction.amount : -transaction.amount), 0);
    if (amount > balance + 0.01) throw new Error(`Payment cannot exceed the outstanding credit of ${balance.toFixed(2)}.`);

    const payment: PosSupplierTransactionRecord = {
      supplier_id: payload.supplier.id,
      supplier_name: payload.supplier.name,
      purchase_id: payload.purchase_id,
      type: 'payment',
      amount,
      payment_method: payload.payment_method,
      reference_no: payload.reference_no?.trim() || undefined,
      notes: payload.notes?.trim() || 'Supplier credit payment',
      created_at: new Date().toISOString(),
    };

    paymentId = await db.pos_supplier_transactions.add(payment);

    // Allocate payment to unpaid/partially paid purchases (updating paid_amount and credit_amount in pos_purchases)
    const purchases = await db.pos_purchases.where('supplier_id').equals(payload.supplier.id).toArray();
    
    // Prioritize specified purchase_id if provided, then FIFO by received_at ascending
    purchases.sort((a, b) => {
      if (payload.purchase_id) {
        if (a.id === payload.purchase_id) return -1;
        if (b.id === payload.purchase_id) return 1;
      }
      return new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
    });

    let remainingPayment = amount;
    for (const purchase of purchases) {
      if (remainingPayment <= 0) break;
      const unpaid = purchase.credit_amount ?? Math.max(0, purchase.total_amount - purchase.paid_amount);
      if (unpaid > 0) {
        const payForThis = Math.min(remainingPayment, unpaid);
        const newPaid = purchase.paid_amount + payForThis;
        const newCredit = Math.max(0, purchase.total_amount - newPaid);

        if (purchase.id) {
          await db.pos_purchases.update(purchase.id, {
            paid_amount: newPaid,
            credit_amount: newCredit,
          });
        }
        remainingPayment -= payForThis;
      }
    }
  });

  return {
    id: paymentId,
    supplier_id: payload.supplier.id,
    supplier_name: payload.supplier.name,
    purchase_id: payload.purchase_id,
    type: 'payment',
    amount,
    payment_method: payload.payment_method,
    reference_no: payload.reference_no?.trim() || undefined,
    notes: payload.notes?.trim() || 'Supplier credit payment',
    created_at: new Date().toISOString(),
  };
};

export const receiveSupplierStock = async (
  payload: ReceiveSupplierStockPayload,
): Promise<PosPurchaseRecord> => {
  const validLines = payload.lines.filter((line) => line.quantity > 0 && line.unit_cost >= 0);
  if (!payload.supplier.id || validLines.length === 0) throw new Error('Supplier and at least one stock item are required.');

  const subtotal = validLines.reduce((sum, line) => sum + line.line_total, 0);
  const discountAmount = Math.max(0, Number(payload.discount_amount) || 0);
  const taxAmount = Math.max(0, Number(payload.tax_amount) || 0);
  const freightAmount = Math.max(0, Number(payload.freight_amount) || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount + freightAmount);
  const paidAmount = Math.min(Math.max(Number(payload.paid_amount) || 0, 0), totalAmount);
  const creditAmount = Math.max(totalAmount - paidAmount, 0);

  const purchaseNo = `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;
  const receivedAt = payload.received_at || new Date().toISOString();
  let purchaseId: number | undefined;

  await db.transaction(
    'rw',
    db.products,
    db.pos_purchases,
    db.pos_supplier_transactions,
    db.pos_stock_movements,
    async () => {
      const purchase: PosPurchaseRecord = {
        purchase_no: purchaseNo,
        supplier_id: payload.supplier.id,
        supplier_name: payload.supplier.name,
        subtotal,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        tax_amount: taxAmount > 0 ? taxAmount : undefined,
        freight_amount: freightAmount > 0 ? freightAmount : undefined,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        credit_amount: creditAmount,
        payment_method: payload.payment_method,
        reference_no: payload.reference_no?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        received_at: receivedAt,
        lines: validLines,
      };

      purchaseId = await db.pos_purchases.add(purchase);
      await db.pos_supplier_transactions.add({
        supplier_id: payload.supplier.id,
        supplier_name: payload.supplier.name,
        purchase_id: purchaseId,
        type: 'purchase',
        amount: totalAmount,
        payment_method: payload.payment_method,
        reference_no: payload.reference_no?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        created_at: receivedAt,
      });

      if (paidAmount > 0) {
        await db.pos_supplier_transactions.add({
          supplier_id: payload.supplier.id,
          supplier_name: payload.supplier.name,
          purchase_id: purchaseId,
          type: 'payment',
          amount: paidAmount,
          payment_method: payload.payment_method,
          reference_no: payload.reference_no?.trim() || undefined,
          notes: `Payment for ${purchaseNo}`,
          created_at: receivedAt,
        });
      }

      for (const line of validLines) {
        const product = await db.products.get(line.product_id);
        if (!product) throw new Error(`Product ${line.product_name} could not be found.`);

        const currentStock = Number(product.stock ?? product.stock_quantity ?? 0);
        const nextStock = currentStock + line.quantity;
        const minimumStock = Number(product.minimumStock ?? product.minimum_stock ?? 5);

        const updateData: Record<string, any> = {
          stock: nextStock,
          stock_quantity: nextStock,
          cost_price: line.unit_cost,
          supplier_id: payload.supplier.id,
          status: nextStock <= 0 ? 'Inactive' : nextStock <= minimumStock ? 'Low stock' : 'Active',
        };

        if (typeof line.selling_price === 'number' && line.selling_price > 0) {
          updateData.price = line.selling_price;
          updateData.selling_price = line.selling_price;
        }

        await db.products.update(line.product_id, updateData);

        const movement: PosStockMovementRecord = {
          product_id: line.product_id,
          product_name: line.product_name,
          type: 'purchase',
          quantity: line.quantity,
          stock_after: nextStock,
          supplier_id: payload.supplier.id,
          supplier_name: payload.supplier.name,
          purchase_id: purchaseId,
          reference_type: 'supplier_purchase',
          reference_id: purchaseNo,
          unit_cost: line.unit_cost,
          remarks: payload.notes?.trim() || undefined,
          created_at: receivedAt,
        };
        await db.pos_stock_movements.add(movement);
      }
    },
  );

  return {
    purchase_no: purchaseNo,
    supplier_id: payload.supplier.id,
    supplier_name: payload.supplier.name,
    subtotal,
    discount_amount: discountAmount > 0 ? discountAmount : undefined,
    tax_amount: taxAmount > 0 ? taxAmount : undefined,
    freight_amount: freightAmount > 0 ? freightAmount : undefined,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    credit_amount: creditAmount,
    payment_method: payload.payment_method,
    reference_no: payload.reference_no?.trim() || undefined,
    notes: payload.notes?.trim() || undefined,
    received_at: receivedAt,
    lines: validLines,
    id: purchaseId,
  };
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

export const createSupplier = async (name: string): Promise<PosSupplier> => {
  return await offlineAddSupplier({
    name: name.trim(),
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    status: true,
  });
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
  if (endpoint.includes('stock-movements')) return await db.pos_stock_movements.toArray() as any;
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

  const totalStock = products.reduce((acc, p) => acc + (p.stock ?? 0), 0);
  const totalValuation = products.reduce((acc, p) => acc + ((p.stock ?? 0) * (p.price ?? 0)), 0);

  const totalsRow = [
    `"TOTAL (${products.length} PRODUCTS)"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    totalStock,
    '""',
    '""',
    `"Stock Value: LKR ${totalValuation.toLocaleString()}"`,
  ];

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), totalsRow.join(',')].join('\n');
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

export interface ProcessCustomerReturnPayload {
  sale_id?: number;
  invoice_number: string;
  customer_id?: number;
  customer_name: string;
  refund_method: 'Cash' | 'Store Credit' | 'Bank / Card';
  items: Array<{
    product_id: number;
    product_name: string;
    product_code?: string;
    barcode?: string;
    unit_price: number;
    quantity: number;
    refund_amount: number;
    reason: string;
    restock: boolean;
  }>;
  notes?: string;
}

export const processCustomerReturn = async (
  payload: ProcessCustomerReturnPayload
): Promise<PosCustomerReturnRecord> => {
  const validItems = payload.items.filter((item) => item.quantity > 0 && item.refund_amount >= 0);
  if (validItems.length === 0) {
    throw new Error('Please select at least one item and quantity to return.');
  }

  const totalRefund = validItems.reduce((sum, item) => sum + item.refund_amount, 0);
  const returnNo = `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;
  const returnedAt = new Date().toISOString();
  let returnId: number | undefined;

  await db.transaction(
    'rw',
    db.products,
    db.pos_sales,
    db.customers,
    db.pos_customer_returns,
    db.pos_stock_movements,
    async () => {
      const returnRecord: PosCustomerReturnRecord = {
        return_no: returnNo,
        sale_id: payload.sale_id,
        invoice_number: payload.invoice_number,
        customer_id: payload.customer_id || undefined,
        customer_name: payload.customer_name || 'Walk-in customer',
        refund_method: payload.refund_method,
        total_refund: totalRefund,
        notes: payload.notes?.trim() || undefined,
        returned_at: returnedAt,
        items: validItems,
      };

      returnId = await db.pos_customer_returns.add(returnRecord);

      // If store credit refund and customer exists, top up customer credit / reduce balance
      if (payload.refund_method === 'Store Credit' && payload.customer_id) {
        const customer = await db.customers.get(payload.customer_id);
        if (customer) {
          const currentBal = Number(customer.balance ?? customer.current_credit ?? 0);
          const nextBal = currentBal - totalRefund;
          await db.customers.update(payload.customer_id, {
            balance: nextBal,
            current_credit: nextBal,
          });
        }
      }

      // Update Stock and create Stock Movements for restocked items
      for (const item of validItems) {
        const product = await db.products.get(item.product_id);
        if (product) {
          const currentStock = Number(product.stock ?? product.stock_quantity ?? 0);
          const nextStock = item.restock ? currentStock + item.quantity : currentStock;
          const minStock = Number(product.minimumStock ?? product.minimum_stock ?? 5);

          if (item.restock) {
            await db.products.update(item.product_id, {
              stock: nextStock,
              stock_quantity: nextStock,
              status: nextStock <= 0 ? 'Inactive' : nextStock <= minStock ? 'Low stock' : 'Active',
            });
          }

          const movement: PosStockMovementRecord = {
            product_id: item.product_id,
            product_name: item.product_name,
            type: 'customer_return',
            quantity: item.quantity,
            stock_after: nextStock,
            customer_id: payload.customer_id || undefined,
            customer_name: payload.customer_name,
            sale_id: payload.sale_id,
            reference_type: 'customer_return',
            reference_id: returnNo,
            unit_cost: item.unit_price,
            remarks: `Customer return (${item.reason})${item.restock ? ' - Restocked' : ' - Discarded'}`,
            created_at: returnedAt,
          };
          await db.pos_stock_movements.add(movement);
        }
      }

      // Check original sale and mark refunded if needed
      if (payload.sale_id) {
        const originalSale = await db.pos_sales.get(payload.sale_id);
        if (originalSale) {
          await db.pos_sales.update(payload.sale_id, {
            status: 'Refunded',
          });
        }
      }
    }
  );

  return {
    id: returnId,
    return_no: returnNo,
    sale_id: payload.sale_id,
    invoice_number: payload.invoice_number,
    customer_id: payload.customer_id,
    customer_name: payload.customer_name,
    refund_method: payload.refund_method,
    total_refund: totalRefund,
    notes: payload.notes,
    returned_at: returnedAt,
    items: validItems,
  };
};

export const getCustomerReturns = async (
  customerId?: number
): Promise<PosCustomerReturnRecord[]> => {
  if (customerId) {
    return await db.pos_customer_returns.where('customer_id').equals(customerId).reverse().toArray();
  }
  return await db.pos_customer_returns.orderBy('returned_at').reverse().toArray();
};
