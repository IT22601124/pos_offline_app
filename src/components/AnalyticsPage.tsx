import React from 'react';
import { type PosSalePayload } from '../hooks/pos/pos_controller';

interface SegmentRow {
  label: string;
  bills: number;
  sales: number;
  collected: number;
  credit: number;
}

interface ProductRow {
  name: string;
  quantity: number;
  sales: number;
  share: number;
}

const LOCAL_SALES_KEY = 'nova_pos_sales';
const LOCAL_HELD_ORDERS_KEY = 'nova_pos_held_orders';

const SAMPLE_SALES: PosSalePayload[] = [
  {
    sale_no: 'ANL-001',
    status: 'completed',
    customer_name: 'Walk-in customer',
    cashier_id: 1,
    cashier_name: 'Super Admin',
    cashier_role: 'Super Admin',
    register_no: 'Register 01',
    shift_code: 'Shift A',
    payment_method: 'Cash',
    subtotal: 18200,
    discount_amount: 700,
    taxable_amount: 17500,
    tax_amount: 1400,
    total_amount: 18900,
    paid_amount: 19000,
    change_amount: 100,
    credit_amount: 0,
    due_days: null,
    notes: '',
    sold_at: new Date().toISOString(),
    items: [
      { product_id: 1, product_name: 'Basmati Rice 5kg', product_code: 'GRY-101', barcode: '', unit_price: 3450, quantity: 3, discount_amount: 350, tax_amount: 820, line_total: 10820 },
      { product_id: 2, product_name: 'Coconut Oil 1L', product_code: 'GRY-102', barcode: '', unit_price: 910, quantity: 7, discount_amount: 350, tax_amount: 580, line_total: 8080 },
    ],
    payments: [{ method: 'Cash', amount: 19000 }],
  },
  {
    sale_no: 'ANL-002',
    status: 'completed',
    customer_name: 'Tharindu Stores',
    cashier_id: 2,
    cashier_name: 'Cashier 01',
    cashier_role: 'Cashier',
    register_no: 'Register 01',
    shift_code: 'Shift A',
    payment_method: 'Credit',
    subtotal: 12200,
    discount_amount: 0,
    taxable_amount: 12200,
    tax_amount: 976,
    total_amount: 13176,
    paid_amount: 6000,
    change_amount: 0,
    credit_amount: 7176,
    due_days: 14,
    notes: '',
    sold_at: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { product_id: 3, product_name: 'Milk 1L', product_code: 'DRY-001', barcode: '', unit_price: 420, quantity: 14, discount_amount: 0, tax_amount: 470, line_total: 6350 },
      { product_id: 4, product_name: 'Orange Juice', product_code: 'BEV-031', barcode: '', unit_price: 520, quantity: 11, discount_amount: 0, tax_amount: 506, line_total: 6826 },
    ],
    payments: [{ method: 'Credit', amount: 6000 }],
  },
  {
    sale_no: 'ANL-003',
    status: 'completed',
    customer_name: 'Walk-in customer',
    cashier_id: 1,
    cashier_name: 'Super Admin',
    cashier_role: 'Super Admin',
    register_no: 'Register 02',
    shift_code: 'Shift B',
    payment_method: 'Card',
    subtotal: 8500,
    discount_amount: 300,
    taxable_amount: 8200,
    tax_amount: 656,
    total_amount: 8856,
    paid_amount: 8856,
    change_amount: 0,
    credit_amount: 0,
    due_days: null,
    notes: '',
    sold_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    items: [
      { product_id: 5, product_name: 'Chicken Sausages', product_code: 'FRZ-011', barcode: '', unit_price: 740, quantity: 6, discount_amount: 150, tax_amount: 344, line_total: 4634 },
      { product_id: 6, product_name: 'Hand Wash', product_code: 'HOM-021', barcode: '', unit_price: 560, quantity: 7, discount_amount: 150, tax_amount: 312, line_total: 4222 },
    ],
    payments: [{ method: 'Card', amount: 8856 }],
  },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(value);

const sum = <T,>(items: T[], selector: (item: T) => number) =>
  items.reduce((total, item) => total + selector(item), 0);

interface UserProfile {
  id?: number;
  name?: string;
  username?: string;
  role_id?: number | string;
  role_name?: string;
  role?: string;
}

const loadStoredSales = (key: string): PosSalePayload[] => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as PosSalePayload[]) : [];
  } catch {
    return [];
  }
};

const getStoredUser = (): UserProfile => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserProfile) : {};
  } catch {
    return {};
  }
};

