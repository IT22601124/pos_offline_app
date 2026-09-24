import React, { useState } from 'react';

export interface StoreProfileInfo {
  store_name?: string;
  legal_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  currency_code?: string;
  logo_url?: string;
  logo?: string;
  receipt_footer?: string;
}

export type ConnectionType = 'bluetooth' | 'usb' | 'network';

export interface DiscoveredDevice {
  id: string;
  name: string;
  connectionType: ConnectionType;
  signalStrength?: string;
  address?: string;
  status: 'connected' | 'paired' | 'available';
  paperWidthDefault?: number;
}

export interface PrintingSettingsState {
  connectionType: ConnectionType;
  selectedDeviceId: string;
  selectedDeviceName: string;
  paperWidth: number; // in mm (e.g. 80, 58, 48, 30)
  autoPrintOnPayment: boolean;
  silentPrinting: boolean;
  directEscPos: boolean;
  autoCutPaper: boolean;
  openCashDrawer: boolean;
  printCopies: number;
  printBeeper: boolean;
  printLogoOnReceipt: boolean;
  showTaxDetails: boolean;
}

const DEFAULT_PRINTING_SETTINGS: PrintingSettingsState = {
  connectionType: 'bluetooth',
  selectedDeviceId: 'dev-01',
  selectedDeviceName: 'RPP02N Mobile Thermal (BT-58)',
  paperWidth: 58,
  autoPrintOnPayment: true,
  silentPrinting: true,
  directEscPos: true,
  autoCutPaper: true,
  openCashDrawer: false,
  printCopies: 1,
  printBeeper: true,
  printLogoOnReceipt: true,
  showTaxDetails: true,
};

const MOCK_DEVICES: DiscoveredDevice[] = [
  {
    id: 'dev-01',
    name: 'RPP02N Mobile Thermal (BT-58)',
    connectionType: 'bluetooth',
    signalStrength: 'Strong (-54 dBm)',
    address: '00:11:22:33:FF:A1',
    status: 'connected',
    paperWidthDefault: 58,
  },
  {
    id: 'dev-02',
    name: 'Epson TM-T20III (USB)',
    connectionType: 'usb',
    address: 'USB PORT 002',
    status: 'paired',
    paperWidthDefault: 80,
  },
  {
    id: 'dev-03',
    name: 'PT-260 Handheld POS Printer',
    connectionType: 'bluetooth',
    signalStrength: 'Medium (-72 dBm)',
    address: '88:44:11:99:BC:12',
    status: 'available',
    paperWidthDefault: 58,
  },
  {
    id: 'dev-04',
    name: 'Bixolon SRP-350plusIII (LAN)',
    connectionType: 'network',
    address: '192.168.1.180:9100',
    status: 'available',
    paperWidthDefault: 80,
  },
];

interface PrintingOptionsProps {
  storeProfile?: StoreProfileInfo;
  onSettingsSaved?: (settings: PrintingSettingsState) => void;
}

