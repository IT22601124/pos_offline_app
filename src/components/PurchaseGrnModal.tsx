import React, { useRef } from 'react';
import type { PosPurchaseRecord } from '../offline/db';
import { generateFormattedTextGRN } from '../utils/thermal_printer';

interface PurchaseGrnModalProps {
  purchase: PosPurchaseRecord;
  onClose: () => void;
}

const money = (value: number) =>
  `LKR ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PurchaseGrnModal({ purchase, onClose }: PurchaseGrnModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GRN - ${purchase.purchase_no}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1f2937; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .subtitle { font-size: 14px; color: #4b5563; margin-top: 4px; font-weight: 600; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 13px; }
            .grid div { padding: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 320px; font-size: 13px; margin-top: 16px; }
            .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
            .totals-grand { font-size: 16px; font-weight: 800; border-top: 2px solid #1f2937; border-bottom: 2px solid #1f2937; padding: 8px 0; margin-top: 6px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 12px; border-top: 1px dashed #9ca3af; font-size: 12px; font-weight: 600; color: #4b5563; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyText = () => {
    const textData = generateFormattedTextGRN({
      purchaseNo: purchase.purchase_no,
      supplierName: purchase.supplier_name,
      receivedAt: purchase.received_at,
      referenceNo: purchase.reference_no,
      paymentMethod: purchase.payment_method,
      items: purchase.lines.map((line) => ({
        name: line.product_name,
        sku: line.sku,
        quantity: line.quantity,
        unitCost: line.unit_cost,
        total: line.line_total,
      })),
      subtotal: purchase.subtotal,
      discount: purchase.discount_amount,
      tax: purchase.tax_amount,
      freight: purchase.freight_amount,
      total: purchase.total_amount,
      paidAmount: purchase.paid_amount,
      creditAmount: purchase.credit_amount,
      notes: purchase.notes,
    });
    navigator.clipboard.writeText(textData);
    alert('GRN text receipt copied to clipboard!');
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="grn-title">
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>Inventory Receipt Document</div>
            <h2 id="grn-title" style={styles.title}>Goods Received Note (GRN)</h2>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={handleCopyText} style={styles.secondaryBtn} title="Copy thermal text receipt">
              <i className="ti ti-copy" aria-hidden="true" /> Copy Slip
            </button>
            <button type="button" onClick={handlePrint} style={styles.primaryBtn} title="Print GRN document">
              <i className="ti ti-printer" aria-hidden="true" /> Print GRN
            </button>
            <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div style={styles.body}>
          <div ref={printRef} style={styles.documentCard}>
            <div className="header" style={styles.docHeader}>
              <h1 className="title" style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>NOVA POS INVENTORY</h1>
              <div className="subtitle" style={{ fontSize: 13, color: '#4b5563', marginTop: 2, fontWeight: 700 }}>
                GOODS RECEIVED NOTE (GRN)
              </div>
            </div>

            <div className="grid" style={styles.docGrid}>
              <div>
                <strong>GRN Number:</strong> {purchase.purchase_no}<br />
                <strong>Supplier:</strong> {purchase.supplier_name}<br />
                <strong>Date & Time:</strong> {new Date(purchase.received_at).toLocaleString('en-LK')}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Invoice / Ref No:</strong> {purchase.reference_no || 'N/A'}<br />
                <strong>Payment Method:</strong> {purchase.payment_method}<br />
                <strong>Status:</strong> <span style={{ color: purchase.credit_amount > 0 ? '#b42318' : '#16834f', fontWeight: 800 }}>{purchase.credit_amount > 0 ? `Credit (Bal: ${money(purchase.credit_amount)})` : 'Paid'}</span>
              </div>
            </div>

            <table style={styles.docTable}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th style={{ textAlign: 'right' }}>Qty Received</th>
                  <th style={{ textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.lines.map((line, index) => (
                  <tr key={line.product_id || index}>
                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td><strong>{line.product_name}</strong></td>
                    <td style={{ color: '#4b5563' }}>{line.sku}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{line.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{money(line.unit_cost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="totals" style={styles.docTotals}>
              <div className="totals-row" style={styles.totalRow}>
                <span>Subtotal:</span>
                <strong>{money(purchase.subtotal)}</strong>
              </div>
              {Boolean(purchase.discount_amount) && (
                <div className="totals-row" style={styles.totalRow}>
                  <span>Discount:</span>
                  <strong style={{ color: '#b42318' }}>-{money(purchase.discount_amount!)}</strong>
                </div>
              )}
              {Boolean(purchase.tax_amount) && (
                <div className="totals-row" style={styles.totalRow}>
                  <span>Tax / VAT:</span>
                  <strong>+{money(purchase.tax_amount!)}</strong>
                </div>
              )}
              {Boolean(purchase.freight_amount) && (
                <div className="totals-row" style={styles.totalRow}>
                  <span>Freight Charges:</span>
                  <strong>+{money(purchase.freight_amount!)}</strong>
                </div>
              )}
              <div className="totals-grand" style={styles.grandRow}>
                <span>Grand Total:</span>
                <span>{money(purchase.total_amount)}</span>
              </div>
              <div className="totals-row" style={{ ...styles.totalRow, marginTop: 6 }}>
                <span>Paid Amount:</span>
                <strong style={{ color: '#16834f' }}>{money(purchase.paid_amount)}</strong>
              </div>
              <div className="totals-row" style={styles.totalRow}>
                <span>Outstanding Credit:</span>
                <strong style={{ color: purchase.credit_amount > 0 ? '#b42318' : '#16834f' }}>{money(purchase.credit_amount)}</strong>
              </div>
            </div>

            {purchase.notes && (
              <div style={{ marginTop: 20, padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 12, border: '1px solid #e2e8f0' }}>
                <strong>Notes / Remarks:</strong> {purchase.notes}
              </div>
            )}

            <div className="signatures" style={styles.docSignatures}>
              <div>
                <br /><br />
                -------------------------------------<br />
                Received By (Store Keeper)
              </div>
              <div style={{ textAlign: 'right' }}>
                <br /><br />
                -------------------------------------<br />
                Approved By / Manager Signature
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.cancelBtn}>Close Document</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 22000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(2, 6, 23, 0.75)',
  },
  modal: {
    width: 'min(860px, 100%)',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'auto',
    borderRadius: 12,
    background: 'var(--app-surface, #ffffff)',
    color: 'var(--app-text, #1f2937)',
    boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--app-border-soft, #e5e7eb)',
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--app-accent-strong, #16834f)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: { margin: '2px 0 0', fontSize: 18, fontWeight: 800 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    background: 'var(--app-accent, #27AE4F)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    padding: '8px 14px',
    background: 'var(--app-button-bg, #ffffff)',
    color: 'var(--app-text, #1f2937)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  closeBtn: {
    width: 34,
    height: 34,
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
  body: { padding: 20 },
  documentCard: {
    background: '#ffffff',
    color: '#1f2937',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 24,
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  },
  docHeader: { textAlign: 'center', borderBottom: '2px solid #1f2937', paddingBottom: 12, marginBottom: 16 },
  docGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 13 },
  docTable: { width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 },
  docTotals: { marginLeft: 'auto', width: 320, fontSize: 13, marginTop: 16 },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0' },
  grandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 16,
    fontWeight: 800,
    borderTop: '2px solid #1f2937',
    borderBottom: '2px solid #1f2937',
    padding: '8px 0',
    marginTop: 6,
  },
  docSignatures: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 50,
    paddingTop: 12,
    borderTop: '1px dashed #9ca3af',
    fontSize: 12,
    fontWeight: 600,
    color: '#4b5563',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid var(--app-border-soft, #e5e7eb)',
  },
  cancelBtn: {
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    padding: '8px 16px',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
