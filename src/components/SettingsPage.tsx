import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import apiClient from '../api/clients';
import { type AdminOutletContext } from '../App';
import { type AppThemeMode } from '../theme/app_theme';
import PrintingOptions from './PrintingOptions';

interface StoreProfile {
  id?: number;
  store_name: string;
  legal_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  phone: string;
  email: string;
  tax_number: string;
  currency_code: string;
  logo: string;
  logo_url: string;
  receipt_footer: string;
  status: boolean;
}

interface StoreProfileResponse {
  success?: boolean;
  logo?: string;
  logo_url?: string;
  store_profile?: Partial<StoreProfile> | null;
}

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

const STORE_PROFILE_ENDPOINT = 'settings/store-profile';
const STORE_PROFILE_LOGO_ENDPOINT = 'settings/store-profile/logo';
const API_BASE_URL = 'https://mpos.studiorespectweddings.com';

const EMPTY_STORE_PROFILE: StoreProfile = {
  store_name: '',
  legal_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  phone: '',
  email: '',
  tax_number: '',
  currency_code: 'LKR',
  logo: '',
  logo_url: '',
  receipt_footer: '',
  status: true,
};

const THEME_OPTIONS: Array<{
  id: AppThemeMode;
  label: string;
  icon: string;
  description: string;
}> = [
    {
      id: 'light',
      label: 'Light',
      icon: 'ti-sun',
      description: 'Bright workspace for daytime counters and office use.',
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: 'ti-moon',
      description: 'Low-glare workspace for cashier screens and night shifts.',
    },
  ];

const normalizeStoreProfile = (profile?: Partial<StoreProfile> | null): StoreProfile => ({
  ...EMPTY_STORE_PROFILE,
  ...profile,
  store_name: profile?.store_name ?? '',
  legal_name: profile?.legal_name ?? '',
  address_line1: profile?.address_line1 ?? '',
  address_line2: profile?.address_line2 ?? '',
  city: profile?.city ?? '',
  phone: profile?.phone ?? '',
  email: profile?.email ?? '',
  tax_number: profile?.tax_number ?? '',
  currency_code: profile?.currency_code ?? 'LKR',
  logo: profile?.logo ?? '',
  logo_url: profile?.logo_url ?? '',
  receipt_footer: profile?.receipt_footer ?? '',
  status: profile?.status !== false,
});

const buildStorePayload = (profile: StoreProfile) => ({
  store_name: profile.store_name.trim(),
  legal_name: profile.legal_name.trim(),
  address_line1: profile.address_line1.trim(),
  address_line2: profile.address_line2.trim(),
  city: profile.city.trim(),
  phone: profile.phone.trim(),
  email: profile.email.trim(),
  tax_number: profile.tax_number.trim(),
  currency_code: profile.currency_code.trim() || 'LKR',
  receipt_footer: profile.receipt_footer.trim(),
  status: profile.status,
});

const getLogoSrc = (profile?: Partial<StoreProfile> | null) => {
  if (!profile) return '';

  if (profile.logo_url) return profile.logo_url;
  if (profile.logo?.startsWith('http')) return profile.logo;
  if (profile.logo?.startsWith('/uploads')) return `${API_BASE_URL}${profile.logo}`;

  return '';
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as { message?: string; error?: string } | undefined;
    return responseData?.message ?? responseData?.error ?? fallback;
  }

  return fallback;
};

import { offlineExportDatabase, offlineImportDatabase } from '../offline/offlineAdapter';
import { initializeOfflineDatabase } from '../offline/seed';

export type SettingsTab = 'store' | 'printing' | 'appearance' | 'database';

