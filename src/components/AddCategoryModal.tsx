import React, { useState } from 'react';
import {
  createCategory,
  updateCategory,
  type CreateCategoryPayload,
  type PosCategory,
} from '../hooks/pos/pos_controller';

interface AddCategoryModalProps {
  category?: PosCategory | null;
  onClose: () => void;
  onSaved: (category: PosCategory) => void;
}

const getInitialForm = (category?: PosCategory | null): CreateCategoryPayload => ({
  name: category?.name ?? '',
  description: category?.description ?? '',
  status: category?.status ?? true,
});

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ category, onClose, onSaved }) => {
  const [form, setForm] = useState<CreateCategoryPayload>(() => getInitialForm(category));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = Boolean(category);

  const updateField = <T extends keyof CreateCategoryPayload>(field: T, value: CreateCategoryPayload[T]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Category name is required.');
      return;
    }

    try {
      setIsSaving(true);
      const savedCategory = isEditMode && category
        ? await updateCategory(category.id, form)
        : await createCategory(form);
      onSaved(savedCategory);
      onClose();
    } catch {
      setError('Unable to save category. Please check backend connection.');
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
            <h2 style={styles.title}>{isEditMode ? 'Edit category' : 'Add category'}</h2>
            <p style={styles.subtitle}>Organize products for checkout and reports.</p>
          </div>
          <button type="button" style={styles.iconBtn} onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.field}>
            <span style={styles.label}>Category name</span>
            <input
              style={styles.input}
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Beverages"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Description</span>
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Drinks, juices, water, and soft drinks"
            />
          </label>

          <label style={styles.checkField}>
            <input
              type="checkbox"
              checked={form.status}
              onChange={(event) => updateField('status', event.target.checked)}
            />
            <span>Active category</span>
          </label>
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={styles.primaryBtn} disabled={isSaving}>
            {isSaving ? 'Saving...' : isEditMode ? 'Update category' : 'Create category'}
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
    zIndex: 1200,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
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
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--app-muted, #a5adba)',
    marginTop: 2,
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
  label: {
    fontSize: 12,
    color: 'var(--app-muted, #a5adba)',
    fontWeight: 600,
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
    minHeight: 92,
    background: 'var(--app-input-bg, #1b1e24)',
    color: 'var(--app-input-text, #f2f4f7)',
  },
  checkField: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--app-text, #f2f4f7)',
  },
  error: {
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

export default AddCategoryModal;
