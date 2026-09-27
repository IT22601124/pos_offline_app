import React, { useMemo, useState } from 'react';
import {
  paySupplierCredit,
  type PosPurchaseRecord,
  type PosSupplier,
  type PosSupplierTransactionRecord,
  type SupplierPaymentMethod,
} from '../hooks/pos/pos_controller';

interface SupplierCreditModalProps {
  supplier: PosSupplier;
  balance: number;
  purchases: PosPurchaseRecord[];
  transactions: PosSupplierTransactionRecord[];
  onClose: () => void;
  onPaid: () => void;
  onViewGrn?: (purchase: PosPurchaseRecord) => void;
}

const money = (value: number) =>
  `LKR ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--app-border, #d0d5dd)',
  borderRadius: 8,
  padding: '8px 10px',
  background: 'var(--app-input-bg, #ffffff)',
  color: 'var(--app-input-text, #1f2937)',
  fontSize: 13,
  outline: 'none',
};

export default function SupplierCreditModal({
  supplier,
  balance,
  purchases,
  transactions,
  onClose,
  onPaid,
  onViewGrn,
}: SupplierCreditModalProps) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<SupplierPaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | undefined>(undefined);

  const supplierPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.supplier_id === supplier.id),
    [purchases, supplier.id],
  );

  const getInvoicePaid = (purchaseId?: number) =>
    transactions
      .filter((transaction) => transaction.purchase_id === purchaseId && transaction.type === 'payment')
      .reduce((total, transaction) => total + transaction.amount, 0);

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    const payAmt = Number(amount);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await paySupplierCredit({
        supplier,
        amount: payAmt,
        payment_method: method,
        purchase_id: selectedPurchaseId,
        reference_no: reference,
        notes,
      });
      onPaid();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Unable to save supplier payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="supplier-credit-title">
      <form style={styles.modal} onSubmit={submitPayment}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>SUPPLIER ACCOUNT & CREDIT PAYMENT</div>
            <h2 id="supplier-credit-title" style={styles.title}>
              {supplier.name}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--app-muted)', marginTop: 2 }}>
              {supplier.phone ? `Phone: ${supplier.phone}` : ''}{' '}
              {supplier.email ? `| Email: ${supplier.email}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={styles.balanceBadgeBox}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-muted)' }}>Outstanding Credit</span>
              <strong style={{ fontSize: 16, color: balance > 0 ? '#b42318' : '#16834f' }}>
                {money(balance)}
              </strong>
            </div>

            <button type="button" onClick={onClose} style={styles.closeButton} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div style={styles.body}>
          {/* Invoice History Section */}
          <div style={styles.sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={styles.sectionTitle}>
                <i className="ti ti-receipt-2" style={{ marginRight: 6, color: 'var(--app-accent, #27AE4F)' }} aria-hidden="true" />
                Purchase Invoices & GRNs ({supplierPurchases.length})
              </h3>
            </div>

            <div style={styles.invoiceTableWrap}>
              <table style={{ ...styles.invoiceTable, minWidth: 780 }}>
                <thead>
                  <tr>
                    <th>GRN / Invoice No</th>
                    <th>Date & Time</th>
                    <th style={{ textAlign: 'center' }}>Items</th>
                    <th style={{ textAlign: 'right' }}>Total Invoice</th>
                    <th style={{ textAlign: 'right' }}>Paid Amount</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th style={{ textAlign: 'center', width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={styles.emptyTd}>
                        No purchase invoices recorded for this supplier yet.
                      </td>
                    </tr>
                  ) : (
                    supplierPurchases.map((purchase) => {
                      const paid = purchase.paid_amount + getInvoicePaid(purchase.id);
                      const outstanding = Math.max(purchase.total_amount - paid, 0);

                      return (
                        <tr key={purchase.id || purchase.purchase_no} style={styles.tr}>
                          <td>
                            <strong>{purchase.purchase_no}</strong>
                            {purchase.reference_no && (
                              <div style={{ fontSize: 11, color: 'var(--app-muted)' }}>Ref: {purchase.reference_no}</div>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--app-muted)' }}>
                            {new Date(purchase.received_at).toLocaleString('en-LK')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={styles.badge}>{purchase.lines.length} items</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(purchase.total_amount)}</td>
                          <td style={{ textAlign: 'right', color: '#16834f' }}>{money(Math.min(paid, purchase.total_amount))}</td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: outstanding > 0 ? '#b42318' : '#16834f' }}>
                              {money(outstanding)}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              {onViewGrn && (
                                <button
                                  type="button"
                                  onClick={() => onViewGrn(purchase)}
                                  style={styles.grnBtn}
                                  title="View & Print GRN Document"
                                >
                                  <i className="ti ti-printer" aria-hidden="true" /> GRN
                                </button>
                              )}
                              {outstanding > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAmount(String(outstanding.toFixed(2)));
                                    setSelectedPurchaseId(purchase.id);
                                  }}
                                  style={{
                                    ...styles.grnBtn,
                                    background: selectedPurchaseId === purchase.id ? 'var(--app-accent, #27AE4F)' : 'var(--app-accent-soft, rgba(39,174,79,0.1))',
                                    color: selectedPurchaseId === purchase.id ? '#ffffff' : 'var(--app-accent-strong, #16834f)',
                                    border: '1px solid var(--app-accent, #27AE4F)',
                                  }}
                                  title="Pay towards this specific invoice"
                                >
                                  <i className="ti ti-wallet" aria-hidden="true" /> Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pay Supplier Credit Section */}
          <div style={styles.sectionBox}>
            <h3 style={styles.sectionTitle}>
              <i className="ti ti-wallet" style={{ marginRight: 6, color: 'var(--app-accent, #27AE4F)' }} aria-hidden="true" />
              Pay Supplier Credit Balance
            </h3>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Payment Amount (LKR) *</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setAmount(String(balance))}
                      style={styles.tagBtn}
                    >
                      Full Pay ({money(balance)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(String((balance / 2).toFixed(2)))}
                      style={styles.tagBtn}
                    >
                      50% Pay
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0.01"
                  max={balance > 0 ? balance : undefined}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={inputStyle}
                  required
                />
              </label>

              <label style={styles.field}>
                <span>Payment Method *</span>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as SupplierPaymentMethod)}
                  style={inputStyle}
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Online</option>
                  <option>Cheque</option>
                </select>
              </label>

              <label style={styles.field}>
                <span>Payment Reference / Cheque No</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Receipt #, Bank TXN ID, or Cheque #"
                  style={inputStyle}
                />
              </label>

              <label style={styles.field}>
                <span>Notes / Payment Remarks</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional payment notes"
                  style={inputStyle}
                />
              </label>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.cancelBtn}>
            Close
          </button>
          <button
            type="submit"
            disabled={saving || balance <= 0}
            style={styles.saveBtn}
          >
            <i className="ti ti-check" aria-hidden="true" /> {saving ? 'Saving Payment...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 25000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(2, 6, 23, 0.75)',
  },
  modal: {
    width: 'min(920px, 100%)',
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
  title: { margin: '2px 0 0', fontSize: 20, fontWeight: 800 },
  balanceBadgeBox: {
    display: 'grid',
    textAlign: 'right',
    padding: '6px 12px',
    borderRadius: 8,
    background: 'var(--app-surface-soft, #f8fafc)',
    border: '1px solid var(--app-border-soft, #e5e7eb)',
  },
  closeButton: {
    width: 34,
    height: 34,
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
  },
  body: { display: 'grid', gap: 14, padding: 20 },
  sectionBox: {
    display: 'grid',
    gap: 10,
    padding: 14,
    border: '1px solid var(--app-border-soft, #e5e7eb)',
    borderRadius: 10,
    background: 'var(--app-surface-soft, #f8fafc)',
  },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center' },
  invoiceTableWrap: {
    maxHeight: 220,
    overflowY: 'auto',
    border: '1px solid var(--app-border-soft, #e5e7eb)',
    borderRadius: 8,
  },
  invoiceTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  tr: { borderBottom: '1px solid var(--app-border-soft, #e5e7eb)', background: 'var(--app-surface, #ffffff)' },
  emptyTd: { padding: 20, textAlign: 'center', color: 'var(--app-muted)' },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--app-surface-soft, #f1f5f9)',
    fontSize: 11,
    fontWeight: 700,
  },
  grnBtn: {
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 6,
    padding: '3px 8px',
    background: 'var(--app-button-bg, #ffffff)',
    color: 'var(--app-text, #1f2937)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
  },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  field: { display: 'grid', gap: 4, minWidth: 0, fontSize: 12, fontWeight: 700 },
  tagBtn: {
    border: 'none',
    background: 'var(--app-accent-soft, rgba(39,174,79,0.12))',
    color: 'var(--app-accent-strong, #16834f)',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },
  errorBox: { padding: '9px 12px', borderRadius: 8, background: '#FEE4E2', color: '#B42318', fontSize: 12, fontWeight: 700 },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 20px',
    borderTop: '1px solid var(--app-border-soft, #e5e7eb)',
  },
  cancelBtn: {
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    padding: '9px 16px',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    background: 'var(--app-accent, #27AE4F)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