const SettingsPage: React.FC = () => {
  const { theme, onThemeChange } = useOutletContext<AdminOutletContext>();
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');
  const [backupMessage, setBackupMessage] = useState<MessageState>(null);
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);

  const [storeProfile, setStoreProfile] = useState<StoreProfile>(EMPTY_STORE_PROFILE);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isStoreEditing, setIsStoreEditing] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [storeMessage, setStoreMessage] = useState<MessageState>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStoreProfile = async () => {
      setIsLoadingStore(true);
      setStoreMessage(null);

      try {
        const response = await apiClient.get<StoreProfileResponse>(STORE_PROFILE_ENDPOINT);
        if (!isMounted) return;

        const profile = response.data.store_profile;
        console.log('Store profile:', profile);
        setStoreProfile(normalizeStoreProfile(profile));
        setIsStoreEditing(!profile);
        if (!profile) {
          setStoreMessage({ type: 'info', text: 'No store profile found yet. Complete the form and save it.' });
        }
      } catch (error) {
        if (!isMounted) return;

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setStoreProfile(EMPTY_STORE_PROFILE);
          setIsStoreEditing(true);
          setStoreMessage({ type: 'info', text: 'No store profile found yet. Complete the form and save it.' });
        } else {
          setStoreMessage({ type: 'error', text: getApiErrorMessage(error, 'Store profile could not be loaded.') });
        }
      } finally {
        if (isMounted) {
          setIsLoadingStore(false);
        }
      }
    };

    fetchStoreProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const updateStoreField = <K extends keyof StoreProfile>(field: K, value: StoreProfile[K]) => {
    setStoreProfile((current) => ({ ...current, [field]: value }));
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some((extension) => fileName.endsWith(extension));
    if (!allowedTypes.includes(file.type) || !hasAllowedExtension) {
      setStoreMessage({ type: 'error', text: 'Please choose a PNG, JPG, JPEG, or WEBP image file.' });
      event.target.value = '';
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setSelectedLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setStoreMessage({ type: 'info', text: `${file.name} selected. Click Upload Logo to send it.` });
  };

  const clearSelectedLogoFile = () => {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setSelectedLogoFile(null);
    setLogoPreviewUrl('');
  };

  const uploadLogo = async () => {
    if (!selectedLogoFile) {
      setStoreMessage({ type: 'error', text: 'Choose a logo image before uploading.' });
      return;
    }

    const formData = new FormData();
    formData.append('logo', selectedLogoFile);
    setIsUploadingLogo(true);
    setStoreMessage(null);

    try {
      const response = await apiClient.post<StoreProfileResponse>(STORE_PROFILE_LOGO_ENDPOINT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedProfile = normalizeStoreProfile({
        ...storeProfile,
        logo: response.data.logo ?? storeProfile.logo,
        logo_url: response.data.logo_url ?? storeProfile.logo_url,
        ...response.data.store_profile,
      });

      setStoreProfile(uploadedProfile);
      clearSelectedLogoFile();
      setStoreMessage({ type: 'success', text: 'Store logo uploaded successfully.' });
    } catch (error) {
      setStoreMessage({ type: 'error', text: getApiErrorMessage(error, 'Store logo could not be uploaded.') });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const saveStoreProfile = async () => {
    if (!storeProfile.store_name.trim()) {
      setStoreMessage({ type: 'error', text: 'Store Name is required before saving.' });
      return;
    }

    const payload = buildStorePayload(storeProfile);
    setIsSavingStore(true);
    setStoreMessage(null);

    try {
      let response;

      try {
        response = await apiClient.put<StoreProfileResponse>(STORE_PROFILE_ENDPOINT, payload);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          response = await apiClient.post<StoreProfileResponse>(STORE_PROFILE_ENDPOINT, payload);
        } else {
          throw error;
        }
      }

      const savedProfile = response.data.store_profile ?? { ...storeProfile, ...payload };
      const normalized = normalizeStoreProfile(savedProfile);
      setStoreProfile(normalized);
      localStorage.setItem('mpos_store_profile', JSON.stringify(normalized));
      setIsStoreEditing(false);
      setStoreMessage({ type: 'success', text: 'Store profile saved successfully.' });
    } catch (error) {
      setStoreMessage({ type: 'error', text: getApiErrorMessage(error, 'Store profile could not be saved.') });
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setIsProcessingBackup(true);
      setBackupMessage(null);
      const json = await offlineExportDatabase();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `mpos_backup_${dateStr}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage({ type: 'success', text: 'Database exported successfully as JSON file.' });
    } catch (err) {
      setBackupMessage({ type: 'error', text: 'Failed to export database backup.' });
    } finally {
      setIsProcessingBackup(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsProcessingBackup(true);
        setBackupMessage(null);
        const jsonContent = event.target?.result as string;
        await offlineImportDatabase(jsonContent);
        setBackupMessage({ type: 'success', text: 'Database restored successfully! Reloading page...' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setBackupMessage({ type: 'error', text: 'Failed to restore database from file.' });
      } finally {
        setIsProcessingBackup(false);
      }
    };
    reader.readAsText(file);
  };

  const handleResetSeedData = async () => {
    if (!window.confirm('Are you sure you want to reset the database to default seed data? All custom data will be replaced.')) {
      return;
    }
    try {
      setIsProcessingBackup(true);
      setBackupMessage(null);
      localStorage.clear();
      await initializeOfflineDatabase();
      setBackupMessage({ type: 'success', text: 'Database reset to default seed data. Reloading...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setBackupMessage({ type: 'error', text: 'Failed to reset seed data.' });
    } finally {
      setIsProcessingBackup(false);
    }
  };

  const activeLogoPreview = logoPreviewUrl || getLogoSrc(storeProfile);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Settings</h1>
          <p style={styles.pageSub}>Control system display preferences, store identity, and offline database backup.</p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div style={styles.tabContainer}>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'store' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab('store')}
        >
          <i className="ti ti-building-store" aria-hidden="true" />
          Store Profile & Branding
        </button>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'printing' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab('printing')}
        >
          <i className="ti ti-printer" aria-hidden="true" />
          Printing & Hardware Options
        </button>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'appearance' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab('appearance')}
        >
          <i className="ti ti-palette" aria-hidden="true" />
          System Appearance
        </button>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(activeTab === 'database' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab('database')}
        >
          <i className="ti ti-database" aria-hidden="true" />
          Offline Data & Backup
        </button>
      </div>

      {activeTab === 'database' && (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>
              <i className="ti ti-database" aria-hidden="true" />
            </span>
            <div>
              <h2 style={styles.panelTitle}>Offline Database Management (IndexedDB)</h2>
              <p style={styles.panelSub}>Backup your complete sales, products, inventory, and store data to a local file.</p>
            </div>
          </div>

          {backupMessage && (
            <div
              style={{
                padding: '12px 16px',
                margin: '16px 20px',
                borderRadius: 8,
                background: backupMessage.type === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                color: backupMessage.type === 'success' ? '#2ecc71' : '#e74c3c',
                fontWeight: 600,
              }}
            >
              {backupMessage.text}
            </div>
          )}

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ padding: 16, border: '1px solid var(--app-border)', borderRadius: 8, background: 'var(--app-bg-secondary)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>📥 Download Full Database Backup</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--app-text-subtle)' }}>
                Export all products, sales history, customers, inventory stock, and settings as a timestamped JSON file.
              </p>
              <button
                type="button"
                style={{
                  padding: '10px 18px',
                  borderRadius: 6,
                  background: '#27ae60',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                disabled={isProcessingBackup}
                onClick={handleExportBackup}
              >
                <i className="ti ti-download" />
                Export Database (.json)
              </button>
            </div>

            <div style={{ padding: 16, border: '1px solid var(--app-border)', borderRadius: 8, background: 'var(--app-bg-secondary)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>📤 Restore Database from File</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--app-text-subtle)' }}>
                Select a previously saved backup file to restore full system data.
              </p>
              <label
                style={{
                  padding: '10px 18px',
                  borderRadius: 6,
                  background: '#2980b9',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <i className="ti ti-upload" />
                Select & Restore JSON File
                <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ padding: 16, border: '1px solid #e74c3c', borderRadius: 8, background: 'rgba(231, 76, 60, 0.05)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#e74c3c' }}>🔄 Reset Database to Default Seed Data</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--app-text-subtle)' }}>
                Re-initialize database with default admin account, categories, and sample products.
              </p>
              <button
                type="button"
                style={{
                  padding: '10px 18px',
                  borderRadius: 6,
                  background: '#c0392b',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                disabled={isProcessingBackup}
                onClick={handleResetSeedData}
              >
                <i className="ti ti-refresh" />
                Reset DB to Initial Seed
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'printing' && (
        <PrintingOptions storeProfile={storeProfile} />
      )}


      {activeTab === 'appearance' && (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelIcon}>
              <i className="ti ti-palette" aria-hidden="true" />
            </span>
            <div>
              <h2 style={styles.panelTitle}>Appearance</h2>
              <p style={styles.panelSub}>Choose how the full admin and POS system should display.</p>
            </div>
          </div>

          <div style={{ ...styles.themeGrid, padding: 20 }}>
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.id;

              return (
                <button
                  key={option.id}
                  style={{
                    ...styles.themeCard,
                    ...(isActive ? styles.themeCardActive : {}),
                  }}
                  onClick={() => onThemeChange(option.id)}
                  aria-pressed={isActive}
                >
                  <span style={styles.themeCardTop}>
                    <span style={styles.themeIcon}>
                      <i className={`ti ${option.icon}`} aria-hidden="true" />
                    </span>
                    <span style={styles.radio}>
                      {isActive && <span style={styles.radioDot} />}
                    </span>
                  </span>
                  <strong style={styles.themeLabel}>{option.label}</strong>
                  <span style={styles.themeDescription}>{option.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'store' && (
        <div style={styles.settingsGrid}>
          <section style={{ ...styles.panel, ...styles.storePanel }}>
            <div style={styles.panelHeader}>
              <span style={styles.panelIcon}>
                <i className="ti ti-building-store" aria-hidden="true" />
              </span>
              <div>
                <h2 style={styles.panelTitle}>Store Management</h2>
                <p style={styles.panelSub}>Maintain store profile details used on receipts and POS screens.</p>
              </div>
            </div>

            {isLoadingStore ? (
              <div style={styles.loadingBox}>
                <i className="ti ti-loader-2" aria-hidden="true" />
                Loading store profile...
              </div>
            ) : (
              <div style={styles.storeBody}>
                {storeMessage && (
                  <div
                    style={{
                      ...styles.message,
                      ...(storeMessage.type === 'success' ? styles.messageSuccess : {}),
                      ...(storeMessage.type === 'error' ? styles.messageError : {}),
                    }}
                  >
                    {storeMessage.text}
                  </div>
                )}

                {!isStoreEditing ? (
                  <>
                    <div style={styles.profileSummary}>
                      <div style={styles.summaryLogo}>
                        {activeLogoPreview ? (
                          <img
                            src={activeLogoPreview}
                            alt="Store logo"
                            style={styles.logoImage}
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span style={styles.logoPlaceholder}>
                            <i className="ti ti-photo" aria-hidden="true" />
                            No logo
                          </span>
                        )}
                      </div>
                      <div style={styles.summaryDetails}>
                        <div style={styles.summaryTitleRow}>
                          <div>
                            <h3 style={styles.summaryTitle}>{storeProfile.store_name || 'Store profile'}</h3>
                            <p style={styles.summarySub}>{storeProfile.legal_name || 'Legal name not set'}</p>
                          </div>
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...(storeProfile.status ? styles.statusBadgeActive : {}),
                            }}
                          >
                            {storeProfile.status ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div style={styles.summaryGrid}>
                          <span style={styles.summaryItem}><small>Address</small><strong>{storeProfile.address_line1 || 'Not set'}</strong></span>
                          <span style={styles.summaryItem}><small>City</small><strong>{storeProfile.city || 'Not set'}</strong></span>
                          <span style={styles.summaryItem}><small>Phone</small><strong>{storeProfile.phone || 'Not set'}</strong></span>
                          <span style={styles.summaryItem}><small>Email</small><strong>{storeProfile.email || 'Not set'}</strong></span>
                          <span style={styles.summaryItem}><small>Tax Number</small><strong>{storeProfile.tax_number || 'Not set'}</strong></span>
                          <span style={styles.summaryItem}><small>Currency</small><strong>{storeProfile.currency_code || 'LKR'}</strong></span>
                        </div>

                        <div style={{ ...styles.footerPreview, ...styles.summaryItem }}>
                          <small>Receipt footer</small>
                          <strong>{storeProfile.receipt_footer || 'Not set'}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={styles.actions}>
                      <button style={styles.editButton} onClick={() => setIsStoreEditing(true)}>
                        <i className="ti ti-pencil" aria-hidden="true" />
                        Edit Store Profile
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.editHeader}>
                      <div>
                        <h3 style={styles.editTitle}>Edit Store Profile</h3>
                        <p style={styles.editSub}>Update the information printed on receipts and shown in POS.</p>
                      </div>
                      {storeProfile.store_name && (
                        <button
                          style={styles.cancelButton}
                          onClick={() => {
                            clearSelectedLogoFile();
                            setIsStoreEditing(false);
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div style={styles.storeLayout}>
                      <div style={styles.formGrid}>
                        <label style={styles.field}>
                          <span>Store Name <b>*</b></span>
                          <input
                            style={styles.input}
                            value={storeProfile.store_name}
                            onChange={(event) => updateStoreField('store_name', event.target.value)}
                            placeholder="MPOS Store"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Legal Name</span>
                          <input
                            style={styles.input}
                            value={storeProfile.legal_name}
                            onChange={(event) => updateStoreField('legal_name', event.target.value)}
                            placeholder="MPOS Store"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Address Line 1</span>
                          <input
                            style={styles.input}
                            value={storeProfile.address_line1}
                            onChange={(event) => updateStoreField('address_line1', event.target.value)}
                            placeholder="No 01, Main Street"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Address Line 2</span>
                          <input
                            style={styles.input}
                            value={storeProfile.address_line2}
                            onChange={(event) => updateStoreField('address_line2', event.target.value)}
                            placeholder="Building, floor, area"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>City</span>
                          <input
                            style={styles.input}
                            value={storeProfile.city}
                            onChange={(event) => updateStoreField('city', event.target.value)}
                            placeholder="Colombo"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Phone Number</span>
                          <input
                            style={styles.input}
                            value={storeProfile.phone}
                            onChange={(event) => updateStoreField('phone', event.target.value)}
                            placeholder="0787450360"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Email</span>
                          <input
                            style={styles.input}
                            type="email"
                            value={storeProfile.email}
                            onChange={(event) => updateStoreField('email', event.target.value)}
                            placeholder="store@mpos.local"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Tax Number</span>
                          <input
                            style={styles.input}
                            value={storeProfile.tax_number}
                            onChange={(event) => updateStoreField('tax_number', event.target.value)}
                            placeholder="VAT / tax reference"
                          />
                        </label>

                        <label style={styles.field}>
                          <span>Currency Code</span>
                          <input
                            style={styles.input}
                            value={storeProfile.currency_code}
                            onChange={(event) => updateStoreField('currency_code', event.target.value.toUpperCase())}
                            placeholder="LKR"
                          />
                        </label>

                        <label style={{ ...styles.field, ...styles.fullField }}>
                          <span>Receipt Footer</span>
                          <textarea
                            style={{ ...styles.input, ...styles.textarea }}
                            value={storeProfile.receipt_footer}
                            onChange={(event) => updateStoreField('receipt_footer', event.target.value)}
                            placeholder="Thank you. Come again."
                          />
                        </label>
                      </div>

                      <aside style={styles.previewCard}>
                        <div style={styles.previewHeader}>
                          <div>
                            <h4 style={styles.previewTitle}>Logo & Status</h4>
                            <p style={styles.previewSub}>Upload a logo or paste an existing logo URL.</p>
                          </div>
                        </div>

                        <div style={styles.logoPreview}>
                          {activeLogoPreview ? (
                            <img
                              src={activeLogoPreview}
                              alt="Store logo"
                              style={styles.logoImage}
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span style={styles.logoPlaceholder}>
                              <i className="ti ti-photo" aria-hidden="true" />
                              Logo preview
                            </span>
                          )}
                        </div>

                        <label style={styles.uploadButton}>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleLogoFileChange}
                            style={styles.fileInput}
                          />
                          <i className="ti ti-photo-up" aria-hidden="true" />
                          {selectedLogoFile ? 'Change selected file' : 'Choose logo file'}
                        </label>

                        {selectedLogoFile && (
                          <div style={styles.selectedFileRow}>
                            <span>
                              <strong>{selectedLogoFile.name}</strong>
                              <small>Ready to upload</small>
                            </span>
                            <button
                              type="button"
                              style={styles.removeUploadIconButton}
                              onClick={clearSelectedLogoFile}
                            >
                              <i className="ti ti-x" aria-hidden="true" />
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          style={{
                            ...styles.saveButton,
                            ...(!selectedLogoFile || isUploadingLogo ? styles.saveButtonDisabled : {}),
                          }}
                          onClick={uploadLogo}
                          disabled={!selectedLogoFile || isUploadingLogo}
                        >
                          <i className={`ti ${isUploadingLogo ? 'ti-loader-2' : 'ti-upload'}`} aria-hidden="true" />
                          {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                        </button>

                        <div style={styles.previewInfo}>
                          <label style={styles.field}>
                            <span>Logo Image Path/URL</span>
                            <input
                              style={styles.input}
                              value={storeProfile.logo}
                              onChange={(event) => updateStoreField('logo', event.target.value)}
                              placeholder="/uploads/store_logo.png"
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          style={{
                            ...styles.statusToggle,
                            ...(storeProfile.status ? styles.statusToggleActive : {}),
                          }}
                          onClick={() => updateStoreField('status', !storeProfile.status)}
                        >
                          <span style={styles.statusKnob} />
                          {storeProfile.status ? 'Store Active' : 'Store Inactive'}
                        </button>
                      </aside>
                    </div>

                    <div style={styles.actions}>
                      <button
                        style={{
                          ...styles.saveButton,
                          ...(isSavingStore ? styles.saveButtonDisabled : {}),
                        }}
                        onClick={saveStoreProfile}
                        disabled={isSavingStore}
                      >
                        <i className={`ti ${isSavingStore ? 'ti-loader-2' : 'ti-device-floppy'}`} aria-hidden="true" />
                        {isSavingStore ? 'Saving...' : 'Save Store Profile'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--app-text-strong)',
  },
  pageSub: {
    fontSize: 13,
    color: 'var(--app-muted)',
    marginTop: 2,
  },
  tabContainer: {
    display: 'flex',
    gap: 8,
    borderBottom: '1px solid var(--app-border)',
    marginBottom: 20,
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: 'var(--app-muted)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    color: 'var(--app-accent-strong)',
    borderBottomColor: 'var(--app-accent-strong)',
    fontWeight: 700,
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 0.78fr) minmax(520px, 1.22fr)',
    gap: 16,
    alignItems: 'start',
  },
  panel: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    boxShadow: 'var(--app-shadow)',
    overflow: 'hidden',
  },
  storePanel: {
    minWidth: 0,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid var(--app-border-soft)',
  },
  panelIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    fontSize: 20,
    flex: '0 0 auto',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--app-text-strong)',
  },
  panelSub: {
    marginTop: 2,
    fontSize: 12,
    color: 'var(--app-muted)',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    padding: 16,
  },
  themeCard: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    color: 'var(--app-text)',
    padding: 16,
    display: 'grid',
    gap: 10,
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  themeCardActive: {
    borderColor: 'var(--app-accent)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--app-accent) 18%, transparent)',
  },
  themeCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  themeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    color: 'var(--app-accent-strong)',
    fontSize: 18,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid var(--app-accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--app-accent)',
  },
  themeLabel: {
    color: 'var(--app-text-strong)',
    fontSize: 15,
  },
  themeDescription: {
    color: 'var(--app-muted)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  loadingBox: {
    minHeight: 220,
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 10,
    color: 'var(--app-muted)',
    fontSize: 13,
  },
  storeBody: {
    display: 'grid',
    gap: 14,
    padding: 16,
  },
  profileSummary: {
    display: 'grid',
    gridTemplateColumns: '180px minmax(0, 1fr)',
    gap: 16,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    padding: 14,
  },
  summaryLogo: {
    minHeight: 150,
    border: '1px dashed var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  summaryDetails: {
    display: 'grid',
    gap: 14,
    minWidth: 0,
  },
  summaryTitleRow: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTitle: {
    margin: 0,
    color: 'var(--app-text-strong)',
    fontSize: 20,
    fontWeight: 800,
  },
  summarySub: {
    margin: '3px 0 0',
    color: 'var(--app-muted)',
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 999,
    border: '1px solid var(--app-border)',
    color: 'var(--app-muted)',
    background: 'var(--app-surface)',
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  statusBadgeActive: {
    borderColor: 'var(--app-accent)',
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  summaryItem: {
    display: 'grid',
    gap: 3,
    minWidth: 0,
  },
  footerPreview: {
    display: 'grid',
    gap: 4,
    borderTop: '1px solid var(--app-border-soft)',
    paddingTop: 12,
  },
  editHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    padding: 12,
  },
  editTitle: {
    margin: 0,
    color: 'var(--app-text-strong)',
    fontSize: 15,
    fontWeight: 800,
  },
  editSub: {
    margin: '2px 0 0',
    color: 'var(--app-muted)',
    fontSize: 12,
  },
  message: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    color: 'var(--app-text)',
    padding: '10px 12px',
    fontSize: 13,
  },
  messageSuccess: {
    borderColor: 'color-mix(in srgb, var(--app-accent) 45%, var(--app-border))',
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
  },
  messageError: {
    borderColor: 'color-mix(in srgb, var(--app-danger) 45%, var(--app-border))',
    background: 'color-mix(in srgb, var(--app-danger) 12%, var(--app-surface))',
    color: 'var(--app-danger)',
  },
  storeLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 300px',
    gap: 16,
    alignItems: 'start',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 6,
    color: 'var(--app-text-strong)',
    fontSize: 12,
    fontWeight: 700,
  },
  fullField: {
    gridColumn: '1 / -1',
  },
  input: {
    width: '100%',
    minHeight: 40,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-input-bg)',
    color: 'var(--app-input-text)',
    padding: '9px 11px',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 13,
  },
  textarea: {
    minHeight: 86,
    resize: 'vertical',
  },
  uploadButton: {
    minHeight: 42,
    border: '1px dashed var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    color: 'var(--app-text-strong)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 13,
    fontFamily: 'inherit',
    padding: '0 12px',
  },
  logoUploadAction: {
    minHeight: 42,
    border: 'none',
    borderRadius: 8,
    background: 'var(--app-accent-strong)',
    color: '#FFFFFF',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 13,
    fontFamily: 'inherit',
    padding: '0 12px',
  },
  logoUploadActionDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  fileInput: {
    display: 'none',
  },
  selectedFileRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 32px',
    gap: 8,
    alignItems: 'center',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    padding: '8px 10px',
    color: 'var(--app-text-strong)',
    fontSize: 12,
  },
  removeUploadIconButton: {
    width: 32,
    height: 32,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-button-bg)',
    color: 'var(--app-danger)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    display: 'grid',
    gap: 12,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
    padding: 12,
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewTitle: {
    margin: 0,
    color: 'var(--app-text-strong)',
    fontSize: 14,
    fontWeight: 800,
  },
  previewSub: {
    margin: '2px 0 0',
    color: 'var(--app-muted)',
    fontSize: 11,
    lineHeight: 1.35,
  },
  logoPreview: {
    height: 150,
    border: '1px dashed var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: 10,
  },
  logoPlaceholder: {
    display: 'grid',
    justifyItems: 'center',
    gap: 8,
    color: 'var(--app-muted)',
    fontSize: 12,
  },
  previewInfo: {
    display: 'grid',
    gap: 4,
    color: 'var(--app-muted)',
    fontSize: 12,
  },
  statusToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface)',
    color: 'var(--app-muted)',
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  statusToggleActive: {
    borderColor: 'var(--app-accent)',
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
  },
  statusKnob: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'currentColor',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    borderTop: '1px solid var(--app-border-soft)',
    paddingTop: 14,
  },
  editButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-button-bg)',
    color: 'var(--app-button-text)',
    padding: '0 14px',
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  cancelButton: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-button-bg)',
    color: 'var(--app-button-text)',
    minHeight: 36,
    padding: '0 12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  saveButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    border: 'none',
    borderRadius: 8,
    background: 'var(--app-accent-strong)',
    color: '#FFFFFF',
    padding: '0 16px',
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  saveButtonDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
};

export default SettingsPage;
