import { db, type PosCashTransactionRecord, type PosSaleRecord } from './db';
import type { Branch, Role, User } from '../types';
import type { CreateProductPayload, PosBrand, PosCategory, PosCustomer, PosProduct, PosSupplier, PosUnit } from '../hooks/pos/pos_controller';

// --- Auth ---
export const offlineLogin = async (phone: string, password: string) => {
  const user = await db.users.where('phone').equals(phone).first();
  if (!user) {
    throw new Error('User with this mobile number does not exist.');
  }

  if (user.password && user.password !== password) {
    throw new Error('Invalid credentials.');
  }

  const access_token = `offline_token_${user.id}_${Date.now()}`;
  return {
    access_token,
    user,
  };
};

// --- Users ---
export const offlineGetUsers = async (): Promise<User[]> => {
  return await db.users.toArray();
};

export const offlineAddUser = async (user: Omit<User, 'id'>): Promise<User> => {
  const id = await db.users.add(user as User);
  return { ...user, id };
};

// --- Roles ---
export const offlineGetRoles = async (): Promise<Role[]> => {
  return await db.roles.toArray();
};

export const offlineAddRole = async (role: Omit<Role, 'id'>): Promise<Role> => {
  const id = await db.roles.add(role as Role);
  return { ...role, id };
};

// --- Branches ---
export const offlineGetBranches = async (): Promise<Branch[]> => {
  return await db.branches.toArray();
};

export const offlineAddBranch = async (branch: Omit<Branch, 'id'>): Promise<Branch> => {
  const id = await db.branches.add(branch as Branch);
  return { ...branch, id };
};

// --- Master Data (Categories, Brands, Units, Suppliers) ---
export const offlineGetCategories = async (): Promise<PosCategory[]> => {
  return await db.categories.toArray();
};

export const offlineAddCategory = async (category: { name: string; description: string; status: boolean }): Promise<PosCategory> => {
  const id = await db.categories.add(category as PosCategory);
  return { id, ...category };
};

export const offlineGetBrands = async (): Promise<PosBrand[]> => {
  return await db.brands.toArray();
};

export const offlineAddBrand = async (brand: { name: string; description: string; status: boolean }): Promise<PosBrand> => {
  const id = await db.brands.add(brand as PosBrand);
  return { id, ...brand };
};

export const offlineGetUnits = async (): Promise<PosUnit[]> => {
  return await db.units.toArray();
};

export const offlineAddUnit = async (unit: { name: string; shortName: string; status: boolean }): Promise<PosUnit> => {
  const id = await db.units.add(unit as PosUnit);
  return { id, ...unit };
};

export const offlineGetSuppliers = async (): Promise<PosSupplier[]> => {
  return await db.suppliers.toArray();
};

export const offlineAddSupplier = async (supplier: Omit<PosSupplier, 'id'>): Promise<PosSupplier> => {
  const id = await db.suppliers.add(supplier as PosSupplier);
  return { id, ...supplier };
};

// --- Products ---
// --- Products ---
export const offlineGetProducts = async (): Promise<PosProduct[]> => {
  const products = await db.products.toArray();
  return products.map((p) => {
    const stock = Number(p.stock ?? p.stock_quantity ?? 0);
    const minimumStock = Number(p.minimumStock ?? p.minimum_stock ?? 5);
    const status: 'Active' | 'Low stock' | 'Inactive' =
      stock <= 0
        ? 'Inactive'
        : stock <= minimumStock
          ? 'Low stock'
          : p.status === 'Inactive'
            ? 'Inactive'
            : 'Active';

    return {
      id: p.id,
      name: p.name || 'Unnamed product',
      sku: p.sku || p.product_code || `SKU-${p.id}`,
      barcode: p.barcode || '',
      category: p.category || 'General',
      categoryId: Number(p.categoryId || p.category_id || 1),
      brandId: Number(p.brandId || p.brand_id || 1),
      unitId: Number(p.unitId || p.unit_id || 1),
      unit_name: p.unit_name || p.unit || 'Pcs',
      unit: p.unit || p.unit_name || 'Pcs',
      price: Number(p.price ?? p.selling_price ?? 0),
      stock,
      minimumStock,
      taxRate: Number(p.taxRate ?? p.tax_rate ?? 0),
      is_weighted: Boolean(p.is_weighted),
      status,
    };
  });
};

