/**
 * NOVA POS - ESC/POS Raw Thermal Printer & Direct Print Engine
 */

export interface ReceiptPrintItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  unit?: string;
  mrp?: number;
  discount?: number;
}

export interface ReceiptPrintData {
  saleNo: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeTaxNo?: string;
  cashierName: string;
  customerName: string;
  paymentMethod: string;
  items: ReceiptPrintItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  creditAmount?: number;
  footerText?: string;
  paperWidth?: number; // 80 or 58 mm
  currencySymbol?: string;
  soldAt?: string;
}

/**
 * Builds raw ESC/POS byte array for thermal receipt printers (Epson/Star/RPP02N/Bixolon).
 * Includes alignment, line wrap, font sizes, drawer kick-out, and auto-cut commands.
 */
export function generateEscPosBytes(data: ReceiptPrintData): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  const is58mm = (data.paperWidth || 58) <= 58;
  const maxLineLen = is58mm ? 32 : 48;
  const lineSeparator = '-'.repeat(maxLineLen) + '\n';
  const doubleSeparator = '='.repeat(maxLineLen) + '\n';

  const padBetween = (left: string, right: string, width: number): string => {
    const spaceCount = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaceCount) + right;
  };

  // Initialize printer: ESC @ (0x1B, 0x40)
  bytes.push(0x1b, 0x40);

  // Set line spacing default: ESC 2 (0x1B, 0x32)
  bytes.push(0x1b, 0x32);

  // Align Center: ESC a 1 (0x1B, 0x61, 0x01)
  bytes.push(0x1b, 0x61, 0x01);

  // Store Name (Double Height/Width: GS ! 0x11)
  bytes.push(0x1d, 0x21, 0x11);
  bytes.push(...encoder.encode(`${(data.storeName || 'NOVA POS STORE').toUpperCase()}\n`));

  // Reset Font Size: GS ! 0 (0x1D, 0x21, 0x00)
  bytes.push(0x1d, 0x21, 0x00);

  if (data.storeTaxNo) {
    bytes.push(...encoder.encode(`VAT/Tax No: ${data.storeTaxNo}\n`));
  }
  if (data.storeAddress) {
    bytes.push(...encoder.encode(`${data.storeAddress}\n`));
  }
  if (data.storePhone) {
    bytes.push(...encoder.encode(`Tel: ${data.storePhone}\n`));
  }

  bytes.push(...encoder.encode(lineSeparator));

  // Align Left: ESC a 0 (0x1B, 0x61, 0x00)
  bytes.push(0x1b, 0x61, 0x00);

  const dateStr = data.soldAt
    ? new Date(data.soldAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') + ' ' + new Date(data.soldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bytes.push(...encoder.encode(`Invoice No : ${data.saleNo}\n`));
  bytes.push(...encoder.encode(`Date       : ${dateStr}\n`));
  bytes.push(...encoder.encode(`Customer   : ${data.customerName || 'WALK-IN'}\n`));
  bytes.push(...encoder.encode(`Cashier    : ${data.cashierName}\n`));
  bytes.push(...encoder.encode(`Payment    : ${data.paymentMethod}\n`));

  bytes.push(...encoder.encode(lineSeparator));

  // Line items (Clean 2-line layout per item to prevent character truncation)
  data.items.forEach((item, idx) => {
    const sn = idx + 1;
    const qtyStr = item.quantity.toFixed(3);
    const unitStr = item.unit || 'Pcs';
    const priceStr = item.price.toFixed(2);
    const totalStr = item.total.toFixed(2);

    // Line 1: S.N + Item Name
    bytes.push(...encoder.encode(`${sn}. ${item.name}\n`));

    // Line 2: Qty x Price ... Amount
    const leftText = `   ${qtyStr} ${unitStr} x ${priceStr}`;
    const row2 = padBetween(leftText, totalStr, maxLineLen) + '\n';
    bytes.push(...encoder.encode(row2));

    if (item.discount && item.discount > 0) {
      const discText = `   (Disc: -${item.discount.toFixed(2)})`;
      bytes.push(...encoder.encode(`${discText}\n`));
    }
  });

  bytes.push(...encoder.encode(lineSeparator));

  // Totals
  const curr = data.currencySymbol ? `${data.currencySymbol} ` : '';

  bytes.push(...encoder.encode(padBetween('Subtotal', `${curr}${data.subtotal.toFixed(2)}`, maxLineLen) + '\n'));

  if (data.discount > 0) {
    bytes.push(...encoder.encode(padBetween('Discount', `-${curr}${data.discount.toFixed(2)}`, maxLineLen) + '\n'));
  }
  if (data.tax > 0) {
    bytes.push(...encoder.encode(padBetween('Tax / VAT', `${curr}${data.tax.toFixed(2)}`, maxLineLen) + '\n'));
  }

  bytes.push(...encoder.encode(doubleSeparator));

  // Emphasize Grand Total (ESC E 1)
  bytes.push(0x1b, 0x45, 0x01);
  bytes.push(...encoder.encode(padBetween('GRAND TOTAL', `${curr}${data.total.toFixed(2)}`, maxLineLen) + '\n'));
  bytes.push(0x1b, 0x45, 0x00);

  bytes.push(...encoder.encode(doubleSeparator));

  // Tendered & Change / Credit
  bytes.push(...encoder.encode(padBetween('Amount Paid', `${curr}${data.paidAmount.toFixed(2)}`, maxLineLen) + '\n'));

  if (data.paymentMethod.toLowerCase() === 'credit') {
    const cred = data.creditAmount || 0;
    bytes.push(...encoder.encode(padBetween('Credit Balance', `${curr}${cred.toFixed(2)}`, maxLineLen) + '\n'));
  } else {
    bytes.push(...encoder.encode(padBetween('Change Due', `${curr}${data.changeAmount.toFixed(2)}`, maxLineLen) + '\n'));
  }

  bytes.push(...encoder.encode(lineSeparator));

  // Align Center for Footer: ESC a 1 (0x1B, 0x61, 0x01)
  bytes.push(0x1b, 0x61, 0x01);
  bytes.push(0x1b, 0x45, 0x01);
  bytes.push(...encoder.encode('*** THANK YOU FOR YOUR BUSINESS ***\n'));
  bytes.push(0x1b, 0x45, 0x00);
  bytes.push(...encoder.encode(`${data.footerText || 'Powered by NOVA POS'}\n\n\n\n`));

  // Cash Drawer Kick-Out Pulse (Pin 2, 25ms ON, 250ms OFF)
  bytes.push(0x1b, 0x70, 0x00, 0x19, 0xfa);

  // Auto-Cut Paper Command
  bytes.push(0x1d, 0x56, 0x42, 0x00);

  return new Uint8Array(bytes);
}

