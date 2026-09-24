import React, { useMemo, useState } from 'react';

interface StoredUser {
  id?: number;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  role?: string | { name?: string };
  role_name?: string;
}

const getStoredUser = (): StoredUser => {
  try {
    const rawUser = localStorage.getItem('user');
    return rawUser ? JSON.parse(rawUser) as StoredUser : {};
  } catch {
    return {};
  }
};

const getRoleName = (user: StoredUser) => {
  if (user.role_name) return user.role_name;
  if (typeof user.role === 'string') return user.role;
  return user.role?.name ?? 'User';
};

const getInitials = (name: string) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return initials || 'U';
};

const ProfileSection: React.FC = () => {
  const storedUser = useMemo(() => getStoredUser(), []);
  const [name, setName] = useState(storedUser.name ?? storedUser.username ?? '');
  const [email, setEmail] = useState(storedUser.email ?? '');
  const [phone, setPhone] = useState(storedUser.phone ?? storedUser.mobile ?? '');
  const [savedMessage, setSavedMessage] = useState('');

  const roleName = getRoleName(storedUser);
  const displayName = name.trim() || 'Profile user';

  const handleSave = () => {
    const updatedUser: StoredUser = {
      ...storedUser,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    setSavedMessage('Profile updated');
    window.setTimeout(() => setSavedMessage(''), 2500);
  };

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Profile</h1>
          <p style={styles.pageSubtitle}>Manage your account identity and contact details.</p>
        </div>
        {savedMessage && <span style={styles.savedBadge}>{savedMessage}</span>}
      </div>

      <div style={styles.layout}>
        <section style={styles.summaryCard}>
          <div style={styles.avatar}>{getInitials(displayName).toUpperCase()}</div>
          <h2 style={styles.profileName}>{displayName}</h2>
          <div style={styles.roleBadge}>{roleName}</div>
          <div style={styles.metaList}>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>User ID</span>
              <span style={styles.metaValue}>#{storedUser.id ?? '-'}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Email</span>
              <span style={styles.metaValue}>{email || '-'}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Phone</span>
              <span style={styles.metaValue}>{phone || '-'}</span>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Account details</h2>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Full name</span>
              <input
                style={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter full name"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Email address</span>
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter email"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Phone number</span>
              <input
                style={styles.input}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter phone"
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Role</span>
              <input style={styles.inputDisabled} value={roleName} disabled />
            </label>
          </div>

          <div style={styles.actions}>
            <button style={styles.primaryBtn} onClick={handleSave}>
              <i className="ti ti-device-floppy" aria-hidden="true" />
              Save changes
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    overflowY: 'auto',
    flex: 1,
    background: 'var(--app-bg)',
    color: 'var(--app-text)',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  pageSubtitle: {
    fontSize: 13,
    color: 'var(--app-muted)',
    marginTop: 2,
  },
  savedBadge: {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    fontSize: 12,
    fontWeight: 500,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: 16,
  },
  summaryCard: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 20,
    alignSelf: 'start',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
    marginBottom: 8,
  },
  roleBadge: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: 999,
    background: '#E8F1FF',
    color: '#1E5BA8',
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 18,
  },
  metaList: {
    display: 'grid',
    gap: 10,
    borderTop: '1px solid var(--app-border-soft)',
    paddingTop: 14,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 12,
  },
  metaLabel: {
    color: 'var(--app-muted)',
  },
  metaValue: {
    color: 'var(--app-text-strong)',
    fontWeight: 500,
    textAlign: 'right',
    overflowWrap: 'anywhere',
  },
  card: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 18,
  },
  cardHeader: {
    borderBottom: '1px solid var(--app-border-soft)',
    paddingBottom: 14,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: 'var(--app-muted)',
  },
  input: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    background: 'var(--app-input-bg)',
    color: 'var(--app-input-text)',
  },
  inputDisabled: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'var(--app-surface-muted)',
    color: 'var(--app-muted)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 8,
    background: '#534AB7',
    color: '#fff',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default ProfileSection;