export const offlineAddProduct = async (payload: CreateProductPayload): Promise<PosProduct> => {
  const categoryObj = await db.categories.get(payload.category_id);
  const newProduct: any = {
    name: payload.name,
    sku: payload.product_code || `SKU-${Date.now()}`,
    product_code: payload.product_code,
    barcode: payload.barcode,
    description: payload.description,
    category: categoryObj?.name || 'General',
    categoryId: payload.category_id,
    category_id: payload.category_id,
    brandId: payload.brand_id,
    brand_id: payload.brand_id,
    unitId: payload.unit_id,
    unit_id: payload.unit_id,
    unit_name: payload.unit_name || 'Pcs',
    unit: payload.unit_name || 'Pcs',
    price: payload.selling_price,
    selling_price: payload.selling_price,
    cost_price: payload.cost_price,
    wholesale_price: payload.wholesale_price,
    stock: payload.stock_quantity,
    stock_quantity: payload.stock_quantity,
    minimumStock: payload.minimum_stock,
    minimum_stock: payload.minimum_stock,
    taxRate: payload.tax_rate,
    tax_rate: payload.tax_rate,
    discount_rate: payload.discount_rate,
    image: payload.image,
    weight: payload.weight,
    is_weighted: payload.is_weighted,
    status: payload.status ? (payload.stock_quantity <= 0 ? 'Inactive' : payload.stock_quantity <= payload.minimum_stock ? 'Low stock' : 'Active') : 'Inactive',
  };

  const id = await db.products.add(newProduct);
  return { ...newProduct, id };
};

export const offlineUpdateProduct = async (id: number, payload: Partial<PosProduct> & Record<string, any>): Promise<void> => {
  const existing = await db.products.get(id);
  const updated: Record<string, any> = { ...payload };

  if (existing) {
    if ('stock' in payload || 'stock_quantity' in payload) {
      const newStock = Number(payload.stock ?? payload.stock_quantity ?? existing.stock ?? existing.stock_quantity ?? 0);
      updated.stock = newStock;
      updated.stock_quantity = newStock;
      const minStock = Number(payload.minimumStock ?? payload.minimum_stock ?? existing.minimumStock ?? existing.minimum_stock ?? 5);
      if (!('status' in payload)) {
        updated.status = newStock <= 0 ? 'Inactive' : newStock <= minStock ? 'Low stock' : 'Active';
      }
    }

    if ('price' in payload || 'selling_price' in payload) {
      const val = Number(payload.price ?? payload.selling_price ?? existing.price ?? existing.selling_price ?? 0);
      updated.price = val;
      updated.selling_price = val;
    }

    if ('minimumStock' in payload || 'minimum_stock' in payload) {
      const val = Number(payload.minimumStock ?? payload.minimum_stock ?? existing.minimumStock ?? existing.minimum_stock ?? 5);
      updated.minimumStock = val;
      updated.minimum_stock = val;
    }

    if ('sku' in payload || 'product_code' in payload) {
      const val = payload.sku || payload.product_code || existing.sku || existing.product_code;
      updated.sku = val;
      updated.product_code = val;
    }

    if ('taxRate' in payload || 'tax_rate' in payload) {
      const val = Number(payload.taxRate ?? payload.tax_rate ?? existing.taxRate ?? existing.tax_rate ?? 0);
      updated.taxRate = val;
      updated.tax_rate = val;
    }

    if ('categoryId' in payload || 'category_id' in payload) {
      const catId = Number(payload.categoryId || payload.category_id || existing.categoryId || existing.category_id || 1);
      updated.categoryId = catId;
      updated.category_id = catId;
      if (catId) {
        const catObj = await db.categories.get(catId);
        if (catObj?.name) updated.category = catObj.name;
      }
    }
  }

  await db.products.update(id, updated);
};

export const offlineDeleteProduct = async (id: number): Promise<void> => {
  await db.products.delete(id);
};

// --- Customers ---
export const offlineGetCustomers = async (): Promise<PosCustomer[]> => {
  const customers = await db.customers.toArray();
  return customers.map((c, index) => ({
    id: c.id || index + 1,
    name: c.name || 'Unnamed customer',
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    creditLimit: Number(c.creditLimit ?? c.credit_limit ?? 0),
    balance: Number(c.balance ?? c.current_credit ?? 0),
    status: c.status === 'Blocked' ? 'Blocked' : 'Active',
  }));
};


export const offlineAddCustomer = async (customerData: Omit<PosCustomer, 'id'>): Promise<PosCustomer> => {
  const id = await db.customers.add(customerData as any);
  return { id, ...customerData };
};

