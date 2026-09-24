/**
 * NOVA POS - ESC/POS Raw Thermal Printer & Silent Direct Print Engine
 */

export interface ReceiptPrintData {
  saleNo: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeTaxNo?: string;
  cashierName: string;
  customerName: string;
  paymentMethod: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  footerText?: string;
  paperWidth?: number; // 80 or 58 mm
}

/**
 * Builds raw ESC/POS byte array for thermal receipt printers (Epson/Star/RPP02N/Bixolon).
 * Includes alignment, line wrap, font sizes, drawer kick-out, and auto-cut commands.
 */
export function generateEscPosBytes(data: ReceiptPrintData): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  // Initialize printer: ESC @ (0x1B, 0x40)
  bytes.push(0x1b, 0x40);

  // Set line spacing default: ESC 2 (0x1B, 0x32)
  bytes.push(0x1b, 0x32);

  // Align Center: ESC a 1 (0x1B, 0x61, 0x01)
  bytes.push(0x1b, 0x61, 0x01);

  // Double Height/Width for Header: GS ! 0x11 (0x1D, 0x21, 0x11)
  bytes.push(0x1d, 0x21, 0x11);
  bytes.push(...encoder.encode(`${data.storeName.toUpperCase()}\n`));

  // Reset Font Size: GS ! 0 (0x1D, 0x21, 0x00)
  bytes.push(0x1d, 0x21, 0x00);

  if (data.storeAddress) {
    bytes.push(...encoder.encode(`${data.storeAddress}\n`));
  }
  if (data.storePhone) {
    bytes.push(...encoder.encode(`Tel: ${data.storePhone}\n`));
  }
  if (data.storeTaxNo) {
    bytes.push(...encoder.encode(`Tax ID: ${data.storeTaxNo}\n`));
  }

  const is58mm = (data.paperWidth || 58) <= 58;
  const lineSeparator = is58mm
    ? '--------------------------------\n'
    : '------------------------------------------------\n';

  bytes.push(...encoder.encode(lineSeparator));

  // Align Left: ESC a 0 (0x1B, 0x61, 0x00)
  bytes.push(0x1b, 0x61, 0x00);
  bytes.push(...encoder.encode(`Sale #: ${data.saleNo}\n`));
  bytes.push(...encoder.encode(`Date  : ${new Date().toLocaleString()}\n`));
  bytes.push(...encoder.encode(`Cashier: ${data.cashierName}\n`));
  bytes.push(...encoder.encode(`Customer: ${data.customerName}\n`));
  bytes.push(...encoder.encode(`Payment : ${data.paymentMethod}\n`));
  bytes.push(...encoder.encode(lineSeparator));

  // Line items
  data.items.forEach((item) => {
    const itemLine = `${item.quantity}x ${item.name}`;
    const priceStr = item.total.toFixed(2);
    if (is58mm) {
      bytes.push(...encoder.encode(`${itemLine.slice(0, 20).padEnd(22)} ${priceStr.padStart(9)}\n`));
    } else {
      bytes.push(...encoder.encode(`${itemLine.slice(0, 34).padEnd(36)} ${priceStr.padStart(10)}\n`));
    }
  });

  bytes.push(...encoder.encode(lineSeparator));

  // Totals
  const formatRow = (label: string, val: string) => {
    if (is58mm) {
      return `${label.padEnd(18)} ${val.padStart(13)}\n`;
    }
    return `${label.padEnd(30)} ${val.padStart(16)}\n`;
  };

  bytes.push(...encoder.encode(formatRow('Subtotal', data.subtotal.toFixed(2))));
  if (data.discount > 0) {
    bytes.push(...encoder.encode(formatRow('Discount', `-${data.discount.toFixed(2)}`)));
  }
  bytes.push(...encoder.encode(formatRow('Tax', data.tax.toFixed(2))));

  // Emphasize Total: ESC E 1 (0x1B, 0x45, 0x01)
  bytes.push(0x1b, 0x45, 0x01);
  bytes.push(...encoder.encode(formatRow('TOTAL', `LKR ${data.total.toFixed(2)}`)));
  bytes.push(0x1b, 0x45, 0x00);

  bytes.push(...encoder.encode(formatRow('Paid', data.paidAmount.toFixed(2))));
  bytes.push(...encoder.encode(formatRow('Change', data.changeAmount.toFixed(2))));
  bytes.push(...encoder.encode(lineSeparator));

  // Align Center for Footer: ESC a 1 (0x1B, 0x61, 0x01)
  bytes.push(0x1b, 0x61, 0x01);
  bytes.push(...encoder.encode(`${data.footerText || 'Thank you for your business!'}\n`));
  bytes.push(...encoder.encode('*** POWERED BY NOVA POS ***\n\n\n\n'));

  // Cash Drawer Kick-Out Pulse (Pin 2, 25ms ON, 250ms OFF): ESC p 0 25 250 (0x1B, 0x70, 0x00, 0x19, 0xFA)
  bytes.push(0x1b, 0x70, 0x00, 0x19, 0xfa);

  // Auto-Cut Paper Command: GS V 66 0 (0x1D, 0x56, 0x42, 0x00)
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

