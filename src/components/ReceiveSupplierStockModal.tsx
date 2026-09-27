import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createSupplier,
  receiveSupplierStock,
  type PosProduct,
  type PosSupplier,
  type PosPurchaseRecord,
  type SupplierPurchasePaymentMethod,
} from '../hooks/pos/pos_controller';

interface ReceiveSupplierStockModalProps {
  products: PosProduct[];
  suppliers: PosSupplier[];
  supplierBalances: Record<number, number>;
  onClose: () => void;
  onSaved: (purchase: PosPurchaseRecord, shouldPrintGrn?: boolean) => void;
  onSupplierCreated?: (supplier: PosSupplier) => void;
  onRequestAddProduct?: () => void;
  productToSelect?: PosProduct | null;
}

interface PurchaseLine {
  product_id: number;
  product_name: string;
  sku: string;
  barcode: string;
  current_stock: number;
  quantity: number;
  unit_cost: number;
  selling_price: number;
  line_total: number;
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

export default function ReceiveSupplierStockModal({
  products,
  suppliers,
  supplierBalances,
  onClose,
  onSaved,
  onSupplierCreated,
  onRequestAddProduct,
  productToSelect,
}: ReceiveSupplierStockModalProps) {
  const [availableProducts, setAvailableProducts] = useState(products);
  const [availableSuppliers, setAvailableSuppliers] = useState(suppliers);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<SupplierPurchasePaymentMethod>('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  // Product Selection Draft State
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PosProduct | null>(null);
  const [draftQty, setDraftQty] = useState('1');
  const [draftUnitCost, setDraftUnitCost] = useState('');
  const [draftSellingPrice, setDraftSellingPrice] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // New Supplier Quick Add State
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize incoming productToSelect prop if passed
  useEffect(() => {
    if (!productToSelect) return;
    setAvailableProducts((prev) => (prev.some((item) => item.id === productToSelect.id) ? prev : [...prev, productToSelect]));
    setSelectedProduct(productToSelect);
    setProductSearch(`${productToSelect.name} (${productToSelect.sku})`);
    setDraftUnitCost(String(productToSelect.cost_price ?? 0));
    setDraftSellingPrice(String(productToSelect.price ?? 0));
  }, [productToSelect]);

  // Handle outside click to hide product dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener (Ctrl+Enter to save, Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showNewSupplier) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showNewSupplier]);

  const supplier = availableSuppliers.find((item) => item.id === supplierId);

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return availableProducts.slice(0, 30);
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)),
    ).slice(0, 30);
  }, [availableProducts, productSearch]);

  // Financial Calculations
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.line_total, 0), [lines]);
  const disc = Number(discountAmount) || 0;
  const tax = Number(taxAmount) || 0;
  const freight = Number(freightAmount) || 0;
  const grandTotal = Math.max(0, subtotal - disc + tax + freight);

  const selectedPaid = paidAmount.trim() === '' ? (paymentMethod === 'Credit' ? 0 : grandTotal) : Number(paidAmount) || 0;
  const newBalance = Math.max(grandTotal - Math.min(selectedPaid, grandTotal), 0);
  const totalUnits = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  // Handle Product Select from Dropdown or Scanner
  const selectProductItem = (prod: PosProduct) => {
    setSelectedProduct(prod);
    setProductSearch(`${prod.name} (${prod.sku})`);
    setDraftUnitCost(String(prod.cost_price ?? prod.price ?? 0));
    setDraftSellingPrice(String(prod.price ?? 0));
    setShowProductDropdown(false);
  };

  // Add Item to Lines List
  const handleAddLineItem = () => {
    if (!selectedProduct) {
      setError('Please search and select a product to add.');
      return;
    }
    const qty = Number(draftQty);
    const unitCost = Number(draftUnitCost);
    const sellingPrice = Number(draftSellingPrice);

    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a valid quantity greater than 0.');
      return;
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError('Enter a valid unit cost price.');
      return;
    }

    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.product_id === selectedProduct.id);
      const newLine: PurchaseLine = {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        sku: selectedProduct.sku,
        barcode: selectedProduct.barcode || '',
        current_stock: selectedProduct.stock,
        quantity: qty,
        unit_cost: unitCost,
        selling_price: sellingPrice,
        line_total: qty * unitCost,
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = newLine;
        return next;
      }
      return [...prev, newLine];
    });

    // Reset draft entry
    setSelectedProduct(null);
    setProductSearch('');
    setDraftQty('1');
    setDraftUnitCost('');
    setDraftSellingPrice('');
    setError('');
    searchInputRef.current?.focus();
  };

  // Barcode / SKU Enter Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = productSearch.trim().toLowerCase();
      if (!query) return;

      // Check for exact barcode or SKU match
      const exactMatch = availableProducts.find(
        (p) => p.sku.toLowerCase() === query || (p.barcode && p.barcode.toLowerCase() === query),
      );

      if (exactMatch) {
        selectProductItem(exactMatch);
        // Automatically add if quantity is ready
        setLines((prev) => {
          const existingIdx = prev.findIndex((l) => l.product_id === exactMatch.id);
          const unitCost = Number(exactMatch.cost_price ?? exactMatch.price ?? 0);
          const sellingPrice = Number(exactMatch.price ?? 0);

          if (existingIdx >= 0) {
            const next = [...prev];
            const oldQty = next[existingIdx].quantity;
            next[existingIdx] = {
              ...next[existingIdx],
              quantity: oldQty + 1,
              line_total: (oldQty + 1) * next[existingIdx].unit_cost,
            };
            return next;
          }

          return [
            ...prev,
            {
              product_id: exactMatch.id,
              product_name: exactMatch.name,
              sku: exactMatch.sku,
              barcode: exactMatch.barcode || '',
              current_stock: exactMatch.stock,
              quantity: 1,
              unit_cost: unitCost,
              selling_price: sellingPrice,
              line_total: unitCost,
            },
          ];
        });
        setProductSearch('');
        setSelectedProduct(null);
        setError('');
      } else if (filteredProducts.length === 1) {
        selectProductItem(filteredProducts[0]);
      }
    }
  };

  // Inline Line Table Updates
  const updateLineQuantity = (index: number, newQty: number) => {
    if (newQty < 0.001) return;
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, quantity: newQty, line_total: newQty * line.unit_cost } : line)),
    );
  };

  const updateLineUnitCost = (index: number, newCost: number) => {
    if (newCost < 0) return;
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, unit_cost: newCost, line_total: line.quantity * newCost } : line)),
    );
  };

  const updateLineSellingPrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, selling_price: newPrice } : line)));
  };

  const removeLineItem = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Create New Supplier
  const handleAddNewSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) {
      setError('Please enter a supplier name.');
      return;
    }
    setIsCreatingSupplier(true);
    setError('');
    try {
      const created = await createSupplier(name);
      setAvailableSuppliers((prev) => [...prev, created]);
      setSupplierId(created.id);
      onSupplierCreated?.(created);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setShowNewSupplier(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create supplier.');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Submit Stock Receiving Form
  const handleSubmit = async (e: React.FormEvent, shouldPrint = false) => {
    e.preventDefault();
    if (!supplier) {
      setError('Please select a supplier.');
      return;
    }
    if (lines.length === 0) {
      setError('Please add at least one stock item to receive.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const purchase = await receiveSupplierStock({
        supplier,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          sku: l.sku,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          selling_price: l.selling_price,
          line_total: l.line_total,
        })),
        payment_method: paymentMethod,
        paid_amount: selectedPaid,
        discount_amount: disc,
        tax_amount: tax,
        freight_amount: freight,
        reference_no: referenceNo,
        notes,
        received_at: receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString(),
      });

      onSaved(purchase, shouldPrint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to receive supplier stock.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="receive-stock-title">
      <form style={styles.modal} onSubmit={(e) => handleSubmit(e, false)}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>INVENTORY PURCHASING & GRN</div>
            <h2 id="receive-stock-title" style={styles.title}>Receive Stock from Supplier</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--app-muted)', fontWeight: 600 }}>[Esc] Close | [Enter] Add SKU</span>
            <button type="button" onClick={onClose} style={styles.closeButton} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div style={styles.body}>
          {/* Section 1: Supplier & Invoice Information */}
          <div style={styles.sectionBox}>
            <div style={styles.formGridHeader}>
              <label style={styles.field}>
                <span>Supplier *</span>
                <div style={styles.fieldActionRow}>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                    style={inputStyle}
                    required
                  >
                    <option value="">Select Supplier</option>
                    {availableSuppliers
                      .filter((s) => s.status !== false)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.phone ? `(${s.phone})` : ''}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewSupplier((prev) => !prev)}
                    style={styles.inlineBtn}
                    title="Create new supplier"
                  >
                    <i className="ti ti-user-plus" aria-hidden="true" /> New
                  </button>
                </div>
              </label>

              <div style={styles.creditBadgeBox}>
                <span>Current Outstanding Credit</span>
                <strong style={{ fontSize: 16, color: (supplierBalances[Number(supplierId)] || 0) > 0 ? '#b42318' : 'inherit' }}>
                  {supplier ? money(supplierBalances[supplier.id] || 0) : money(0)}
                </strong>
              </div>

              <label style={styles.field}>
                <span>Supplier Invoice / Ref No</span>
                <input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. INV-9982 or GRN Ref"
                  style={inputStyle}
                />
              </label>

              <label style={styles.field}>
                <span>Received Date & Time</span>
                <input
                  type="datetime-local"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            {/* Quick Add Supplier Drawer */}
            {showNewSupplier && (
              <div style={styles.quickAddBox}>
                <strong>Create New Supplier Profile</strong>
                <div style={styles.quickAddRow}>
                  <input
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="Supplier Name (Required)"
                    style={inputStyle}
                    autoFocus
                  />
                  <input
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder="Phone Number (Optional)"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={handleAddNewSupplier}
                    disabled={isCreatingSupplier}
                    style={styles.inlineSaveBtn}
                  >
                    {isCreatingSupplier ? 'Saving...' : 'Save Supplier'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Product Search & Item Entry */}
          <div style={styles.sectionBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text-strong)' }}>Add Stock Items</span>
              <button
                type="button"
                onClick={onRequestAddProduct}
                style={styles.textLinkBtn}
                title="Create a new product definition"
              >
                <i className="ti ti-plus" aria-hidden="true" /> Product missing? Create New Product
              </button>
            </div>

            <div style={styles.lineEntryGrid}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <span style={styles.labelTitle}>Search Product / Scan Barcode</span>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                      if (selectedProduct) setSelectedProduct(null);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Scan Barcode or type Name / SKU..."
                    style={{ ...inputStyle, paddingLeft: 32 }}
                    autoComplete="off"
                  />
                  <i
                    className="ti ti-search"
                    style={{ position: 'absolute', left: 10, top: 11, color: 'var(--app-muted)', fontSize: 15 }}
                  />
                </div>

                {/* Custom Product Autocomplete Dropdown */}
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div ref={dropdownRef} style={styles.dropdownList}>
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectProductItem(p)}
                        style={styles.dropdownItem}
                      >
                        <div>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--app-muted)' }}>
                            SKU: {p.sku} {p.barcode ? `| Barcode: ${p.barcode}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#16834f' }}>
                            Cost: {money(p.cost_price ?? 0)}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--app-muted)' }}>Stock: {p.stock}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ width: 110 }}>
                <span style={styles.labelTitle}>Qty</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={{ width: 130 }}>
                <span style={styles.labelTitle}>Unit Cost (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftUnitCost}
                  onChange={(e) => setDraftUnitCost(e.target.value)}
                  style={inputStyle}
                  placeholder="0.00"
                />
              </label>

              <label style={{ width: 130 }}>
                <span style={styles.labelTitle}>Selling Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftSellingPrice}
                  onChange={(e) => setDraftSellingPrice(e.target.value)}
                  style={inputStyle}
                  placeholder="Optional"
                />
              </label>

              <button
                type="button"
                onClick={handleAddLineItem}
                style={styles.addBtn}
                title="Add product to line items"
              >
                <i className="ti ti-plus" aria-hidden="true" /> Add Item
              </button>
            </div>
          </div>

          {/* Section 3: Received Items Table */}
          <div style={styles.tableWrap}>
            <table style={{ ...styles.linesTable, minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: 'center' }}>#</th>
                  <th>Product Name & SKU</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Stock</th>
                  <th style={{ width: 130 }}>Recv Qty</th>
                  <th style={{ width: 130 }}>Unit Cost (LKR)</th>
                  <th style={{ width: 130 }}>Selling Price</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Margin</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Line Total</th>
                  <th style={{ width: 50, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={styles.emptyTableTd}>
                      <i className="ti ti-package-off" style={{ fontSize: 28, color: 'var(--app-muted)', display: 'block', marginBottom: 4 }} />
                      No stock items added to invoice yet. Search or scan barcode above to add items.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => {
                    const marginPct =
                      line.selling_price > 0
                        ? (((line.selling_price - line.unit_cost) / line.selling_price) * 100).toFixed(1)
                        : null;

                    return (
                      <tr key={line.product_id} style={styles.lineTr}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--app-muted)' }}>{idx + 1}</td>
                        <td>
                          <strong>{line.product_name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--app-muted)' }}>
                            SKU: {line.sku} {line.barcode ? `| Barcode: ${line.barcode}` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={styles.stockBadge}>{line.current_stock}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => updateLineQuantity(idx, Math.max(0.001, line.quantity - 1))}
                              style={styles.stepBtn}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={line.quantity}
                              onChange={(e) => updateLineQuantity(idx, Number(e.target.value) || 0)}
                              style={{ ...inputStyle, width: 65, textAlign: 'center', padding: '4px 6px' }}
                            />
                            <button
                              type="button"
                              onClick={() => updateLineQuantity(idx, line.quantity + 1)}
                              style={styles.stepBtn}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unit_cost}
                            onChange={(e) => updateLineUnitCost(idx, Number(e.target.value) || 0)}
                            style={{ ...inputStyle, padding: '4px 6px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.selling_price}
                            onChange={(e) => updateLineSellingPrice(idx, Number(e.target.value) || 0)}
                            style={{ ...inputStyle, padding: '4px 6px' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {marginPct !== null ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 6,
                                background: Number(marginPct) >= 15 ? 'rgba(39, 174, 79, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: Number(marginPct) >= 15 ? '#16834f' : '#b42318',
                              }}
                            >
                              {marginPct}%
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--app-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(line.line_total)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            style={styles.deleteBtn}
                            title="Remove line item"
                          >
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Summary Bar */}
          <div style={styles.tableFooterBar}>
            <span>Items Count: <strong>{lines.length}</strong></span>
            <span>Total Quantity Received: <strong>{totalUnits} Units</strong></span>
            <span>Subtotal: <strong>{money(subtotal)}</strong></span>
          </div>

          {/* Section 4: Financial Adjustments & Payment Details */}
          <div style={styles.sectionBox}>
            <div style={styles.financialGrid}>
              {/* Adjustments */}
              <div style={styles.adjustmentsCol}>
                <label style={styles.field}>
                  <span>Purchase Discount (LKR)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </label>
                <label style={styles.field}>
                  <span>Purchase Tax / VAT (LKR)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </label>
                <label style={styles.field}>
                  <span>Freight / Shipping Charges</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freightAmount}
                    onChange={(e) => setFreightAmount(e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </label>
              </div>

              {/* Payment Details */}
              <div style={styles.paymentCol}>
                <label style={styles.field}>
                  <span>Payment Method</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const m = e.target.value as SupplierPurchasePaymentMethod;
                      setPaymentMethod(m);
                      if (m !== 'Credit') setPaidAmount(String(grandTotal));
                      else setPaidAmount('0');
                    }}
                    style={inputStyle}
                  >
                    <option>Cash</option>
                    <option>Credit</option>
                    <option>Bank Transfer</option>
                    <option>Online</option>
                    <option>Cheque</option>
                  </select>
                </label>

                <label style={styles.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Paid Amount (LKR)</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setPaidAmount(String(grandTotal))}
                        style={styles.microTagBtn}
                      >
                        Full Pay
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount('0')}
                        style={styles.microTagBtn}
                      >
                        Credit (0)
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={paymentMethod === 'Credit' ? '0.00' : grandTotal.toFixed(2)}
                    style={inputStyle}
                  />
                </label>

                <label style={styles.field}>
                  <span>Notes / Purchase Remarks</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional purchase details..."
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>

            {/* Total Grand Bar */}
            <div style={styles.grandSummaryBar}>
              <div>
                <span>Grand Net Total: </span>
                <strong style={{ fontSize: 20, color: 'var(--app-accent-strong, #16834f)' }}>{money(grandTotal)}</strong>
              </div>
              <div>
                <span>Paid: </span>
                <strong>{money(selectedPaid)}</strong>
              </div>
              <div>
                <span>New Supplier Credit Created: </span>
                <strong style={{ color: newBalance > 0 ? '#b42318' : '#16834f' }}>{money(newBalance)}</strong>
              </div>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.cancelBtn}>
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={(e) => handleSubmit(e, true)}
            style={styles.secondarySaveBtn}
            title="Receive stock and automatically open printable GRN receipt"
          >
            <i className="ti ti-printer" aria-hidden="true" /> Save & Print GRN
          </button>

          <button type="submit" disabled={isSaving} style={styles.saveBtn}>
            <i className="ti ti-package-import" aria-hidden="true" /> {isSaving ? 'Receiving Stock...' : 'Receive Stock'}
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
    zIndex: 20000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(2, 6, 23, 0.75)',
  },
  modal: {
    width: 'min(1080px, 100%)',
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
    alignItems: 'flex-start',
    gap: 16,
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
  title: { margin: '3px 0 0', fontSize: 20, fontWeight: 800 },
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
  formGridHeader: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1.1fr 1fr 1fr',
    gap: 12,
    alignItems: 'end',
  },
  field: { display: 'grid', gap: 4, minWidth: 0, fontSize: 12, fontWeight: 700 },
  fieldActionRow: { display: 'flex', alignItems: 'center', gap: 6 },
  inlineBtn: {
    height: 37,
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    padding: '0 10px',
    background: 'var(--app-surface, #ffffff)',
    color: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  creditBadgeBox: {
    display: 'grid',
    gap: 2,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--app-accent-soft, rgba(39,174,79,0.1))',
    color: 'var(--app-text, #1f2937)',
    fontSize: 12,
    fontWeight: 700,
  },
  quickAddBox: {
    display: 'grid',
    gap: 8,
    padding: 12,
    border: '1px solid var(--app-accent, #27AE4F)',
    borderRadius: 8,
    background: 'var(--app-accent-soft, rgba(39,174,79,0.08))',
    marginTop: 6,
  },
  quickAddRow: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 },
  inlineSaveBtn: {
    height: 37,
    border: 'none',
    borderRadius: 8,
    padding: '0 14px',
    background: 'var(--app-accent, #27AE4F)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  textLinkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--app-accent-strong, #16834f)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  lineEntryGrid: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
  },
  labelTitle: { display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 },
  dropdownList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    zIndex: 100,
    maxHeight: 220,
    overflowY: 'auto',
    background: 'var(--app-surface, #ffffff)',
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 8,
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    marginTop: 4,
  },
  dropdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--app-border-soft, #f1f5f9)',
    cursor: 'pointer',
    fontSize: 12,
  },
  addBtn: {
    height: 37,
    border: 'none',
    borderRadius: 8,
    padding: '0 16px',
    background: 'var(--app-accent, #27AE4F)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--app-border-soft, #e5e7eb)', borderRadius: 8 },
  linesTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  emptyTableTd: { padding: 30, textAlign: 'center', color: 'var(--app-muted)', fontSize: 13 },
  lineTr: { borderBottom: '1px solid var(--app-border-soft, #e5e7eb)', background: 'var(--app-surface, #ffffff)' },
  stockBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--app-surface-soft, #f1f5f9)',
    fontWeight: 700,
  },
  stepBtn: {
    width: 26,
    height: 26,
    border: '1px solid var(--app-border, #d0d5dd)',
    borderRadius: 6,
    background: 'var(--app-surface-soft, #f8fafc)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  deleteBtn: { border: 'none', background: 'transparent', color: 'var(--app-danger, #b42318)', cursor: 'pointer' },
  tableFooterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'var(--app-surface-soft, #f1f5f9)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  financialGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  adjustmentsCol: { display: 'grid', gap: 8 },
  paymentCol: { display: 'grid', gap: 8 },
  microTagBtn: {
    border: 'none',
    background: 'var(--app-accent-soft, rgba(39,174,79,0.12))',
    color: 'var(--app-accent-strong, #16834f)',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
  },
  grandSummaryBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderTop: '1px solid var(--app-border, #d0d5dd)',
    marginTop: 10,
    fontSize: 13,
    fontWeight: 700,
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
  secondarySaveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--app-accent, #27AE4F)',
    borderRadius: 8,
    padding: '9px 16px',
    background: 'var(--app-accent-soft, rgba(39,174,79,0.1))',
    color: 'var(--app-accent-strong, #16834f)',
    fontWeight: 800,
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