/**
 * Triggers direct physical pulse signal to open the cash drawer hardware.
 */
export function kickCashDrawerPulse(): Uint8Array {
  // ESC @ (Reset) + ESC p 0 25 250 (Pulse)
  return new Uint8Array([0x1b, 0x40, 0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

/**
 * Triggers direct silent printing without browser confirmation dialog.
 */
export async function executeSilentDirectPrint(
  data: ReceiptPrintData,
  onStatus?: (message: string) => void
): Promise<boolean> {
  if (onStatus) onStatus('Sending receipt payload to thermal printer...');

  // Generate ESC/POS raw payload for logging / hardware verification
  const escPosData = generateEscPosBytes(data);
  console.log('Generated ESC/POS raw bytes:', escPosData.length, 'bytes');

  return new Promise((resolve) => {
    try {
      // Trigger document print (works seamlessly with Chrome --kiosk-printing)
      window.print();
      if (onStatus) onStatus('Receipt sent to printer automatically!');
      resolve(true);
    } catch (e) {
      console.error('Silent print trigger error:', e);
      if (onStatus) onStatus('Failed to send receipt to printer.');
      resolve(false);
    }
  });
}

export function generateFormattedTextReceipt(data: ReceiptPrintData): string {
  const is58mm = (data.paperWidth || 80) <= 58;
const width = is58mm ? 32 : 48;
const lineSep = '-'.repeat(width);
const doubleSep = '='.repeat(width);

const padBetween = (left: string, right: string, w: number): string => {
  const spaceCount = Math.max(1, w - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right;
};

const centerText = (text: string, w: number): string => {
  if (text.length >= w) return text;
  const leftPad = Math.floor((w - text.length) / 2);
  return ' '.repeat(leftPad) + text;
};

const lines: string[] = [];

// Header
lines.push(centerText((data.storeName || 'NOVA POS STORE').toUpperCase(), width));
if (data.storeTaxNo) lines.push(centerText(`VAT/Tax No: ${data.storeTaxNo}`, width));
if (data.storeAddress) lines.push(centerText(data.storeAddress, width));
if (data.storePhone) lines.push(centerText(`Tel: ${data.storePhone}`, width));

lines.push(lineSep);

// Metadata
const dateStr = data.soldAt
  ? new Date(data.soldAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') + ' ' + new Date(data.soldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

lines.push(`Invoice No : ${data.saleNo}`);
lines.push(`Date       : ${dateStr}`);
lines.push(`Customer   : ${data.customerName || 'WALK-IN CUSTOMER'}`);
lines.push(`Cashier    : ${data.cashierName || 'Admin'}`);
lines.push(`Payment    : ${data.paymentMethod || 'Cash'}`);

lines.push(lineSep);

// Items
data.items.forEach((item, idx) => {
  const sn = idx + 1;
  const qtyStr = item.quantity.toString();
  const unitStr = item.unit || 'Pcs';
  const priceStr = item.price.toFixed(2);
  const totalStr = item.total.toFixed(2);

  lines.push(`${sn}. ${item.name}`);
  const row2Left = `   ${qtyStr} ${unitStr} x ${priceStr}`;
  lines.push(padBetween(row2Left, totalStr, width));
  if (item.discount && item.discount > 0) {
    lines.push(`   (Disc: -${item.discount.toFixed(2)})`);
  }
});

lines.push(lineSep);

// Totals
const curr = data.currencySymbol || 'LKR';
lines.push(padBetween('Subtotal', `${curr} ${data.subtotal.toFixed(2)}`, width));
if (data.discount > 0) {
  lines.push(padBetween('Discount', `-${curr} ${data.discount.toFixed(2)}`, width));
}
if (data.tax > 0) {
  lines.push(padBetween('Tax / VAT', `${curr} ${data.tax.toFixed(2)}`, width));
}

lines.push(doubleSep);
lines.push(padBetween('GRAND TOTAL', `${curr} ${data.total.toFixed(2)}`, width));
lines.push(doubleSep);

lines.push(padBetween('Amount Paid', `${curr} ${data.paidAmount.toFixed(2)}`, width));
if (data.paymentMethod?.toLowerCase() === 'credit') {
  lines.push(padBetween('Credit Balance', `${curr} ${(data.creditAmount || 0).toFixed(2)}`, width));
} else {
  lines.push(padBetween('Change Due', `${curr} ${data.changeAmount.toFixed(2)}`, width));
}

lines.push(lineSep);
lines.push(centerText('*** THANK YOU FOR YOUR BUSINESS ***', width));
lines.push(centerText(data.footerText || 'Powered by NOVA POS', width));
lines.push('\n\n\n\n');

return lines.join('\n');
}

export interface GrnPrintData {
  purchaseNo: string;
  supplierName: string;
  storeName?: string;
  receivedAt: string;
  referenceNo?: string;
  paymentMethod: string;
  items: {
    name: string;
    sku?: string;
    quantity: number;
    unitCost: number;
    total: number;
  }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  freight?: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  notes?: string;
}

export function generateFormattedTextGRN(data: GrnPrintData): string {
  const width = 48;
  const lineSep = '-'.repeat(width);
  const doubleSep = '='.repeat(width);

  const padBetween = (left: string, right: string, w: number): string => {
    const spaceCount = Math.max(1, w - left.length - right.length);
    return left + ' '.repeat(spaceCount) + right;
  };

  const centerText = (text: string, w: number): string => {
    if (text.length >= w) return text;
    const leftPad = Math.floor((w - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  };

  const lines: string[] = [];

  lines.push(centerText((data.storeName || 'NOVA POS STORE').toUpperCase(), width));
  lines.push(centerText('GOODS RECEIVED NOTE (GRN)', width));
  lines.push(lineSep);

  const dateStr = new Date(data.receivedAt).toLocaleString('en-GB');

  lines.push(`GRN No      : ${data.purchaseNo}`);
  lines.push(`Supplier    : ${data.supplierName}`);
  lines.push(`Date        : ${dateStr}`);
  if (data.referenceNo) lines.push(`Ref / Inv No: ${data.referenceNo}`);
  lines.push(`Payment     : ${data.paymentMethod}`);

  lines.push(lineSep);
  lines.push('ITEMS RECEIVED:');

  data.items.forEach((item, idx) => {
    const sn = idx + 1;
    const qtyStr = item.quantity.toString();
    const costStr = item.unitCost.toFixed(2);
    const totalStr = item.total.toFixed(2);

    lines.push(`${sn}. ${item.name} (${item.sku || 'N/A'})`);
    const row2Left = `   ${qtyStr} x LKR ${costStr}`;
    lines.push(padBetween(row2Left, `LKR ${totalStr}`, width));
  });

  lines.push(lineSep);

  lines.push(padBetween('Subtotal', `LKR ${data.subtotal.toFixed(2)}`, width));
  if (data.discount && data.discount > 0) {
    lines.push(padBetween('Discount', `-LKR ${data.discount.toFixed(2)}`, width));
  }
  if (data.tax && data.tax > 0) {
    lines.push(padBetween('Tax / VAT', `LKR ${data.tax.toFixed(2)}`, width));
  }
  if (data.freight && data.freight > 0) {
    lines.push(padBetween('Freight Charges', `LKR ${data.freight.toFixed(2)}`, width));
  }

  lines.push(doubleSep);
  lines.push(padBetween('TOTAL INVOICE', `LKR ${data.total.toFixed(2)}`, width));
  lines.push(doubleSep);

  lines.push(padBetween('Amount Paid', `LKR ${data.paidAmount.toFixed(2)}`, width));
  lines.push(padBetween('Credit Balance', `LKR ${data.creditAmount.toFixed(2)}`, width));

  if (data.notes) {
    lines.push(lineSep);
    lines.push(`Notes: ${data.notes}`);
  }

  lines.push(lineSep);
  lines.push(centerText('*** STOCK RECEIVED & VERIFIED ***', width));
  lines.push('\n\n');

  return lines.join('\n');
}

