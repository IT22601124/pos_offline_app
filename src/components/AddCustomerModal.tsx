import React, { useState } from 'react';

export interface PosCustomer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  balance: number;
  status: 'Active' | 'Blocked';
}

interface AddCustomerModalProps {
  customer?: PosCustomer | null;
  onClose: () => void;
  onSaved: (customer: PosCustomer) => void | Promise<void>;
}

type CustomerForm = Omit<PosCustomer, 'id'>;

const getInitialForm = (customer?: PosCustomer | null): CustomerForm => ({
  name: customer?.name ?? '',
  phone: customer?.phone ?? '',
  email: customer?.email ?? '',
  address: customer?.address ?? '',
  creditLimit: customer?.creditLimit ?? 0,
  balance: customer?.balance ?? 0,
  status: customer?.status ?? 'Active',
});

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ customer, onClose, onSaved }) => {
  const [form, setForm] = useState<CustomerForm>(() => getInitialForm(customer));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = Boolean(customer);

  const updateField = <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim() || !form.phone.trim()) {
      setError('Customer name and phone are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaved({
        id: customer?.id ?? 0,
        ...form,
        creditLimit: Math.max(form.creditLimit, 0),
        balance: Math.max(form.balance, 0),
      });
      onClose();
    } catch {
      setError('Unable to save customer. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form style={styles.modal} onSubmit={handleSubmit}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{isEditMode ? 'Edit customer' : 'Add customer'}</h2>
            <p style={styles.subTitle}>Manage customer details and credit account limits.</p>
          </div>
          <button type="button" style={styles.iconBtn} onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.body}>
          <label style={styles.field}>
            <span style={styles.label}>Customer name</span>
            <input
              style={styles.input}
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Tharindu Stores"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Phone</span>
            <input
              style={styles.input}
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              placeholder="0771234567"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Email</span>
            <input
              style={styles.input}
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="customer@test.com"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Credit limit</span>
            <input
              style={styles.input}
              type="number"
              min={0}
              placeholder="0"
              value={form.creditLimit === 0 ? '' : form.creditLimit}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                const val = event.target.value;
                updateField('creditLimit', val === '' ? 0 : Number(val) || 0);
              }}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Opening balance</span>
            <input
              style={styles.input}
              type="number"
              min={0}
              placeholder="0"
              value={form.balance === 0 ? '' : form.balance}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                const val = event.target.value;
                updateField('balance', val === '' ? 0 : Number(val) || 0);
              }}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Status</span>
            <select
              style={styles.input}
              value={form.status}
              onChange={(event) => updateField('status', event.target.value as CustomerForm['status'])}
            >
              <option value="Active">Active</option>
              <option value="Blocked">Blocked</option>
            </select>
          </label>

          <label style={styles.fieldWide}>
            <span style={styles.label}>Address</span>
            <textarea
              style={styles.textarea}
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
              placeholder="Customer address"
            />
          </label>
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={styles.primaryBtn} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update customer' : 'Create customer'}
          </button>
        </div>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    zIndex: 1200,
  },
  modal: {
    width: '28vw',
    minWidth: 400,
    maxWidth: '95vw',
    height: '100vh',
    maxHeight: '100vh',
    background: 'var(--app-surface, #202329)',
    color: 'var(--app-text, #f2f4f7)',
    borderRadius: '16px 0 0 16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.5)',
    borderLeft: '1px solid var(--app-border, #353b46)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--app-border-soft, #2f3540)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: 'var(--app-surface-soft, #252932)',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--app-text-strong, #ffffff)',
    margin: 0,
  },
  subTitle: {
    fontSize: 12,
    color: 'var(--app-muted, #a5adba)',
    marginTop: 2,
    margin: 0,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--app-border, #353b46)',
    background: 'var(--app-surface-soft, #252932)',
    color: 'var(--app-text, #f2f4f7)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    flex: 1,
    background: 'var(--app-surface, #202329)',
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  fieldWide: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--app-muted, #a5adba)',
  },
  input: {
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    background: 'var(--app-input-bg, #1b1e24)',
    color: 'var(--app-input-text, #f2f4f7)',
  },
  textarea: {
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    minHeight: 84,
    background: 'var(--app-input-bg, #1b1e24)',
    color: 'var(--app-input-text, #f2f4f7)',
  },
  errorBox: {
    margin: '12px 24px 0',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: 'var(--app-danger, #ff8585)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  footer: {
    padding: '18px 24px',
    borderTop: '1px solid var(--app-border-soft, #2f3540)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    background: 'var(--app-surface-soft, #252932)',
  },
  secondaryBtn: {
    border: '1px solid var(--app-border, #353b46)',
    borderRadius: 8,
    background: 'var(--app-button-bg, #252932)',
    color: 'var(--app-button-text, #e4e7ec)',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    border: 'none',
    borderRadius: 8,
    background: 'var(--app-accent, #32c862)',
    color: '#ffffff',
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default AddCustomerModal;
