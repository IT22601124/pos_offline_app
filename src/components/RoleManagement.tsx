import React, { useMemo, useState } from 'react';
import { Role } from '../types';

interface RoleManagementProps {
  searchQuery: string;
  roles: Role[];
  onAddRole: (role: Omit<Role, 'id' | 'status'>) => void;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ searchQuery, roles, onAddRole }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(q) ||
        role.description.toLowerCase().includes(q) ||
        role.permissions.some((permission) => permission.toLowerCase().includes(q)),
    );
  }, [roles, searchQuery]);

  const handleSubmit = () => {
    if (!name.trim() || !description.trim() || !permissions.trim()) return;
    onAddRole({
      name: name.trim(),
      description: description.trim(),
      permissions: permissions
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setName('');
    setDescription('');
    setPermissions('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Role management</h1>
          <p style={styles.pageSubtitle}>Define access bundles and the permissions they expose.</p>
        </div>
        <div style={styles.counter}>{filtered.length} roles</div>
      </div>

      <div style={styles.layout}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Add role</h2>
            <span style={styles.helper}>Separate permissions with commas.</span>
          </div>

          <div style={styles.formStack}>
            <input
              style={styles.input}
              placeholder="Role name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              style={styles.textarea}
              placeholder="Role description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <textarea
              style={styles.textarea}
              placeholder="Permissions, e.g. View dashboard, Edit users"
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
            />
          </div>

          <button style={styles.primaryBtn} onClick={handleSubmit}>
            <i className="ti ti-plus" aria-hidden="true" />
            Add role
          </button>
        </section>

        <section style={styles.listCard}>
          {filtered.length === 0 ? (
            <div style={styles.empty}>
              <i className="ti ti-shield-lock" style={styles.emptyIcon} aria-hidden="true" />
              <p style={styles.emptyText}>No roles match your search</p>
            </div>
          ) : (
            filtered.map((role) => (
              <article key={role.id} style={styles.roleRow}>
                <div style={styles.roleMark}>{role.name.slice(0, 2).toUpperCase()}</div>
                <div style={styles.roleBody}>
                  <div style={styles.roleTop}>
                    <h3 style={styles.roleName}>{role.name}</h3>
                    <span
                      style={{
                        ...styles.badge,
                        ...(role.status === 'Active' ? styles.badgeActive : styles.badgeDraft),
                      }}
                    >
                      {role.status}
                    </span>
                  </div>
                  <p style={styles.roleDescription}>{role.description}</p>
                  <div style={styles.permissionWrap}>
                    {role.permissions.map((permission) => (
                      <span key={permission} style={styles.permissionChip}>
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))
          )}
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
  counter: {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '360px 1fr',
    gap: 16,
  },
  card: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    alignSelf: 'start',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  helper: {
    fontSize: 12,
    color: 'var(--app-muted)',
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
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
  textarea: {
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    minHeight: 84,
    background: 'var(--app-input-bg)',
    color: 'var(--app-input-text)',
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
  listCard: {
    display: 'grid',
    gap: 12,
  },
  roleRow: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  roleMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#E8F1FF',
    color: '#1E5BA8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0,
  },
  roleBody: {
    flex: 1,
    minWidth: 0,
  },
  roleTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  roleName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  roleDescription: {
    fontSize: 13,
    color: 'var(--app-muted)',
    marginBottom: 10,
  },
  permissionWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionChip: {
    padding: '5px 9px',
    borderRadius: 999,
    background: 'var(--app-surface-muted)',
    color: 'var(--app-muted)',
    fontSize: 11,
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 9px',
    borderRadius: 999,
  },
  badgeActive: {
    background: '#EAF3DE',
    color: '#3B6D11',
  },
  badgeDraft: {
    background: '#F1EFE8',
    color: '#5F5E5A',
  },
  empty: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: '48px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    color: '#bbb',
    display: 'block',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: 'var(--app-muted)',
  },
};

export default RoleManagement;