const checkIsAdmin = (user: UserProfile): boolean => {
  if (user.role_id === 1 || user.role_id === '1') return true;
  const rName = (user.role_name || user.role || '').toLowerCase();
  if (rName.includes('admin')) return true;
  const uName = (user.name || user.username || '').toLowerCase();
  if (uName.includes('super admin') || uName === 'tahrindu') return true;
  return false;
};

const getSegmentRows = (sales: PosSalePayload[], selector: (sale: PosSalePayload) => string): SegmentRow[] => {
  const rows = new Map<string, SegmentRow>();

  sales.forEach((sale) => {
    const label = selector(sale);
    const current = rows.get(label) ?? { label, bills: 0, sales: 0, collected: 0, credit: 0 };
    rows.set(label, {
      label,
      bills: current.bills + 1,
      sales: current.sales + sale.total_amount,
      collected: current.collected + sale.paid_amount,
      credit: current.credit + sale.credit_amount,
    });
  });

  return Array.from(rows.values()).sort((a, b) => b.sales - a.sales);
};

const AnalyticsPage: React.FC = () => {
  const user = getStoredUser();
  const isAdmin = checkIsAdmin(user);
  const [salesScope, setSalesScope] = React.useState<'all' | 'own'>(isAdmin ? 'all' : 'own');
  const storedSales = loadStoredSales(LOCAL_SALES_KEY);
  const heldOrders = loadStoredSales(LOCAL_HELD_ORDERS_KEY);
  const allCompletedSales = (storedSales.length ? storedSales : SAMPLE_SALES).filter((sale) => sale.status === 'completed');

  const effectiveScope = isAdmin ? salesScope : 'own';

  const sales = allCompletedSales.filter((sale) => {
    if (effectiveScope === 'all') return true;
    if (user.id && sale.cashier_id) {
      return Number(sale.cashier_id) === Number(user.id);
    }
    const currentName = (user.name || user.username || '').toLowerCase();
    const cashierName = (sale.cashier_name || '').toLowerCase();
    if (currentName && cashierName) {
      return cashierName.includes(currentName) || currentName.includes(cashierName);
    }
    if (!isAdmin) {
      return Number(sale.cashier_id) === 2 || cashierName.includes('cashier');
    }
    return Number(sale.cashier_id) === 1 || cashierName.includes('admin');
  });

  const totalSales = sum(sales, (sale) => sale.total_amount);
  const collected = sum(sales, (sale) => sale.paid_amount);
  const credit = sum(sales, (sale) => sale.credit_amount);
  const tax = sum(sales, (sale) => sale.tax_amount);
  const discount = sum(sales, (sale) => sale.discount_amount);
  const itemsSold = sum(sales, (sale) => sum(sale.items, (item) => item.quantity));
  const averageBill = sales.length ? totalSales / sales.length : 0;
  const collectionRate = totalSales ? Math.round((collected / totalSales) * 100) : 0;
  const discountRate = totalSales ? Math.round((discount / totalSales) * 100) : 0;

  const cashierRows = getSegmentRows(sales, (sale) => sale.cashier_name || 'Unknown cashier');
  const paymentRows = getSegmentRows(sales, (sale) => sale.payment_method || 'Unknown payment');
  const shiftRows = getSegmentRows(sales, (sale) => sale.shift_code || 'No shift');
  const maxSegmentSales = Math.max(...cashierRows.map((row) => row.sales), 1);

  const productMap = new Map<string, Omit<ProductRow, 'share'>>();
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = productMap.get(item.product_name) ?? { name: item.product_name, quantity: 0, sales: 0 };
      productMap.set(item.product_name, {
        name: item.product_name,
        quantity: current.quantity + item.quantity,
        sales: current.sales + item.line_total,
      });
    });
  });
  const productRows = Array.from(productMap.values())
    .map((row) => ({ ...row, share: totalSales ? Math.round((row.sales / totalSales) * 100) : 0 }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 7);

  const exceptionRows = [
    {
      label: 'Credit exposure',
      value: formatMoney(credit),
      status: credit > totalSales * 0.25 ? 'Watch' : 'Normal',
      tone: credit > totalSales * 0.25 ? '#F59E0B' : '#23C16B',
    },
    {
      label: 'Discount leakage',
      value: `${discountRate}%`,
      status: discountRate > 8 ? 'Review' : 'Controlled',
      tone: discountRate > 8 ? '#EF4444' : '#23C16B',
    },
    {
      label: 'Held orders',
      value: formatNumber(heldOrders.length),
      status: heldOrders.length ? 'Pending' : 'Clear',
      tone: heldOrders.length ? '#2F80ED' : '#23C16B',
    },
  ];

  return (
    <div style={styles.container}>
      <section style={styles.topBar}>
        <div>
          <span style={styles.eyebrow}>Analytics workspace</span>
          <h1 style={styles.title}>Sales analysis</h1>
        </div>
        <div style={styles.filterBar}>
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setSalesScope('all')}
                style={{ ...styles.filterButton, ...(effectiveScope === 'all' ? styles.filterButtonActive : {}) }}
              >
                All Sales
              </button>
              <button
                type="button"
                onClick={() => setSalesScope('own')}
                style={{ ...styles.filterButton, ...(effectiveScope === 'own' ? styles.filterButtonActive : {}) }}
              >
                My Sales
              </button>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#23C16B' }}>
              My Sales Only
            </span>
          )}
        </div>
      </section>

      <section style={styles.metricStrip}>
        {[
          ['Net sales', formatMoney(totalSales), 'ti-report-money'],
          ['Collected', formatMoney(collected), 'ti-cash-banknote'],
          ['Credit due', formatMoney(credit), 'ti-credit-card'],
          ['Avg bill', formatMoney(averageBill), 'ti-receipt'],
          ['Items', formatNumber(itemsSold), 'ti-shopping-bag'],
        ].map(([label, value, icon]) => (
          <article key={label} style={styles.metricCell}>
            <i className={`ti ${icon}`} aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section style={styles.workbenchGrid}>
        <article style={styles.scorePanel}>
          <div style={styles.scoreHeader}>
            <span>Collection score</span>
            <strong>{collectionRate}%</strong>
          </div>
          <div style={styles.scoreRing} aria-label={`Collection score ${collectionRate}%`}>
            <span style={{ ...styles.scoreRingFill, background: `conic-gradient(#23C16B ${collectionRate * 3.6}deg, var(--app-surface-muted) 0deg)` }} />
            <b>{collectionRate}%</b>
          </div>
          <div style={styles.scoreStats}>
            <span><strong>{formatMoney(tax)}</strong><small>Tax</small></span>
            <span><strong>{formatMoney(discount)}</strong><small>Discount</small></span>
          </div>
        </article>

        <article style={styles.matrixPanel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Payment matrix</h2>
              <p style={styles.panelSub}>Collection and credit by method</p>
            </div>
          </div>
          <div style={styles.matrixTable}>
            <div style={styles.matrixHead}>
              <span>Method</span>
              <span>Bills</span>
              <span>Sales</span>
              <span>Collected</span>
              <span>Credit</span>
            </div>
            {paymentRows.map((row) => (
              <div key={row.label} style={styles.matrixRow}>
                <strong>{row.label}</strong>
                <span>{row.bills}</span>
                <span>{formatMoney(row.sales)}</span>
                <span>{formatMoney(row.collected)}</span>
                <span>{formatMoney(row.credit)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={styles.detailGrid}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Cashier contribution</h2>
              <p style={styles.panelSub}>Ranked by sale value</p>
            </div>
          </div>
          <div style={styles.rankList}>
            {(cashierRows.length ? cashierRows : [{ label: 'No cashier data', bills: 0, sales: 0, collected: 0, credit: 0 }]).map((row, index) => (
              <div key={row.label} style={styles.rankRow}>
                <span style={styles.rankNumber}>{index + 1}</span>
                <div style={styles.rankBody}>
                  <div style={styles.rankTop}>
                    <strong>{row.label}</strong>
                    <span>{formatMoney(row.sales)}</span>
                  </div>
                  <div style={styles.track}>
                    <span style={{ ...styles.fill, width: `${Math.max(6, (row.sales / maxSegmentSales) * 100)}%` }} />
                  </div>
                  <small>{row.bills} bills / {formatMoney(row.credit)} credit</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Product contribution</h2>
              <p style={styles.panelSub}>Share of total sales</p>
            </div>
          </div>
          <div style={styles.productTable}>
            <div style={styles.productHead}>
              <span>Product</span>
              <span>Qty</span>
              <span>Share</span>
              <span>Sales</span>
            </div>
            {(productRows.length ? productRows : [{ name: 'No products sold', quantity: 0, share: 0, sales: 0 }]).map((row) => (
              <div key={row.name} style={styles.productRow}>
                <strong>{row.name}</strong>
                <span>{formatNumber(row.quantity)}</span>
                <span>{row.share}%</span>
                <span>{formatMoney(row.sales)}</span>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.sideStack}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Exceptions</h2>
                <p style={styles.panelSub}>Items needing attention</p>
              </div>
            </div>
            <div style={styles.exceptionList}>
              {exceptionRows.map((row) => (
                <div key={row.label} style={styles.exceptionRow}>
                  <span style={{ ...styles.statusDot, background: row.tone }} />
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.status}</small>
                  </span>
                  <b>{row.value}</b>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Shift split</h2>
                <p style={styles.panelSub}>Register timing view</p>
              </div>
            </div>
            <div style={styles.shiftList}>
              {shiftRows.map((row) => (
                <span key={row.label}>
                  <strong>{row.label}</strong>
                  <small>{row.bills} bills</small>
                  <b>{formatMoney(row.sales)}</b>
                </span>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100%',
    padding: 24,
    background: 'var(--app-bg)',
    color: 'var(--app-text)',
    overflowY: 'auto',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#2F80ED',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    color: 'var(--app-text-strong)',
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 0,
  },
  filterBar: {
    display: 'inline-grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
    padding: 4,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
  },
  filterButton: {
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--app-muted)',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  filterButtonActive: {
    background: '#2F80ED',
    color: '#FFFFFF',
  },
  metricStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: 'var(--app-shadow)',
  },
  metricCell: {
    display: 'grid',
    gap: 7,
    padding: 15,
    borderRight: '1px solid var(--app-border-soft)',
  },
  workbenchGrid: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: 16,
    marginBottom: 16,
  },
  scorePanel: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    boxShadow: 'var(--app-shadow)',
    padding: 16,
    display: 'grid',
    gap: 14,
  },
  scoreHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: 'var(--app-text-strong)',
    fontWeight: 900,
  },
  scoreRing: {
    position: 'relative',
    width: 190,
    height: 190,
    justifySelf: 'center',
    display: 'grid',
    placeItems: 'center',
  },
  scoreRingFill: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
  },
  scoreStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  matrixPanel: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    boxShadow: 'var(--app-shadow)',
    overflow: 'hidden',
  },
  panel: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    boxShadow: 'var(--app-shadow)',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: 16,
    borderBottom: '1px solid var(--app-border-soft)',
  },
  panelTitle: {
    color: 'var(--app-text-strong)',
    fontSize: 15,
    fontWeight: 900,
  },
  panelSub: {
    color: 'var(--app-muted)',
    fontSize: 12,
    marginTop: 2,
  },
  matrixTable: {
    display: 'grid',
  },
  matrixHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(130px, 1fr) 70px repeat(3, minmax(120px, 1fr))',
    gap: 12,
    padding: '10px 16px',
    background: 'var(--app-surface-soft)',
    color: 'var(--app-muted)',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  matrixRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(130px, 1fr) 70px repeat(3, minmax(120px, 1fr))',
    gap: 12,
    padding: '13px 16px',
    borderTop: '1px solid var(--app-border-soft)',
    alignItems: 'center',
    fontSize: 13,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 0.9fr) minmax(430px, 1.15fr) minmax(300px, 0.85fr)',
    gap: 16,
  },
  rankList: {
    display: 'grid',
    gap: 10,
    padding: 16,
  },
  rankRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr)',
    gap: 10,
    alignItems: 'start',
  },
  rankNumber: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#2F80ED',
    color: '#FFFFFF',
    fontWeight: 900,
  },
  rankBody: {
    display: 'grid',
    gap: 6,
  },
  rankTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: 'var(--app-text-strong)',
    fontSize: 13,
  },
  track: {
    height: 10,
    borderRadius: 999,
    background: 'var(--app-surface-muted)',
    overflow: 'hidden',
  },
  fill: {
    display: 'block',
    height: '100%',
    minWidth: 6,
    borderRadius: 999,
    background: 'linear-gradient(90deg, #2F80ED, #23C16B)',
  },
  productTable: {
    display: 'grid',
  },
  productHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) 70px 70px 120px',
    gap: 10,
    padding: '10px 16px',
    background: 'var(--app-surface-soft)',
    color: 'var(--app-muted)',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  productRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) 70px 70px 120px',
    gap: 10,
    padding: '13px 16px',
    borderTop: '1px solid var(--app-border-soft)',
    color: 'var(--app-text-strong)',
    fontSize: 13,
  },
  sideStack: {
    display: 'grid',
    gap: 16,
    alignContent: 'start',
  },
  exceptionList: {
    display: 'grid',
  },
  exceptionRow: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
    padding: '13px 16px',
    borderTop: '1px solid var(--app-border-soft)',
    fontSize: 13,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  shiftList: {
    display: 'grid',
    gap: 10,
    padding: 16,
  },
};

export default AnalyticsPage;
