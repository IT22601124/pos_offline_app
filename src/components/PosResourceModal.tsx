import React, { useState } from 'react';
import type { PosMasterRecord } from '../hooks/pos/pos_controller';

export interface ResourceField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'boolean' | 'select';
  required?: boolean;
  options?: Array<{ value: string | number; label: string }>;
}

interface PosResourceModalProps {
  title: string;
  fields: ResourceField[];
  record?: PosMasterRecord | null;
  onClose: () => void;
  onSubmit: (payload: PosMasterRecord) => Promise<void>;
}

const getInitialForm = (fields: ResourceField[], record?: PosMasterRecord | null): PosMasterRecord => {
  return fields.reduce<PosMasterRecord>((form, field) => {
    if (record && record[field.name] !== undefined && record[field.name] !== null) {
      form[field.name] = record[field.name];
      return form;
    }

    if (field.type === 'boolean') form[field.name] = true;
    else if (field.type === 'number') form[field.name] = 0;
    else if (field.type === 'select') form[field.name] = field.options?.[0]?.value ?? '';
    else form[field.name] = '';

    return form;
  }, {});
};

const PosResourceModal: React.FC<PosResourceModalProps> = ({ title, fields, record, onClose, onSubmit }) => {
  const [form, setForm] = useState<PosMasterRecord>(() => getInitialForm(fields, record));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = Boolean(record);

  const updateField = (field: ResourceField, value: string | number | boolean) => {
    setForm((previous) => ({ ...previous, [field.name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const missingField = fields.find((field) => field.required && String(form[field.name] ?? '').trim() === '');
    if (missingField) {
      setError(`${missingField.label} is required.`);
      return;
    }

    try {
      setIsSaving(true);
      await onSubmit(form);
      onClose();
    } catch {
      setError('Unable to save record. Please check backend connection.');
    } finally {
      setIsSaving(false);
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
            <h2 style={styles.title}>{isEditMode ? `Edit ${title}` : `Add ${title}`}</h2>
            <p style={styles.subTitle}>Create or update POS master data.</p>
          </div>
          <button type="button" style={styles.iconBtn} onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.body}>
          {fields.map((field) => (
            <label key={field.name} style={field.type === 'textarea' ? styles.fieldWide : styles.field}>
              <span style={styles.label}>{field.label}</span>
              {field.type === 'textarea' ? (
                <textarea
                  style={styles.textarea}
                  value={String(form[field.name] ?? '')}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              ) : field.type === 'boolean' ? (
                <select
                  style={styles.input}
                  value={String(Boolean(form[field.name]))}
                  onChange={(event) => updateField(field, event.target.value === 'true')}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              ) : field.type === 'select' ? (
                <select
                  style={styles.input}
                  value={String(form[field.name] ?? '')}
                  onChange={(event) => updateField(field, Number(event.target.value) || event.target.value)}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={styles.input}
                  type={field.type}
                  value={String(form[field.name] ?? '')}
                  onChange={(event) =>
                    updateField(field, field.type === 'number' ? Number(event.target.value) || 0 : event.target.value)
                  }
                />
              )}
            </label>
          ))}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={styles.primaryBtn} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
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

export default PosResourceModal;
