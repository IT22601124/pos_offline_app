import React, { useMemo, useState } from 'react';
import { Branch } from '../types';

interface BranchManagementProps {
  searchQuery: string;
  branches: Branch[];
  onAddBranch: (branch: Omit<Branch, 'id' | 'status'>) => void;
}

const BranchManagement: React.FC<BranchManagementProps> = ({ searchQuery, branches, onAddBranch }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [manager, setManager] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(q) ||
        branch.code.toLowerCase().includes(q) ||
        branch.location.toLowerCase().includes(q) ||
        branch.manager.toLowerCase().includes(q),
    );
  }, [branches, searchQuery]);

  const handleSubmit = () => {
    if (!name.trim() || !code.trim() || !location.trim() || !manager.trim()) return;
    onAddBranch({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      location: location.trim(),
      manager: manager.trim(),
    });
    setName('');
    setCode('');
    setLocation('');
    setManager('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Branch management</h1>
          <p style={styles.pageSubtitle}>Create and track operating branches across the network.</p>
        </div>
        <div style={styles.counter}>{filtered.length} branches</div>
      </div>

      <div style={styles.layout}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Add branch</h2>
            <span style={styles.helper}>Branch codes are shown in uppercase.</span>
          </div>

          <div style={styles.formGrid}>
            <input
              style={styles.input}
              placeholder="Branch name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Branch code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Branch manager"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            />
          </div>

          <button style={styles.primaryBtn} onClick={handleSubmit}>
            <i className="ti ti-plus" aria-hidden="true" />
            Add branch
          </button>
        </section>

        <section style={styles.listCard}>
          {filtered.length === 0 ? (
            <div style={styles.empty}>
              <i className="ti ti-building" style={styles.emptyIcon} aria-hidden="true" />
              <p style={styles.emptyText}>No branches match your search</p>
            </div>
          ) : (
            filtered.map((branch) => (
              <article key={branch.id} style={styles.branchRow}>
                <div style={styles.branchMark}>{branch.code.slice(0, 2)}</div>
                <div style={styles.branchBody}>
                  <div style={styles.branchTop}>
                    <h3 style={styles.branchName}>{branch.name}</h3>
                    <span
                      style={{
                        ...styles.badge,
                        ...(branch.status === 'Active' ? styles.badgeActive : styles.badgeInactive),
                      }}
                    >
                      {branch.status}
                    </span>
                  </div>
                  <div style={styles.branchMeta}>
                    <span>{branch.code}</span>
                    <span>{branch.location}</span>
                    <span>Manager: {branch.manager}</span>
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
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
  branchRow: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  branchMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0,
  },
  branchBody: {
    flex: 1,
    minWidth: 0,
  },
  branchTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  branchName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  branchMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    fontSize: 12,
    color: 'var(--app-muted)',
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
  badgeInactive: {
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

export default BranchManagement;
