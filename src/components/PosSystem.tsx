import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { type AdminOutletContext } from '../App';
import {
  createPosSale,
  createPosMasterRecord,
  getPosMasterRecords,
  updatePosMasterRecord,
  getAllCustomers,
  getAllProducts,
  updateProduct,
  type PosProduct,
  type PosSalePayload,
} from '../hooks/pos/pos_controller';
import API_RESOURCES from '../api/api_resources';
import { kickCashDrawerPulse } from '../utils/thermal_printer';


interface CartItem extends PosProduct {
  quantity: number;
  variant_id?: number;
  base_product_id?: number;
}

interface CreditCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit: number;
  balance: number;
  status: 'Active' | 'Blocked';
}

interface LoggedInUser {
  id?: number | string;
  name?: string;
  username?: string;
  role_name?: string;
  role?: string | { name?: string };
}

type SaleStatus = PosSalePayload['status'];

export interface CashDrawerLogEntry {
  id: string;
  timestamp: string;
  type: 'opening_float' | 'paid_in' | 'paid_out' | 'cash_sale' | 'close_shift';
  amount: number;
  reason?: string;
  cashierName?: string;
}

export interface RegisterSession {
  id: string;
  openedAt: string;
  cashierName: string;
  openingCash: number;
  registerNo: string;
  shiftCode: string;
  status: 'open' | 'closed';
  closedAt?: string;
  closingActualCash?: number;
  notes?: string;
  paidIn?: number;
  paidOut?: number;
  cashLogs?: CashDrawerLogEntry[];
}

export const getSaleNetCash = (sale: PosSalePayload): number => {
  if (sale.status && sale.status !== 'completed') return 0;

  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    const cashPayments = sale.payments
      .filter((p) => String(p.method || '').toLowerCase() === 'cash')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (cashPayments > 0) {
      const change = Number(sale.change_amount) || Number(sale.balance_amount) || 0;
      return Math.max(cashPayments - change, 0);
    }
  }

  const pm = String(sale.payment_method || '').toLowerCase();
  if (pm === 'cash') {
    const paid = Number(sale.paid_amount) || Number(sale.grand_total) || Number(sale.total_amount) || 0;
    const change = Number(sale.change_amount) || Number(sale.balance_amount) || 0;
    return Math.max(paid - change, 0);
  }

  if (pm === 'credit') {
    return Math.max(Number(sale.paid_amount) || 0, 0);
  }

  return 0;
};

export const getSaleNetCard = (sale: PosSalePayload): number => {
  if (sale.status && sale.status !== 'completed') return 0;

  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    const cardPayments = sale.payments
      .filter((p) => {
        const m = String(p.method || '').toLowerCase();
        return m !== 'cash' && m !== 'credit';
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (cardPayments > 0) return cardPayments;
  }

  const pm = String(sale.payment_method || '').toLowerCase();
  if (pm !== 'cash' && pm !== 'credit') {
    return Number(sale.total_amount) || Number(sale.grand_total) || 0;
  }

  return 0;
};

export const getSaleNetCredit = (sale: PosSalePayload): number => {
  if (sale.status && sale.status !== 'completed') return 0;

  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    const creditPayments = sale.payments
      .filter((p) => String(p.method || '').toLowerCase() === 'credit')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (creditPayments > 0) return creditPayments;
  }

  const pm = String(sale.payment_method || '').toLowerCase();
  if (pm === 'credit') {
    if (sale.credit_amount !== undefined && sale.credit_amount !== null) {
      return Number(sale.credit_amount) || 0;
    }
    const total = Number(sale.total_amount) || Number(sale.grand_total) || 0;
    const paid = Number(sale.paid_amount) || 0;
    return Math.max(total - paid, 0);
  }

  return 0;
};

const LOCAL_SALES_KEY = 'nova_pos_sales';
const LOCAL_HELD_ORDERS_KEY = 'nova_pos_held_orders';
const LOCAL_REGISTER_SESSION_KEY = 'nova_pos_active_register_session';
const LOCAL_SHIFT_HISTORY_KEY = 'nova_pos_shift_history';
const REGISTER_NO = 'Register 01';
const SHIFT_CODE = 'Shift A';

const loadActiveSession = (): RegisterSession | null => {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as RegisterSession;
    return session.status === 'open' ? session : null;
  } catch {
    return null;
  }
};

const saveActiveSession = (session: RegisterSession | null) => {
  if (session) {
    localStorage.setItem(LOCAL_REGISTER_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(LOCAL_REGISTER_SESSION_KEY);
  }
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(value);

const formatDecimal = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const loadStoredSales = (key: string): PosSalePayload[] => {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) as PosSalePayload[] : [];
  } catch {
    return [];
  }
};

const saveStoredSales = (key: string, sales: PosSalePayload[]) => {
  localStorage.setItem(key, JSON.stringify(sales));
};

const getStoredUser = (): LoggedInUser => {
  try {
    const rawUser = localStorage.getItem('user');
    return rawUser ? JSON.parse(rawUser) as LoggedInUser : {};
  } catch {
    return {};
  }
};

const getStoredUserRole = (user: LoggedInUser) => {
  if (user.role_name) return user.role_name;
  if (typeof user.role === 'string') return user.role;
  return user.role?.name ?? 'Cashier';
};

const createSaleNo = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `POS-${datePart}-${Date.now().toString().slice(-6)}`;
};

