import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PAGE_PATHS } from '../appRouter/route_config';
import { type NavPage } from '../types';
import { type PosSalePayload, getPosSales } from '../hooks/pos/pos_controller';

interface UserProfile {
  id?: number;
  name?: string;
  username?: string;
  role_id?: number | string;
  role_name?: string;
  role?: string;
}

interface QuickAction {
  label: string;
  detail: string;
  icon: string;
  page: NavPage;
  section?: string;
  color: string;
}

interface ProductRow {
  label: string;
  value: number;
  quantity: number;
}

interface CashierRow {
  cashier: string;
  role: string;
  bills: number;
  sales: number;
  collected: number;
  credit: number;
}

const LOCAL_SALES_KEY = 'nova_pos_sales';
const LOCAL_HELD_ORDERS_KEY = 'nova_pos_held_orders';
const DAILY_TARGET = 50000;
const CHART_W = 720;
const CHART_H = 260;
const PAD = 34;
const COLORS = ['#23C16B', '#2F80ED', '#F59E0B', '#E056FD'];
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Open POS', detail: 'Start cashier sale', icon: 'ti-cash-register', page: 'pos', color: '#23C16B' },
  { label: 'Reports', detail: 'Sales insights', icon: 'ti-report-analytics', page: 'posManagement', section: 'reports', color: '#2F80ED' },
  { label: 'Products', detail: 'Stock control', icon: 'ti-package', page: 'posManagement', section: 'products', color: '#F59E0B' },
  { label: 'Users', detail: 'Cashiers & roles', icon: 'ti-users', page: 'users', color: '#E056FD' },
];


const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(value);

const sum = <T,>(items: T[], selector: (item: T) => number) =>
  items.reduce((total, item) => total + selector(item), 0);

const loadStoredSales = (key: string): PosSalePayload[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PosSalePayload[]) : [];
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

const parseDate = (val: string | number | Date | null | undefined): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'number') return new Date(val);
  const str = String(val).trim();
  const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

const toLocalDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dayKey = (value: string) => toLocalDateKey(parseDate(value));
const shortDay = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short' });
const timeLabel = (value: string) =>
  parseDate(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const Overview: React.FC = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const isAdmin = checkIsAdmin(user);
  const [salesScope, setSalesScope] = useState<'all' | 'own'>(isAdmin ? 'all' : 'own');
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [apiSales, setApiSales] = useState<PosSalePayload[]>([]);

  useEffect(() => {
    getPosSales(undefined, isAdmin ? salesScope : 'own')
      .then((data) => {
        if (Array.isArray(data)) {
          setApiSales(data);
        }
      })
      .catch(() => { });
  }, [isAdmin, salesScope]);

  const salesSource = apiSales.length ? apiSales : loadStoredSales(LOCAL_SALES_KEY);
  const heldOrders = loadStoredSales(LOCAL_HELD_ORDERS_KEY);
  const allCompletedSales = salesSource.filter((sale) => sale.status === 'completed');

  const effectiveScope = isAdmin ? salesScope : 'own';

  const isWithinTimeRange = (soldAtStr: string) => {
    const soldAtTime = parseDate(soldAtStr).getTime();
    const now = Date.now();
    if (timeRange === 'daily') {
      const todayDate = new Date();
      const startOfToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()).getTime();
      const twentyFourHoursAgo = now - 24 * 86400000;
      return soldAtTime >= Math.min(startOfToday, twentyFourHoursAgo);
    }
    if (timeRange === 'monthly') {
      const thirtyDaysAgo = now - 30 * 86400000;
      return soldAtTime >= thirtyDaysAgo;
    }
    const fourteenDaysAgo = now - 14 * 86400000;
    return soldAtTime >= fourteenDaysAgo;
  };

  const sales = allCompletedSales.filter((sale) => {
    if (!isWithinTimeRange(sale.sold_at)) return false;
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

  const recentSales = [...sales].sort((a, b) => parseDate(b.sold_at).getTime() - parseDate(a.sold_at).getTime()).slice(0, 4);

  const grossSales = sum(sales, (sale) => sale.total_amount);
  const paidAmount = sum(sales, (sale) => sale.paid_amount);
  const creditAmount = sum(sales, (sale) => sale.credit_amount);
  const discounts = sum(sales, (sale) => sale.discount_amount);
  const tax = sum(sales, (sale) => sale.tax_amount);
  const itemsSold = sum(sales, (sale) => sum(sale.items, (item) => item.quantity));
  const collectionRate = grossSales ? Math.round((paidAmount / grossSales) * 100) : 0;

  const targetForRange = timeRange === 'daily' ? DAILY_TARGET : timeRange === 'weekly' ? DAILY_TARGET * 7 : DAILY_TARGET * 30;
  const targetProgress = Math.min(Math.round((grossSales / targetForRange) * 100), 100);
  const targetLabel = timeRange === 'daily' ? 'Daily target' : timeRange === 'weekly' ? 'Weekly target' : 'Monthly target';

  const trendDays = useMemo(() => {
    if (timeRange === 'daily') {
      const slots = [
        { label: '8 AM', startHour: 0, endHour: 9 },
        { label: '11 AM', startHour: 9, endHour: 12 },
        { label: '1 PM', startHour: 12, endHour: 14 },
        { label: '3 PM', startHour: 14, endHour: 16 },
        { label: '5 PM', startHour: 16, endHour: 18 },
        { label: '8 PM+', startHour: 18, endHour: 24 },
      ];
      return slots.map((slot, index) => {
        const slotSales = sales.filter((sale) => {
          const d = parseDate(sale.sold_at);
          const hour = d.getHours();
          return hour >= slot.startHour && hour < slot.endHour;
        });
        return {
          key: `slot-${index}`,
          label: slot.label,
          total: sum(slotSales, (sale) => sale.total_amount),
        };
      });
    }

    if (timeRange === 'monthly') {
      return [
        { label: 'Wk 1', daysBackStart: 30, daysBackEnd: 22 },
        { label: 'Wk 2', daysBackStart: 22, daysBackEnd: 15 },
        { label: 'Wk 3', daysBackStart: 15, daysBackEnd: 7 },
        { label: 'Wk 4', daysBackStart: 7, daysBackEnd: 0 },
      ].map((bucket, index) => {
        const now = Date.now();
        const startTime = now - bucket.daysBackStart * 86400000;
        const endTime = now - bucket.daysBackEnd * 86400000;
        const bucketSales = sales.filter((sale) => {
          const t = parseDate(sale.sold_at).getTime();
          return t >= startTime && t < endTime;
        });
        return {
          key: `wk-${index}`,
          label: bucket.label,
          total: sum(bucketSales, (sale) => sale.total_amount),
        };
      });
    }

    const anchorDate = new Date();
    if (sales.length > 0) {
      const latestTime = Math.max(...sales.map((s) => parseDate(s.sold_at).getTime()));
      const latestDate = new Date(latestTime);
      if (latestDate < anchorDate && (anchorDate.getTime() - latestTime > 2 * 86400000)) {
        anchorDate.setTime(latestTime);
      }
    }

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(anchorDate.getTime());
      date.setDate(date.getDate() - (6 - index));
      const key = toLocalDateKey(date);
      return {
        key,
        label: shortDay(date),
        total: sum(sales.filter((sale) => dayKey(sale.sold_at) === key), (sale) => sale.total_amount),
      };
    });
  }, [timeRange, sales]);

  const maxLine = Math.max(...trendDays.map((day) => day.total), 1);
  const points = trendDays.map((day, index) => ({
    ...day,
    x: PAD + ((CHART_W - PAD * 2) / Math.max(trendDays.length - 1, 1)) * index,
    y: PAD + (CHART_H - PAD * 2) - (day.total / maxLine) * (CHART_H - PAD * 2),
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${CHART_H - PAD} L ${PAD} ${CHART_H - PAD} Z`;

  const paymentRows = ['Cash', 'Card', 'Credit', 'Wallet'].map((method) => ({
    method,
    total: sum(sales.filter((sale) => sale.payment_method === method), (sale) => sale.total_amount),
  }));
  const paymentTotal = Math.max(sum(paymentRows, (row) => row.total), 1);
  let donutOffset = 25;

  const productMap = new Map<string, ProductRow>();
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = productMap.get(item.product_name) ?? { label: item.product_name, value: 0, quantity: 0 };
      productMap.set(item.product_name, {
        label: item.product_name,
        value: current.value + item.line_total,
        quantity: current.quantity + item.quantity,
      });
    });
  });
  const productRows = Array.from(productMap.values()).sort((a, b) => b.value - a.value).slice(0, 5);
  const maxProductValue = Math.max(...productRows.map((row) => row.value), 1);
  const cashierMap = new Map<string, CashierRow>();
  sales.forEach((sale) => {
    const key = sale.cashier_name || 'Unknown cashier';
    const current = cashierMap.get(key) ?? {
      cashier: key,
      role: sale.cashier_role || 'Cashier',
      bills: 0,
      sales: 0,
      collected: 0,
      credit: 0,
    };

    cashierMap.set(key, {
      ...current,
      bills: current.bills + 1,
      sales: current.sales + sale.total_amount,
      collected: current.collected + sale.paid_amount,
      credit: current.credit + sale.credit_amount,
    });
  });
  const cashierRows = Array.from(cashierMap.values()).sort((a, b) => b.sales - a.sales);
  const maxCashierSales = Math.max(...cashierRows.map((row) => row.sales), 1);

  return (
    <div style={styles.container}>
      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <div style={styles.headerTopRow}>
            <span style={styles.eyebrow}>Live dashboard</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={styles.scopeSwitcher}>
                <button
                  type="button"
                  onClick={() => setTimeRange('daily')}
                  style={{
                    ...styles.scopeButton,
                    ...(timeRange === 'daily' ? styles.scopeButtonActive : {}),
                  }}
                >
                  <i className="ti ti-calendar-event" aria-hidden="true" />
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setTimeRange('weekly')}
                  style={{
                    ...styles.scopeButton,
                    ...(timeRange === 'weekly' ? styles.scopeButtonActive : {}),
                  }}
                >
                  <i className="ti ti-calendar" aria-hidden="true" />
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setTimeRange('monthly')}
                  style={{
                    ...styles.scopeButton,
                    ...(timeRange === 'monthly' ? styles.scopeButtonActive : {}),
                  }}
                >
                  <i className="ti ti-calendar-stats" aria-hidden="true" />
                  Monthly
                </button>
              </div>

              {isAdmin ? (
                <div style={styles.scopeSwitcher}>
                  <button
                    type="button"
                    onClick={() => setSalesScope('all')}
                    style={{
                      ...styles.scopeButton,
                      ...(effectiveScope === 'all' ? styles.scopeButtonActiveAll : {}),
                    }}
                  >
                    <i className="ti ti-building-store" aria-hidden="true" />
                    All Company Sales
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesScope('own')}
                    style={{
                      ...styles.scopeButton,
                      ...(effectiveScope === 'own' ? styles.scopeButtonActiveOwn : {}),
                    }}
                  >
                    <i className="ti ti-user-check" aria-hidden="true" />
                    My Own Sales
                  </button>
                </div>
              ) : (
                <span style={styles.ownSalesBadge}>
                  <i className="ti ti-user-check" aria-hidden="true" /> My Sales Only
                </span>
              )}
            </div>
          </div>
          <h1 style={styles.pageTitle}>Good day, {user.name ?? user.username ?? 'Super Admin'}</h1>
          <p style={styles.pageSubtitle}>
            {effectiveScope === 'own'
              ? 'Showing performance, bills, and metrics for your own sales.'
              : 'Colorful sales charts, cashier flow, collections, credit, and product movement in one clear view.'}
          </p>
        </div>
        <div style={styles.heroMeter}>
          <span>{targetLabel}</span>
          <strong>{targetProgress}%</strong>
          <div style={styles.targetTrack}>
            <span style={{ ...styles.targetBar, width: `${targetProgress}%` }} />
          </div>
          <small>{formatMoney(grossSales)} / {formatMoney(targetForRange)}</small>
        </div>
        <div style={styles.actionGrid}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              style={styles.actionButton}
              onClick={() => {
                const basePath = PAGE_PATHS[action.page];
                if (action.section) {
                  navigate(`${basePath}?section=${action.section}`, { state: { section: action.section } });
                } else {
                  navigate(basePath);
                }
              }}
            >
              <span style={{ ...styles.actionIcon, background: action.color }}>
                <i className={`ti ${action.icon}`} aria-hidden="true" />
              </span>
              <span>
                <strong>{action.label}</strong>
                <small> {action.detail}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section style={styles.colorGrid}>
        {[
          ['Net sales', formatMoney(grossSales), 'ti-report-money', '#23C16B'],
          ['Collected', formatMoney(paidAmount), 'ti-cash-banknote', '#2F80ED'],
          ['Credit due', formatMoney(creditAmount), 'ti-credit-card', '#F59E0B'],
          ['Items sold', formatNumber(itemsSold), 'ti-shopping-bag', '#E056FD'],
        ].map(([label, value, icon, color]) => (
          <article
            key={label}
            style={{ ...styles.colorCard, background: color, cursor: 'pointer' }}
            onClick={() => {
              navigate(`${PAGE_PATHS.posManagement}?section=reports`, { state: { section: 'reports' } });
            }}
          >
            <i className={`ti ${icon}`} aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>


      <section style={styles.chartLayout}>
        <article style={styles.linePanel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>
                {timeRange === 'daily' ? 'Today\'s sales trend' : timeRange === 'monthly' ? 'Monthly sales trend' : 'Sales line chart'}
              </h2>
              <p style={styles.panelSub}>
                {timeRange === 'daily'
                  ? 'Hourly breakdown for today\'s sales.'
                  : timeRange === 'monthly'
                    ? 'Weekly aggregation over 30 days.'
                    : 'Last 7 days performance.'}
              </p>
            </div>
            <span style={styles.panelPill}>{formatMoney(grossSales)}</span>
          </div>
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={styles.lineChart} role="img" aria-label="Sales line chart">
            <defs>
              <linearGradient id="lineStroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#23C16B" />
                <stop offset="50%" stopColor="#2F80ED" />
                <stop offset="100%" stopColor="#E056FD" />
              </linearGradient>
              <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2F80ED" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#23C16B" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => {
              const y = PAD + ((CHART_H - PAD * 2) / 3) * line;
              return <line key={line} x1={PAD} x2={CHART_W - PAD} y1={y} y2={y} style={styles.gridLine} />;
            })}
            <path d={areaPath} fill="url(#areaFill)" />
            <path d={linePath} fill="none" stroke="url(#lineStroke)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point) => (
              <g key={point.key}>
                <circle cx={point.x} cy={point.y} r="7" fill="var(--app-surface)" stroke="#2F80ED" strokeWidth="4" />
                <text x={point.x} y={CHART_H - 8} textAnchor="middle" style={styles.chartText} fill="var(--app-text-strong, #ffffff)">{point.label}</text>
              </g>
            ))}
          </svg>
          <div style={{ ...styles.chartLegend, gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
            {points.map((point) => (
              <span key={point.key} style={{ color: 'var(--app-text-strong, #ffffff)' }}>
                <b style={{ color: 'var(--app-text-strong, #ffffff)', display: 'block' }}>{point.label}</b>
                {point.total ? formatMoney(point.total) : 'No sales'}
              </span>
            ))}
          </div>
        </article>

        <aside style={styles.sideCharts}>
          <article style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Payment donut</h2>
                <p style={styles.panelSub}>Color split by payment type.</p>
              </div>
            </div>
            <div style={styles.donutBody}>
              <svg viewBox="0 0 140 140" style={styles.donutChart} role="img" aria-label="Payment donut chart">
                {paymentRows.map((row, index) => {
                  const dash = (row.total / paymentTotal) * 100;
                  const circle = (
                    <circle
                      key={row.method}
                      cx="70"
                      cy="70"
                      r="45"
                      fill="none"
                      stroke={COLORS[index]}
                      strokeWidth="18"
                      strokeDasharray={`${dash} ${100 - dash}`}
                      strokeDashoffset={donutOffset}
                      pathLength="100"
                      strokeLinecap="round"
                      transform="rotate(-90 70 70)"
                    />
                  );
                  donutOffset -= dash;
                  return circle;
                })}
                <circle cx="70" cy="70" r="31" fill="var(--app-surface)" />
                <text x="70" y="66" textAnchor="middle" style={styles.donutValue}>{collectionRate}%</text>
                <text x="70" y="84" textAnchor="middle" style={styles.donutLabel}>paid</text>
              </svg>
              <div style={styles.legend}>
                {paymentRows.map((row, index) => (
                  <div key={row.method} style={styles.legendRow}>
                    <span style={{ ...styles.legendDot, background: COLORS[index] }} />
                    <span>{row.method}</span>
                    <strong>{formatMoney(row.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Control summary</h2>
                <p style={styles.panelSub}>Tax, discount, held orders.</p>
              </div>
            </div>
            <div style={styles.summaryGrid}>
              <span><b>{formatMoney(tax)}</b><small>  Tax</small></span>
              <span><b>{formatMoney(discounts)}</b><small>  Discount</small></span>
              <span><b>{heldOrders.length}</b><small> Held</small></span>
            </div>
          </article>
        </aside>
      </section>

      <section style={styles.bottomGrid}>
        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Product bar chart</h2>
              <p style={styles.panelSub}>Best moving products by sales value.</p>
            </div>
          </div>
          <div style={styles.productBars}>
            {(productRows.length ? productRows : [{ label: 'No products yet', value: 0, quantity: 0 }]).map((row, index) => (
              <div key={`${row.label || 'prod'}-${index}`} style={styles.productBarRow}>
                <div style={styles.productBarTop}>
                  <span>{row.label}</span>
                  <strong>{formatMoney(row.value)}</strong>
                </div>
                <div style={styles.productBarTrack}>
                  <span style={{ ...styles.productBarFill, width: `${Math.max(6, (row.value / maxProductValue) * 100)}%`, background: COLORS[index % COLORS.length] }} />
                </div>
                <small>{formatNumber(row.quantity)} sold</small>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Cashier sales & credit</h2>
              <p style={styles.panelSub}>Each cashier&apos;s sales, collections, and credit balance.</p>
            </div>
          </div>
          <div style={styles.cashierList}>
            {(cashierRows.length ? cashierRows : [{ cashier: 'No cashier sales', role: 'Cashier', bills: 0, sales: 0, collected: 0, credit: 0 }]).map((row, index) => (
              <div key={`${row.cashier || 'cashier'}-${index}`} style={styles.cashierCard}>
                <div style={styles.cashierTop}>
                  <span style={{ ...styles.cashierAvatar, background: COLORS[index % COLORS.length] }}>
                    {row.cashier
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <span style={styles.cashierIdentity}>
                    <strong>{row.cashier}</strong>
                    <small>{row.role} / {row.bills} bill{row.bills === 1 ? '' : 's'}</small>
                  </span>
                  <b>{formatMoney(row.sales)}</b>
                </div>
                <div style={styles.cashierTrack}>
                  <span
                    style={{
                      ...styles.cashierBar,
                      width: `${Math.max(6, (row.sales / maxCashierSales) * 100)}%`,
                      background: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
                <div style={styles.cashierStats}>
                  <span>
                    <small>Collected</small>
                    <strong> {formatMoney(row.collected)}</strong>
                  </span>
                  <span>
                    <small>Credit</small>
                    <strong style={row.credit > 0 ? styles.creditText : undefined}>  {formatMoney(row.credit)}</strong>
                  </span>
                  <span>
                    <small>Average</small>
                    <strong>  {formatMoney(row.bills ? row.sales / row.bills : 0)}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Recent sales</h2>
              <p style={styles.panelSub}>Latest bills saved for reports.</p>
            </div>
          </div>
          <div style={styles.salesList}>
            {recentSales.map((sale, index) => (
              <div key={sale.sale_no ? `${sale.sale_no}-${index}` : index} style={styles.saleRow}>
                <span style={styles.saleIcon}><i className="ti ti-receipt" aria-hidden="true" /></span>
                <span style={styles.saleInfo}>
                  <strong>{sale.sale_no}</strong>
                  <small>{sale.customer_name} / {timeLabel(sale.sold_at)}</small>
                </span>
                <b>{formatMoney(sale.total_amount)}</b>
              </div>
            ))}
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
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 230px 360px',
    gap: 16,
    marginBottom: 16,
  },
  heroCopy: {
    borderRadius: 8,
    padding: 20,
    background: 'linear-gradient(135deg, rgba(35,193,107,0.18), rgba(47,128,237,0.16), rgba(224,86,253,0.14))',
    border: '1px solid var(--app-border)',
    display: 'grid',
    alignContent: 'center',
    gap: 5,
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeSwitcher: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    padding: 3,
    gap: 3,
    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)',
  },
  scopeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    padding: '6px 14px',
    borderRadius: 18,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  scopeButtonActive: {
    background: 'linear-gradient(135deg, #2F80ED 0%, #1B61D1 100%)',
    color: '#ffffff',
    fontWeight: 700,
  },
  scopeButtonActiveAll: {
    background: 'linear-gradient(135deg, #2F80ED 0%, #1B61D1 100%)',
    color: '#ffffff',
    fontWeight: 700,
  },
  scopeButtonActiveOwn: {
    background: 'linear-gradient(135deg, #23C16B 0%, #179650 100%)',
    color: '#ffffff',
    fontWeight: 700,
  },
  ownSalesBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(35, 193, 107, 0.15)',
    color: '#23C16B',
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 700,
  },
  eyebrow: {
    color: '#23C16B',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  pageTitle: {
    color: 'var(--app-text-strong)',
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 0,
  },
  pageSubtitle: {
    maxWidth: 720,
    color: 'var(--app-muted)',
    fontSize: 14,
    lineHeight: 1.55,
  },
  heroMeter: {
    borderRadius: 8,
    padding: 16,
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    display: 'grid',
    alignContent: 'center',
    gap: 10,
    boxShadow: 'var(--app-shadow)',
  },
  targetTrack: {
    height: 12,
    borderRadius: 999,
    background: 'var(--app-surface-muted)',
    overflow: 'hidden',
  },
  targetBar: {
    display: 'block',
    height: '100%',
    minWidth: 8,
    borderRadius: 999,
    background: 'linear-gradient(90deg, #23C16B, #2F80ED, #E056FD)',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  actionButton: {
    display: 'grid',
    gridTemplateColumns: '36px minmax(0, 1fr)',
    gap: 9,
    alignItems: 'center',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    color: 'var(--app-text)',
    padding: 11,
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: 'var(--app-shadow)',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  colorCard: {
    display: 'grid',
    gap: 8,
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    boxShadow: '0 14px 28px rgba(15,23,42,0.16)',
  },
  chartLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.55fr) minmax(330px, 0.85fr)',
    gap: 16,
    marginBottom: 16,
  },
  linePanel: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    boxShadow: 'var(--app-shadow)',
    overflow: 'hidden',
  },
  panel: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    boxShadow: 'var(--app-shadow)',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  panelPill: {
    borderRadius: 999,
    padding: '6px 10px',
    background: 'rgba(35,193,107,0.13)',
    color: '#23C16B',
    fontSize: 12,
    fontWeight: 900,
  },
  lineChart: {
    width: '100%',
    minHeight: 280,
    display: 'block',
    padding: 12,
  },
  gridLine: {
    stroke: 'var(--app-border-soft)',
    strokeWidth: 1,
  },
  chartText: {
    fill: 'var(--app-text-strong, #ffffff)',
    fontSize: 12,
    fontWeight: 700,
  },
  chartLegend: {
    display: 'grid',
    gap: 8,
    padding: '0 16px 16px',
    color: 'var(--app-text-strong, #ffffff)',
    fontSize: 11,
  },
  sideCharts: {
    display: 'grid',
    gap: 16,
  },
  donutBody: {
    display: 'grid',
    gridTemplateColumns: '150px minmax(0, 1fr)',
    gap: 14,
    alignItems: 'center',
    padding: 16,
  },
  donutChart: {
    width: 150,
    height: 150,
  },
  donutValue: {
    fill: 'var(--app-text-strong)',
    fontSize: 20,
    fontWeight: 900,
  },
  donutLabel: {
    fill: 'var(--app-muted)',
    fontSize: 11,
    fontWeight: 700,
  },
  legend: {
    display: 'grid',
    gap: 9,
  },
  legendRow: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'center',
    fontSize: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    padding: 16,
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.9fr) minmax(360px, 1fr) minmax(340px, 0.85fr)',
    gap: 16,
  },
  productBars: {
    display: 'grid',
    gap: 13,
    padding: 16,
  },
  productBarRow: {
    display: 'grid',
    gap: 6,
  },
  productBarTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: 'var(--app-text-strong)',
    fontSize: 13,
  },
  productBarTrack: {
    height: 12,
    borderRadius: 999,
    background: 'var(--app-surface-muted)',
    overflow: 'hidden',
  },
  productBarFill: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
  },
  cashierList: {
    display: 'grid',
    gap: 12,
    padding: 16,
  },
  cashierCard: {
    display: 'grid',
    gap: 10,
    border: '1px solid var(--app-border-soft)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    padding: 12,
  },
  cashierTop: {
    display: 'grid',
    gridTemplateColumns: '38px minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
  },
  cashierAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 900,
  },
  cashierIdentity: {
    display: 'grid',
    minWidth: 0,
    color: 'var(--app-text-strong)',
    fontSize: 13,
  },
  cashierTrack: {
    height: 10,
    borderRadius: 999,
    background: 'var(--app-surface-muted)',
    overflow: 'hidden',
  },
  cashierBar: {
    display: 'block',
    height: '100%',
    minWidth: 6,
    borderRadius: 999,
  },
  cashierStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  creditText: {
    color: '#F59E0B',
  },
  salesList: {
    display: 'grid',
  },
  saleRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
    padding: '13px 16px',
    borderBottom: '1px solid var(--app-border-soft)',
  },
  saleIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: 'rgba(47,128,237,0.12)',
    color: '#2F80ED',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  saleInfo: {
    display: 'grid',
    minWidth: 0,
    color: 'var(--app-text-strong)',
    fontSize: 13,
  },
};

export default Overview;
