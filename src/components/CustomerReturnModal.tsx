import React, { useState, useEffect } from 'react';
import type { PosSalePayload, PosCustomer } from '../hooks/pos/pos_controller';
import { processCustomerReturn, type PosCustomerReturnRecord } from '../hooks/pos/pos_controller';

interface CustomerReturnModalProps {
  sale?: PosSalePayload | null;
  allSales?: PosSalePayload[];
  customers?: PosCustomer[];
  onClose: () => void;
  onReturnProcessed: (returnRecord: PosCustomerReturnRecord) => void;
}

export interface ReturnItemDraft {
  product_id: number;
  product_name: string;
  product_code?: string;
  barcode?: string;
  unit_price: number;
  max_quantity: number;
  return_quantity: number;
  reason: string;
  restock: boolean;
}

const REASONS = [
  'Customer Choice',
  'Damaged / Broken',
  'Expired',
  'Defective',
  'Wrong Item',
  'Other',
];

export const CustomerReturnModal: React.FC<CustomerReturnModalProps> = ({
  sale: initialSale,
  allSales = [],
  customers: _customers = [],
  onClose,
  onReturnProcessed,
}) => {
  const [selectedSale, setSelectedSale] = useState<PosSalePayload | null>(initialSale || null);
  const [searchInvoice, setSearchInvoice] = useState<string>('');
  const [itemsDraft, setItemsDraft] = useState<ReturnItemDraft[]>([]);
  const [refundMethod, setRefundMethod] = useState<'Cash' | 'Store Credit' | 'Bank / Card'>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successRecord, setSuccessRecord] = useState<PosCustomerReturnRecord | null>(null);

  // Keyboard Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // When selected sale changes, populate return item drafts
  useEffect(() => {
    if (selectedSale && selectedSale.items) {
      const drafts: ReturnItemDraft[] = selectedSale.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code,
        barcode: item.barcode,
        unit_price: item.unit_price,
        max_quantity: item.quantity || (item as any).qty || 1,
        return_quantity: 0, // default 0 items to return
        reason: 'Customer Choice',
        restock: true,
      }));
      setItemsDraft(drafts);
    } else {
      setItemsDraft([]);
    }
  }, [selectedSale]);

  // Filter sales for invoice search dropdown if no initial sale provided
  const filteredSales = allSales.filter((s) => {
    if (!searchInvoice.trim()) return true;
    const q = searchInvoice.trim().toLowerCase();
    return (
      s.sale_no.toLowerCase().includes(q) ||
      s.customer_name.toLowerCase().includes(q)
    );
  });

  const updateItemQty = (index: number, qty: number) => {
    setItemsDraft((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const validQty = Math.max(0, Math.min(item.max_quantity, qty));
        return { ...item, return_quantity: validQty };
      })
    );
  };

  const updateItemReason = (index: number, reason: string) => {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === index ? { ...item, reason } : item))
    );
  };

  const updateItemRestock = (index: number, restock: boolean) => {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === index ? { ...item, restock } : item))
    );
  };

  const itemsToReturn = itemsDraft.filter((item) => item.return_quantity > 0);
  const totalRefundAmount = itemsToReturn.reduce(
    (sum, item) => sum + item.return_quantity * item.unit_price,
    0
  );

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) {
      setError('Please select a valid sales bill to process returns.');
      return;
    }
    if (itemsToReturn.length === 0) {
      setError('Please specify return quantity (> 0) for at least one item.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const record = await processCustomerReturn({
        sale_id: selectedSale.id,
        invoice_number: selectedSale.sale_no,
        customer_id: selectedSale.customer_id || undefined,
        customer_name: selectedSale.customer_name || 'Walk-in customer',
        refund_method: refundMethod,
        items: itemsToReturn.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          barcode: item.barcode,
          unit_price: item.unit_price,
          quantity: item.return_quantity,
          refund_amount: item.return_quantity * item.unit_price,
          reason: item.reason,
          restock: item.restock,
        })),
        notes,
      });

      setSuccessRecord(record);
      onReturnProcessed(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process return.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatMoney = (val: number) => `LKR ${Number(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="customer-return-title">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>CUSTOMER SALES RETURNS</div>
            <h2 id="customer-return-title" style={styles.title}>
              Return Items by Customer
            </h2>
          </div>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {error && <div style={styles.errorBox}>{error}</div>}

          {successRecord ? (
            <div style={styles.successBox}>
              <i className="ti ti-circle-check" style={{ fontSize: 44, color: '#16834f' }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', margin: '8px 0 4px' }}>
                Customer Return Processed Successfully!
              </h3>
              <p style={{ fontSize: 13, color: 'var(--app-muted)' }}>
                Return Slip No: <strong>{successRecord.return_no}</strong> • Total Refund: <strong>{formatMoney(successRecord.total_refund)}</strong> ({successRecord.refund_method})
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={styles.primaryBtn}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProcessReturn} style={{ display: 'grid', gap: 16 }}>
              {/* Section 1: Bill / Customer Selection */}
              <div style={styles.sectionBox}>
                <span style={styles.sectionTitle}>1. Select Customer Bill / Invoice</span>

                {!initialSale ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={searchInvoice}
                        onChange={(e) => setSearchInvoice(e.target.value)}
                        placeholder="Search Invoice # (INV-XXXXXX) or Customer Name..."
                        style={styles.input}
                      />
                      <i className="ti ti-search" style={styles.searchIcon} />
                    </div>

                    <div style={styles.billSelectGrid}>
                      {filteredSales.slice(0, 10).map((s) => (
                        <div
                          key={s.id || s.sale_no}
                          onClick={() => setSelectedSale(s)}
                          style={{
                            ...styles.billCard,
                            ...(selectedSale?.sale_no === s.sale_no ? styles.billCardActive : {}),
                          }}
                        >
                          <div style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{s.sale_no}</div>
                          <div style={{ fontSize: 11, color: 'var(--app-muted)' }}>
                            Customer: <strong>{s.customer_name || 'Walk-in'}</strong>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#16834f', marginTop: 2 }}>
                            {formatMoney(s.total_amount)} • {new Date(s.sold_at).toLocaleDateString('en-LK')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedSale ? (
                  <div style={styles.activeBillBanner}>
                    <div>
                      <strong style={{ fontSize: 14 }}>Invoice: {selectedSale.sale_no}</strong>
                      <div style={{ fontSize: 12, color: 'var(--app-muted)' }}>
                        Customer: <strong>{selectedSale.customer_name || 'Walk-in customer'}</strong> • Date: {new Date(selectedSale.sold_at).toLocaleString('en-LK')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, color: 'var(--app-muted)', display: 'block' }}>Paid Amount</span>
                      <strong style={{ fontSize: 15, color: '#16834f' }}>{formatMoney(selectedSale.total_amount)}</strong>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Section 2: Purchased Items & Return Quantities */}
              {selectedSale && (
                <div style={styles.sectionBox}>
                  <span style={styles.sectionTitle}>2. Items to Return & Reason</span>

                  <div style={styles.tableWrap}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                      <thead>
                        <tr style={{ background: 'var(--app-surface-soft)', borderBottom: '1px solid var(--app-border)' }}>
                          <th style={styles.th}>Product</th>
                          <th style={{ ...styles.th, textAlign: 'center', width: 90 }}>Purchased</th>
                          <th style={{ ...styles.th, textAlign: 'center', width: 140 }}>Return Qty</th>
                          <th style={{ ...styles.th, width: 150 }}>Return Reason</th>
                          <th style={{ ...styles.th, textAlign: 'center', width: 90 }}>Restock?</th>
                          <th style={{ ...styles.th, textAlign: 'right', width: 120 }}>Refund Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsDraft.map((item, idx) => {
                          const lineRefund = item.return_quantity * item.unit_price;

                          return (
                            <tr key={item.product_id} style={{ borderBottom: '1px solid var(--app-border-soft)' }}>
                              <td style={styles.td}>
                                <strong>{item.product_name}</strong>
                                <div style={{ fontSize: 11, color: 'var(--app-muted)' }}>
                                  Price: {formatMoney(item.unit_price)} {item.barcode ? `| Barcode: ${item.barcode}` : ''}
                                </div>
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <span style={styles.qtyBadge}>{item.max_quantity}</span>
                              </td>
                              <td style={styles.td}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => updateItemQty(idx, item.return_quantity - 1)}
                                    style={styles.stepBtn}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.max_quantity}
                                    value={item.return_quantity}
                                    onChange={(e) => updateItemQty(idx, Number(e.target.value) || 0)}
                                    style={{ ...styles.input, width: 55, textAlign: 'center', padding: '4px' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateItemQty(idx, item.return_quantity + 1)}
                                    style={styles.stepBtn}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td style={styles.td}>
                                <select
                                  value={item.reason}
                                  onChange={(e) => updateItemReason(idx, e.target.value)}
                                  style={{ ...styles.input, padding: '4px 6px', fontSize: 11 }}
                                >
                                  {REASONS.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={item.restock}
                                  onChange={(e) => updateItemRestock(idx, e.target.checked)}
                                  title="Add item back to store inventory stock"
                                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                                />
                              </td>
                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>
                                {formatMoney(lineRefund)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 3: Refund Method & Remarks */}
              {selectedSale && (
                <div style={styles.sectionBox}>
                  <span style={styles.sectionTitle}>3. Refund Method & Remarks</span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                    <div>
                      <label style={styles.label}>Refund Payment Method *</label>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        {(['Cash', 'Store Credit', 'Bank / Card'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setRefundMethod(method)}
                            style={{
                              flex: 1,
                              border: refundMethod === method ? '2px solid var(--app-accent, #27AE4F)' : '1px solid var(--app-border)',
                              borderRadius: 8,
                              padding: '8px 10px',
                              background: refundMethod === method ? 'var(--app-accent-soft, rgba(39,174,79,0.1))' : 'var(--app-surface)',
                              color: refundMethod === method ? 'var(--app-accent-strong, #16834f)' : 'inherit',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={styles.label}>Return Notes / Remarks (Optional)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Customer returned damaged seal"
                        style={{ ...styles.input, marginTop: 6 }}
                      />
                    </div>
                  </div>

                  {/* Summary bar */}
                  <div style={styles.grandSummaryBar}>
                    <div>
                      <span>Items to Return: </span>
                      <strong style={{ fontSize: 14 }}>
                        {itemsToReturn.reduce((sum, i) => sum + i.return_quantity, 0)} units
                      </strong>
                    </div>
                    <div>
                      <span>Total Refund Amount: </span>
                      <strong style={{ fontSize: 18, color: '#b42318' }}>
                        {formatMoney(totalRefundAmount)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div style={styles.footer}>
                <button type="button" onClick={onClose} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || itemsToReturn.length === 0}
                  style={styles.saveBtn}
                >
                  {isSaving ? 'Processing Return...' : `Process Return (${formatMoney(totalRefundAmount)})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 26000,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '92vh',
    background: 'var(--app-surface, #ffffff)',
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 12,
    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 20px',
    background: 'var(--app-surface-soft, #f8fafc)',
    borderBottom: '1px solid var(--app-border, #e2e8f0)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: { fontSize: 11, fontWeight: 800, color: 'var(--app-accent, #27AE4F)', letterSpacing: '0.05em' },
  title: { fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)', margin: 0 },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    fontSize: 18,
    color: 'var(--app-muted)',
    cursor: 'pointer',
  },
  body: { padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  sectionBox: {
    border: '1px solid var(--app-border-soft, #e2e8f0)',
    borderRadius: 8,
    padding: 12,
    background: 'var(--app-surface, #ffffff)',
  },
  sectionTitle: { fontSize: 12, fontWeight: 800, color: 'var(--app-text-strong)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--app-border, #d0d5dd)',
    background: 'var(--app-input-bg, #ffffff)',
    color: 'var(--app-input-text, #1f2937)',
    fontSize: 12,
    outline: 'none',
  },
  searchIcon: { position: 'absolute', right: 10, top: 10, color: 'var(--app-muted)' },
  billSelectGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxHeight: 160, overflowY: 'auto' },
  billCard: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--app-border, #d0d5dd)',
    cursor: 'pointer',
    background: 'var(--app-surface-soft, #f8fafc)',
  },
  billCardActive: {
    borderColor: 'var(--app-accent, #27AE4F)',
    background: 'var(--app-accent-soft, rgba(39,174,79,0.1))',
  },
  activeBillBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 6,
    background: 'var(--app-surface-soft, #f8fafc)',
    border: '1px solid var(--app-border)',
    marginTop: 6,
  },
  tableWrap: { overflowX: 'auto', marginTop: 8, border: '1px solid var(--app-border-soft)', borderRadius: 6 },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: 800, color: 'var(--app-text-strong)', fontSize: 11 },
  td: { padding: '8px 10px', verticalAlign: 'middle', fontSize: 12 },
  qtyBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: 'var(--app-surface-soft)', fontWeight: 700 },
  stepBtn: {
    width: 24,
    height: 24,
    border: '1px solid var(--app-border)',
    borderRadius: 4,
    background: 'var(--app-surface-soft)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  grandSummaryBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 6,
    background: 'var(--app-surface-soft, #f8fafc)',
    border: '1px solid var(--app-border)',
    marginTop: 12,
  },
  label: { fontSize: 11, fontWeight: 700, color: 'var(--app-muted)' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: {
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 700,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 18px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--app-accent, #27AE4F)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '8px 18px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--app-accent, #27AE4F)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  errorBox: { padding: '8px 12px', borderRadius: 6, background: '#FEE4E2', color: '#B42318', fontSize: 12, fontWeight: 700 },
  successBox: { padding: 30, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
};

export default CustomerReturnModal;
