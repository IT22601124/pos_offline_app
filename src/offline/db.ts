import Dexie, { type Table } from 'dexie';
import type { Branch, Role, User } from '../types';
import type { PosBrand, PosCategory, PosCustomer, PosProduct, PosSupplier, PosUnit } from '../hooks/pos/pos_controller';

export interface PosSaleItem {
  product_id: number;
  product_name: string;
  product_code: string;
  barcode: string;
  unit_price: number;
  quantity: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

export interface PosSaleRecord {
  id?: number;
  invoice_number: string;
  customer_id?: number;
  customer_name?: string;
  user_id?: number;
  user_name?: string;
  branch_id?: number;
  branch_name?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  change_amount: number;
  payment_method: string;
  notes?: string;
  status: 'Completed' | 'Refunded' | 'Cancelled';
  created_at: string;
  items: PosSaleItem[];
}

export interface PosCashTransactionRecord {
  id?: number;
  type: 'Cash In' | 'Cash Out' | 'Float Open' | 'Float Close';
  amount: number;
  note?: string;
  user_name?: string;
  created_at: string;
}

export type SupplierPurchasePaymentMethod = 'Cash' | 'Credit' | 'Bank Transfer' | 'Online';

export interface PosPurchaseLineRecord {
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  selling_price?: number;
  line_total: number;
}

export interface PosPurchaseRecord {
  id?: number;
  purchase_no: string;
  supplier_id: number;
  supplier_name: string;
  subtotal: number;
  discount_amount?: number;
  tax_amount?: number;
  freight_amount?: number;
  total_amount: number;
  paid_amount: number;
  credit_amount: number;
  payment_method: SupplierPurchasePaymentMethod;
  reference_no?: string;
  notes?: string;
  received_at: string;
  lines: PosPurchaseLineRecord[];
}

export interface PosSupplierTransactionRecord {
  id?: number;
  supplier_id: number;
  supplier_name: string;
  purchase_id?: number;
  type: 'purchase' | 'payment';
  amount: number;
  payment_method: SupplierPurchasePaymentMethod;
  reference_no?: string;
  notes?: string;
  created_at: string;
}

export interface PosStockMovementRecord {
  id?: number;
  product_id: number;
  product_name: string;
  type: 'purchase' | 'return' | 'customer_return' | 'sale' | 'adjustment';
  quantity: number;
  stock_after: number;
  supplier_id?: number;
  supplier_name?: string;
  customer_id?: number;
  customer_name?: string;
  purchase_id?: number;
  sale_id?: number;
  reference_type: 'supplier_purchase' | 'customer_return' | 'customer_sale' | 'manual';
  reference_id: string;
  unit_cost?: number;
  remarks?: string;
  created_at: string;
}

export interface PosCustomerReturnLine {
  product_id: number;
  product_name: string;
  product_code?: string;
  barcode?: string;
  unit_price: number;
  quantity: number;
  refund_amount: number;
  reason: string;
  restock: boolean;
}

export interface PosCustomerReturnRecord {
  id?: number;
  return_no: string;
  sale_id?: number;
  invoice_number: string;
  customer_id?: number;
  customer_name: string;
  refund_method: 'Cash' | 'Store Credit' | 'Bank / Card';
  total_refund: number;
  notes?: string;
  returned_at: string;
  items: PosCustomerReturnLine[];
}

export interface PosSettingRecord {
  key: string;
  value: any;
}

export class AppOfflineDatabase extends Dexie {
  users!: Table<User, number>;
  roles!: Table<Role, number>;
  branches!: Table<Branch, number>;
  categories!: Table<PosCategory, number>;
  brands!: Table<PosBrand, number>;
  units!: Table<PosUnit, number>;
  suppliers!: Table<PosSupplier, number>;
  products!: Table<PosProduct & {
    product_code?: string;
    description?: string;
    category_id?: number;
    brand_id?: number;
    unit_id?: number;
    cost_price?: number;
    selling_price?: number;
    wholesale_price?: number;
    stock_quantity?: number;
    minimum_stock?: number;
    tax_rate?: number;
    discount_rate?: number;
    supplier_id?: number;
    image?: string;
    weight?: number;
  }, number>;
  customers!: Table<PosCustomer & { id?: number; creditLimit?: number; balance?: number; credit_limit?: number; current_credit?: number; points?: number }, number>;

  pos_sales!: Table<PosSaleRecord, number>;
  pos_cash_transactions!: Table<PosCashTransactionRecord, number>;
  pos_purchases!: Table<PosPurchaseRecord, number>;
  pos_supplier_transactions!: Table<PosSupplierTransactionRecord, number>;
  pos_stock_movements!: Table<PosStockMovementRecord, number>;
  pos_customer_returns!: Table<PosCustomerReturnRecord, number>;
  pos_settings!: Table<PosSettingRecord, string>;

  constructor() {
    super('MPOS_Offline_DB');
    this.version(1).stores({
      users: '++id, phone, email, role, status',
      roles: '++id, name, status',
      branches: '++id, name, code, status',
      categories: '++id, name, status',
      brands: '++id, name, status',
      units: '++id, name, shortName, status',
      suppliers: '++id, name, phone, status',
      products: '++id, sku, barcode, categoryId, category_id, brandId, brand_id, status',
      customers: '++id, name, phone',
      pos_sales: '++id, invoice_number, customer_id, payment_method, status, created_at',
      pos_cash_transactions: '++id, type, created_at',
      pos_purchases: '++id, purchase_no, supplier_id, payment_method, received_at',
      pos_supplier_transactions: '++id, supplier_id, type, created_at',
      pos_stock_movements: '++id, product_id, supplier_id, type, created_at',
      pos_settings: 'key',
    });
    this.version(2).stores({
      pos_purchases: '++id, purchase_no, supplier_id, payment_method, received_at',
      pos_supplier_transactions: '++id, supplier_id, type, created_at',
      pos_stock_movements: '++id, product_id, supplier_id, type, created_at',
    });
    this.version(3).stores({
      pos_customer_returns: '++id, return_no, invoice_number, customer_id, customer_name, returned_at',
      pos_stock_movements: '++id, product_id, supplier_id, customer_id, type, created_at',
    });
  }
}

export const db = new AppOfflineDatabase();