export const PrintingOptions: React.FC<PrintingOptionsProps> = ({
  storeProfile,
  onSettingsSaved,
}) => {
  const [settings, setSettings] = useState<PrintingSettingsState>(() => {
    const saved = localStorage.getItem('mpos_printing_options');
    if (saved) {
      try {
        return { ...DEFAULT_PRINTING_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_PRINTING_SETTINGS;
      }
    }
    return DEFAULT_PRINTING_SETTINGS;
  });

  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>(MOCK_DEVICES);
  const [showTestModal, setShowTestModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const updateSetting = <K extends keyof PrintingSettingsState>(
    key: K,
    val: PrintingSettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleScanForDevices = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const newDev: DiscoveredDevice = {
        id: `dev-${Date.now()}`,
        name: settings.connectionType === 'bluetooth' ? 'POS-5802 Mobile BT' : 'Star TSP100 USB',
        connectionType: settings.connectionType,
        signalStrength: 'Strong (-48 dBm)',
        address: settings.connectionType === 'bluetooth' ? 'DC:0D:30:19:92:44' : 'USB PORT 003',
        status: 'available',
        paperWidthDefault: settings.connectionType === 'bluetooth' ? 58 : 80,
      };
      setDiscoveredDevices((prev) => {
        if (prev.some((d) => d.address === newDev.address)) return prev;
        return [...prev, newDev];
      });
    }, 1800);
  };

  const handlePairDevice = (device: DiscoveredDevice) => {
    setDiscoveredDevices((prev) =>
      prev.map((d) => ({
        ...d,
        status: d.id === device.id ? 'connected' : d.status === 'connected' ? 'paired' : d.status,
      }))
    );
    updateSetting('selectedDeviceId', device.id);
    updateSetting('selectedDeviceName', device.name);
    if (device.paperWidthDefault) {
      updateSetting('paperWidth', device.paperWidthDefault);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('mpos_printing_options', JSON.stringify(settings));
    if (onSettingsSaved) onSettingsSaved(settings);
    setSaveSuccessMsg('Printing & Hardware preferences saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handlePrintTestPage = () => {
    setShowTestModal(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Receipt auto-scaling calculations based on width
  const paperWidth = settings.paperWidth; // mm
  const receiptPixelWidth = Math.min(Math.max(paperWidth * 3.8, 180), 340); // px preview width
  const fontSize = paperWidth <= 48 ? 10 : paperWidth <= 58 ? 11 : 13; // dynamic font size
  const logoHeight = paperWidth <= 48 ? 32 : paperWidth <= 58 ? 44 : 60; // dynamic logo scaling
  const maxLineLength = paperWidth <= 48 ? 24 : paperWidth <= 58 ? 32 : 44; // char line wrap capacity

  const storeName = storeProfile?.store_name || 'NOVA POS STORE';
  const storeAddress = [storeProfile?.address_line1, storeProfile?.city]
    .filter(Boolean)
    .join(', ') || 'Main Street, Colombo';
  const storePhone = storeProfile?.phone || '0787450360';
  const storeTaxNo = storeProfile?.tax_number || 'VAT-987654321';
  const currency = storeProfile?.currency_code || 'LKR';
  const footerText = storeProfile?.receipt_footer || 'Thank you for shopping with us!';

  return (
    <div style={styles.container}>
      {/* Header & Sync Banner */}
      <div style={styles.syncBanner}>
        <div style={styles.syncBannerIcon}>
          <i className="ti ti-refresh" aria-hidden="true" />
        </div>
        <div style={styles.syncBannerContent}>
          <h3 style={styles.syncBannerTitle}>Web Admin Syncing Model</h3>
          <p style={styles.syncBannerText}>
            Store branding (Store Name, Address, Logo, Tax ID, Receipt Footer) is managed here in the
            Web Admin and automatically synced to all mobile POS devices during background sync.
            Hardware connections (Bluetooth/USB) and local paper sizes stay on the individual handheld or desktop POS terminals.
          </p>
        </div>
      </div>

      {saveSuccessMsg && (
        <div style={styles.successNotification}>
          <i className="ti ti-check" aria-hidden="true" />
          {saveSuccessMsg}
        </div>
      )}

      {/* Main Grid */}
      <div style={styles.mainGrid}>
        {/* Left Column: Controls & Hardware Configuration */}
        <div style={styles.leftCol}>
          {/* Card 1: Hardware Connection */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitleRow}>
                <span style={styles.cardIcon}>
                  <i className="ti ti-bluetooth" aria-hidden="true" />
                </span>
                <div>
                  <h2 style={styles.cardTitle}>1. Hardware Connection</h2>
                  <p style={styles.cardSub}>Configure how the POS interacts with your local thermal printer.</p>
                </div>
              </div>
            </div>

            {/* Connection Type Switcher */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Connection Type</label>
              <div style={styles.connectionTypeGrid}>
                <button
                  type="button"
                  style={{
                    ...styles.typeBtn,
                    ...(settings.connectionType === 'bluetooth' ? styles.typeBtnActive : {}),
                  }}
                  onClick={() => updateSetting('connectionType', 'bluetooth')}
                >
                  <i className="ti ti-bluetooth" aria-hidden="true" />
                  <strong>Bluetooth</strong>
                  <span>Mobile & Handheld POS</span>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.typeBtn,
                    ...(settings.connectionType === 'usb' ? styles.typeBtnActive : {}),
                  }}
                  onClick={() => updateSetting('connectionType', 'usb')}
                >
                  <i className="ti ti-usb" aria-hidden="true" />
                  <strong>USB Cable</strong>
                  <span>Desktop & Docked Setups</span>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.typeBtn,
                    ...(settings.connectionType === 'network' ? styles.typeBtnActive : {}),
                  }}
                  onClick={() => updateSetting('connectionType', 'network')}
                >
                  <i className="ti ti-network" aria-hidden="true" />
                  <strong>Network / LAN</strong>
                  <span>Ethernet & Kitchen Printers</span>
                </button>
              </div>
            </div>

            {/* Scanner & Discovered Devices */}
            <div style={styles.fieldGroup}>
              <div style={styles.scannerHeader}>
                <div>
                  <h4 style={styles.sectionHeading}>Device Discovery</h4>
                  <p style={styles.sectionSub}>Find nearby active printers. Pair once and the system will remember.</p>
                </div>
                <button
                  type="button"
                  style={styles.scanBtn}
                  onClick={handleScanForDevices}
                  disabled={isScanning}
                >
                  <i className={`ti ${isScanning ? 'ti-loader-2 ti-spin' : 'ti-radar'}`} aria-hidden="true" />
                  {isScanning ? 'Scanning...' : 'Scan Nearby'}
                </button>
              </div>

              <div style={styles.deviceList}>
                {discoveredDevices
                  .filter((d) => d.connectionType === settings.connectionType)
                  .map((device) => {
                    const isSelected = settings.selectedDeviceId === device.id;
                    return (
                      <div
                        key={device.id}
                        style={{
                          ...styles.deviceItem,
                          ...(isSelected ? styles.deviceItemSelected : {}),
                        }}
                      >
                        <div style={styles.deviceInfo}>
                          <div style={styles.deviceNameRow}>
                            <strong>{device.name}</strong>
                            {isSelected && <span style={styles.connectedBadge}>Connected</span>}
                          </div>
                          <div style={styles.deviceDetails}>
                            <span>{device.address}</span>
                            {device.signalStrength && <span>• {device.signalStrength}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          style={{
                            ...styles.pairBtn,
                            ...(isSelected ? styles.pairBtnConnected : {}),
                          }}
                          onClick={() => handlePairDevice(device)}
                        >
                          {isSelected ? 'Paired & Active' : 'Pair Device'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>

          {/* Card 2: Paper & Layout Settings */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitleRow}>
                <span style={styles.cardIcon}>
                  <i className="ti ti-receipt" aria-hidden="true" />
                </span>
                <div>
                  <h2 style={styles.cardTitle}>2. Paper & Layout Settings</h2>
                  <p style={styles.cardSub}>Set thermal paper width. Fonts and scaling adapt automatically.</p>
                </div>
              </div>
            </div>

            {/* Paper Size Width Buttons */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Paper Size (Width)</label>
              <div style={styles.paperWidthGrid}>
                <button
                  type="button"
                  style={{
                    ...styles.paperBtn,
                    ...(settings.paperWidth === 80 ? styles.paperBtnActive : {}),
                  }}
                  onClick={() => updateSetting('paperWidth', 80)}
                >
                  <span style={styles.paperWidthTag}>80mm</span>
                  <strong>Standard Thermal</strong>
                  <small>Large counter printers (full detail)</small>
                </button>

                <button
                  type="button"
                  style={{
                    ...styles.paperBtn,
                    ...(settings.paperWidth === 58 ? styles.paperBtnActive : {}),
                  }}
                  onClick={() => updateSetting('paperWidth', 58)}
                >
                  <span style={styles.paperWidthTag}>58mm</span>
                  <strong>Portable / Handheld</strong>
                  <small>Compact mobile printers</small>
                </button>

                <button
                  type="button"
                  style={{
                    ...styles.paperBtn,
                    ...(settings.paperWidth !== 80 && settings.paperWidth !== 58 ? styles.paperBtnActive : {}),
                  }}
                  onClick={() => updateSetting('paperWidth', 48)}
                >
                  <span style={styles.paperWidthTag}>30mm - 72mm</span>
                  <strong>Custom / Mini Label</strong>
                  <small>Specialized mini printers</small>
                </button>
              </div>

              {/* Slider for custom paper width */}
              <div style={styles.sliderContainer}>
                <div style={styles.sliderHeader}>
                  <span>Adjust Width Slider:</span>
                  <strong>{settings.paperWidth} mm</strong>
                </div>
                <input
                  type="range"
                  min={30}
                  max={80}
                  step={2}
                  value={settings.paperWidth}
                  onChange={(e) => updateSetting('paperWidth', parseInt(e.target.value, 10))}
                  style={styles.sliderInput}
                />
                <div style={styles.sliderTicks}>
                  <span>30mm</span>
                  <span>48mm</span>
                  <span>58mm</span>
                  <span>72mm</span>
                  <span>80mm</span>
                </div>
              </div>
            </div>

            {/* Dynamic Scaling Info Box */}
            <div style={styles.logicNotice}>
              <i className="ti ti-cpu" aria-hidden="true" style={{ fontSize: 18 }} />
              <div>
                <strong>Auto-Scaling System Logic:</strong> When paper width changes to{' '}
                <b>{settings.paperWidth}mm</b>, the system calculates max line width to{' '}
                <b>{maxLineLength} chars</b>, sets receipt font size to <b>{fontSize}px</b>, and scales the logo height to <b>{logoHeight}px</b> so text is never cut off.
              </div>
            </div>
          </section>

          {/* Card 3: Automation Rules */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitleRow}>
                <span style={styles.cardIcon}>
                  <i className="ti ti-adjustments-alt" aria-hidden="true" />
                </span>
                <div>
                  <h2 style={styles.cardTitle}>3. Automation Rules</h2>
                  <p style={styles.cardSub}>Streamline checkout operations with automated printing commands.</p>
                </div>
              </div>
            </div>

            <div style={styles.toggleList}>
              <label style={styles.toggleRow}>
                <div style={styles.toggleInfo}>
                  <strong>Automatic Printing</strong>
                  <span>When ON, hitting "Complete Payment" sends data to printer with zero extra clicks.</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPrintOnPayment}
                  onChange={(e) => updateSetting('autoPrintOnPayment', e.target.checked)}
                  style={styles.checkbox}
                />
              </label>

              <label style={styles.toggleRow}>
                <div style={styles.toggleInfo}>
                  <strong>Silent Direct Printing (Bypass Browser Dialog)</strong>
                  <span>Send ESC/POS thermal command stream directly to printer without opening browser print preview popup window.</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.silentPrinting}
                  onChange={(e) => updateSetting('silentPrinting', e.target.checked)}
                  style={styles.checkbox}
                />
              </label>

              {settings.silentPrinting && (
                <div style={{ ...styles.logicNotice, background: 'rgba(16, 185, 129, 0.08)', borderColor: '#10B981' }}>
                  <i className="ti ti-bolt" aria-hidden="true" style={{ fontSize: 18, color: '#059669' }} />
                  <div>
                    <strong style={{ color: '#047857' }}>⚡ Silent Instant Printing Active:</strong>
                    <div style={{ fontSize: 11, marginTop: 2, color: 'var(--app-text)' }}>
                      - <b>Desktop / Counter Chrome:</b> Launch browser with <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>--kiosk-printing</code> flag for 0-second silent printing.<br />
                      - <b>Web Bluetooth / ESC-POS:</b> Sends raw thermal commands directly to hardware buffer.
                    </div>
                  </div>
                </div>
              )}

              <label style={styles.toggleRow}>
                <div style={styles.toggleInfo}>
                  <strong>Auto-Cut Paper</strong>
                  <span>Sends an electronic paper cut signal after receipt output completes.</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCutPaper}
                  onChange={(e) => updateSetting('autoCutPaper', e.target.checked)}
                  style={styles.checkbox}
                />
              </label>

              <label style={styles.toggleRow}>
                <div style={styles.toggleInfo}>
                  <strong>Open Cash Drawer</strong>
                  <span>Trigger cash drawer kick-out pulse signal upon cash payment confirmation.</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.openCashDrawer}
                  onChange={(e) => updateSetting('openCashDrawer', e.target.checked)}
                  style={styles.checkbox}
                />
              </label>

              <label style={styles.toggleRow}>
                <div style={styles.toggleInfo}>
                  <strong>Audio Beeper Alert</strong>
                  <span>Sound a buzz prompt on printer when a print job completes.</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.printBeeper}
                  onChange={(e) => updateSetting('printBeeper', e.target.checked)}
                  style={styles.checkbox}
                />
              </label>

              <div style={styles.copiesRow}>
                <div style={styles.toggleInfo}>
                  <strong>Number of Copies</strong>
                  <span>Select default number of receipt copies to print per transaction.</span>
                </div>
                <select
                  value={settings.printCopies}
                  onChange={(e) => updateSetting('printCopies', parseInt(e.target.value, 10))}
                  style={styles.selectInput}
                >
                  <option value={1}>1 Copy (Customer)</option>
                  <option value={2}>2 Copies (Customer + Store)</option>
                  <option value={3}>3 Copies (Customer + Kitchen + Store)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Action Footer */}
          <div style={styles.actionsFooter}>
            <button
              type="button"
              style={styles.testBtn}
              onClick={handlePrintTestPage}
            >
              <i className="ti ti-printer" aria-hidden="true" />
              Print Test Page
            </button>

            <button
              type="button"
              style={styles.saveBtn}
              onClick={handleSaveSettings}
            >
              <i className="ti ti-device-floppy" aria-hidden="true" />
              Save Preferences
            </button>
          </div>
        </div>

        {/* Right Column: Live Receipt Preview */}
        <div style={styles.rightCol}>
          <div style={styles.previewContainerCard}>
            <div style={styles.previewCardHeader}>
              <div>
                <h3 style={styles.previewCardTitle}>Live Receipt Layout Preview</h3>
                <p style={styles.previewCardSub}>
                  Calculated width: <b>{settings.paperWidth}mm</b> ({receiptPixelWidth}px canvas)
                </p>
              </div>
              <span style={styles.paperBadge}>{settings.paperWidth}mm</span>
            </div>

            {/* Thermal Receipt Paper Effect */}
            <div style={styles.receiptPaperWrapper}>
              <div
                style={{
                  ...styles.receiptPaper,
                  width: receiptPixelWidth,
                  fontSize: fontSize,
                }}
              >
                {/* Top Tear Cut Simulation */}
                <div style={styles.tearEdgeTop} />

                {/* Header / Logo */}
                {settings.printLogoOnReceipt && (
                  <div style={styles.receiptHeader}>
                    {storeProfile?.logo_url ? (
                      <img
                        src={storeProfile.logo_url}
                        alt="Store Logo"
                        style={{ ...styles.receiptLogoImg, height: logoHeight }}
                      />
                    ) : (
                      <div style={{ ...styles.receiptLogoBox, height: logoHeight }}>
                        <i className="ti ti-shopping-cart" aria-hidden="true" />
                        <span>NOVA POS</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={styles.receiptStoreInfo}>
                  <div style={styles.receiptTitle}>{storeName}</div>
                  <div>{storeAddress}</div>
                  <div>Tel: {storePhone}</div>
                  <div>Tax ID: {storeTaxNo}</div>
                </div>

                <div style={styles.receiptDivider}>--------------------------------</div>

                <div style={styles.receiptMeta}>
                  <div>Order #: #INV-10948</div>
                  <div>Date: {new Date().toLocaleDateString()} 14:32</div>
                  <div>Cashier: Admin (Counter 1)</div>
                </div>

                <div style={styles.receiptDivider}>--------------------------------</div>

                {/* Items */}
                <div style={styles.receiptItems}>
                  <div style={styles.receiptItemRow}>
                    <span style={styles.receiptItemName}>1x Espresso Double</span>
                    <span style={styles.receiptItemPrice}>850.00</span>
                  </div>
                  <div style={styles.receiptItemRow}>
                    <span style={styles.receiptItemName}>2x Butter Croissant</span>
                    <span style={styles.receiptItemPrice}>1,100.00</span>
                  </div>
                  <div style={styles.receiptItemRow}>
                    <span style={styles.receiptItemName}>1x Iced Caramel Latte</span>
                    <span style={styles.receiptItemPrice}>950.00</span>
                  </div>
                </div>

                <div style={styles.receiptDivider}>--------------------------------</div>

                {/* Summary */}
                <div style={styles.receiptTotals}>
                  <div style={styles.receiptTotalRow}>
                    <span>Subtotal:</span>
                    <span>{currency} 2,900.00</span>
                  </div>
                  {settings.showTaxDetails && (
                    <div style={styles.receiptTotalRow}>
                      <span>Tax:</span>
                      <span>{currency} 0.00</span>
                    </div>
                  )}
                  <div style={{ ...styles.receiptTotalRow, ...styles.receiptGrandTotal }}>
                    <span>TOTAL:</span>
                    <span>{currency} 3,132.00</span>
                  </div>
                  <div style={styles.receiptTotalRow}>
                    <span>Paid Cash:</span>
                    <span>{currency} 3,500.00</span>
                  </div>
                  <div style={styles.receiptTotalRow}>
                    <span>Change:</span>
                    <span>{currency} 368.00</span>
                  </div>
                </div>

                <div style={styles.receiptDivider}>--------------------------------</div>

                {/* Footer */}
                <div style={styles.receiptFooter}>
                  <p style={{ margin: 0 }}>{footerText}</p>
                  <div style={styles.barcodeSim}>
                    ||||| ||| ||||||| |||| |||||
                  </div>
                  <small style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>
                    Device: {settings.selectedDeviceName}
                  </small>
                </div>

                {/* Bottom Tear Cut Simulation */}
                <div style={styles.tearEdgeBottom} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics Test Page Modal */}
      {showTestModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowTestModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderTitle}>
                <i className="ti ti-printer" aria-hidden="true" />
                <h3>Print Diagnostics & Alignment Test Page</h3>
              </div>
              <button
                type="button"
                style={styles.modalCloseBtn}
                onClick={() => setShowTestModal(false)}
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--app-muted)' }}>
                Printing this test page verifies that your thermal head alignment, character wrapping, and printer connection are operating properly.
              </p>

              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-test-receipt, #printable-test-receipt * {
                    visibility: visible !important;
                  }
                  #printable-test-receipt {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 380px !important;
                    margin: 0 auto !important;
                    border: 1px dashed #000 !important;
                    box-shadow: none !important;
                    background: #fff !important;
                    color: #000 !important;
                  }
                }
              `}</style>

              <div id="printable-test-receipt" style={styles.testTicketBox}>
                <div style={styles.testTicketHeader}>
                  <h2>NOVA POS</h2>
                  <p>HARDWARE DIAGNOSTIC TEST PAGE</p>
                </div>
                <div style={styles.testTicketGrid}>
                  <div><strong>Store Name:</strong> {storeName}</div>
                  <div><strong>Connection:</strong> {settings.connectionType.toUpperCase()}</div>
                  <div><strong>Device Name:</strong> {settings.selectedDeviceName}</div>
                  <div><strong>Paper Width:</strong> {settings.paperWidth} mm</div>
                  <div><strong>Max Line Chars:</strong> {maxLineLength} chars</div>
                  <div><strong>Date / Time:</strong> {new Date().toLocaleString()}</div>
                </div>
                <div style={styles.alignmentGrid}>
                  <div style={{ fontWeight: 'bold' }}>ALIGNMENT PATTERN:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    [012345678901234567890123456789]
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    [LEFT aligned line-----------------RIGHT]
                  </div>
                </div>
                <div style={styles.testStatusTag}>
                  <i className="ti ti-check" aria-hidden="true" /> PRINTER HARDWARE READY
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.modalSecondaryBtn}
                onClick={() => setShowTestModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                style={styles.modalPrimaryBtn}
                onClick={() => {
                  window.print();
                }}
              >
                <i className="ti ti-printer" aria-hidden="true" />
                Trigger Hardware Test Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  syncBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '14px 18px',
    borderRadius: 10,
    background: 'var(--app-accent-soft, rgba(83, 74, 183, 0.08))',
    border: '1px solid var(--app-accent-strong, #534AB7)',
    color: 'var(--app-text)',
  },
  syncBannerIcon: {
    fontSize: 22,
    color: 'var(--app-accent-strong, #534AB7)',
    marginTop: 2,
  },
  syncBannerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  syncBannerTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  syncBannerText: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--app-text)',
  },
  successNotification: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 8,
    background: '#10B98122',
    border: '1px solid #10B981',
    color: '#047857',
    fontWeight: 600,
    fontSize: 13,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gap: 20,
    alignItems: 'start',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  rightCol: {
    position: 'sticky',
    top: 20,
  },
  card: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  cardHeader: {
    borderBottom: '1px solid var(--app-border-soft)',
    paddingBottom: 12,
  },
  cardHeaderTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: 'var(--app-accent-soft, rgba(83,74,183,0.1))',
    color: 'var(--app-accent-strong, #534AB7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  cardSub: {
    margin: '2px 0 0',
    fontSize: 12,
    color: 'var(--app-muted)',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  connectionTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  typeBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '14px 10px',
    borderRadius: 10,
    border: '1px solid var(--app-border)',
    background: 'var(--app-surface)',
    color: 'var(--app-text)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  },
  typeBtnActive: {
    borderColor: 'var(--app-accent-strong, #534AB7)',
    background: 'var(--app-accent-soft, rgba(83,74,183,0.08))',
    color: 'var(--app-accent-strong, #534AB7)',
    fontWeight: 700,
  },
  scannerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  sectionSub: {
    margin: '2px 0 0',
    fontSize: 11,
    color: 'var(--app-muted)',
  },
  scanBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deviceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 6,
  },
  deviceItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--app-border)',
    background: 'var(--app-surface-soft)',
  },
  deviceItemSelected: {
    borderColor: 'var(--app-accent-strong, #534AB7)',
    background: 'var(--app-accent-soft, rgba(83,74,183,0.04))',
  },
  deviceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  deviceNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--app-text-strong)',
  },
  connectedBadge: {
    padding: '2px 6px',
    borderRadius: 4,
    background: '#10B98122',
    color: '#059669',
    fontSize: 10,
    fontWeight: 700,
  },
  deviceDetails: {
    fontSize: 11,
    color: 'var(--app-muted)',
  },
  pairBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  pairBtnConnected: {
    background: 'var(--app-accent-strong, #534AB7)',
    color: '#fff',
    borderColor: 'var(--app-accent-strong, #534AB7)',
  },
  paperWidthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  paperBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--app-border)',
    background: 'var(--app-surface)',
    color: 'var(--app-text)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  paperBtnActive: {
    borderColor: 'var(--app-accent-strong, #534AB7)',
    background: 'var(--app-accent-soft, rgba(83,74,183,0.08))',
  },
  paperWidthTag: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--app-accent-strong, #534AB7)',
    background: 'var(--app-accent-soft, rgba(83,74,183,0.15))',
    padding: '2px 6px',
    borderRadius: 4,
  },
  sliderContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 8,
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    border: '1px solid var(--app-border)',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: 'var(--app-text)',
  },
  sliderInput: {
    width: '100%',
    cursor: 'pointer',
  },
  sliderTicks: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: 'var(--app-muted)',
  },
  logicNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    border: '1px solid var(--app-border-soft)',
    fontSize: 12,
    color: 'var(--app-text)',
    lineHeight: 1.4,
  },
  toggleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    paddingBottom: 10,
    borderBottom: '1px solid var(--app-border-soft)',
  },
  toggleInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 13,
    color: 'var(--app-text-strong)',
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
  },
  copiesRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectInput: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-surface)',
    color: 'var(--app-text)',
    fontSize: 13,
    cursor: 'pointer',
  },
  actionsFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  testBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    color: 'var(--app-text)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 22px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--app-accent-strong, #534AB7)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  previewContainerCard: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  previewCardHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--app-border-soft)',
    paddingBottom: 10,
  },
  previewCardTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  previewCardSub: {
    margin: '2px 0 0',
    fontSize: 11,
    color: 'var(--app-muted)',
  },
  paperBadge: {
    padding: '3px 8px',
    borderRadius: 4,
    background: 'var(--app-accent-strong, #534AB7)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
  },
  receiptPaperWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 0',
    background: '#1118270A',
    width: '100%',
    borderRadius: 8,
    overflowX: 'auto',
  },
  receiptPaper: {
    background: '#FFFFFF',
    color: '#111111',
    fontFamily: '"Courier New", Courier, monospace',
    padding: '16px 12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    borderRadius: 2,
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  tearEdgeTop: {
    height: 4,
    borderTop: '2px dashed #D1D5DB',
    marginBottom: 8,
  },
  tearEdgeBottom: {
    height: 4,
    borderBottom: '2px dashed #D1D5DB',
    marginTop: 12,
  },
  receiptHeader: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 6,
  },
  receiptLogoImg: {
    maxWidth: '100%',
    objectFit: 'contain',
  },
  receiptLogoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 'bold',
    fontSize: 14,
    color: '#111827',
  },
  receiptStoreInfo: {
    textAlign: 'center',
    lineHeight: 1.3,
  },
  receiptTitle: {
    fontWeight: 'bold',
    fontSize: '1.1em',
    marginBottom: 2,
  },
  receiptDivider: {
    textAlign: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    letterSpacing: -1,
    color: '#6B7280',
    margin: '4px 0',
  },
  receiptMeta: {
    lineHeight: 1.35,
    fontSize: '0.9em',
  },
  receiptItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  receiptItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    lineHeight: 1.3,
  },
  receiptItemName: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '70%',
  },
  receiptItemPrice: {
    fontWeight: 600,
  },
  receiptTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  receiptTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  receiptGrandTotal: {
    fontWeight: 'bold',
    fontSize: '1.15em',
    margin: '4px 0',
    borderTop: '1px solid #111',
    borderBottom: '1px solid #111',
    padding: '3px 0',
  },
  receiptFooter: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: '0.85em',
  },
  barcodeSim: {
    letterSpacing: 2,
    fontWeight: 'bold',
    marginTop: 6,
    fontSize: 12,
  },

  // Modal Styles
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalContent: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 520,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--app-border)',
  },
  modalHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 16,
    color: 'var(--app-text-strong)',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: 'var(--app-muted)',
    cursor: 'pointer',
  },
  modalBody: {
    padding: 20,
  },
  testTicketBox: {
    background: '#FFFFFF',
    color: '#000000',
    fontFamily: '"Courier New", Courier, monospace',
    padding: 16,
    borderRadius: 6,
    border: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  testTicketHeader: {
    textAlign: 'center',
    borderBottom: '2px solid #000',
    paddingBottom: 8,
  },
  testTicketGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    fontSize: 11,
  },
  alignmentGrid: {
    borderTop: '1px dashed #000',
    paddingTop: 8,
    fontSize: 11,
  },
  testStatusTag: {
    textAlign: 'center',
    fontWeight: 'bold',
    background: '#10B9811A',
    color: '#059669',
    padding: '6px',
    borderRadius: 4,
    fontSize: 12,
    marginTop: 4,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '14px 20px',
    borderTop: '1px solid var(--app-border)',
    background: 'var(--app-surface-soft)',
  },
  modalSecondaryBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    color: 'var(--app-text)',
    cursor: 'pointer',
  },
  modalPrimaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--app-accent-strong, #534AB7)',
    color: '#FFFFFF',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default PrintingOptions;
