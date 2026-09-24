import React from 'react';
import { User, UserStatus } from '../types';
import { AVATAR_COLORS } from '../data/users';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onRequestLeave?: (user: User) => void;
}

const roleBadge: Record<string, React.CSSProperties> = {
  Admin: { background: '#EEEDFE', color: '#534AB7' },
  Manager: { background: '#E8F1FF', color: '#1E5BA8' },
  Member: { background: '#E1F5EE', color: '#0F6E56' },
  Viewer: { background: '#FAEEDA', color: '#854F0B' },
};

const statusBadge: Record<UserStatus, React.CSSProperties> = {
  Active: { background: '#EAF3DE', color: '#3B6D11' },
  Inactive: { background: '#F1EFE8', color: '#5F5E5A' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
}

const UserTable: React.FC<UserTableProps> = ({ users, onEdit, onRequestLeave }) => {
  if (users.length === 0) {
    return (
      <div style={styles.empty}>
        <i className="ti ti-users-off" style={styles.emptyIcon} aria-hidden="true" />
        <p style={styles.emptyText}>No users match your filter</p>
      </div>
    );
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['ID', 'User', 'Role', 'Phone', 'Branch', 'Status', 'Joined', ''].map((h) => (
              <th key={h} style={styles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => {
            const ac = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const badgeStyle = roleBadge[user.role] ?? {
              background: '#EFEFEF',
              color: '#555',
            };

            return (
              <tr key={user.id} style={{ ...styles.tr, ...(i % 2 ? styles.trAlt : {}) }}>
                <td style={styles.tdId}>#{String(user.id).padStart(3, '0')}</td>

                <td style={styles.td}>
                  <div style={styles.userCell}>
                    <div style={{ ...styles.uAvatar, background: ac.bg, color: ac.color }}>
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <div style={styles.uName}>{user.name}</div>
                      <div style={styles.uEmail}>{user.email}</div>
                    </div>
                  </div>
                </td>

                <td style={styles.td}>
                  <span style={{ ...styles.badge, ...badgeStyle }}>{user.role}</span>
                </td>

                <td style={styles.td}>{user.phone}</td>

                <td style={styles.td}>{user.branch}</td>

                <td style={styles.td}>
                  <span style={{ ...styles.badge, ...statusBadge[user.status] }}>{user.status}</span>
                </td>

                <td style={{ ...styles.td, color: 'var(--app-muted)' }}>{user.joined}</td>

                <td style={styles.td}>
                  <div style={styles.actions}>
                    <button
                      style={styles.actBtn}
                      title="Edit user"
                      onClick={() => onEdit(user)}
                      aria-label={`Edit ${user.name}`}
                    >
                      <i className="ti ti-edit" aria-hidden="true" />
                    </button>
                    {onRequestLeave && (
                      <button
                        style={styles.actBtn}
                        title="Request leave"
                        onClick={() => onRequestLeave(user)}
                        aria-label={`Request leave for ${user.name}`}
                      >
                        <i className="ti ti-calendar-event" aria-hidden="true" />
                      </button>
                    )}
                    <button style={styles.actBtn} title="More options" aria-label="More options">
                      <i className="ti ti-dots" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  tableWrap: {
    overflowX: 'auto',
    padding: '0 12px 12px',
    background: 'linear-gradient(180deg, rgba(83,74,183,0.05), transparent 130px)',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 8px',
    minWidth: 980,
  },
  th: {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 800,
    color: '#534AB7',
    padding: '10px 20px',
    borderTop: '1px solid rgba(83,74,183,0.18)',
    borderBottom: '1px solid rgba(83,74,183,0.18)',
    background: 'rgba(83,74,183,0.08)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  tr: {
    background: 'linear-gradient(90deg, rgba(83,74,183,0.16), var(--app-surface-soft) 34px)',
    transition: 'background 0.1s',
  },
  trAlt: {
    background: 'linear-gradient(90deg, rgba(47,128,237,0.14), var(--app-surface) 34px)',
  },
  td: {
    padding: '14px 20px',
    fontSize: 13,
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid var(--app-border-soft)',
    color: 'var(--app-text)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    background: 'transparent',
  },
  tdId: {
    padding: '14px 20px',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--app-muted)',
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid var(--app-border-soft)',
    whiteSpace: 'nowrap',
    background: 'transparent',
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  uAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
  },
  uName: {
    fontWeight: 500,
    fontSize: 13,
    color: 'var(--app-text-strong)',
  },
  uEmail: {
    fontSize: 11,
    color: 'var(--app-muted)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
  },
  actions: {
    display: 'flex',
    gap: 4,
  },
  actBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--app-button-text)',
    fontSize: 14,
  },
  empty: {
    margin: 12,
    padding: '48px 20px',
    textAlign: 'center',
    border: '1px dashed var(--app-border)',
    borderRadius: 8,
    background: 'var(--app-surface-soft)',
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

export default UserTable;