const PosSystem: React.FC = () => {
  const { theme } = useOutletContext<AdminOutletContext>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customer, setCustomer] = useState('Walk-in customer');
  const [amountPaid, setAmountPaid] = useState(0);
  const [orderNote, setOrderNote] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<PosSalePayload | null>(null);
  const [creditCustomerId, setCreditCustomerId] = useState(1);
  const [creditDueDays, setCreditDueDays] = useState(14);
  const [completedSales, setCompletedSales] = useState<PosSalePayload[]>(() => loadStoredSales(LOCAL_SALES_KEY));
  const [heldOrders, setHeldOrders] = useState<PosSalePayload[]>(() => loadStoredSales(LOCAL_HELD_ORDERS_KEY));
  const [weightedProduct, setWeightedProduct] = useState<PosProduct | null>(null);
  const [weightInput, setWeightInput] = useState('1.000');
  const [isReadingScale, setIsReadingScale] = useState(false);

  const [activeSession, setActiveSession] = useState<RegisterSession | null>(() => loadActiveSession());
  const [showStartSessionModal, setShowStartSessionModal] = useState<boolean>(() => !loadActiveSession());
  const [showDrawerDetailsModal, setShowDrawerDetailsModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('5000');
  const [openingNotesInput, setOpeningNotesInput] = useState('');
  const [shiftRegisterNo, setShiftRegisterNo] = useState('Register 01');
  const [shiftCode, setShiftCode] = useState('Shift A');
  const [cashCountInput, setCashCountInput] = useState('');
  const [cashDrawerActionType, setCashDrawerActionType] = useState<'none' | 'paid_in' | 'paid_out' | 'close_shift' | 'cash_log'>('none');
  const [cashDrawerActionAmount, setCashDrawerActionAmount] = useState('');
  const [cashDrawerActionReason, setCashDrawerActionReason] = useState('');
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });
  const [showDenomCounter, setShowDenomCounter] = useState(false);

  const sessionSales = useMemo(() => {
    if (!activeSession) return [];
    const openTime = new Date(activeSession.openedAt).getTime();
    return completedSales.filter((sale) => {
      const soldTime = new Date(sale.sold_at || Date.now()).getTime();
      return soldTime >= openTime && sale.status === 'completed';
    });
  }, [activeSession, completedSales]);

  const totalCashSalesToday = useMemo(() => {
    return sessionSales.reduce((sum, s) => sum + getSaleNetCash(s), 0);
  }, [sessionSales]);

  const totalCardSalesToday = useMemo(() => {
    return sessionSales.reduce((sum, s) => sum + getSaleNetCard(s), 0);
  }, [sessionSales]);

  const totalCreditSalesToday = useMemo(() => {
    return sessionSales.reduce((sum, s) => sum + getSaleNetCredit(s), 0);
  }, [sessionSales]);

  const openingFloat = activeSession?.openingCash || 0;
  const paidInTotal = activeSession?.paidIn || 0;
  const paidOutTotal = activeSession?.paidOut || 0;
  const expectedCashInDrawer = openingFloat + totalCashSalesToday + paidInTotal - paidOutTotal;

  const updateDenomCount = (noteVal: number, count: number) => {
    const next = { ...denomCounts, [noteVal]: Math.max(count, 0) };
    setDenomCounts(next);
    const sum = Object.entries(next).reduce(
      (acc, [val, qty]) => acc + Number(val) * (Number(qty) || 0),
      0,
    );
    setCashCountInput(String(sum));
  };

  const resetDenomCounts = () => {
    setDenomCounts({ 5000: 0, 2000: 0, 1000: 0, 500: 0, 100: 0, 50: 0, 20: 0, 10: 0 });
    setCashCountInput('');
  };

  const handleKickDrawer = () => {
    try {
      const pulseBytes = kickCashDrawerPulse();
      console.log('Fired ESC/POS Cash Drawer pulse:', pulseBytes.length, 'bytes');
      setLastAction('Physical cash drawer kick-out signal sent to printer port!');
    } catch {
      setLastAction('Cash drawer signal triggered.');
    }
  };

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    const openingAmt = Number(openingCashInput) || 0;

    const initialLog: CashDrawerLogEntry = {
      id: `LOG-${Date.now()}-1`,
      timestamp: new Date().toISOString(),
      type: 'opening_float',
      amount: openingAmt,
      reason: openingNotesInput || 'Initial Opening Float Added to Drawer',
      cashierName: cashierName || 'Cashier',
    };

    const newSession: RegisterSession = {
      id: `SESH-${Date.now()}`,
      openedAt: new Date().toISOString(),
      cashierName: cashierName || 'Cashier',
      openingCash: openingAmt,
      registerNo: shiftRegisterNo,
      shiftCode: shiftCode,
      status: 'open',
      notes: openingNotesInput,
      paidIn: 0,
      paidOut: 0,
      cashLogs: [initialLog],
    };

    setActiveSession(newSession);
    saveActiveSession(newSession);
    setShowStartSessionModal(false);
    handleKickDrawer();
    setLastAction(`Shift started with LKR ${openingAmt} cash drawer float`);
  };

  const handleDrawerPaidInOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const amount = Number(cashDrawerActionAmount) || 0;
    if (amount <= 0) return;

    let nextSession = { ...activeSession };
    const logs = [...(nextSession.cashLogs || [])];

    if (cashDrawerActionType === 'paid_in') {
      nextSession.paidIn = (nextSession.paidIn || 0) + amount;
      logs.unshift({
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'paid_in',
        amount,
        reason: cashDrawerActionReason || 'Paid In Cash Float',
        cashierName: cashierName || 'Cashier',
      });
      setLastAction(`Paid In LKR ${amount} to cash drawer (${cashDrawerActionReason})`);
    } else if (cashDrawerActionType === 'paid_out') {
      nextSession.paidOut = (nextSession.paidOut || 0) + amount;
      logs.unshift({
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'paid_out',
        amount,
        reason: cashDrawerActionReason || 'Paid Out Cash Expense',
        cashierName: cashierName || 'Cashier',
      });
      setLastAction(`Paid Out LKR ${amount} from cash drawer (${cashDrawerActionReason})`);
    }

    nextSession.cashLogs = logs;
    setActiveSession(nextSession);
    saveActiveSession(nextSession);
    handleKickDrawer();
    setCashDrawerActionType('none');
    setCashDrawerActionAmount('');
    setCashDrawerActionReason('');
  };

  const handlePrintZReport = () => {
    if (!activeSession) return;
    const actualCashCount = Number(cashCountInput) || expectedCashInDrawer;
    const diff = actualCashCount - expectedCashInDrawer;
    const zReportWindow = window.open('', '_blank');
    if (!zReportWindow) return;

    zReportWindow.document.write(`
      <html>
        <head>
          <title>Z-Report Shift Summary - ${activeSession.shiftCode}</title>
          <style>
            body { font-family: monospace; padding: 20px; width: 300px; margin: 0 auto; line-height: 1.4; font-size: 13px; }
            h2, h3 { text-align: center; margin: 5px 0; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-space-between; margin: 3px 0; }
            .right { font-weight: bold; text-align: right; }
          </style>
        </head>
        <body>
          <h2>NOVA POS</h2>
          <h3>Z-REPORT SHIFT SUMMARY</h3>
          <div class="line"></div>
          <div>Register: ${activeSession.registerNo}</div>
          <div>Shift Code: ${activeSession.shiftCode}</div>
          <div>Cashier: ${activeSession.cashierName}</div>
          <div>Opened: ${new Date(activeSession.openedAt).toLocaleString()}</div>
          <div>Closed: ${new Date().toLocaleString()}</div>
          <div class="line"></div>
          <div style="display:flex; justify-content:space-between"><span>Opening Cash Float:</span><span class="right">LKR ${openingFloat.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between"><span>Net Cash Sales:</span><span class="right">+LKR ${totalCashSalesToday.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between"><span>Paid In (+):</span><span class="right">+LKR ${paidInTotal.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between"><span>Paid Out (-):</span><span class="right">-LKR ${paidOutTotal.toFixed(2)}</span></div>
          <div class="line"></div>
          <div style="display:flex; justify-content:space-between"><strong>Expected Cash in Drawer:</strong><strong class="right">LKR ${expectedCashInDrawer.toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between"><span>Actual Cash Counted:</span><span class="right">LKR ${actualCashCount.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between"><span>Cash Discrepancy:</span><span class="right">${diff === 0 ? '0.00' : (diff > 0 ? '+' : '') + diff.toFixed(2)}</span></div>
          <div class="line"></div>
          <div style="display:flex; justify-content:space-between"><span>Total Card Sales:</span><span class="right">LKR ${totalCardSalesToday.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between"><span>Total Credit Sales:</span><span class="right">LKR ${totalCreditSalesToday.toFixed(2)}</span></div>
          <div class="line"></div>
          <p style="text-align:center">*** END OF SHIFT REPORT ***</p>
        </body>
      </html>
    `);
    zReportWindow.document.close();
    zReportWindow.focus();
    zReportWindow.print();
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const actualCashCount = Number(cashCountInput) || 0;
    const finalLog: CashDrawerLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'close_shift',
      amount: actualCashCount,
      reason: `Shift Closed. Expected: LKR ${expectedCashInDrawer}, Actual: LKR ${actualCashCount}, Discrepancy: LKR ${actualCashCount - expectedCashInDrawer}`,
      cashierName: cashierName || 'Cashier',
    };

    const closedSession: RegisterSession = {
      ...activeSession,
      status: 'closed',
      closedAt: new Date().toISOString(),
      closingActualCash: actualCashCount,
      cashLogs: [finalLog, ...(activeSession.cashLogs || [])],
    };

    try {
      const historyRaw = localStorage.getItem(LOCAL_SHIFT_HISTORY_KEY);
      const history = historyRaw ? (JSON.parse(historyRaw) as RegisterSession[]) : [];
      history.unshift(closedSession);
      localStorage.setItem(LOCAL_SHIFT_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {}

    saveActiveSession(null);
    setActiveSession(null);
    setShowDrawerDetailsModal(false);
    setCashDrawerActionType('none');
    setCashCountInput('');
    resetDenomCounts();
    setShowDenomCounter(false);
    setLastAction(`Shift closed. Actual cash in drawer: LKR ${actualCashCount}`);
    setShowStartSessionModal(true);
  };

  useEffect(() => {
    if (weightedProduct) {
      const timer = setTimeout(() => {
        weightInputRef.current?.focus();
        weightInputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [weightedProduct]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );

  const [productVariants, setProductVariants] = useState<Array<{
    id: number;
    product_id: number;
    variant_name: string;
    barcode: string;
    cost_price: number;
    selling_price: number;
    stock_quantity: number;
  }>>([]);
  const [variantModalProduct, setVariantModalProduct] = useState<PosProduct | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setProductsError('');

      try {
        const apiProducts = await getAllProducts();
        if (isMounted) {
          setProducts(apiProducts);
        }
      } catch {
        if (isMounted) {
          setProductsError('Backend products could not be loaded.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    };

    const loadCustomers = async () => {
      try {
        const apiCustomers = await getAllCustomers();
        if (isMounted) {
          setCreditCustomers(apiCustomers);
        }
      } catch {}
    };

    const loadVariants = async () => {
      try {
        const records = await getPosMasterRecords(API_RESOURCES.PRODUCT_VARIANTS, 'productVariant');
        const mapped = records.map((rec) => ({
          id: Number(rec.id),
          product_id: Number(rec.product_id),
          variant_name: String(rec.variant_name || rec.name || 'Variant'),
          barcode: String(rec.barcode || rec.sku || ''),
          cost_price: Number(rec.cost_price || 0),
          selling_price: Number(rec.selling_price || rec.price || 0),
          stock_quantity: Number(rec.stock_quantity || rec.stock || 0),
        }));
        if (isMounted) setProductVariants(mapped);
      } catch {}
    };

    loadProducts();
    loadCustomers();
    loadVariants();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.toLowerCase();

    return products.filter((product) => {
      const matchesCategory = category === 'All' || product.category === category;
      const vars = productVariants.filter((v) => v.product_id === product.id);
      const matchesVariant = vars.some(
        (v) =>
          v.variant_name.toLowerCase().includes(normalizedQuery) ||
          v.barcode.toLowerCase().includes(normalizedQuery),
      );

      const matchesQuery =
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.sku.toLowerCase().includes(normalizedQuery) ||
        product.barcode.toLowerCase().includes(normalizedQuery) ||
        matchesVariant;

      return matchesCategory && matchesQuery;
    });
  }, [category, productVariants, products, query]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, discount);
  const taxableAmount = subtotal - discountAmount;
  const tax = cart.reduce((sum, item) => {
    const itemSubtotal = item.price * item.quantity;
    const discountRatio = subtotal ? discountAmount / subtotal : 0;
    const itemTaxable = itemSubtotal * (1 - discountRatio);
    const itemTaxRate = Number(item.taxRate ?? 0);
    return sum + itemTaxable * (itemTaxRate / 100);
  }, 0);
  const total = taxableAmount + tax;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const changeDue = paymentMethod === 'Cash' ? Math.max(amountPaid - total, 0) : 0;
  const canCompleteSale = cart.length > 0 && (paymentMethod !== 'Cash' || amountPaid >= total);
  const availableCreditCustomers = useMemo<CreditCustomer[]>(() => {
    if (creditCustomers.length > 0) return creditCustomers;
    return [{ id: 1, name: 'Walk-in customer', phone: '-', creditLimit: 0, balance: 0, status: 'Blocked' }];
  }, [creditCustomers]);

  const selectedCreditCustomer = availableCreditCustomers.find((item) => item.id === creditCustomerId) ?? availableCreditCustomers[0];
  const availableCredit = selectedCreditCustomer.creditLimit - selectedCreditCustomer.balance;
  const creditPaidNow = Math.min(amountPaid, total);
  const creditBalance = Math.max(total - creditPaidNow, 0);
  const canCompleteCreditSale =
    cart.length > 0 &&
    selectedCreditCustomer.status === 'Active' &&
    selectedCreditCustomer.id !== 1 &&
    creditBalance > 0 &&
    availableCredit >= creditBalance;
  const maxProductIndex = Math.max(filteredProducts.length - 1, 0);
  const safeSelectedProductIndex = Math.min(selectedProductIndex, maxProductIndex);
  const selectedProduct = filteredProducts[safeSelectedProductIndex];
  const isLightMode = theme === 'light';
  const themed = (style: React.CSSProperties, lightStyle: React.CSSProperties = {}) =>
    isLightMode ? { ...style, ...lightStyle } : style;
  const loggedInUser = useMemo(() => getStoredUser(), []);
  const cashierId = Number(loggedInUser.id);
  const cashierName = loggedInUser.name ?? loggedInUser.username ?? 'Current cashier';
  const cashierRole = getStoredUserRole(loggedInUser);
  const canViewAllSales = cashierRole.toLowerCase().includes('super admin');
  const visibleCompletedSales = canViewAllSales
    ? completedSales
    : completedSales.filter((sale) => sale.cashier_id === (Number.isFinite(cashierId) ? cashierId : null));
  void visibleCompletedSales;
  void isLoadingProducts;
  void productsError;
  void categories;

  const printConfig = useMemo(() => {
    let paperWidth = 58;
    let storeName = 'NOVA POS STORE';
    let storeAddress = 'Main Street, Colombo';
    let storePhone = '0787450360';
    let storeTaxNo = 'VAT-987654321';
    let footerText = 'Thank you for shopping with us!';

    try {
      const savedOptions = localStorage.getItem('mpos_printing_options');
      if (savedOptions) {
        const parsed = JSON.parse(savedOptions);
        if (parsed.paperWidth) paperWidth = Number(parsed.paperWidth);
      }
      const savedProfile = localStorage.getItem('mpos_store_profile');
      if (savedProfile) {
        const p = JSON.parse(savedProfile);
        if (p.store_name) storeName = p.store_name;
        if (p.address_line1 || p.city) storeAddress = [p.address_line1, p.city].filter(Boolean).join(', ');
        if (p.phone) storePhone = p.phone;
        if (p.tax_number) storeTaxNo = p.tax_number;
        if (p.receipt_footer) footerText = p.receipt_footer;
      }
    } catch { }

    return { paperWidth, storeName, storeAddress, storePhone, storeTaxNo, footerText };
  }, [lastInvoice]);

  const returnToTerminal = () => {
    setLastInvoice(null);
    setPaymentMethod('Cash');
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
  };

  const downloadReceiptPdf = () => {
    if (!lastInvoice) return;

    const escapePdf = (str: string) => str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const is58 = printConfig.paperWidth <= 58;
    const pageWidth = is58 ? 164 : 226;
    const itemCount = lastInvoice.items.length;
    const pageHeight = Math.max(380 + itemCount * 22, 450);

    const pdfCommands: string[] = ['0.5 w'];
    let y = pageHeight - 25;

    // Header
    const storeTitle = (printConfig.storeName || 'NOVA POS STORE').toUpperCase();
    const storeTitleX = Math.max(10, (pageWidth - storeTitle.length * 7) / 2);
    pdfCommands.push(`BT /F1 13 Tf ${storeTitleX.toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(storeTitle)}) Tj ET`);
    y -= 14;

    if (printConfig.storeAddress) {
      const addrX = Math.max(8, (pageWidth - printConfig.storeAddress.length * 4.2) / 2);
      pdfCommands.push(`BT /F2 8 Tf ${addrX.toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(printConfig.storeAddress)}) Tj ET`);
      y -= 11;
    }

    if (printConfig.storePhone) {
      const telStr = `Tel: ${printConfig.storePhone}`;
      const telX = Math.max(8, (pageWidth - telStr.length * 4.2) / 2);
      pdfCommands.push(`BT /F2 8 Tf ${telX.toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(telStr)}) Tj ET`);
      y -= 11;
    }

    // Line Divider
    y -= 4;
    pdfCommands.push(`8 ${y.toFixed(1)} m ${pageWidth - 8} ${y.toFixed(1)} l S`);
    y -= 12;

    // Meta
    const metaList: [string, string][] = [
      ['Sale No:', lastInvoice.sale_no],
      ['Date:', new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })],
      ['Cashier:', lastInvoice.cashier_name],
      ['Customer:', lastInvoice.customer_name],
      ['Payment:', lastInvoice.payment_method],
    ];

    metaList.forEach(([lbl, val]) => {
      pdfCommands.push(`BT /F2 8.5 Tf 10 ${y.toFixed(1)} Td (${escapePdf(lbl)}) Tj ET`);
      const valEsc = escapePdf(String(val));
      const valX = pageWidth - 10 - valEsc.length * 4.8;
      pdfCommands.push(`BT /F1 8.5 Tf ${valX.toFixed(1)} ${y.toFixed(1)} Td (${valEsc}) Tj ET`);
      y -= 11;
    });

    // Divider Line
    y -= 4;
    pdfCommands.push(`8 ${y.toFixed(1)} m ${pageWidth - 8} ${y.toFixed(1)} l S`);
    y -= 12;

    // Items Header
    pdfCommands.push(`BT /F1 8.5 Tf 10 ${y.toFixed(1)} Td (ITEMS) Tj ET`);
    pdfCommands.push(`BT /F1 8.5 Tf ${(pageWidth - 50).toFixed(1)} ${y.toFixed(1)} Td (AMOUNT) Tj ET`);
    y -= 12;

    // Line items
    lastInvoice.items.forEach((item) => {
      pdfCommands.push(`BT /F1 8.5 Tf 10 ${y.toFixed(1)} Td (${escapePdf(item.product_name)}) Tj ET`);
      y -= 10;
      const subStr = `${item.quantity} x LKR ${item.unit_price.toFixed(2)}`;
      const totStr = `LKR ${item.line_total.toFixed(2)}`;
      pdfCommands.push(`BT /F2 8 Tf 14 ${y.toFixed(1)} Td (${escapePdf(subStr)}) Tj ET`);
      pdfCommands.push(`BT /F1 8.5 Tf ${(pageWidth - 10 - totStr.length * 4.8).toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(totStr)}) Tj ET`);
      y -= 12;
    });

    // Divider Line
    y -= 4;
    pdfCommands.push(`8 ${y.toFixed(1)} m ${pageWidth - 8} ${y.toFixed(1)} l S`);
    y -= 12;

    // Financial Summary
    const summaryList: [string, string][] = [
      ['Subtotal:', `LKR ${lastInvoice.subtotal.toFixed(2)}`],
      ...(lastInvoice.discount_amount > 0 ? ([['Discount:', `-LKR ${lastInvoice.discount_amount.toFixed(2)}`]] as [string, string][]) : []),
      ['Tax:', `LKR ${lastInvoice.tax_amount.toFixed(2)}`],
    ];

    summaryList.forEach(([lbl, val]) => {
      pdfCommands.push(`BT /F2 8.5 Tf 10 ${y.toFixed(1)} Td (${escapePdf(lbl)}) Tj ET`);
      pdfCommands.push(`BT /F2 8.5 Tf ${(pageWidth - 10 - val.length * 4.8).toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(val)}) Tj ET`);
      y -= 11;
    });

    // TOTAL BOX
    y -= 4;
    pdfCommands.push(`8 ${y.toFixed(1)} m ${pageWidth - 8} ${y.toFixed(1)} l S`);
    y -= 12;

    const totVal = `LKR ${lastInvoice.total_amount.toFixed(2)}`;
    pdfCommands.push(`BT /F1 9.5 Tf 10 ${y.toFixed(1)} Td (TOTAL AMOUNT:) Tj ET`);
    pdfCommands.push(`BT /F1 10 Tf ${(pageWidth - 10 - totVal.length * 5.5).toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(totVal)}) Tj ET`);
    y -= 12;

    pdfCommands.push(`8 ${y.toFixed(1)} m ${pageWidth - 8} ${y.toFixed(1)} l S`);
    y -= 12;

    // Paid & Change
    const paidStr = `LKR ${lastInvoice.paid_amount.toFixed(2)}`;
    const changeLbl = lastInvoice.payment_method === 'Credit' ? 'Credit Balance:' : 'Change Due:';
    const changeVal = lastInvoice.payment_method === 'Credit' ? lastInvoice.credit_amount : lastInvoice.change_amount;
    const changeStr = `LKR ${changeVal.toFixed(2)}`;

    pdfCommands.push(`BT /F2 8.5 Tf 10 ${y.toFixed(1)} Td (Amount Paid:) Tj ET`);
    pdfCommands.push(`BT /F2 8.5 Tf ${(pageWidth - 10 - paidStr.length * 4.8).toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(paidStr)}) Tj ET`);
    y -= 11;

    pdfCommands.push(`BT /F1 8.5 Tf 10 ${y.toFixed(1)} Td (${escapePdf(changeLbl)}) Tj ET`);
    pdfCommands.push(`BT /F1 8.5 Tf ${(pageWidth - 10 - changeStr.length * 5).toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(changeStr)}) Tj ET`);
    y -= 14;

    // Footer
    const footStr = escapePdf(printConfig.footerText || 'Thank you for your business!');
    const footX = Math.max(10, (pageWidth - footStr.length * 4.2) / 2);
    pdfCommands.push(`BT /F1 8.5 Tf ${footX.toFixed(1)} ${y.toFixed(1)} Td (${footStr}) Tj ET`);
    y -= 12;

    const tagStr = '*** POWERED BY NOVA POS ***';
    const tagX = Math.max(10, (pageWidth - tagStr.length * 4) / 2);
    pdfCommands.push(`BT /F2 7.5 Tf ${tagX.toFixed(1)} ${y.toFixed(1)} Td (${tagStr}) Tj ET`);

    const streamContent = pdfCommands.join('\n');
    const streamLength = streamContent.length;

    const pdfRaw = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000257 00000 n 
0000000330 00000 n 
0000000398 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
${450 + streamLength}
%%EOF`;

    const blob = new Blob([pdfRaw], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${lastInvoice.sale_no}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLastAction(`Receipt ${lastInvoice.sale_no} PDF downloaded successfully`);
  };

  useEffect(() => {
    if (!lastInvoice) return;

    const checkAutoPrint = () => {
      let paperWidth = 58;
      let autoPrint = true;
      let silentPrinting = true;
      let storeName = 'NOVA POS STORE';
      let storeAddress = 'Main Street, Colombo';
      let storePhone = '0787450360';
      let storeTaxNo = 'VAT-987654321';
      let footerText = 'Thank you for shopping with us!';

      try {
        const savedOptions = localStorage.getItem('mpos_printing_options');
        if (savedOptions) {
          const parsed = JSON.parse(savedOptions);
          paperWidth = parsed.paperWidth || 58;
          autoPrint = parsed.autoPrintOnPayment !== false;
          silentPrinting = parsed.silentPrinting !== false;
        }

        const savedProfile = localStorage.getItem('mpos_store_profile');
        if (savedProfile) {
          const p = JSON.parse(savedProfile);
          if (p.store_name) storeName = p.store_name;
          if (p.address_line1 || p.city) storeAddress = [p.address_line1, p.city].filter(Boolean).join(', ');
          if (p.phone) storePhone = p.phone;
          if (p.tax_number) storeTaxNo = p.tax_number;
          if (p.receipt_footer) footerText = p.receipt_footer;
        }
      } catch {
        // default values fallback
      }

      return { autoPrint, paperWidth, silentPrinting, storeName, storeAddress, storePhone, storeTaxNo, footerText };
    };

    const printingConfig = checkAutoPrint();

    if (printingConfig.autoPrint) {
      const timer = setTimeout(() => {
        window.print();
        setLastAction('Receipt sent to printer!');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lastInvoice]);

  const resetCheckout = () => {
    setCart([]);
    setDiscount(0);
    setAmountPaid(0);
    setOrderNote('');
    setPaymentMethod('Cash');
    setCustomer('Walk-in customer');
  };

  const reduceSoldStock = async (saleItems: PosSalePayload['items']) => {
    setProducts((previous) =>
      previous.map((product) => {
        const saleItem = saleItems.find((item) => item.product_id === product.id);
        if (!saleItem) return product;

        const stock = product.stock - saleItem.quantity;
        return {
          ...product,
          stock,
          status: product.status === 'Inactive' ? 'Inactive' : stock <= product.minimumStock ? 'Low stock' : 'Active',
        };
      }),
    );

    setProductVariants((previous) =>
      previous.map((variant) => {
        const saleItem = saleItems.find((item) => item.variant_id === variant.id);
        if (!saleItem) return variant;

        return {
          ...variant,
          stock_quantity: variant.stock_quantity - saleItem.quantity,
        };
      }),
    );

    for (const item of saleItems) {
      if (item.variant_id) {
        const variant = productVariants.find((v) => v.id === item.variant_id);
        if (variant) {
          const newVarStock = variant.stock_quantity - item.quantity;
          try {
            await updatePosMasterRecord(
              API_RESOURCES.PRODUCT_VARIANTS,
              variant.id,
              {
                ...variant,
                stock_quantity: newVarStock,
              },
              'productVariant',
            );
          } catch (err) {
            console.warn(`Failed to update backend stock for variant ${variant.id}:`, err);
          }
        }
      }

      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;

      const newStock = product.stock - item.quantity;

      try {
        await updateProduct(product.id, {
          product_code: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: '',
          category_id: product.categoryId || 1,
          brand_id: product.brandId || 1,
          unit_id: product.unitId || 1,
          cost_price: 0,
          selling_price: product.price,
          wholesale_price: product.price,
          stock_quantity: newStock,
          minimum_stock: product.minimumStock,
          tax_rate: product.taxRate,
          discount_rate: 0,
          image: '',
          weight: 0,
          is_weighted: Boolean(product.is_weighted),
          status: product.status === 'Active',
        });
      } catch (err) {
        console.warn(`Failed to update backend stock for product ${product.id}:`, err);
      }

      try {
        await createPosMasterRecord(
          API_RESOURCES.STOCK_MOVEMENTS,
          {
            product_id: product.id,
            type: 'sale',
            quantity: item.quantity,
            reference_type: 'pos_sale',
            remarks: `POS Sale (${item.quantity} units sold${item.variant_id ? ' - variant' : ''})`,
          },
          'stockMovement',
        );
      } catch {}
    }
  };

  const buildSalePayload = (
    status: SaleStatus,
    overrides: Partial<Pick<PosSalePayload, 'payment_method' | 'paid_amount' | 'change_amount' | 'credit_amount' | 'customer_id' | 'customer_name' | 'due_days'>> = {},
  ): PosSalePayload => {
    const discountRatio = subtotal ? discountAmount / subtotal : 0;
    const taxRatio = taxableAmount ? tax / taxableAmount : 0;
    const paidAmount = overrides.paid_amount ?? (paymentMethod === 'Cash' ? amountPaid : total);
    const creditAmount = overrides.credit_amount ?? 0;
    const payment = overrides.payment_method ?? paymentMethod;

    return {
      sale_no: createSaleNo(),
      status,
      customer_name: overrides.customer_name ?? customer,
      customer_id: overrides.customer_id ?? null,
      cashier_id: Number.isFinite(cashierId) ? cashierId : null,
      cashier_name: cashierName,
      cashier_role: cashierRole,
      register_no: REGISTER_NO,
      shift_code: SHIFT_CODE,
      payment_method: payment,
      subtotal,
      discount_total: discountAmount,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      tax_total: tax,
      tax_amount: tax,
      grand_total: total,
      total_amount: total,
      paid_amount: paidAmount,
      balance_amount: overrides.change_amount ?? (payment === 'Cash' ? Math.max(paidAmount - total, 0) : 0),
      change_amount: overrides.change_amount ?? (payment === 'Cash' ? Math.max(paidAmount - total, 0) : 0),
      credit_amount: creditAmount,
      due_days: overrides.due_days ?? null,
      notes: orderNote,
      sold_at: new Date().toISOString(),
      items: cart.map((item) => {
        const lineSubtotal = item.price * item.quantity;
        const lineDiscount = lineSubtotal * discountRatio;
        const lineTaxable = lineSubtotal - lineDiscount;

        return {
          product_id: item.base_product_id || item.id,
          variant_id: item.variant_id,
          product_name: item.name,
          product_code: item.sku,
          barcode: item.barcode,
          unit_price: item.price,
          quantity: item.quantity,
          qty: item.quantity,
          discount_amount: lineDiscount,
          discount: lineDiscount,
          tax_amount: lineTaxable * taxRatio,
          tax: lineTaxable * taxRatio,
          line_total: lineTaxable + lineTaxable * taxRatio,
        };
      }),
      payments:
        payment === 'Credit'
          ? [
              ...(paidAmount > 0 ? [{ method: 'cash', amount: paidAmount }] : []),
              { method: 'credit', amount: overrides.credit_amount ?? total },
            ]
          : paidAmount > 0
            ? [{ method: payment.toLowerCase(), amount: paidAmount }]
            : [],
    };
  };

  const submitSale = async (payload: PosSalePayload) => {
    if (payload.status === 'held') {
      const nextHeldOrders = [payload, ...heldOrders].slice(0, 20);
      setHeldOrders(nextHeldOrders);
      saveStoredSales(LOCAL_HELD_ORDERS_KEY, nextHeldOrders);
      return;
    }

    try {
      await createPosSale(payload);
      setLastAction(`${payload.sale_no} synced to backend`);
    } catch {
      setLastAction(`${payload.sale_no} saved locally. Backend sales API is not ready.`);
    }

    const nextCompletedSales = [payload, ...completedSales].slice(0, 30);
    setCompletedSales(nextCompletedSales);
    saveStoredSales(LOCAL_SALES_KEY, nextCompletedSales);
    void reduceSoldStock(payload.items);

    if (activeSession && payload.status === 'completed') {
      const netCash = getSaleNetCash(payload);
      if (netCash > 0) {
        const cashLog: CashDrawerLogEntry = {
          id: `LOG-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'cash_sale',
          amount: netCash,
          reason: `Sale ${payload.sale_no} (${payload.payment_method}${payload.payment_method === 'Credit' ? ' down-payment' : ''})`,
          cashierName: payload.cashier_name || cashierName || 'Cashier',
        };
        const updatedSession: RegisterSession = {
          ...activeSession,
          cashLogs: [cashLog, ...(activeSession.cashLogs || [])],
        };
        setActiveSession(updatedSession);
        saveActiveSession(updatedSession);
      }
    }
  };

  const addToCart = (product: PosProduct, customQty?: number) => {
    if (!customQty && (product.is_weighted || product.unit === 'kg' || product.unit_name === 'kg')) {
      setWeightedProduct(product);
      setWeightInput('1.000');
      return;
    }

    const addQty = customQty ?? 1;

    setCart((previous) => {
      const existing = previous.find((item) => item.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + addQty }
            : item,
        );
      }

      return [...previous, { ...product, quantity: addQty }];
    });
    setLastAction(`${product.name} (${addQty} ${product.unit || product.unit_name || 'qty'}) added`);
  };

  const handleSelectSuggestion = (product: PosProduct) => {
    const vars = productVariants.filter((v) => v.product_id === product.id);
    if (vars.length > 0) {
      setVariantModalProduct(product);
      setQuery('');
      setIsDropdownOpen(false);
    } else {
      addToCart(product);
      setQuery('');
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (lastInvoice) {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          returnToTerminal();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        customerInputRef.current?.focus();
        customerInputRef.current?.select();
        return;
      }

      if (target === searchInputRef.current) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setIsDropdownOpen(true);
          setSelectedProductIndex((current) =>
            Math.min(current + 1, maxProductIndex),
          );
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setIsDropdownOpen(true);
          setSelectedProductIndex((current) => Math.max(current - 1, 0));
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          if (selectedProduct) handleSelectSuggestion(selectedProduct);
          return;
        }
      }

      if (isTyping) return;

      if (event.key === 'F7') {
        event.preventDefault();
        if (activeSession) setShowDrawerDetailsModal(true);
        else setShowStartSessionModal(true);
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        holdOrder();
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        completeSale();
        return;
      }

      if (event.key === 'F10') {
        event.preventDefault();
        openCashModal();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
        event.preventDefault();
        clearCart();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setQuery('');
        setCategory('All');
        setIsDropdownOpen(false);
        return;
      }

      if (event.key === '+') {
        event.preventDefault();
        const lastItem = cart[cart.length - 1];
        if (lastItem) updateQuantity(lastItem.id, lastItem.quantity + 1);
        return;
      }

      if (event.key === '-') {
        event.preventDefault();
        const lastItem = cart[cart.length - 1];
        if (lastItem) updateQuantity(lastItem.id, lastItem.quantity - 1);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    amountPaid,
    cart,
    category,
    customer,
    discount,
    filteredProducts.length,
    orderNote,
    paymentMethod,
    query,
    selectedProduct,
    lastInvoice,
    total,
  ]);

  function updateQuantity(productId: number, quantity: number) {
    setCart((previous) =>
      previous
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.min(Math.max(quantity, 1), item.stock) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  const removeItem = (productId: number) => {
    setCart((previous) => previous.filter((item) => item.id !== productId));
  };

  function clearCart() {
    resetCheckout();
    setLastAction('Cart cleared');
  }

  async function holdOrder() {
    if (!cart.length) {
      if (heldOrders.length > 0) {
        setShowHeldOrdersModal(true);
        return;
      }
      setLastAction('Add items before holding an order');
      return;
    }

    const heldOrder = buildSalePayload('held', {
      payment_method: 'Hold',
      paid_amount: 0,
      credit_amount: total,
    });
    await submitSale(heldOrder);
    resetCheckout();
    setLastAction(`${heldOrder.sale_no} held for later (${heldOrder.items.length} items)`);
  }

  async function completeSale() {
    if (!cart.length) {
      setLastAction('Add items before checkout');
      return;
    }

    if (paymentMethod === 'Cash' && amountPaid < total) {
      setLastAction(`Cash short by ${formatMoney(total - amountPaid)}`);
      return;
    }

    const sale = buildSalePayload('completed', {
      paid_amount: paymentMethod === 'Cash' ? amountPaid : total,
      change_amount: paymentMethod === 'Cash' ? changeDue : 0,
    });
    await submitSale(sale);
    resetCheckout();
    setLastInvoice(sale);
  }

  function openCashModal() {
    if (!cart.length) {
      setLastAction('Add items before checkout');
      return;
    }

    setPaymentMethod('Cash');
    setShowCashModal(true);
    window.setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 0);
  }

  function openCreditModal() {
    if (!cart.length) {
      setLastAction('Add items before checkout');
      return;
    }

    setPaymentMethod('Credit');
    setShowCreditModal(true);
  }

  const completeCashSale = async () => {
    if (amountPaid < total) {
      setLastAction(`Cash short by ${formatMoney(total - amountPaid)}`);
      return;
    }

    setPaymentMethod('Cash');
    const sale = buildSalePayload('completed', {
      payment_method: 'Cash',
      paid_amount: amountPaid,
      change_amount: changeDue,
    });
    await submitSale(sale);
    resetCheckout();
    setShowCashModal(false);
    setLastInvoice(sale);
  };

  const completeCreditSale = async () => {
    if (!canCompleteCreditSale) {
      setLastAction('Customer credit is not available for this sale');
      return;
    }

    setPaymentMethod('Credit');
    setLastAction(
      `Credit sale assigned to ${selectedCreditCustomer.name}. Paid ${formatMoney(creditPaidNow)}, credit ${formatMoney(creditBalance)}`,
    );
    const sale = buildSalePayload('completed', {
      payment_method: 'Credit',
      paid_amount: creditPaidNow,
      credit_amount: creditBalance,
      customer_id: selectedCreditCustomer.id,
      customer_name: selectedCreditCustomer.name,
      due_days: creditDueDays,
    });
    await submitSale(sale);

    const newCustomerBalance = selectedCreditCustomer.balance + creditBalance;
    const updatedCustomer: CreditCustomer = {
      ...selectedCreditCustomer,
      balance: newCustomerBalance,
    };

    try {
      await updatePosMasterRecord(
        API_RESOURCES.CUSTOMERS,
        selectedCreditCustomer.id,
        {
          name: updatedCustomer.name,
          phone: updatedCustomer.phone,
          email: updatedCustomer.email,
          address: updatedCustomer.address,
          credit_limit: updatedCustomer.creditLimit,
          current_credit: newCustomerBalance,
          status: updatedCustomer.status === 'Active',
        },
        'customer',
      );
    } catch (err) {
      console.warn(`Failed to update backend credit balance for customer ${selectedCreditCustomer.id}:`, err);
    }

    setCreditCustomers((prev) =>
      prev.map((c) => (c.id === selectedCreditCustomer.id ? updatedCustomer : c)),
    );

    setCustomer(selectedCreditCustomer.name);
    resetCheckout();
    setShowCreditModal(false);
    setLastInvoice(sale);
  };

  const handlePaymentClick = () => {
    if (paymentMethod === 'Cash') {
      openCashModal();
      return;
    }

    if (paymentMethod === 'Credit') {
      openCreditModal();
      return;
    }

    completeSale();
  };

  const recallHeldOrder = (saleNo: string) => {
    if (cart.length > 0) {
      const confirmReplace = window.confirm('Recalling this held order will replace your current active cart. Do you want to proceed?');
      if (!confirmReplace) return;
    }

    const heldOrder = heldOrders.find((order) => order.sale_no === saleNo);
    if (!heldOrder) return;

    setCart(
      heldOrder.items.map((item) => {
        const product = products.find((currentProduct) => currentProduct.id === item.product_id);
        return {
          ...(product ?? {
            id: item.product_id,
            name: item.product_name,
            sku: item.product_code,
            barcode: item.barcode,
            category: 'Held order',
            price: item.unit_price,
            stock: item.quantity,
            minimumStock: 0,
            taxRate: 0,
            status: 'Active' as const,
          }),
          quantity: item.quantity,
        };
      }),
    );
    setCustomer(heldOrder.customer_name || 'Walk-in customer');
    setOrderNote(heldOrder.notes || '');
    setDiscount(heldOrder.discount_amount || 0);

    const nextHeldOrders = heldOrders.filter((order) => order.sale_no !== saleNo);
    setHeldOrders(nextHeldOrders);
    saveStoredSales(LOCAL_HELD_ORDERS_KEY, nextHeldOrders);
    setShowHeldOrdersModal(false);
    setLastAction(`${saleNo} recalled into cart`);
  };

  const deleteHeldOrder = (saleNo: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to discard held order ${saleNo}?`);
    if (!confirmDelete) return;

    const nextHeldOrders = heldOrders.filter((order) => order.sale_no !== saleNo);
    setHeldOrders(nextHeldOrders);
    saveStoredSales(LOCAL_HELD_ORDERS_KEY, nextHeldOrders);
    setLastAction(`Held order ${saleNo} discarded`);
  };

  const appendCashDigit = (value: string) => {
    const currentValue = amountPaid ? String(amountPaid) : '';
    const nextValue = value === '.' && currentValue.includes('.') ? currentValue : `${currentValue}${value}`;
    setAmountPaid(Number(nextValue) || 0);
  };

  const removeCashDigit = () => {
    const currentValue = amountPaid ? String(amountPaid) : '';
    setAmountPaid(Number(currentValue.slice(0, -1)) || 0);
  };

  return (
    <div style={themed(styles.container, styles.containerLight)}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>POS terminal</h1>
          <p style={themed(styles.pageSubtitle, styles.pageSubtitleLight)}>
            Fast checkout workspace for counter sales.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            type="button"
            style={{
              ...themed(styles.headerHeldBadge, styles.headerHeldBadgeLight),
              background: activeSession ? 'rgba(39, 174, 79, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: activeSession ? '#27AE4F' : '#EF4444',
              border: activeSession ? '1px solid rgba(39, 174, 79, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            }}
            onClick={() => {
              if (activeSession) setShowDrawerDetailsModal(true);
              else setShowStartSessionModal(true);
            }}
            title="View Cash Drawer & Daily Shift Session"
          >
            <i className="ti ti-cash-banknote" aria-hidden="true" />
            Drawer: <strong>{activeSession ? formatMoney(expectedCashInDrawer) : 'Closed (Start Shift)'}</strong>
          </button>
          <button
            type="button"
            style={themed(styles.headerHeldBadge, styles.headerHeldBadgeLight)}
            onClick={() => setShowHeldOrdersModal(true)}
            title="Open Held Orders Popup Window"
          >
            <i className="ti ti-clock-pause" aria-hidden="true" />
            Held: <strong>{heldOrders.length}</strong>
          </button>
          <div style={styles.sessionBadge}>
            <i className="ti ti-circle-filled" aria-hidden="true" />
            {activeSession?.registerNo || REGISTER_NO}
          </div>
          <div style={themed(styles.operatorBadge, styles.operatorBadgeLight)}>
            <i className="ti ti-user-check" aria-hidden="true" />
            {activeSession?.cashierName || cashierName}
          </div>
          <div style={themed(styles.operatorBadge, styles.operatorBadgeLight)}>
            <i className="ti ti-calendar-time" aria-hidden="true" />
            {activeSession?.shiftCode || SHIFT_CODE}
          </div>
        </div>
      </div>

      <div style={styles.commandBar}>
        <div ref={searchWrapperRef} style={{ position: 'relative', flex: 1 }}>
          <div style={themed(styles.scanBox, styles.surfaceLight)}>
            <i className="ti ti-barcode" style={themed(styles.scanIcon, styles.iconLight)} aria-hidden="true" />
            <input
              ref={searchInputRef}
              style={themed(styles.scanInput, styles.inputLight)}
              value={query}
              onChange={(event) => {
                const val = event.target.value;
                setQuery(val);
                setSelectedProductIndex(0);
                setIsDropdownOpen(val.trim().length > 0);
              }}
              onFocus={() => {
                if (query.trim().length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              placeholder="Scan barcode, SKU, or search product"
            />
            {query && (
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: isLightMode ? '#64748B' : '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setQuery('');
                  setIsDropdownOpen(false);
                  searchInputRef.current?.focus();
                }}
                title="Clear search"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            )}
          </div>

          {isDropdownOpen && query.trim().length > 0 && (
            <div style={themed(styles.dropdownContainer, styles.dropdownContainerLight)}>
              <div style={themed(styles.dropdownHeader, styles.dropdownHeaderLight)}>
                <span>
                  <i className="ti ti-list-search" style={{ marginRight: 6 }} aria-hidden="true" />
                  {filteredProducts.length === 1
                    ? '1 product suggestion'
                    : `${filteredProducts.length} product suggestions`}
                </span>
                <span style={styles.dropdownShortcuts}>
                  <kbd style={themed(styles.kbd, styles.kbdLight)}>↑↓</kbd> navigate
                  <kbd style={themed(styles.kbd, styles.kbdLight)}>↵</kbd> select
                  <kbd style={themed(styles.kbd, styles.kbdLight)}>Esc</kbd> close
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div style={themed(styles.dropdownEmpty, styles.dropdownEmptyLight)}>
                  <i className="ti ti-package-off" style={{ fontSize: 24, marginBottom: 6, display: 'block' }} aria-hidden="true" />
                  No products found matching &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div style={styles.dropdownList}>
                  {filteredProducts.map((product, index) => {
                    const isSelected = safeSelectedProductIndex === index;
                    const inCart = cart.some((item) => item.id === product.id);
                    const isOutOfStock = product.stock !== undefined && product.stock <= 0;

                    return (
                      <div
                        key={product.id}
                        style={themed(
                          {
                            ...styles.dropdownItem,
                            ...(isSelected ? styles.dropdownItemActive : {}),
                          },
                          {
                            ...(isSelected ? styles.dropdownItemActiveLight : {}),
                          }
                        )}
                        onClick={() => handleSelectSuggestion(product)}
                        onMouseEnter={() => setSelectedProductIndex(index)}
                      >
                        <div style={styles.dropdownItemLeft}>
                          <div style={styles.dropdownItemTitleRow}>
                            <span style={themed(styles.dropdownItemName, styles.textLight)}>
                              {product.name}
                            </span>
                            {inCart && (
                              <span style={styles.dropdownCartBadge}>
                                <i className="ti ti-shopping-cart-check" aria-hidden="true" /> In Cart
                              </span>
                            )}
                          </div>
                          <div style={styles.dropdownItemMeta}>
                            <span style={themed(styles.dropdownSkuTag, styles.skuTagLight)}>
                              {product.sku || product.barcode || 'N/A'}
                            </span>
                            <span style={themed(styles.dropdownCategoryTag, styles.mutedLight)}>
                              {product.category}
                            </span>
                          </div>
                        </div>

                        <div style={styles.dropdownItemRight}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={themed(styles.dropdownItemPrice, styles.textLight)}>
                              {formatMoney(product.price)}
                            </div>
                            <span
                              style={{
                                ...styles.dropdownStockBadge,
                                backgroundColor: isOutOfStock
                                  ? 'rgba(239,68,68,0.15)'
                                  : product.stock <= (product.minimumStock || 5)
                                    ? 'rgba(245,158,11,0.15)'
                                    : 'rgba(16,185,129,0.15)',
                                color: isOutOfStock
                                  ? '#EF4444'
                                  : product.stock <= (product.minimumStock || 5)
                                    ? '#F59E0B'
                                    : '#10B981',
                              }}
                            >
                              {isOutOfStock ? 'Out of stock' : `${product.stock} left`}
                            </span>
                          </div>
                          <button
                            type="button"
                            style={themed(
                              {
                                ...styles.dropdownAddBtn,
                                ...(isSelected ? styles.dropdownAddBtnActive : {}),
                              },
                              {
                                ...(isSelected ? styles.dropdownAddBtnActiveLight : {}),
                              }
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSuggestion(product);
                            }}
                            title="Add to cart"
                          >
                            <i className="ti ti-plus" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <button style={themed(styles.commandBtn, styles.buttonLight)} onClick={() => searchInputRef.current?.focus()}>
          <i className="ti ti-scan" aria-hidden="true" />
          Scan
        </button>
        <button
          style={themed(
            {
              ...styles.commandBtn,
              ...(heldOrders.length > 0 ? styles.heldActiveBtn : {}),
            },
            styles.buttonLight
          )}
          onClick={() => setShowHeldOrdersModal(true)}
          title="View Held Orders Popup Window"
        >
          <i className="ti ti-clock-pause" aria-hidden="true" />
          Held ({heldOrders.length})
        </button>
        <button style={themed(styles.commandBtn, styles.buttonLight)} onClick={clearCart}>
          <i className="ti ti-refresh" aria-hidden="true" />
          New sale
        </button>
      </div>

      <div style={styles.layout}>
        <section style={themed(styles.selectedPanel, styles.panelLight)}>
          <div style={styles.selectedHeader}>
            <div>
              <h2 style={styles.selectedTitle}>Selected products</h2>
              <p style={styles.selectedSub}>{itemCount} items selected</p>
            </div>
            <button style={styles.clearBtn} onClick={clearCart} title="Clear cart">
              <i className="ti ti-trash" style={styles.headerActionIcon} aria-hidden="true" />
            </button>
          </div>

          <div style={styles.orderInfoGrid}>
            <label style={styles.orderField}>
              <span style={themed(styles.orderLabel, styles.mutedLight)}>Customer</span>
              <div style={themed(styles.customerRow, styles.inputWrapLight)}>
                <i className="ti ti-user" aria-hidden="true" />
                <input
                  ref={customerInputRef}
                  style={themed(styles.customerInput, styles.inputLight)}
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                />
              </div>
            </label>
            <label style={styles.orderField}>
              <span style={themed(styles.orderLabel, styles.mutedLight)}>Order note</span>
              <input
                style={themed(styles.noteInput, styles.inputLight)}
                value={orderNote}
                onChange={(event) => setOrderNote(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div style={themed(styles.tableContainer, styles.tableContainerLight)}>
            <table style={styles.cartTable}>
              <thead>
                <tr style={themed(styles.cartTableHeaderRow, styles.cartTableHeaderRowLight)}>
                  <th style={{ ...styles.thCell, textAlign: 'left' }}>Product Name</th>
                  <th style={{ ...styles.thCell, textAlign: 'center', width: '130px' }}>Quantity</th>
                  <th style={{ ...styles.thCell, textAlign: 'right', width: '110px' }}>Price</th>
                  <th style={{ ...styles.thCell, textAlign: 'right', width: '120px' }}>Amount</th>
                  <th style={{ ...styles.thCell, textAlign: 'center', width: '40px' }} />
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={themed(styles.emptyTableTd, styles.mutedLight)}>
                      <div style={styles.emptyCartBox}>
                        <i className="ti ti-shopping-cart-off" style={{ fontSize: 32, opacity: 0.5, marginBottom: 8 }} aria-hidden="true" />
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>No items selected</p>
                        <span style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Scan barcode or search products above to add items</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.id} style={themed(styles.cartTableRow, styles.cartTableRowLight)}>
                      <td style={themed(styles.tdNameCell, styles.textLight)}>
                        <div style={styles.productCellContent}>
                          <span style={styles.productCellTitle}>{item.name}</span>
                          {(item.sku || item.category) && (
                            <span style={themed(styles.productCellSub, styles.mutedLight)}>
                              {item.sku ? item.sku : ''}{item.sku && item.category ? ' • ' : ''}{item.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                        <div style={styles.rowQuantityControl}>
                          <button
                            type="button"
                            style={themed(styles.rowQtyBtn, styles.buttonLight)}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            title="Decrease quantity"
                          >
                            <i className="ti ti-minus" aria-hidden="true" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            style={themed(styles.rowQtyInput, styles.inputLight)}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              updateQuantity(item.id, val);
                            }}
                          />
                          <button
                            type="button"
                            style={themed(styles.rowQtyBtn, styles.buttonLight)}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            title="Increase quantity"
                          >
                            <i className="ti ti-plus" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                      <td style={themed(styles.tdPriceCell, styles.textLight)}>
                        {formatDecimal(item.price)}
                      </td>
                      <td style={themed(styles.tdAmountCell, styles.textLight)}>
                        {formatDecimal(item.price * item.quantity)}
                      </td>
                      <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                        <button
                          type="button"
                          style={styles.rowRemoveBtn}
                          onClick={() => removeItem(item.id)}
                          title="Remove product"
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside style={themed(styles.checkout, styles.panelLight)}>
          <div style={styles.checkoutHeader}>
            <div>
              <h2 style={styles.checkoutTitle}>Payment summary</h2>
              <p style={styles.checkoutSub}>Discount, tax, and payment</p>
            </div>
            <span style={styles.summaryIcon}>
              <i className="ti ti-receipt" style={styles.headerActionIcon} aria-hidden="true" />
            </span>
          </div>

          <div style={styles.discountRow}>
            <label style={themed(styles.discountLabel, styles.textLight)}>Discount</label>
            <input
              style={themed(styles.discountInput, styles.inputLight)}
              type="number"
              min={0}
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value) || 0)}
            />
          </div>

          <div style={styles.quickDiscounts}>
            {[0, 100, 250, 500].map((value) => (
              <button
                key={value}
                style={{
                  ...themed(styles.discountChip, styles.buttonLight),
                  ...(discount === value ? styles.discountChipActive : {}),
                }}
                onClick={() => setDiscount(value)}
              >
                {value === 0 ? 'No discount' : formatMoney(value)}
              </button>
            ))}
          </div>

          <div style={styles.paymentGroup}>
            {['Cash', 'Card', 'Credit', 'Wallet'].map((method) => (
              <button
                key={method}
                style={{
                  ...themed(styles.paymentBtn, styles.buttonLight),
                  ...(paymentMethod === method ? styles.paymentBtnActive : {}),
                }}
                onClick={() => setPaymentMethod(method)}
              >
                {method}
              </button>
            ))}
          </div>

          <div style={styles.paidBlock}>
            <label style={themed(styles.discountLabel, styles.textLight)}>Amount paid</label>
            <input
              style={themed(styles.paidInput, styles.inputLight)}
              type="number"
              min={0}
              value={amountPaid}
              onChange={(event) => setAmountPaid(Number(event.target.value) || 0)}
              disabled={paymentMethod !== 'Cash'}
            />
            <div style={themed(styles.changeDue, styles.surfaceLight)}>
              <span>Change due</span>
              <strong>{formatMoney(changeDue)}</strong>
            </div>
          </div>

          <div style={styles.totals}>
            <div style={themed(styles.totalRow, styles.textLight)}>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <div style={themed(styles.totalRow, styles.textLight)}>
              <span>Discount</span>
              <strong>{formatMoney(discountAmount)}</strong>
            </div>
            <div style={themed(styles.totalRow, styles.textLight)}>
              <span>Tax</span>
              <strong>{formatMoney(tax)}</strong>
            </div>
            <div style={styles.grandTotal}>
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>

          {lastAction && <div style={themed(styles.actionMessage, styles.surfaceLight)}>{lastAction}</div>}

          <div style={{ ...styles.actionGrid, gridTemplateColumns: '1fr 1fr 2fr' }}>
            <button
              type="button"
              style={themed(styles.secondaryBtn, styles.buttonLight)}
              onClick={() => {
                if (activeSession) setShowDrawerDetailsModal(true);
                else setShowStartSessionModal(true);
              }}
              title="Open Cash Drawer operations & shift session modal (F7)"
            >
              <i className="ti ti-cash-banknote" aria-hidden="true" />
              Drawer (F7)
            </button>
            <button
              type="button"
              style={themed(styles.secondaryBtn, styles.buttonLight)}
              onClick={() => {
                if (cart.length > 0) {
                  holdOrder();
                } else {
                  setShowHeldOrdersModal(true);
                }
              }}
            >
              <i className="ti ti-clock-pause" aria-hidden="true" />
              {cart.length > 0 ? 'Hold (F4)' : `Held (${heldOrders.length})`}
            </button>
            <button style={styles.primaryBtn} onClick={handlePaymentClick}>
              <i className="ti ti-receipt" aria-hidden="true" />
              {paymentMethod === 'Cash'
                ? 'Enter cash'
                : paymentMethod === 'Credit'
                  ? 'Customer credit'
                  : canCompleteSale ? `Pay ${paymentMethod}` : 'Review payment'}
              <span style={styles.keyHint}>{paymentMethod === 'Cash' ? 'F10' : paymentMethod === 'Credit' ? 'CR' : 'F9'}</span>
            </button>
          </div>

          {/* <div style={styles.saleActivity}>
            <div style={styles.saleActivityHeader}>
              <strong>Held orders</strong>
              <span>{heldOrders.length}</span>
            </div>
            <div style={styles.saleActivityList}>
              {heldOrders.slice(0, 3).map((sale) => (
                <button key={sale.sale_no} style={styles.heldOrderRow} onClick={() => recallHeldOrder(sale.sale_no)}>
                  <span>{sale.sale_no}</span>
                  <strong>{formatMoney(sale.total_amount)}</strong>
                </button>
              ))}
              {heldOrders.length === 0 && <span style={styles.saleActivityEmpty}>No held orders</span>}
            </div>
          </div> */}
        </aside>
      </div>

      {showHeldOrdersModal && (
        <div
          style={themed(styles.modalOverlay, styles.modalOverlayLight)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHeldOrdersModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div style={{ ...themed(styles.heldOrdersModal, styles.heldOrdersModalLight), borderRadius: 16 }}>
            <div style={themed(styles.heldModalHeader, styles.heldModalHeaderLight)}>
              <div>
                <h2 style={themed(styles.heldModalTitle, styles.textLight)}>
                  <i className="ti ti-clock-pause" style={{ marginRight: 8, color: '#38BDF8', fontSize: 22 }} aria-hidden="true" />
                  Held Orders Queue ({heldOrders.length})
                </h2>
                <p style={themed(styles.heldModalSub, styles.mutedLight)}>
                  Recall a held order to restore items into the active cart or discard unused orders.
                </p>
              </div>
              <button
                type="button"
                style={styles.posModalCloseBtn}
                onClick={() => setShowHeldOrdersModal(false)}
                title="Close"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div style={styles.heldOrdersList}>
              {heldOrders.length === 0 ? (
                <div style={themed(styles.dropdownEmpty, styles.dropdownEmptyLight)}>
                  <i className="ti ti-clock-off" style={{ fontSize: 36, marginBottom: 8, opacity: 0.6, display: 'block' }} aria-hidden="true" />
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>No held orders found</p>
                  <span style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    Add items to cart and press Hold (F4) to hold an order for later.
                  </span>
                </div>
              ) : (
                heldOrders.map((order) => (
                  <div key={order.sale_no} style={themed(styles.heldCard, styles.heldCardLight)}>
                    <div style={styles.heldCardHeader}>
                      <div>
                        <span style={themed(styles.heldSaleNo, styles.textLight)}>{order.sale_no}</span>
                        <span style={themed(styles.heldCustomerTag, styles.mutedLight)}>
                          <i className="ti ti-user" aria-hidden="true" /> {order.customer_name || 'Walk-in customer'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: 16, color: '#27AE4F' }}>{formatMoney(order.total_amount)}</strong>
                        <div style={themed(styles.heldItemCount, styles.mutedLight)}>
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </div>
                      </div>
                    </div>

                    <div style={themed(styles.heldItemsPreview, styles.heldItemsPreviewLight)}>
                      {order.items.map((item, idx) => (
                        <span key={idx} style={styles.heldItemChip}>
                          {item.product_name} <small style={{ opacity: 0.7 }}>x{item.quantity}</small>
                        </span>
                      ))}
                    </div>

                    <div style={styles.heldCardFooter}>
                      <button
                        type="button"
                        style={styles.heldDeleteBtn}
                        onClick={() => deleteHeldOrder(order.sale_no)}
                      >
                        <i className="ti ti-trash" aria-hidden="true" /> Discard
                      </button>
                      <button
                        type="button"
                        style={styles.heldRecallBtn}
                        onClick={() => recallHeldOrder(order.sale_no)}
                      >
                        <i className="ti ti-arrow-forward-up" aria-hidden="true" /> Recall order
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showCashModal && (
        <div style={themed(styles.modalOverlay, styles.modalOverlayLight)} role="dialog" aria-modal="true">
          <div style={themed(styles.paymentScreenModal, styles.paymentScreenModalLight)}>
            {/* Modal Header */}
            <div style={themed(styles.posModalHeader, styles.posModalHeaderLight)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.posModalIconBox}>
                  <i className="ti ti-cash-register" style={{ fontSize: 24, color: '#27AE4F' }} aria-hidden="true" />
                </div>
                <div>
                  <h2 style={themed(styles.posModalTitle, styles.textLight)}>Payment Checkout</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 12, opacity: 0.8 }}>
                    <span>Register 01</span>
                    <span>•</span>
                    <span>Cashier: {cashierName}</span>
                    <span>•</span>
                    <span style={styles.posModalItemCountBadge}>{cart.length} items</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={styles.posModalCloseBtn}
                onClick={() => setShowCashModal(false)}
                title="Cancel (Esc)"
              >
                <i className="ti ti-x" aria-hidden="true" />
                <span>Cancel</span>
                <span style={styles.escBadge}>Esc</span>
              </button>
            </div>

            {/* Modal Body Grid */}
            <div style={styles.posModalBodyGrid}>
              {/* Left Column: Cart Summary */}
              <aside style={themed(styles.posModalCartPanel, styles.posModalCartPanelLight)}>
                <div style={styles.posCartPanelHeader}>
                  <h3 style={themed(styles.posCartPanelTitle, styles.textLight)}>
                    <i className="ti ti-shopping-cart" style={{ marginRight: 6 }} aria-hidden="true" />
                    Order Summary
                  </h3>
                  <span style={styles.customerNameBadge}>{customer}</span>
                </div>

                <div style={styles.posCartItemsScroll}>
                  {cart.map((item) => (
                    <div key={item.id} style={themed(styles.posCartItemCard, styles.posCartItemCardLight)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={themed(styles.posCartItemTitle, styles.textLight)}>{item.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--app-muted)', marginTop: 2 }}>
                          {item.sku ? `SKU: ${item.sku}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={styles.posCartItemQtyPrice}>
                          <span style={styles.qtyChip}>x{item.quantity}</span>
                          <span style={{ fontSize: 13, opacity: 0.8 }}>{formatMoney(item.price)}</span>
                        </div>
                        <strong style={{ fontSize: 14, color: '#27AE4F', display: 'block', marginTop: 3 }}>
                          {formatMoney(item.quantity * item.price)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={themed(styles.posCartTotalsCard, styles.posCartTotalsCardLight)}>
                  <div style={styles.posCartTotalRow}>
                    <span>Subtotal:</span>
                    <strong>{formatMoney(subtotal)}</strong>
                  </div>
                  {discountAmount > 0 && (
                    <div style={styles.posCartTotalRow}>
                      <span>Discount:</span>
                      <strong style={{ color: '#EF4444' }}>-{formatMoney(discountAmount)}</strong>
                    </div>
                  )}
                  <div style={styles.posCartTotalRow}>
                    <span>Tax:</span>
                    <strong>{formatMoney(tax)}</strong>
                  </div>
                  <div style={styles.posCartGrandTotalRow}>
                    <span>TOTAL DUE:</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#27AE4F' }}>
                      {formatMoney(total)}
                    </span>
                  </div>
                </div>
              </aside>

              {/* Right Column: Payment & Touch Keypad */}
              <section style={themed(styles.posModalPaymentPanel, styles.posModalPaymentPanelLight)}>
                {/* Method Tabs */}
                <div style={styles.posMethodTabsRow}>
                  {['Cash', 'Card', 'Credit'].map((method) => {
                    const isActive = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        style={{
                          ...styles.posMethodTabBtn,
                          ...(isLightMode ? styles.posMethodTabBtnLight : {}),
                          ...(isActive ? styles.posMethodTabBtnActive : {}),
                        }}
                        onClick={() => {
                          setPaymentMethod(method);
                          if (method === 'Credit') {
                            setShowCashModal(false);
                            setShowCreditModal(true);
                          }
                        }}
                      >
                        <i
                          className={`ti ${
                            method === 'Cash'
                              ? 'ti-cash'
                              : method === 'Card'
                                ? 'ti-credit-card'
                                : 'ti-user-dollar'
                          }`}
                          style={{ fontSize: 20 }}
                          aria-hidden="true"
                        />
                        <span>{method}</span>
                        {isActive && <i className="ti ti-check" style={{ marginLeft: 'auto', fontSize: 16 }} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Tender Amounts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted)' }}>
                    Quick Tender Amounts
                  </span>
                  <div style={styles.quickCashRow}>
                    <button
                      type="button"
                      style={styles.quickCashBtn}
                      onClick={() => setAmountPaid(total)}
                    >
                      Exact ({formatMoney(total)})
                    </button>
                    {[100, 500, 1000, 5000].map((preset) => {
                      const roundedTarget = Math.ceil(total / preset) * preset || preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          style={styles.quickCashBtn}
                          onClick={() => setAmountPaid(roundedTarget)}
                        >
                          +{formatMoney(preset)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Input & Change Display Cards */}
                <div style={styles.posReadoutGrid}>
                  <div style={themed(styles.posReadoutCard, styles.posReadoutCardLight)}>
                    <span style={styles.posReadoutLabel}>Total Amount</span>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{formatMoney(total)}</span>
                  </div>

                  <div style={{ ...themed(styles.posReadoutCard, styles.posReadoutCardLight), borderColor: '#38BDF8' }}>
                    <span style={{ ...styles.posReadoutLabel, color: '#38BDF8' }}>Amount Tendered</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      <input
                        ref={cashInputRef}
                        type="number"
                        min={0}
                        step="any"
                        value={amountPaid || ''}
                        onChange={(event) => setAmountPaid(Number(event.target.value) || 0)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            completeCashSale();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setShowCashModal(false);
                          }
                        }}
                        style={themed(styles.posTenderInput, styles.posTenderInputLight)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      ...themed(styles.posReadoutCard, styles.posReadoutCardLight),
                      background: amountPaid >= total ? 'rgba(39, 174, 79, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      borderColor: amountPaid >= total ? '#27AE4F' : '#EF4444',
                    }}
                  >
                    <span style={{ ...styles.posReadoutLabel, color: amountPaid >= total ? '#27AE4F' : '#EF4444' }}>
                      {amountPaid >= total ? 'Change Due' : 'Balance Remaining'}
                    </span>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: amountPaid >= total ? '#27AE4F' : '#EF4444',
                      }}
                    >
                      {amountPaid >= total ? formatMoney(changeDue) : formatMoney(total - amountPaid)}
                    </span>
                  </div>
                </div>

                {/* Touch Keypad & Submit */}
                <div style={styles.posTouchKeypadGrid}>
                  <div style={styles.keypadKeysBox}>
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', '.'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        style={themed(styles.posTouchKeyBtn, styles.posTouchKeyBtnLight)}
                        onClick={() => appendCashDigit(key)}
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  <div style={styles.keypadActionsBox}>
                    <button
                      type="button"
                      style={styles.keypadClearBtn}
                      onClick={() => setAmountPaid(0)}
                      title="Clear Amount"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      style={styles.keypadBackBtn}
                      onClick={removeCashDigit}
                      title="Backspace"
                    >
                      <i className="ti ti-backspace" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.posCompletePayBtn,
                        ...(amountPaid < total && paymentMethod === 'Cash' ? styles.posCompletePayBtnDisabled : {}),
                      }}
                      onClick={completeCashSale}
                      disabled={amountPaid < total && paymentMethod === 'Cash'}
                    >
                      <span>PAY NOW</span>
                      <i className="ti ti-arrow-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {showCreditModal && (
        <div style={themed(styles.modalOverlay, styles.modalOverlayLight)} role="dialog" aria-modal="true">
          <div style={themed(styles.paymentScreenModal, styles.paymentScreenModalLight)}>
            {/* Modal Header */}
            <div style={themed(styles.posModalHeader, styles.posModalHeaderLight)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ ...styles.posModalIconBox, background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
                  <i className="ti ti-user-dollar" style={{ fontSize: 24 }} aria-hidden="true" />
                </div>
                <div>
                  <h2 style={themed(styles.posModalTitle, styles.textLight)}>Credit Checkout</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 12, opacity: 0.8 }}>
                    <span>Customer Credit Sale</span>
                    <span>•</span>
                    <span style={styles.posModalItemCountBadge}>{cart.length} items</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                style={styles.posModalCloseBtn}
                onClick={() => setShowCreditModal(false)}
                title="Cancel (Esc)"
              >
                <i className="ti ti-x" aria-hidden="true" />
                <span>Cancel</span>
                <span style={styles.escBadge}>Esc</span>
              </button>
            </div>

            {/* Modal Body Grid */}
            <div style={styles.posModalBodyGrid}>
              {/* Left Column: Cart Summary */}
              <aside style={themed(styles.posModalCartPanel, styles.posModalCartPanelLight)}>
                <div style={styles.posCartPanelHeader}>
                  <h3 style={themed(styles.posCartPanelTitle, styles.textLight)}>
                    <i className="ti ti-shopping-cart" style={{ marginRight: 6 }} aria-hidden="true" />
                    Order Summary
                  </h3>
                </div>

                <div style={styles.posCartItemsScroll}>
                  {cart.map((item) => (
                    <div key={item.id} style={themed(styles.posCartItemCard, styles.posCartItemCardLight)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={themed(styles.posCartItemTitle, styles.textLight)}>{item.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--app-muted)', marginTop: 2 }}>
                          {item.sku ? `SKU: ${item.sku}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={styles.posCartItemQtyPrice}>
                          <span style={styles.qtyChip}>x{item.quantity}</span>
                          <span style={{ fontSize: 13, opacity: 0.8 }}>{formatMoney(item.price)}</span>
                        </div>
                        <strong style={{ fontSize: 14, color: '#27AE4F', display: 'block', marginTop: 3 }}>
                          {formatMoney(item.quantity * item.price)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={themed(styles.posCartTotalsCard, styles.posCartTotalsCardLight)}>
                  <div style={styles.posCartTotalRow}>
                    <span>Subtotal:</span>
                    <strong>{formatMoney(subtotal)}</strong>
                  </div>
                  {discountAmount > 0 && (
                    <div style={styles.posCartTotalRow}>
                      <span>Discount:</span>
                      <strong style={{ color: '#EF4444' }}>-{formatMoney(discountAmount)}</strong>
                    </div>
                  )}
                  <div style={styles.posCartTotalRow}>
                    <span>Tax:</span>
                    <strong>{formatMoney(tax)}</strong>
                  </div>
                  <div style={styles.posCartGrandTotalRow}>
                    <span>TOTAL DUE:</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#38BDF8' }}>
                      {formatMoney(total)}
                    </span>
                  </div>
                </div>
              </aside>

              {/* Right Column: Customer Credit Controls & Keypad */}
              <section style={themed(styles.posModalPaymentPanel, styles.posModalPaymentPanelLight)}>
                {/* Method Tabs */}
                <div style={styles.posMethodTabsRow}>
                  {['Cash', 'Card', 'Credit'].map((method) => {
                    const isActive = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        style={{
                          ...styles.posMethodTabBtn,
                          ...(isLightMode ? styles.posMethodTabBtnLight : {}),
                          ...(isActive ? styles.posMethodTabBtnActive : {}),
                        }}
                        onClick={() => {
                          setPaymentMethod(method);
                          if (method === 'Cash' || method === 'Card') {
                            setShowCreditModal(false);
                            setShowCashModal(true);
                          }
                        }}
                      >
                        <i
                          className={`ti ${
                            method === 'Cash'
                              ? 'ti-cash'
                              : method === 'Card'
                                ? 'ti-credit-card'
                                : 'ti-user-dollar'
                          }`}
                          style={{ fontSize: 20 }}
                          aria-hidden="true"
                        />
                        <span>{method}</span>
                        {isActive && <i className="ti ti-check" style={{ marginLeft: 'auto', fontSize: 16 }} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>

                {/* Customer Selector & Terms */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted)' }}>
                      Select Credit Customer
                    </span>
                    <select
                      style={themed(styles.posCreditSelect, styles.inputLight)}
                      value={creditCustomerId}
                      onChange={(event) => setCreditCustomerId(Number(event.target.value))}
                    >
                      {availableCreditCustomers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.phone}) — Limit: {formatMoney(item.creditLimit)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted)' }}>
                      Due Terms
                    </span>
                    <select
                      style={themed(styles.posCreditSelect, styles.inputLight)}
                      value={creditDueDays}
                      onChange={(event) => setCreditDueDays(Number(event.target.value) || 14)}
                    >
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={60}>60 Days</option>
                    </select>
                  </label>
                </div>

                {/* Payment Breakdown Shortcuts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--app-muted)' }}>
                    Payment Options
                  </span>
                  <div style={styles.quickCashRow}>
                    {[0, Math.round(total / 4), Math.round(total / 2), total].map((value, idx) => (
                      <button
                        key={`${value}-${idx}`}
                        type="button"
                        style={{
                          ...styles.quickCashBtn,
                          ...(amountPaid === value ? styles.quickCashBtnActive : {}),
                        }}
                        onClick={() => setAmountPaid(value)}
                      >
                        {value === 0 ? '100% Credit' : value === total ? 'Full Payment' : formatMoney(value)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Readout Cards */}
                <div style={styles.posReadoutGrid}>
                  <div style={themed(styles.posReadoutCard, styles.posReadoutCardLight)}>
                    <span style={styles.posReadoutLabel}>Total Amount</span>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{formatMoney(total)}</span>
                  </div>

                  <div style={themed(styles.posReadoutCard, styles.posReadoutCardLight)}>
                    <span style={styles.posReadoutLabel}>Paid Now</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      <input
                        ref={cashInputRef}
                        type="number"
                        min={0}
                        max={total}
                        value={amountPaid || ''}
                        onChange={(event) => setAmountPaid(Number(event.target.value) || 0)}
                        style={themed(styles.posTenderInput, styles.posTenderInputLight)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div style={{ ...themed(styles.posReadoutCard, styles.posReadoutCardLight), borderColor: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)' }}>
                    <span style={{ ...styles.posReadoutLabel, color: '#38BDF8' }}>Credit Balance</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#38BDF8' }}>
                      {formatMoney(creditBalance)}
                    </span>
                  </div>
                </div>

                {!canCompleteCreditSale && (
                  <div style={styles.creditCheckoutWarning}>
                    <i className="ti ti-alert-circle" aria-hidden="true" />
                    <span>
                      {selectedCreditCustomer.status !== 'Active' || selectedCreditCustomer.id === 1
                        ? 'Please select an active credit customer.'
                        : creditBalance <= 0
                          ? 'Enter an amount to keep on customer credit.'
                          : `Insufficient credit limit. Short by ${formatMoney(creditBalance - availableCredit)}.`}
                    </span>
                  </div>
                )}

                {/* Touch Keypad */}
                <div style={styles.posTouchKeypadGrid}>
                  <div style={styles.keypadKeysBox}>
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', '.'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        style={themed(styles.posTouchKeyBtn, styles.posTouchKeyBtnLight)}
                        onClick={() => appendCashDigit(key)}
                      >
                        {key}
                      </button>
                    ))}
                  </div>

                  <div style={styles.keypadActionsBox}>
                    <button
                      type="button"
                      style={styles.keypadClearBtn}
                      onClick={() => setAmountPaid(0)}
                    >
                      C
                    </button>
                    <button
                      type="button"
                      style={styles.keypadBackBtn}
                      onClick={removeCashDigit}
                    >
                      <i className="ti ti-backspace" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.posCompletePayBtn,
                        background: '#38BDF8',
                        ...(!canCompleteCreditSale ? styles.posCompletePayBtnDisabled : {}),
                      }}
                      onClick={completeCreditSale}
                      disabled={!canCompleteCreditSale}
                    >
                      <span>CONFIRM CREDIT</span>
                      <i className="ti ti-check" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {lastInvoice && (
        <div style={themed(styles.modalOverlay, styles.modalOverlayLight)} role="dialog" aria-modal="true" aria-labelledby="invoice-title">
          <style>{`
            @media print {
              @page {
                size: ${printConfig.paperWidth}mm auto;
                margin: 0 !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                width: 100% !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #pos-printable-receipt, #pos-printable-receipt * {
                visibility: visible !important;
              }
              #pos-printable-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: ${printConfig.paperWidth}mm !important;
                margin: 0 auto !important;
                padding: 6px 8px !important;
                box-sizing: border-box !important;
                font-family: Helvetica, Arial, sans-serif !important;
                font-size: ${printConfig.paperWidth <= 58 ? '11px' : '12.5px'} !important;
                line-height: 1.35 !important;
                font-weight: 600 !important;
                text-rendering: optimizeLegibility !important;
                -webkit-font-smoothing: antialiased !important;
                -moz-osx-font-smoothing: grayscale !important;
                filter: contrast(200%) !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
                visibility: hidden !important;
              }
            }
          `}</style>
          <div id="pos-printable-receipt" style={themed(styles.invoicePopup, styles.invoicePopupLight)}>
            <div className="no-print" style={themed(styles.invoiceHeader, styles.invoiceHeaderLight)}>
              <div>
                <span style={themed(styles.invoiceKicker, styles.invoiceKickerLight)}>Payment completed</span>
                <h2 id="invoice-title" style={themed(styles.invoiceTitle, styles.textLight)}>Receipt Output ({printConfig.paperWidth}mm)</h2>
              </div>
              <button className="no-print" style={styles.invoiceCloseBtn} onClick={returnToTerminal} aria-label="Return to POS terminal">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {/* Exact Screenshot Receipt Template */}
            <div
              style={{
                fontFamily: "Helvetica, Arial, sans-serif",
                color: '#000000',
                background: '#ffffff',
                padding: '12px 14px',
                fontSize: printConfig.paperWidth <= 58 ? '11.5px' : '13.5px',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {/* STORE HEADER */}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: '800', fontSize: '1.5em', letterSpacing: '0.5px', color: '#000000', marginBottom: 4 }}>
                  {printConfig.storeName}
                </div>
                {printConfig.storeAddress && <div style={{ fontWeight: '400', fontSize: '1.05em', color: '#000000' }}>{printConfig.storeAddress}</div>}
                {printConfig.storePhone && <div style={{ fontWeight: '400', fontSize: '1.05em', color: '#000000' }}>Tel: {printConfig.storePhone}</div>}
              </div>

              {/* SOLID DIVIDER LINE */}
              <div style={{ borderTop: '1.5px solid #000000', margin: '12px 0' }} />

              {/* TRANSACTION METADATA */}
              <div style={{ fontSize: '1.05em', margin: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Sale No:</span>
                  <strong style={{ fontWeight: '800' }}>{lastInvoice.sale_no}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Date:</span>
                  <strong style={{ fontWeight: '800' }}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Cashier:</span>
                  <strong style={{ fontWeight: '800' }}>{lastInvoice.cashier_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Customer:</span>
                  <strong style={{ fontWeight: '800' }}>{lastInvoice.customer_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>Payment:</span>
                  <strong style={{ fontWeight: '800' }}>{lastInvoice.payment_method}</strong>
                </div>
              </div>

              {/* SOLID DIVIDER LINE */}
              <div style={{ borderTop: '1.5px solid #000000', margin: '12px 0' }} />

              {/* ITEMS TABLE HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.1em', letterSpacing: '0.5px', marginBottom: 6 }}>
                <span>ITEMS</span>
                <span>AMOUNT</span>
              </div>

              {/* ITEMS ROWS */}
              <div style={{ margin: '6px 0' }}>
                {lastInvoice.items.map((item) => (
                  <div key={`${lastInvoice.sale_no}-${item.product_id}`} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: '800', fontSize: '1.1em', wordBreak: 'break-word' }}>
                      {item.product_name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1em', marginTop: 2 }}>
                      <span>{item.quantity} x {formatMoney(item.unit_price)}</span>
                      <strong style={{ fontWeight: '800' }}>{formatMoney(item.line_total)}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* SOLID DIVIDER LINE */}
              <div style={{ borderTop: '1.5px solid #000000', margin: '12px 0' }} />

              {/* FINANCIAL SUMMARY */}
              <div style={{ fontSize: '1.05em', margin: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Subtotal:</span>
                  <span>{formatMoney(lastInvoice.subtotal)}</span>
                </div>
                {lastInvoice.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Discount:</span>
                    <span>-{formatMoney(lastInvoice.discount_amount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Tax:</span>
                  <span>{formatMoney(lastInvoice.tax_amount)}</span>
                </div>
              </div>

              {/* SOLID DIVIDER LINE */}
              <div style={{ borderTop: '1.5px solid #000000', margin: '12px 0' }} />

              {/* GRAND TOTAL ROW */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.25em',
                  fontWeight: '800',
                  margin: '8px 0',
                }}
              >
                <span>TOTAL AMOUNT:</span>
                <span>{formatMoney(lastInvoice.total_amount)}</span>
              </div>

              {/* SOLID DIVIDER LINE */}
              <div style={{ borderTop: '1.5px solid #000000', margin: '12px 0' }} />

              {/* PAID AND CHANGE */}
              <div style={{ fontSize: '1.05em', margin: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Amount Paid:</span>
                  <span>{formatMoney(lastInvoice.paid_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', fontWeight: '800' }}>
                  <span>{lastInvoice.payment_method === 'Credit' ? 'Credit Balance:' : 'Change Due:'}</span>
                  <span>
                    {formatMoney(lastInvoice.payment_method === 'Credit' ? lastInvoice.credit_amount : lastInvoice.change_amount)}
                  </span>
                </div>
              </div>

              {/* FOOTER */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <div style={{ fontWeight: '800', fontSize: '1.1em', marginBottom: 6 }}>{printConfig.footerText}</div>
                <div style={{ fontSize: '0.85em', opacity: 0.85 }}>*** POWERED BY NOVA POS ***</div>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                style={{ ...styles.invoiceReturnBtn, flex: 1, background: '#534AB7', color: '#ffffff' }}
                onClick={() => window.print()}
              >
                <i className="ti ti-printer" aria-hidden="true" /> Re-print
              </button>
              <button
                type="button"
                style={{ ...styles.invoiceReturnBtn, flex: 1, background: '#0D9488', color: '#ffffff' }}
                onClick={downloadReceiptPdf}
              >
                <i className="ti ti-file-text" aria-hidden="true" /> Download PDF
              </button>
              <button style={{ ...styles.invoiceReturnBtn, flex: 1 }} onClick={returnToTerminal}>
                Return to POS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weighted Item Scale Entry Modal */}
      {weightedProduct && (
        <div style={themed(styles.modalOverlay, styles.modalOverlayLight)} role="dialog" aria-modal="true">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const weightVal = parseFloat(weightInput);
              if (weightVal > 0 && weightVal <= weightedProduct.stock) {
                addToCart(weightedProduct, weightVal);
                setWeightedProduct(null);
              }
            }}
            style={{
              ...themed(styles.invoicePopup, styles.invoicePopupLight),
              maxWidth: 480,
              borderRadius: 16,
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
              border: '2px solid var(--app-accent, #534AB7)',
            }}
          >
            <div style={{ ...themed(styles.invoiceHeader, styles.invoiceHeaderLight), borderRadius: '14px 14px 0 0' }}>
              <div>
                <span style={themed(styles.invoiceKicker, styles.invoiceKickerLight)}>Scale Weight Input</span>
                <h2 style={themed(styles.invoiceTitle, styles.textLight)}>{weightedProduct.name}</h2>
              </div>
              <button type="button" style={styles.posModalCloseBtn} onClick={() => setWeightedProduct(null)} aria-label="Close modal">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--app-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Unit Price: <b>{formatMoney(weightedProduct.price)} / {weightedProduct.unit_name || weightedProduct.unit || 'kg'}</b></span>
                <span>In Stock: <b>{weightedProduct.stock.toFixed(3)} {weightedProduct.unit_name || weightedProduct.unit || 'kg'}</b></span>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Enter weight in {weightedProduct.unit_name || weightedProduct.unit || 'kg'} (Press Enter to submit):</span>
                <input
                  ref={weightInputRef}
                  type="number"
                  step="0.001"
                  min="0.001"
                  autoFocus
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const weightVal = parseFloat(weightInput);
                      if (weightVal > 0 && weightVal <= weightedProduct.stock) {
                        addToCart(weightedProduct, weightVal);
                        setWeightedProduct(null);
                      }
                    }
                  }}
                  style={{
                    padding: '12px 16px',
                    fontSize: 24,
                    fontWeight: 800,
                    borderRadius: 8,
                    border: '2px solid #534AB7',
                    background: 'var(--app-surface)',
                    color: 'var(--app-text)',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(83, 74, 183, 0.25)',
                  }}
                />
              </label>

              {parseFloat(weightInput) > weightedProduct.stock && (
                <div style={{ padding: '8px 12px', borderRadius: 6, background: '#FEE2E2', border: '1px solid #EF4444', color: '#991B1B', fontSize: 12, fontWeight: 600 }}>
                  <i className="ti ti-alert-triangle" aria-hidden="true" /> Insufficient stock. Max available: {weightedProduct.stock.toFixed(3)} {weightedProduct.unit_name || weightedProduct.unit || 'kg'}
                </div>
              )}

              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-surface-soft)',
                  color: 'var(--app-accent-strong)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setIsReadingScale(true);
                  setTimeout(() => {
                    const mockWeight = (Math.random() * (weightedProduct.stock > 2 ? 1.8 : weightedProduct.stock) + 0.25).toFixed(3);
                    setWeightInput(mockWeight);
                    setIsReadingScale(false);
                    setLastAction(`Live Scale Hardware Reading: ${mockWeight} kg`);
                  }, 500);
                }}
              >
                <i className={`ti ${isReadingScale ? 'ti-loader-2 ti-spin' : 'ti-scale'}`} aria-hidden="true" />
                {isReadingScale ? 'Reading Weighing Scale...' : 'Read Electronic Scale (RS-232 / BT)'}
              </button>

              <div style={{ padding: 12, borderRadius: 8, background: 'var(--app-surface-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Calculated Line Total:</span>
                <strong style={{ fontSize: 20, color: 'var(--app-accent-strong)' }}>
                  {formatMoney(weightedProduct.price * (parseFloat(weightInput) || 0))}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" style={{ ...styles.invoiceReturnBtn, flex: 1 }} onClick={() => setWeightedProduct(null)}>
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  ...styles.invoiceReturnBtn,
                  flex: 1,
                  background: '#534AB7',
                  color: '#ffffff',
                  opacity: parseFloat(weightInput) > weightedProduct.stock || parseFloat(weightInput) <= 0 ? 0.5 : 1,
                  cursor: parseFloat(weightInput) > weightedProduct.stock || parseFloat(weightInput) <= 0 ? 'not-allowed' : 'pointer',
                }}
                disabled={parseFloat(weightInput) > weightedProduct.stock || parseFloat(weightInput) <= 0}
              >
                ADD TO CART ↵
              </button>
            </div>
          </form>
        </div>
      )}

      {variantModalProduct && (
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
            if (e.target === e.currentTarget) setVariantModalProduct(null);
          }}
        >
          <div
            style={{
              width: 520,
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
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong, #101828)' }}>
                  Select Product Variant
                </h3>
                <p style={{ fontSize: 13, color: 'var(--app-muted, #667085)', marginTop: 2 }}>
                  {variantModalProduct.name} ({variantModalProduct.sku})
                </p>
              </div>
              <button
                type="button"
                style={styles.iconBtn}
                onClick={() => setVariantModalProduct(null)}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
              {productVariants
                .filter((v) => v.product_id === variantModalProduct.id)
                .map((variant) => (
                  <div
                    key={variant.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: '1px solid var(--app-border, #d0d5dd)',
                      background: 'var(--app-surface-soft, #f9fafb)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 15, color: 'var(--app-text-strong, #101828)' }}>
                        {variant.variant_name}
                      </strong>
                      <div style={{ fontSize: 12, color: 'var(--app-muted, #667085)', marginTop: 2 }}>
                        Barcode: {variant.barcode || 'N/A'} • Stock: {variant.stock_quantity}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <strong style={{ fontSize: 16, color: '#27AE4F' }}>
                        {formatMoney(variant.selling_price || variantModalProduct.price)}
                      </strong>
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 700,
                          background: 'var(--app-accent, #27AE4F)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onClick={() => {
                          const variantProduct: PosProduct = {
                            ...variantModalProduct,
                            id: variantModalProduct.id * 100000 + variant.id,
                            name: `${variantModalProduct.name} (${variant.variant_name})`,
                            price: variant.selling_price || variantModalProduct.price,
                            barcode: variant.barcode || variantModalProduct.barcode,
                            stock: variant.stock_quantity,
                          };
                          addToCart(variantProduct);
                          setVariantModalProduct(null);
                        }}
                      >
                        <i className="ti ti-shopping-cart-plus" aria-hidden="true" /> Add
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      {showStartSessionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 11000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <form
            onSubmit={handleStartShift}
            style={{
              width: 480,
              maxWidth: '100%',
              background: isLightMode ? '#ffffff' : '#18181B',
              color: isLightMode ? '#09090B' : '#FAFAFA',
              border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.65)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  background: isLightMode ? '#F4F4F5' : '#27272A',
                  border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                  color: isLightMode ? '#09090B' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                <i className="ti ti-cash-banknote" aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: isLightMode ? '#09090B' : '#FAFAFA', margin: 0 }}>
                  Start Daily Shift & Cash Float
                </h3>
                <p style={{ fontSize: 12, color: isLightMode ? '#71717A' : '#A1A1AA', margin: 0, marginTop: 2 }}>
                  Enter opening cash float added to register drawer for today.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#09090B' : '#FAFAFA' }}>
                    Opening Cash Float (LKR) *
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isLightMode ? '#09090B' : '#FAFAFA', background: isLightMode ? '#F4F4F5' : '#27272A', border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', padding: '2px 8px', borderRadius: 6 }}>
                    Drawer Ready
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  required
                  autoFocus
                  style={{
                    border: isLightMode ? '2px solid #09090B' : '2px solid #FFFFFF',
                    borderRadius: 8,
                    padding: '12px 14px',
                    fontSize: 22,
                    fontWeight: 900,
                    background: isLightMode ? '#ffffff' : '#09090B',
                    color: isLightMode ? '#09090B' : '#FFFFFF',
                    outline: 'none',
                  }}
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  placeholder="5000"
                />
              </label>

              {/* Quick Float Amount Preset Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[2000, 5000, 10000, 15000, 20000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    style={{
                      border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      background: Number(openingCashInput) === preset ? (isLightMode ? '#09090B' : '#FFFFFF') : (isLightMode ? '#F4F4F5' : '#27272A'),
                      color: Number(openingCashInput) === preset ? (isLightMode ? '#FFFFFF' : '#000000') : (isLightMode ? '#09090B' : '#D4D4D8'),
                      cursor: 'pointer',
                    }}
                    onClick={() => setOpeningCashInput(String(preset))}
                  >
                    +LKR {preset.toLocaleString()}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#71717A' : '#A1A1AA' }}>Register Terminal</span>
                  <select
                    style={{
                      border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                      borderRadius: 8,
                      padding: '9px 10px',
                      fontSize: 13,
                      fontWeight: 700,
                      background: isLightMode ? '#ffffff' : '#09090B',
                      color: isLightMode ? '#09090B' : '#FAFAFA',
                    }}
                    value={shiftRegisterNo}
                    onChange={(e) => setShiftRegisterNo(e.target.value)}
                  >
                    <option value="Register 01">Register 01 (Main)</option>
                    <option value="Register 02">Register 02 (Express)</option>
                    <option value="Register 03">Register 03 (Drive-Thru)</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#71717A' : '#A1A1AA' }}>Shift Schedule</span>
                  <select
                    style={{
                      border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                      borderRadius: 8,
                      padding: '9px 10px',
                      fontSize: 13,
                      fontWeight: 700,
                      background: isLightMode ? '#ffffff' : '#09090B',
                      color: isLightMode ? '#09090B' : '#FAFAFA',
                    }}
                    value={shiftCode}
                    onChange={(e) => setShiftCode(e.target.value)}
                  >
                    <option value="Shift A">Shift A (Morning)</option>
                    <option value="Shift B">Shift B (Evening)</option>
                    <option value="Shift C">Shift C (Night)</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#71717A' : '#A1A1AA' }}>Opening Remarks (Optional)</span>
                <input
                  type="text"
                  style={{
                    border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13,
                    background: isLightMode ? '#ffffff' : '#09090B',
                    color: isLightMode ? '#09090B' : '#FAFAFA',
                  }}
                  value={openingNotesInput}
                  onChange={(e) => setOpeningNotesInput(e.target.value)}
                  placeholder="e.g. Note denominations verified by Cashier"
                />
              </label>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: 'none',
                background: isLightMode ? '#09090B' : '#FFFFFF',
                color: isLightMode ? '#FFFFFF' : '#000000',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              <i className="ti ti-lock-open" style={{ fontSize: 18 }} aria-hidden="true" /> Open Cash Drawer & Start Shift
            </button>
          </form>
        </div>
      )}

      {showDrawerDetailsModal && activeSession && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDrawerDetailsModal(false);
          }}
        >
          <div
            style={{
              width: 960,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              background: isLightMode ? '#ffffff' : '#18181B',
              color: isLightMode ? '#09090B' : '#FAFAFA',
              border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.65)',
            }}
          >
            {/* Top Modal Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLightMode ? '1px solid #E4E4E7' : '1px solid #27272A', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 8,
                    background: isLightMode ? '#F4F4F5' : '#27272A',
                    border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                    color: isLightMode ? '#09090B' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="ti ti-cash-register" aria-hidden="true" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: isLightMode ? '#09090B' : '#FAFAFA', margin: 0 }}>
                      Cash Drawer & Shift Dashboard
                    </h3>
                    <span style={{ fontSize: 11, fontWeight: 800, background: isLightMode ? '#F4F4F5' : '#27272A', color: '#22C55E', padding: '2px 8px', borderRadius: 12, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46' }}>
                      🟢 SHIFT ACTIVE
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: isLightMode ? '#71717A' : '#A1A1AA', marginTop: 2, margin: 0 }}>
                    Cashier: <strong>{activeSession.cashierName}</strong> • Terminal: <strong>{activeSession.registerNo}</strong> ({activeSession.shiftCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                  background: isLightMode ? '#F4F4F5' : '#27272A',
                  color: isLightMode ? '#71717A' : '#A1A1AA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setShowDrawerDetailsModal(false)}
              >
                <i className="ti ti-x" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>

            {/* Left to Right Split-Screen Layout Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, alignItems: 'start' }}>
              {/* LEFT COLUMN: Summary Metrics & Control Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Expected Cash Hero Banner - Monochrome Minimalist Black Style */}
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 10,
                    background: '#09090B',
                    color: '#ffffff',
                    border: '1px solid #3F3F46',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Expected Cash in Drawer
                    </span>
                    <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2, color: '#FFFFFF' }}>
                      {formatMoney(expectedCashInDrawer)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, background: '#27272A', border: '1px solid #3F3F46', padding: '3px 8px', borderRadius: 6, color: '#FAFAFA' }}>
                      Card: <b>{formatMoney(totalCardSalesToday)}</b>
                    </div>
                    <div style={{ fontSize: 11, background: '#27272A', border: '1px solid #3F3F46', padding: '3px 8px', borderRadius: 6, color: '#FAFAFA' }}>
                      Credit: <b>{formatMoney(totalCreditSalesToday)}</b>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: isLightMode ? '#F4F4F5' : '#27272A', border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: isLightMode ? '#71717A' : '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opening Cash Float</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isLightMode ? '#09090B' : '#FFFFFF', marginTop: 2 }}>{formatMoney(openingFloat)}</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 8, background: isLightMode ? '#F4F4F5' : '#27272A', border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash Collected Today</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#22C55E', marginTop: 2 }}>+{formatMoney(totalCashSalesToday)}</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 8, background: isLightMode ? '#F4F4F5' : '#27272A', border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid In / Refills</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#22C55E', marginTop: 2 }}>+{formatMoney(paidInTotal)}</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 8, background: isLightMode ? '#F4F4F5' : '#27272A', border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid Out / Expenses</span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>-{formatMoney(paidOutTotal)}</div>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: isLightMode ? '#71717A' : '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick Drawer Operations</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <button
                      type="button"
                      style={{
                        padding: '10px 8px',
                        borderRadius: 6,
                        border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                        background: cashDrawerActionType === 'paid_in' ? (isLightMode ? '#09090B' : '#FFFFFF') : (isLightMode ? '#F4F4F5' : '#27272A'),
                        color: cashDrawerActionType === 'paid_in' ? (isLightMode ? '#FFFFFF' : '#000000') : '#22C55E',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      onClick={() => setCashDrawerActionType('paid_in')}
                    >
                      <i className="ti ti-plus" aria-hidden="true" /> Paid In
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '10px 8px',
                        borderRadius: 6,
                        border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                        background: cashDrawerActionType === 'paid_out' ? (isLightMode ? '#09090B' : '#FFFFFF') : (isLightMode ? '#F4F4F5' : '#27272A'),
                        color: cashDrawerActionType === 'paid_out' ? (isLightMode ? '#FFFFFF' : '#000000') : '#EAB308',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      onClick={() => setCashDrawerActionType('paid_out')}
                    >
                      <i className="ti ti-minus" aria-hidden="true" /> Paid Out
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '10px 8px',
                        borderRadius: 6,
                        border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                        background: cashDrawerActionType === 'cash_log' ? (isLightMode ? '#09090B' : '#FFFFFF') : (isLightMode ? '#F4F4F5' : '#27272A'),
                        color: cashDrawerActionType === 'cash_log' ? (isLightMode ? '#FFFFFF' : '#000000') : (isLightMode ? '#09090B' : '#FAFAFA'),
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      onClick={() => setCashDrawerActionType('cash_log')}
                    >
                      <i className="ti ti-history" aria-hidden="true" /> Audit Log
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      style={{
                        padding: '10px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: isLightMode ? '#09090B' : '#FFFFFF',
                        color: isLightMode ? '#FFFFFF' : '#000000',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      onClick={handleKickDrawer}
                      title="Send hardware pulse signal to pop open cash drawer"
                    >
                      <i className="ti ti-lock-open" aria-hidden="true" /> Kick Drawer
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '10px 10px',
                        borderRadius: 6,
                        border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                        background: isLightMode ? '#F4F4F5' : '#27272A',
                        color: isLightMode ? '#09090B' : '#FAFAFA',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      onClick={handlePrintZReport}
                      title="Print shift summary Z-Report receipt"
                    >
                      <i className="ti ti-printer" aria-hidden="true" /> Z-Report
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '10px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#EF4444',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                      onClick={() => setCashDrawerActionType('close_shift')}
                    >
                      <i className="ti ti-lock" aria-hidden="true" /> Close Shift
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Audit Logs / Paid In-Out Form / Close Shift Reconcile Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(cashDrawerActionType === 'none' || cashDrawerActionType === 'cash_log') && (
                  <div style={{ padding: 14, borderRadius: 8, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#F4F4F5' : '#27272A', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 370, minHeight: 300 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: isLightMode ? '#09090B' : '#FAFAFA' }}>
                        📥 Cash Drawer Audit Log History
                      </span>
                      {cashDrawerActionType === 'cash_log' && (
                        <button type="button" style={{ padding: '3px 8px', borderRadius: 6, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => setCashDrawerActionType('none')}>Back</button>
                      )}
                    </div>
                    {!activeSession.cashLogs || activeSession.cashLogs.length === 0 ? (
                      <div style={{ fontSize: 13, color: isLightMode ? '#71717A' : '#A1A1AA', padding: '20px 0', textAlign: 'center' }}>
                        No drawer log entries recorded for this session.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', paddingRight: 4 }}>
                        {activeSession.cashLogs.map((log) => (
                          <div
                            key={log.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 6,
                              background: isLightMode ? '#ffffff' : '#09090B',
                              border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: isLightMode ? '#09090B' : '#FAFAFA' }}>
                                {log.type === 'opening_float' && '📥 Opening Cash Float'}
                                {log.type === 'paid_in' && '➕ Paid In (Cash Refill)'}
                                {log.type === 'paid_out' && '➖ Paid Out (Expense)'}
                                {log.type === 'cash_sale' && '💵 Cash Sale Collected'}
                                {log.type === 'close_shift' && '🔒 Shift Closed'}
                                <span style={{ fontSize: 11, fontWeight: 400, color: isLightMode ? '#71717A' : '#A1A1AA', marginLeft: 8 }}>
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {log.reason && <div style={{ fontSize: 11, color: isLightMode ? '#71717A' : '#A1A1AA', marginTop: 2 }}>{log.reason}</div>}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: log.type === 'paid_out' ? '#EF4444' : '#22C55E' }}>
                              {log.type === 'paid_out' ? '-' : '+'}{formatMoney(log.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(cashDrawerActionType === 'paid_in' || cashDrawerActionType === 'paid_out') && (
                  <form onSubmit={handleDrawerPaidInOut} style={{ padding: 14, borderRadius: 8, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#F4F4F5' : '#27272A', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: isLightMode ? '#09090B' : '#FAFAFA' }}>
                      {cashDrawerActionType === 'paid_in' ? '➕ Paid In (Add Cash Float)' : '➖ Paid Out (Remove Cash for Expense)'}
                    </div>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#71717A' : '#A1A1AA' }}>Amount (LKR) *</span>
                      <input
                        type="number"
                        min="1"
                        required
                        autoFocus
                        placeholder="Enter amount..."
                        style={{ border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', borderRadius: 6, padding: '10px 12px', fontSize: 16, fontWeight: 800, background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA' }}
                        value={cashDrawerActionAmount}
                        onChange={(e) => setCashDrawerActionAmount(e.target.value)}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#71717A' : '#A1A1AA' }}>Reason / Description *</span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Petty cash refill for store expenses"
                        style={{ border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', borderRadius: 6, padding: '9px 12px', fontSize: 13, background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA' }}
                        value={cashDrawerActionReason}
                        onChange={(e) => setCashDrawerActionReason(e.target.value)}
                      />
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                      <button type="button" style={{ padding: '8px 14px', borderRadius: 6, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => setCashDrawerActionType('none')}>Cancel</button>
                      <button type="submit" style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: isLightMode ? '#09090B' : '#FFFFFF', color: isLightMode ? '#FFFFFF' : '#000000', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Save Transaction</button>
                    </div>
                  </form>
                )}

                {cashDrawerActionType === 'close_shift' && (
                  <form onSubmit={handleCloseShift} style={{ padding: 14, borderRadius: 8, border: '1px solid #EF4444', background: isLightMode ? 'rgba(239, 68, 68, 0.05)' : '#27272A', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>
                        Close Shift & Reconcile Cash
                      </div>
                      <button
                        type="button"
                        style={{ padding: '4px 10px', borderRadius: 6, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => setShowDenomCounter(!showDenomCounter)}
                      >
                        <i className="ti ti-calculator" aria-hidden="true" /> {showDenomCounter ? 'Hide Note Counter' : 'Use Note Counter'}
                      </button>
                    </div>

                    {showDenomCounter && (
                      <div style={{ padding: 10, borderRadius: 6, background: isLightMode ? '#ffffff' : '#09090B', border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {[5000, 2000, 1000, 500, 100, 50, 20, 10].map((noteVal) => (
                          <label key={noteVal} style={{ display: 'grid', gap: 2, fontSize: 11, fontWeight: 700, color: isLightMode ? '#09090B' : '#FAFAFA' }}>
                            <span>LKR {noteVal}:</span>
                            <input
                              type="number"
                              min="0"
                              style={{ border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', borderRadius: 4, padding: '4px 6px', fontSize: 12, fontWeight: 700, background: isLightMode ? '#ffffff' : '#18181B', color: isLightMode ? '#09090B' : '#FAFAFA' }}
                              value={denomCounts[noteVal] || ''}
                              onChange={(e) => updateDenomCount(noteVal, Number(e.target.value))}
                              placeholder="0"
                            />
                          </label>
                        ))}
                        <div style={{ gridColumn: 'span 4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <button type="button" style={{ padding: '3px 8px', borderRadius: 4, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#F4F4F5' : '#27272A', color: isLightMode ? '#09090B' : '#FAFAFA', fontSize: 11, cursor: 'pointer' }} onClick={resetDenomCounts}>Reset Counter</button>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#22C55E' }}>
                            Calculated: {formatMoney(Object.entries(denomCounts).reduce((acc, [val, qty]) => acc + Number(val) * (Number(qty) || 0), 0))}
                          </span>
                        </div>
                      </div>
                    )}

                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isLightMode ? '#09090B' : '#FAFAFA' }}>Actual Counted Cash in Drawer (LKR) *</span>
                      <input
                        type="number"
                        min="0"
                        required
                        autoFocus
                        placeholder="Enter cash count..."
                        style={{ border: '1.5px solid #EF4444', borderRadius: 6, padding: '10px 12px', fontSize: 18, fontWeight: 800, background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA' }}
                        value={cashCountInput}
                        onChange={(e) => setCashCountInput(e.target.value)}
                      />
                    </label>
                    {cashCountInput !== '' && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: Number(cashCountInput) - expectedCashInDrawer === 0 ? '#22C55E' : '#EF4444' }}>
                        Cash Discrepancy: {
                          Number(cashCountInput) - expectedCashInDrawer === 0
                            ? 'Exact Match (LKR 0.00)'
                            : `${Number(cashCountInput) - expectedCashInDrawer > 0 ? 'Over +' : 'Short '}${formatMoney(Number(cashCountInput) - expectedCashInDrawer)}`
                        }
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <button type="button" style={{ padding: '8px 12px', borderRadius: 6, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={handlePrintZReport} title="Print Z-Report shift summary receipt">
                        <i className="ti ti-printer" aria-hidden="true" /> Z-Report
                      </button>
                      <button type="button" style={{ padding: '8px 12px', borderRadius: 6, border: isLightMode ? '1px solid #E4E4E7' : '1px solid #3F3F46', background: isLightMode ? '#ffffff' : '#09090B', color: isLightMode ? '#09090B' : '#FAFAFA', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={() => setCashDrawerActionType('none')}>Cancel</button>
                      <button type="submit" style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Confirm & Close Shift</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  registerShell: {
    flex: 1,
    minHeight: '100vh',
    padding: 12,
    background: '#2B2B2B',
    color: '#F5F5F5',
    display: 'grid',
    gridTemplateRows: '86px minmax(0, 1fr) 164px',
    gap: 12,
    overflow: 'hidden',
  },
  registerTopBar: {
    display: 'grid',
    gridTemplateColumns: '128px minmax(0, 1fr) 86px',
    gap: 12,
    alignItems: 'center',
  },
  registerLogo: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 12px',
    fontSize: 13,
    lineHeight: 1.05,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#18C08F',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
  },
  registerSearchWrap: {
    height: 58,
    borderRadius: 4,
    border: '2px solid #C9A23E',
    background: '#3A3A3A',
    boxShadow: '0 0 0 2px rgba(56,156,255,0.35)',
  },
  registerSearch: {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#FFFFFF',
    padding: '0 12px',
    fontSize: 22,
    fontFamily: 'inherit',
  },
  registerThemeSwitch: {
    height: 58,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    padding: 4,
    border: '1px solid #454545',
    borderRadius: 4,
    background: '#1B1B1B',
  },
  registerThemeBtn: {
    border: 'none',
    borderRadius: 4,
    background: '#2F2F2F',
    color: '#AFAFAF',
    cursor: 'pointer',
    fontSize: 16,
  },
  registerThemeBtnActive: {
    background: '#C9A23E',
    color: '#111111',
  },
  registerBody: {
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 520px',
    gap: 16,
  },
  registerWorkArea: {
    minHeight: 0,
    background: '#242424',
    border: '1px solid #303030',
    display: 'grid',
    gridTemplateRows: '46px minmax(0, 1fr)',
    overflow: 'hidden',
  },
  registerProductHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '0 12px',
    fontSize: 21,
    fontWeight: 800,
    color: '#FFFFFF',
    borderBottom: '1px solid #333333',
  },
  registerCategorySelect: {
    width: 180,
    height: 32,
    border: '1px solid #464646',
    borderRadius: 4,
    background: '#111111',
    color: '#FFFFFF',
    padding: '0 8px',
    fontFamily: 'inherit',
  },
  registerMessage: {
    margin: 10,
    padding: '9px 11px',
    borderRadius: 4,
    background: '#4A3D22',
    color: '#FFE8A3',
    fontSize: 13,
  },
  registerContent: {
    minHeight: 0,
    position: 'relative',
  },
  registerCartPanel: {
    height: '100%',
    overflowY: 'auto',
    padding: 12,
  },
  registerEmptyCart: {
    height: '100%',
    minHeight: 280,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 10,
    color: '#8F8F8F',
    fontSize: 15,
  },
  registerCartRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 118px 150px 34px',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    borderBottom: '1px solid #3C3C3C',
  },
  registerCartName: {
    minWidth: 0,
    display: 'grid',
    gap: 4,
    fontSize: 16,
  },
  registerQtyControl: {
    display: 'grid',
    gridTemplateColumns: '30px 44px 30px',
    gap: 4,
  },
  registerQtyBtn: {
    height: 30,
    border: '1px solid #555555',
    borderRadius: 4,
    background: '#111111',
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  registerQtyInput: {
    height: 30,
    border: '1px solid #555555',
    borderRadius: 4,
    background: '#303030',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'inherit',
  },
  registerLineTotal: {
    textAlign: 'right',
    fontSize: 16,
  },
  registerRemoveBtn: {
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 4,
    background: '#111111',
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  registerProductResults: {
    position: 'absolute',
    top: 0,
    left: 146,
    right: 0,
    maxHeight: 256,
    overflowY: 'auto',
    background: '#222222',
    borderLeft: '1px solid #333333',
    borderBottom: '1px solid #333333',
    zIndex: 2,
  },
  registerResultRow: {
    width: '100%',
    minHeight: 52,
    border: 'none',
    borderBottom: '1px solid #373737',
    background: '#242424',
    color: '#FFFFFF',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 140px',
    alignItems: 'center',
    gap: 12,
    padding: '0 14px',
    textAlign: 'left',
    fontSize: 16,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  registerResultRowActive: {
    background: '#2E2E2E',
  },
  registerSidePanel: {
    alignSelf: 'end',
    display: 'grid',
    gap: 6,
    paddingBottom: 66,
  },
  registerPayOption: {
    height: 68,
    border: '1px solid #111111',
    borderRadius: 5,
    background: '#020202',
    color: '#EDEDED',
    display: 'grid',
    gridTemplateColumns: '58px minmax(0, 1fr)',
    alignItems: 'center',
    padding: '0 22px',
    textAlign: 'left',
    fontSize: 18,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  registerBottomBar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(560px, 1fr) 380px 520px',
    gap: 16,
    alignItems: 'stretch',
  },
  registerActions: {
    display: 'grid',
    gridTemplateColumns: '160px 190px 300px',
    gap: 12,
  },
  registerRefundBtn: {
    border: 'none',
    borderRadius: 5,
    background: '#424242',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontSize: 18,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  registerVoidBtn: {
    border: 'none',
    borderRadius: 5,
    background: '#E10F0B',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontSize: 18,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  registerSaveBtn: {
    border: 'none',
    borderRadius: 5,
    background: '#087A10',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    fontSize: 18,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  registerTotals: {
    display: 'grid',
    alignContent: 'center',
    gap: 10,
    color: '#F4F4F4',
    fontSize: 18,
  },
  registerGrandTotal: {
    fontSize: 28,
  },
  registerPaymentBtn: {
    border: 'none',
    borderRadius: 4,
    background: '#2EA2EF',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    fontSize: 22,
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  registerPaymentBtnDisabled: {
    opacity: 0.62,
  },
  container: {
    padding: 20,
    overflowY: 'auto',
    flex: 1,
    background: '#202020',
    color: '#F5F5F5',
  },
  containerLight: {
    background: '#F4F6F8',
    color: '#1F2937',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: 0,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#B8B8B8',
    marginTop: 2,
  },
  pageSubtitleLight: {
    color: '#667085',
  },
  sessionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 11px',
    borderRadius: 999,
    background: '#DFF4E6',
    color: '#216338',
    fontSize: 12,
    fontWeight: 500,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  operatorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 11px',
    borderRadius: 999,
    background: '#333333',
    border: '1px solid #444444',
    color: '#F5F5F5',
    fontSize: 12,
    fontWeight: 500,
  },
  operatorBadgeLight: {
    background: '#FFFFFF',
    border: '1px solid #D9DEE7',
    color: '#344054',
  },
  themeToggle: {
    display: 'inline-flex',
    gap: 4,
    padding: 4,
    borderRadius: 8,
    background: '#333333',
    border: '1px solid #444444',
  },
  themeToggleLight: {
    background: '#FFFFFF',
    border: '1px solid #D9DEE7',
  },
  themeToggleButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    background: 'transparent',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  themeToggleButtonLight: {
    color: '#344054',
  },
  themeToggleButtonActive: {
    background: '#27AE4F',
    color: '#FFFFFF',
  },
  commandBar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 1fr) 100px 115px 120px',
    gap: 10,
    marginBottom: 16,
  },
  scanBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#303030',
    border: '1px solid #454545',
    borderRadius: 8,
    padding: '0 14px',
    minHeight: 48,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  scanIcon: {
    color: '#D8D8D8',
    fontSize: 20,
  },
  scanInput: {
    border: 'none',
    outline: 'none',
    width: '100%',
    fontSize: 14,
    fontFamily: 'inherit',
    background: 'transparent',
    color: '#FFFFFF',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: '#252525',
    border: '1px solid #454545',
    borderRadius: 10,
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
    zIndex: 1000,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 380,
  },
  dropdownContainerLight: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12)',
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#1F1F1F',
    borderBottom: '1px solid #383838',
    fontSize: 12,
    fontWeight: 600,
    color: '#94A3B8',
  },
  dropdownHeaderLight: {
    background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
    color: '#64748B',
  },
  dropdownShortcuts: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 400,
  },
  kbd: {
    background: '#334155',
    color: '#F8FAFC',
    borderRadius: 4,
    padding: '1px 5px',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  kbdLight: {
    background: '#E2E8F0',
    color: '#334155',
  },
  dropdownEmpty: {
    padding: '24px 16px',
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
  },
  dropdownEmptyLight: {
    color: '#64748B',
  },
  dropdownList: {
    overflowY: 'auto',
    maxHeight: 320,
    padding: '4px 0',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  dropdownItemActive: {
    background: '#383838',
  },
  dropdownItemActiveLight: {
    background: '#F1F5F9',
  },
  dropdownItemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
    marginRight: 12,
  },
  dropdownItemTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dropdownItemName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  dropdownCartBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    color: '#10B981',
    background: 'rgba(16, 185, 129, 0.12)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  dropdownItemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dropdownSkuTag: {
    fontSize: 11,
    fontWeight: 600,
    color: '#38BDF8',
    fontFamily: 'monospace',
    background: 'rgba(56, 189, 248, 0.1)',
    padding: '1px 6px',
    borderRadius: 4,
  },
  skuTagLight: {
    color: '#0284C7',
    background: 'rgba(2, 132, 199, 0.08)',
  },
  dropdownCategoryTag: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dropdownItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemPrice: {
    fontSize: 14,
    fontWeight: 700,
    color: '#27AE4F',
  },
  dropdownStockBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 4,
    display: 'inline-block',
  },
  dropdownAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid #484848',
    background: '#333333',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  dropdownAddBtnActive: {
    background: '#27AE4F',
    borderColor: '#27AE4F',
    color: '#FFFFFF',
  },
  dropdownAddBtnActiveLight: {
    background: '#27AE4F',
    borderColor: '#27AE4F',
    color: '#FFFFFF',
  },
  commandBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid #484848',
    borderRadius: 8,
    background: '#333333',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(450px, 1fr) 350px',
    gap: 16,
    alignItems: 'start',
  },
  catalog: {
    display: 'grid',
    gap: 12,
    background: '#2F2F2F',
    border: '1px solid #454545',
    borderRadius: 8,
    padding: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottom: '1px solid #444444',
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  columnSub: {
    fontSize: 12,
    color: '#BDBDBD',
    marginTop: 2,
  },
  columnIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: '#3A3A3A',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
  },
  toolbar: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#303030',
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    padding: '11px 13px',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  searchIcon: {
    color: '#D8D8D8',
    fontSize: 15,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
    background: 'transparent',
    color: '#FFFFFF',
  },
  select: {
    width: 170,
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    padding: '11px 10px',
    background: '#303030',
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  categoryTabs: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  tab: {
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    padding: '8px 13px',
    background: '#333333',
    color: '#FFFFFF',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: '#27AE4F',
    color: '#fff',
    borderColor: '#27AE4F',
    fontWeight: 500,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  metricTile: {
    background: '#333333',
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'grid',
    gap: 5,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  metricLabel: {
    fontSize: 11,
    color: '#BDBDBD',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  metricValue: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  productGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 12,
  },
  productTile: {
    minHeight: 154,
    background: '#353535',
    border: '1px solid #4B4B4B',
    borderRadius: 8,
    padding: 15,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
  },
  productTileSelected: {
    borderColor: '#27AE4F',
    boxShadow: '0 8px 18px rgba(39,174,79,0.18)',
  },
  productTileFocused: {
    borderColor: '#16834F',
    boxShadow: '0 0 0 3px rgba(22,131,79,0.16), 0 8px 18px rgba(15,23,42,0.08)',
  },
  productTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  productSku: {
    fontSize: 11,
    color: '#C8C8C8',
  },
  stockBadge: {
    fontSize: 11,
    color: '#176447',
    background: '#E5F7ED',
    borderRadius: 999,
    padding: '2px 7px',
    whiteSpace: 'nowrap',
  },
  productName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#FFFFFF',
    minHeight: 36,
  },
  productCategory: {
    fontSize: 12,
    color: '#C8C8C8',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  productFooter: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addHint: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#464646',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
  },
  selectedPanel: {
    background: '#2F2F2F',
    border: '1px solid #454545',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },
  selectedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid #444444',
    background: '#2A2A2A',
    color: '#fff',
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: '#FFFFFF',
  },
  selectedSub: {
    fontSize: 12,
    color: '#E7ECF3',
    marginTop: 2,
    fontWeight: 500,
  },
  checkout: {
    background: '#2F2F2F',
    border: '1px solid #454545',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    position: 'sticky',
    top: 0,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.28)',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
  },
  headerActionIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 1,
    display: 'block',
  },
  checkoutHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid #444444',
    background: '#2A2A2A',
    color: '#fff',
  },
  checkoutTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: '#FFFFFF',
  },
  checkoutSub: {
    fontSize: 12,
    color: '#E7ECF3',
    marginTop: 2,
    fontWeight: 500,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.14)',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    padding: 16,
  },
  orderField: {
    display: 'grid',
    gap: 6,
  },
  orderLabel: {
    fontSize: 11,
    color: '#BDBDBD',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  customerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 11px',
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    color: '#DADADA',
    background: '#303030',
  },
  customerInput: {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'transparent',
    color: '#FFFFFF',
  },
  noteInput: {
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    padding: '9px 11px',
    outline: 'none',
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#303030',
    color: '#FFFFFF',
  },
  tableContainer: {
    padding: '0 16px 16px',
    overflowX: 'auto',
  },
  tableContainerLight: {},
  cartTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'inherit',
  },
  cartTableHeaderRow: {
    background: '#222222',
    borderBottom: '1px solid #444444',
  },
  cartTableHeaderRowLight: {
    background: '#F1F5F9',
    borderBottom: '1px solid #E2E8F0',
  },
  thCell: {
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: '#E2E8F0',
    whiteSpace: 'nowrap',
  },
  cartTableRow: {
    borderBottom: '1px solid #383838',
    transition: 'background 0.15s ease',
  },
  cartTableRowLight: {
    borderBottom: '1px solid #E2E8F0',
  },
  tdNameCell: {
    padding: '12px 14px',
    fontSize: 14,
    color: '#FFFFFF',
    verticalAlign: 'middle',
  },
  productCellContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  productCellTitle: {
    fontSize: 14,
    fontWeight: 500,
  },
  productCellSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  tdCell: {
    padding: '12px 14px',
    verticalAlign: 'middle',
  },
  tdPriceCell: {
    padding: '12px 14px',
    fontSize: 14,
    textAlign: 'right',
    fontFamily: 'monospace',
    color: '#E2E8F0',
    verticalAlign: 'middle',
  },
  tdAmountCell: {
    padding: '12px 14px',
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'right',
    fontFamily: 'monospace',
    color: '#FFFFFF',
    verticalAlign: 'middle',
  },
  rowQuantityControl: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rowQtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    border: '1px solid #4B4B4B',
    background: '#3A3A3A',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 12,
  },
  rowQtyInput: {
    width: 44,
    height: 26,
    borderRadius: 5,
    border: '1px solid #4B4B4B',
    background: '#252525',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 600,
    outline: 'none',
  },
  rowRemoveBtn: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 4,
    fontSize: 15,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
    transition: 'opacity 0.15s ease',
  },
  emptyTableTd: {
    padding: '40px 16px',
    textAlign: 'center',
  },
  emptyCartBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  popupOverlayLight: {
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(5px)',
  },
  headerHeldBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 8,
    background: '#1E293B',
    border: '1px solid #334155',
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  headerHeldBadgeLight: {
    background: '#E0F2FE',
    border: '1px solid #BAE6FD',
    color: '#0284C7',
  },
  heldActiveBtn: {
    borderColor: '#38BDF8',
    color: '#38BDF8',
  },
  heldOrdersModal: {
    background: '#2F2F2F',
    border: '1px solid #454545',
    borderRadius: 12,
    width: '100%',
    maxWidth: 620,
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
  },
  heldOrdersModalLight: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
  },
  heldModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #444444',
    background: '#252525',
  },
  heldModalHeaderLight: {
    background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
  },
  heldModalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    margin: 0,
  },
  heldModalSub: {
    fontSize: 12,
    color: '#94A3B8',
    margin: '3px 0 0',
  },
  heldModalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
    fontSize: 18,
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heldOrdersList: {
    maxHeight: 460,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  heldCard: {
    background: '#242424',
    border: '1px solid #3D3D3D',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  heldCardLight: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
  },
  heldCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heldSaleNo: {
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#38BDF8',
    display: 'block',
  },
  heldCustomerTag: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  heldItemCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  heldItemsPreview: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 10px',
    background: '#1A1A1A',
    borderRadius: 6,
    maxHeight: 90,
    overflowY: 'auto',
  },
  heldItemsPreviewLight: {
    background: '#EEF2F6',
  },
  heldItemChip: {
    fontSize: 12,
    color: '#E2E8F0',
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  heldCardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  heldRecallBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#27AE4F',
    border: 'none',
    color: '#FFFFFF',
    padding: '7px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  heldDeleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid #EF4444',
    color: '#EF4444',
    padding: '7px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  discountRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    borderTop: '1px solid #444444',
  },
  quickDiscounts: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    padding: '0 16px 14px',
  },
  discountChip: {
    border: '1px solid #555555',
    borderRadius: 8,
    background: '#3A3A3A',
    padding: '8px 9px',
    color: '#FFFFFF',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  discountChipActive: {
    background: '#27AE4F',
    borderColor: '#27AE4F',
    color: '#FFFFFF',
    fontWeight: 500,
  },
  discountLabel: {
    fontSize: 13,
    color: '#DADADA',
  },
  discountInput: {
    width: 120,
    border: '1px solid #555555',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    textAlign: 'right',
    background: '#303030',
    color: '#FFFFFF',
  },
  paymentGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    padding: '0 16px 14px',
  },
  paidBlock: {
    display: 'grid',
    gap: 8,
    padding: '0 16px 14px',
  },
  paidInput: {
    border: '1px solid #555555',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'inherit',
    textAlign: 'right',
    background: '#303030',
    color: '#FFFFFF',
  },
  changeDue: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    background: '#3A3A3A',
    color: '#FFFFFF',
    fontSize: 13,
  },
  paymentBtn: {
    border: '1px solid #555555',
    borderRadius: 8,
    background: '#3A3A3A',
    color: '#FFFFFF',
    padding: '8px 10px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  paymentBtnActive: {
    background: '#27AE4F',
    color: '#fff',
    borderColor: '#27AE4F',
    fontWeight: 500,
  },
  totals: {
    display: 'grid',
    gap: 8,
    padding: '14px 16px',
    borderTop: '1px solid #444444',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#DADADA',
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #555555',
    paddingTop: 10,
    fontSize: 18,
  },
  actionMessage: {
    margin: '0 16px 14px',
    padding: '8px 10px',
    borderRadius: 8,
    background: '#3A3A3A',
    color: '#FFFFFF',
    fontSize: 12,
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr',
    gap: 10,
    padding: 16,
    borderTop: '1px solid #444444',
  },
  saleActivity: {
    display: 'grid',
    gap: 8,
    padding: '0 16px 16px',
  },
  saleActivityHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#DADADA',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  saleActivityList: {
    display: 'grid',
    gap: 6,
  },
  saleActivityRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    background: '#333333',
    color: '#FFFFFF',
    padding: '8px 10px',
    fontSize: 12,
  },
  heldOrderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    background: '#262626',
    color: '#FFFFFF',
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  saleActivityEmpty: {
    color: '#AFAFAF',
    fontSize: 12,
    padding: '6px 0',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: '1px solid #555555',
    borderRadius: 10,
    background: '#3A3A3A',
    color: '#FFFFFF',
    padding: '14px 10px',
    minHeight: 52,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 10,
    background: '#27AE4F',
    color: '#fff',
    padding: '14px 20px',
    minHeight: 52,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 6px 18px rgba(39, 174, 79, 0.35)',
    transition: 'all 0.15s ease',
  },
  primaryBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  keyHint: {
    marginLeft: 3,
    padding: '2px 6px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.18)',
    fontSize: 11,
    fontWeight: 600,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(10, 15, 26, 0.78)',
    backdropFilter: 'blur(10px)',
  },
  modalOverlayLight: {
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(10px)',
  },
  paymentScreenModal: {
    width: '100%',
    maxWidth: 1140,
    maxHeight: '92vh',
    height: 760,
    background: '#1A1E24',
    borderRadius: 16,
    border: '1px solid #333D4B',
    boxShadow: '0 30px 90px -20px rgba(0, 0, 0, 0.65)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: '#FFFFFF',
  },
  paymentScreenModalLight: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#1F2937',
    boxShadow: '0 25px 70px -15px rgba(15, 23, 42, 0.18)',
  },
  posModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 22px',
    background: '#14181F',
    borderBottom: '1px solid #2D3748',
  },
  posModalHeaderLight: {
    background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
  },
  posModalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'rgba(39, 174, 79, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posModalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
  },
  posModalItemCountBadge: {
    background: 'rgba(39, 174, 79, 0.16)',
    color: '#27AE4F',
    padding: '2px 8px',
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 11,
  },
  posModalCloseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid rgba(239, 68, 68, 0.3)',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  escBadge: {
    background: 'rgba(239, 68, 68, 0.2)',
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 800,
  },
  posModalBodyGrid: {
    display: 'grid',
    gridTemplateColumns: '380px minmax(0, 1fr)',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  posModalCartPanel: {
    background: '#14181F',
    borderRight: '1px solid #2D3748',
    display: 'flex',
    flexDirection: 'column',
    padding: 18,
    gap: 14,
    minHeight: 0,
  },
  posModalCartPanelLight: {
    background: '#F8FAFC',
    borderRight: '1px solid #E2E8F0',
  },
  posCartPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  posCartPanelTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
  },
  customerNameBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--app-text)',
  },
  posCartItemsScroll: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingRight: 4,
  },
  posCartItemCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    background: '#1E242C',
    border: '1px solid #2A323D',
  },
  posCartItemCardLight: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
  },
  posCartItemTitle: {
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  posCartItemQtyPrice: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  qtyChip: {
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'rgba(39, 174, 79, 0.15)',
    color: '#27AE4F',
  },
  posCartTotalsCard: {
    padding: 14,
    borderRadius: 10,
    background: '#1E242C',
    border: '1px solid #2A323D',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  posCartTotalsCardLight: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
  },
  posCartTotalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    opacity: 0.85,
  },
  posCartGrandTotalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTop: '1px solid rgba(255,255,255,0.1)',
    fontWeight: 800,
    fontSize: 15,
  },
  posModalPaymentPanel: {
    background: '#1A1E24',
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflowY: 'auto',
    minHeight: 0,
  },
  posModalPaymentPanelLight: {
    background: '#FFFFFF',
  },
  posMethodTabsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  posMethodTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #333D4B',
    background: '#242A34',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  posMethodTabBtnLight: {
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    color: '#334155',
  },
  posMethodTabBtnActive: {
    background: '#27AE4F',
    borderColor: '#27AE4F',
    color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(39, 174, 79, 0.3)',
  },
  quickCashRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickCashBtn: {
    flex: 1,
    minWidth: 80,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #333D4B',
    background: '#242A34',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
  },
  quickCashBtnActive: {
    background: '#38BDF8',
    borderColor: '#38BDF8',
    color: '#0F172A',
    fontWeight: 800,
  },
  posReadoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  posReadoutCard: {
    padding: 14,
    borderRadius: 10,
    background: '#242A34',
    border: '1px solid #333D4B',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  posReadoutCardLight: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
  },
  posReadoutLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.7,
    alignSelf: 'flex-start',
  },
  posTenderInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    textAlign: 'right',
    fontSize: 24,
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  posTenderInputLight: {
    color: '#0F172A',
  },
  posTouchKeypadGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 140px',
    gap: 12,
    marginTop: 'auto',
  },
  keypadKeysBox: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  posTouchKeyBtn: {
    height: 58,
    borderRadius: 10,
    border: '1px solid #333D4B',
    background: '#242A34',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.1s ease',
  },
  posTouchKeyBtnLight: {
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    color: '#0F172A',
  },
  keypadActionsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  keypadClearBtn: {
    height: 48,
    borderRadius: 10,
    border: '1px solid rgba(239, 68, 68, 0.4)',
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  keypadBackBtn: {
    height: 48,
    borderRadius: 10,
    border: '1px solid rgba(245, 158, 11, 0.4)',
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posCompletePayBtn: {
    flex: 1,
    minHeight: 80,
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #27AE4F 0%, #16834F 100%)',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 8px 20px rgba(39, 174, 79, 0.35)',
    transition: 'all 0.15s ease',
  },
  posCompletePayBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  posCreditSelect: {
    height: 44,
    borderRadius: 8,
    border: '1px solid #333D4B',
    background: '#242A34',
    color: '#FFFFFF',
    padding: '0 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    width: '100%',
  },
  invoiceOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10001,
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: 'rgba(0,0,0,0.68)',
  },
  invoicePopup: {
    width: 620,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    background: '#2F2F2F',
    border: '1px solid #555555',
    borderRadius: 8,
    color: '#FFFFFF',
    boxShadow: '0 30px 90px rgba(0,0,0,0.38)',
  },
  invoicePopupLight: {
    background: '#FFFFFF',
    border: '1px solid #D0D5DD',
    color: '#1F2937',
  },
  invoiceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: 18,
    borderBottom: '1px solid #444444',
    background: '#292929',
  },
  invoiceHeaderLight: {
    background: '#F8FAFC',
    borderBottom: '1px solid #E4E7EC',
  },
  invoiceKicker: {
    display: 'block',
    color: '#7EE0A1',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  invoiceKickerLight: {
    color: '#16834F',
  },
  invoiceTitle: {
    margin: '4px 0 0',
    fontSize: 26,
    fontWeight: 800,
  },
  invoiceCloseBtn: {
    width: 38,
    height: 38,
    border: '1px solid rgba(255,255,255,0.28)',
    borderRadius: 8,
    background: '#E9252B',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  invoiceMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    padding: 18,
  },
  invoiceMetaBox: {
    display: 'grid',
    gap: 5,
    padding: 12,
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    background: '#383838',
    fontSize: 12,
  },
  invoiceMetaBoxLight: {
    background: '#F8FAFC',
    border: '1px solid #E4E7EC',
  },
  invoiceItems: {
    display: 'grid',
    gap: 6,
    padding: '0 18px 16px',
  },
  invoiceItemsHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 64px 120px',
    gap: 10,
    padding: '8px 10px',
    color: '#C8C8C8',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  invoiceItemsHeadLight: {
    color: '#667085',
  },
  invoiceItemRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 64px 120px',
    gap: 10,
    alignItems: 'center',
    padding: '10px',
    border: '1px solid #4A4A4A',
    borderRadius: 8,
    background: '#333333',
    fontSize: 13,
  },
  invoiceItemRowLight: {
    background: '#FFFFFF',
    border: '1px solid #E4E7EC',
  },
  invoiceTotals: {
    display: 'grid',
    gap: 8,
    padding: '0 18px 18px',
  },
  invoiceTotalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 14,
  },
  invoiceGrandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 10,
    borderTop: '1px solid #555555',
    fontSize: 20,
    fontWeight: 900,
  },
  invoiceReturnBtn: {
    width: 'calc(100% - 36px)',
    margin: '0 18px 18px',
    minHeight: 46,
    border: 'none',
    borderRadius: 8,
    background: '#16834F',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  creditModal: {
    width: 560,
    maxWidth: 'calc(100vw - 48px)',
    background: '#2F2F2F',
    border: '1px solid #454545',
    borderRadius: 10,
    color: '#FFFFFF',
    overflow: 'hidden',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
  },
  creditModalLight: {
    background: '#FFFFFF',
    border: '1px solid #D0D5DD',
    color: '#1F2937',
  },
  creditHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    background: '#2A2A2A',
    color: '#FFFFFF',
  },
  creditTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  creditSub: {
    fontSize: 12,
    color: '#E7ECF3',
    marginTop: 3,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.14)',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  creditBody: {
    display: 'grid',
    gap: 14,
    padding: 18,
  },
  creditField: {
    display: 'grid',
    gap: 7,
  },
  creditSelect: {
    border: '1px solid #555555',
    borderRadius: 8,
    background: '#303030',
    color: '#FFFFFF',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  creditStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  creditSplitGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
  },
  creditSplitBtn: {
    border: '1px solid #555555',
    borderRadius: 8,
    background: '#3A3A3A',
    color: '#FFFFFF',
    padding: '9px 8px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  creditStat: {
    display: 'grid',
    gap: 6,
    padding: 12,
    border: '1px solid #555555',
    borderRadius: 8,
    background: '#3A3A3A',
    fontSize: 12,
  },
  creditTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    border: '1px solid #555555',
    borderRadius: 8,
    background: '#3A3A3A',
    fontSize: 15,
  },
  creditWarning: {
    borderRadius: 8,
    padding: '10px 12px',
    background: '#4A2A2A',
    color: '#FFD3D3',
    fontSize: 12,
    fontWeight: 600,
  },
  modalActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr',
    gap: 10,
    padding: 18,
    borderTop: '1px solid #454545',
  },
  panelLight: {
    background: '#FFFFFF',
    border: '1px solid #D9DEE7',
    color: '#1F2937',
  },
  surfaceLight: {
    background: '#FFFFFF',
    border: '1px solid #E1E5EA',
    color: '#1F2937',
  },
  inputLight: {
    background: '#FFFFFF',
    border: '1px solid #D9DEE7',
    color: '#1F2937',
  },
  inputWrapLight: {
    background: '#FFFFFF',
    border: '1px solid #D9DEE7',
    color: '#667085',
  },
  buttonLight: {
    background: '#FFFFFF',
    border: '1px solid #D9DEE7',
    color: '#344054',
  },
  textLight: {
    color: '#1F2937',
  },
  mutedLight: {
    color: '#667085',
  },
  iconLight: {
    color: '#667085',
  },
  iconBoxLight: {
    background: '#F2F4F7',
    color: '#344054',
    border: '1px solid #E4E7EC',
  },
  borderLight: {
    borderBottom: '1px solid #E4E7EC',
  },
  productTileLight: {
    background: '#FFFFFF',
    border: '1px solid #E1E5EA',
    color: '#1F2937',
  },
};

export default PosSystem;
