import { db } from './db';

export const initializeOfflineDatabase = async () => {
  try {
    const userCount = await db.users.count();
    if (userCount > 0) {
      return; // Already initialized
    }

    console.log('Seeding initial offline database...');

    // 1. Roles
    await db.roles.bulkAdd([
      { id: 1, name: 'Super Admin', description: 'Full system access', permissions: ['all'], status: 'Active' },
      { id: 2, name: 'Manager', description: 'Branch management & reports', permissions: ['inventory', 'sales', 'reports'], status: 'Active' },
      { id: 3, name: 'Cashier', description: 'POS sale processing', permissions: ['pos'], status: 'Active' },
    ]);

    // 2. Branches
    await db.branches.bulkAdd([
      { id: 1, name: 'Main Branch', code: 'MB01', location: 'Commercial Center, Colombo', manager: 'Admin User', status: 'Active' },
      { id: 2, name: 'Kandy Branch', code: 'KB02', location: 'Main Street, Kandy', manager: 'John Cashier', status: 'Active' },
    ]);

    // 3. Users
    await db.users.bulkAdd([
      {
        id: 1,
        name: 'Admin User',
        email: 'admin@mpos.local',
        phone: '0770000000',
        password: 'admin123',
        branch: 'Main Branch',
        role: 'Super Admin',
        status: 'Active',
        joined: '2026-01-01',
        designation: 'System Administrator',
        department: 'Management',
      },
      {
        id: 2,
        name: 'John Cashier',
        email: 'cashier@mpos.local',
        phone: '0771111111',
        password: 'cashier123',
        branch: 'Main Branch',
        role: 'Cashier',
        status: 'Active',
        joined: '2026-02-01',
        designation: 'Senior Cashier',
        department: 'Sales',
      },
    ]);

    // 4. Categories
    await db.categories.bulkAdd([
      { id: 1, name: 'Beverages', description: 'Soft drinks, juices & water', status: true },
      { id: 2, name: 'Snacks & Confectionery', description: 'Chips, chocolates & biscuits', status: true },
      { id: 3, name: 'Dairy & Eggs', description: 'Milk, cheese, butter & eggs', status: true },
      { id: 4, name: 'Bakery', description: 'Bread, buns & pastries', status: true },
      { id: 5, name: 'General Merchandise', description: 'Household items & sundries', status: true },
    ]);

    // 5. Brands
    await db.brands.bulkAdd([
      { id: 1, name: 'Coca Cola', description: 'Global beverage brand', status: true },
      { id: 2, name: 'Nestle', description: 'Food & beverage giant', status: true },
      { id: 3, name: 'Elephant House', description: 'Local beverage & ice cream brand', status: true },
      { id: 4, name: 'Anchor', description: 'Dairy product brand', status: true },
      { id: 5, name: 'Generic / Local', description: 'Unbranded or local items', status: true },
    ]);

    // 6. Units
    await db.units.bulkAdd([
      { id: 1, name: 'Pieces', shortName: 'Pcs', status: true },
      { id: 2, name: 'Kilograms', shortName: 'Kg', status: true },
      { id: 3, name: 'Liters', shortName: 'L', status: true },
      { id: 4, name: 'Packets', shortName: 'Pkt', status: true },
      { id: 5, name: 'Boxes', shortName: 'Box', status: true },
    ]);

    // 7. Suppliers
    await db.suppliers.bulkAdd([
      { id: 1, name: 'Ceylon Beverages Ltd', contactPerson: 'Sunil Perera', phone: '0112345678', email: 'sales@ceylonbev.com', address: 'Colombo 03', status: true },
      { id: 2, name: 'Lanka Food Distributors', contactPerson: 'Kamal Silva', phone: '0119876543', email: 'orders@lankafood.com', address: 'Kelaniya', status: true },
    ]);

    // 8. Customers
    await db.customers.bulkAdd([
      { id: 1, name: 'Walk-in Customer', phone: '0000000000', email: 'walkin@mpos.local', address: 'Over the counter', creditLimit: 0, balance: 0, status: 'Active' },
      { id: 2, name: 'Jane Doe', phone: '0779998888', email: 'jane@example.com', address: 'Nugegoda, Colombo', creditLimit: 50000, balance: 0, status: 'Active' },
    ]);


    // 9. Sample Products
    await db.products.bulkAdd([
      {
        id: 1,
        name: 'Coca Cola 500ml',
        sku: 'BEV-CC-500',
        barcode: '8830001',
        category: 'Beverages',
        categoryId: 1,
        category_id: 1,
        brandId: 1,
        brand_id: 1,
        unitId: 1,
        unit_id: 1,
        unit_name: 'Pcs',
        unit: 'Pcs',
        price: 250.00,
        selling_price: 250.00,
        cost_price: 190.00,
        wholesale_price: 230.00,
        stock: 150,
        stock_quantity: 150,
        minimumStock: 20,
        minimum_stock: 20,
        taxRate: 0,
        tax_rate: 0,
        discount_rate: 0,
        is_weighted: false,
        status: 'Active',
      },
      {
        id: 2,
        name: 'Elephant House Ginger Beer 400ml',
        sku: 'BEV-EGB-400',
        barcode: '8830002',
        category: 'Beverages',
        categoryId: 1,
        category_id: 1,
        brandId: 3,
        brand_id: 3,
        unitId: 1,
        unit_id: 1,
        unit_name: 'Pcs',
        unit: 'Pcs',
        price: 220.00,
        selling_price: 220.00,
        cost_price: 170.00,
        wholesale_price: 200.00,
        stock: 120,
        stock_quantity: 120,
        minimumStock: 15,
        minimum_stock: 15,
        taxRate: 0,
        tax_rate: 0,
        discount_rate: 0,
        is_weighted: false,
        status: 'Active',
      },
      {
        id: 3,
        name: 'Anchor Full Cream Milk Powder 400g',
        sku: 'DY-ANC-400',
        barcode: '8830003',
        category: 'Dairy & Eggs',
        categoryId: 3,
        category_id: 3,
        brandId: 4,
        brand_id: 4,
        unitId: 4,
        unit_id: 4,
        unit_name: 'Pkt',
        unit: 'Pkt',
        price: 1150.00,
        selling_price: 1150.00,
        cost_price: 980.00,
        wholesale_price: 1100.00,
        stock: 45,
        stock_quantity: 45,
        minimumStock: 10,
        minimum_stock: 10,
        taxRate: 0,
        tax_rate: 0,
        discount_rate: 0,
        is_weighted: false,
        status: 'Active',
      },
      {
        id: 4,
        name: 'Fresh Sandwich Bread 450g',
        sku: 'BK-BRD-450',
        barcode: '8830004',
        category: 'Bakery',
        categoryId: 4,
        category_id: 4,
        brandId: 5,
        brand_id: 5,
        unitId: 1,
        unit_id: 1,
        unit_name: 'Pcs',
        unit: 'Pcs',
        price: 180.00,
        selling_price: 180.00,
        cost_price: 140.00,
        wholesale_price: 165.00,
        stock: 30,
        stock_quantity: 30,
        minimumStock: 5,
        minimum_stock: 5,
        taxRate: 0,
        tax_rate: 0,
        discount_rate: 0,
        is_weighted: false,
        status: 'Active',
      },
      {
        id: 5,
        name: 'Munchee Cream Crackers 190g',
        sku: 'SNK-MCC-190',
        barcode: '8830005',
        category: 'Snacks & Confectionery',
        categoryId: 2,
        category_id: 2,
        brandId: 5,
        brand_id: 5,
        unitId: 4,
        unit_id: 4,
        unit_name: 'Pkt',
        unit: 'Pkt',
        price: 240.00,
        selling_price: 240.00,
        cost_price: 195.00,
        wholesale_price: 220.00,
        stock: 80,
        stock_quantity: 80,
        minimumStock: 12,
        minimum_stock: 12,
        taxRate: 0,
        tax_rate: 0,
        discount_rate: 0,
        is_weighted: false,
        status: 'Active',
      },
    ]);

    // 10. Default Store Settings
    await db.pos_settings.bulkAdd([
      { key: 'store_name', value: 'NOVA MPOS Offline' },
      { key: 'currency', value: 'Rs.' },
      { key: 'address', value: 'No 100, Galle Road, Colombo 03' },
      { key: 'phone', value: '+94 11 234 5678' },
      { key: 'tax_rate', value: 0 },
      { key: 'receipt_footer', value: 'Thank you for shopping with us! Please come again.' },
    ]);

    console.log('Offline database initial seed completed successfully.');
  } catch (error) {
    console.error('Error seeding offline database:', error);
  }
};