// --- Sales & Transactions ---
export const offlineCreateSale = async (sale: Omit<PosSaleRecord, 'id'>): Promise<PosSaleRecord> => {
  return await db.transaction('rw', [db.pos_sales, db.products, db.customers], async () => {
    const invoiceNumber = sale.invoice_number || `INV-${Date.now().toString().slice(-6)}`;
    const fullSale: PosSaleRecord = {
      ...sale,
      invoice_number: invoiceNumber,
      status: sale.status || 'Completed',
      created_at: sale.created_at || new Date().toISOString(),
    };

    const id = await db.pos_sales.add(fullSale);
    fullSale.id = id;

    // Decrement stock in local DB
    if (sale.items && Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const product = await db.products.get(item.product_id);
        if (product) {
          const currentStock = Number(product.stock_quantity ?? product.stock ?? 0);
          const newStock = currentStock - item.quantity;
          await db.products.update(item.product_id, {
            stock: newStock,
            stock_quantity: newStock,
            status: product.status === 'Inactive' ? 'Inactive' : newStock <= (product.minimum_stock || 5) ? 'Low stock' : 'Active',
          });
        }
      }
    }

    return fullSale;
  });
};

export const offlineGetSales = async (): Promise<PosSaleRecord[]> => {
  return await db.pos_sales.reverse().toArray();
};

export const offlineAddCashTransaction = async (tx: Omit<PosCashTransactionRecord, 'id'>): Promise<PosCashTransactionRecord> => {
  const id = await db.pos_cash_transactions.add({
    ...tx,
    created_at: tx.created_at || new Date().toISOString(),
  });
  return { id, ...tx };
};

export const offlineGetCashTransactions = async (): Promise<PosCashTransactionRecord[]> => {
  return await db.pos_cash_transactions.reverse().toArray();
};

// --- Data Backup & Restore ---
export const offlineExportDatabase = async (): Promise<string> => {
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    users: await db.users.toArray(),
    roles: await db.roles.toArray(),
    branches: await db.branches.toArray(),
    categories: await db.categories.toArray(),
    brands: await db.brands.toArray(),
    units: await db.units.toArray(),
    suppliers: await db.suppliers.toArray(),
    products: await db.products.toArray(),
    customers: await db.customers.toArray(),
    pos_sales: await db.pos_sales.toArray(),
    pos_cash_transactions: await db.pos_cash_transactions.toArray(),
    pos_settings: await db.pos_settings.toArray(),
  };
  return JSON.stringify(exportData, null, 2);
};

export const offlineImportDatabase = async (jsonString: string): Promise<void> => {
  const data = JSON.parse(jsonString);

  await db.transaction(
    'rw',
    [
      db.users,
      db.roles,
      db.branches,
      db.categories,
      db.brands,
      db.units,
      db.suppliers,
      db.products,
      db.customers,
      db.pos_sales,
      db.pos_cash_transactions,
      db.pos_settings,
    ],
    async () => {
      if (data.users?.length) { await db.users.clear(); await db.users.bulkAdd(data.users); }
      if (data.roles?.length) { await db.roles.clear(); await db.roles.bulkAdd(data.roles); }
      if (data.branches?.length) { await db.branches.clear(); await db.branches.bulkAdd(data.branches); }
      if (data.categories?.length) { await db.categories.clear(); await db.categories.bulkAdd(data.categories); }
      if (data.brands?.length) { await db.brands.clear(); await db.brands.bulkAdd(data.brands); }
      if (data.units?.length) { await db.units.clear(); await db.units.bulkAdd(data.units); }
      if (data.suppliers?.length) { await db.suppliers.clear(); await db.suppliers.bulkAdd(data.suppliers); }
      if (data.products?.length) { await db.products.clear(); await db.products.bulkAdd(data.products); }
      if (data.customers?.length) { await db.customers.clear(); await db.customers.bulkAdd(data.customers); }
      if (data.pos_sales?.length) { await db.pos_sales.clear(); await db.pos_sales.bulkAdd(data.pos_sales); }
      if (data.pos_cash_transactions?.length) { await db.pos_cash_transactions.clear(); await db.pos_cash_transactions.bulkAdd(data.pos_cash_transactions); }
      if (data.pos_settings?.length) { await db.pos_settings.clear(); await db.pos_settings.bulkAdd(data.pos_settings); }
    }
  );
};
