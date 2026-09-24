import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole } from '../types';
import StatCard from './StatCard';
import UserTable from './UserTable';
import InviteModal from './InviteModal';
import UserEditModal from './UserEditModal';
import RequestLeaveModal from './RequestLeaveModal';
import { getAllUsers, createBackendUser, updateBackendUser } from '../hooks/users/user_controller';
import { createLeaveRequest } from '../hooks/hr/hr_controller';
import { getAllBranches } from '../hooks/branch/branch_controller';
import { getAllRoles } from '../hooks/users/role_constroller';

type FilterTab = 'all' | 'active' | 'admin';

interface UserManagementProps {
  searchQuery: string;
  branchOptions: string[];
  roleOptions: string[];
}

const UserManagement: React.FC<UserManagementProps> = ({
  searchQuery,
  branchOptions,
  roleOptions,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<FilterTab>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [leaveTargetUser, setLeaveTargetUser] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [loadedBranchOptions, setLoadedBranchOptions] = useState<string[]>(branchOptions);
  const [loadedRoleOptions, setLoadedRoleOptions] = useState<string[]>(roleOptions);

  const displayBranchOptions = loadedBranchOptions.length ? loadedBranchOptions : branchOptions;
  const displayRoleOptions = loadedRoleOptions.length ? loadedRoleOptions : roleOptions;

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setUsersError('');

      try {
        const apiUsers = await getAllUsers();
        if (isMounted) {
          setUsers(apiUsers);
        }
      } catch {
        if (isMounted) {
          setUsersError('Unable to load users');
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    };

    const loadRoles = async () => {
      try {
        const roles = await getAllRoles();
        if (isMounted) {
          setLoadedRoleOptions(roles.map((role) => role.name));
        }
      } catch {
        if (isMounted) {
          setLoadedRoleOptions(roleOptions);
        }
      }
    };

    const loadBranches = async () => {
      try {
        const branches = await getAllBranches();
        if (isMounted) {
          setLoadedBranchOptions(branches.map((branch) => branch.name));
        }
      } catch {
        if (isMounted) {
          setLoadedBranchOptions(branchOptions);
        }
      }
    };

    loadUsers();
    loadRoles();
    loadBranches();

    return () => {
      isMounted = false;
    };
  }, [branchOptions, roleOptions]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.branch.toLowerCase().includes(q);
      const matchTab =
        tab === 'all' ? true : tab === 'active' ? u.status === 'Active' : u.role === 'Admin';
      const matchRole = roleFilter === 'all' ? true : u.role === roleFilter;
      const matchBranch = branchFilter === 'all' ? true : u.branch === branchFilter;
      return matchSearch && matchTab && matchRole && matchBranch;
    });
  }, [users, searchQuery, tab, roleFilter, branchFilter]);

  const activeCount = users.filter((u) => u.status === 'Active').length;
  const adminCount = users.filter((u) => u.role === 'Admin').length;
  const nextUserId = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;

  const handleInvite = async (data: {
    id: number;
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    branch: string;
    designation?: string;
    department?: string;
    salary?: number;
    shift?: string;
    emergency_contact?: string;
    arrival_time?: string;
    leave_time?: string;
    salary_paid?: boolean;
  }) => {
    try {
      const createdUser = await createBackendUser(data as any);
      setUsers((prev) => [...prev.filter((u) => u.id !== createdUser.id), createdUser]);
    } catch (err) {
      console.error('Failed to create user on backend:', err);
      const fallbackUser: User = {
        id: data.id,
        name: data.name.trim(),
        email: data.email,
        phone: data.phone,
        branch: data.branch,
        role: data.role,
        status: 'Active',
        joined: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        password: data.password,
        designation: data.designation,
        department: data.department,
        salary: data.salary,
        shift: data.shift,
        emergency_contact: data.emergency_contact,
        arrival_time: data.arrival_time,
        leave_time: data.leave_time,
        salary_paid: data.salary_paid,
      };
      setUsers((prev) => [...prev, fallbackUser]);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
  };

  const handleSaveEdit = async (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    try {
      await updateBackendUser(updatedUser.id, updatedUser);
    } catch (err) {
      console.error('Failed to update user on backend:', err);
    }
  };

  const handleRequestLeave = (user: User) => {
    setLeaveTargetUser(user);
  };

  const handleSaveLeave = async (data: {
    userId: number;
    userName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => {
    try {
      await createLeaveRequest(data);
      console.log('Leave requested successfully:', data);
    } catch (err) {
      console.error('Failed to create leave request on backend:', err);
    }
  };

  const stats = [
    { label: 'Total users', value: users.length, delta: '↑ 2 this month', trend: 'up' as const },
    {
      label: 'Active users',
      value: activeCount,
      delta: `${users.length ? Math.round((activeCount / users.length) * 100) : 0}% of total`,
      trend: 'up' as const,
    },
    { label: 'Admins', value: adminCount, delta: `${adminCount} with full access`, trend: 'neutral' as const },
    { label: 'Pending invites', value: 3, delta: '↑ 1 awaiting', trend: 'down' as const },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>User management</h1>
          <p style={styles.pageSubtitle}>Manage team members and their access levels</p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          <i className="ti ti-plus" aria-hidden="true" />
          Add user
        </button>
      </div>

      <div style={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} card={s} />
        ))}
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            All users <span style={styles.countBadge}>{filtered.length}</span>
          </h2>
          <div style={styles.tabGroup}>
            {(['all', 'active', 'admin'] as FilterTab[]).map((t) => (
              <button
                key={t}
                style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.filtersRow}>
          <select
            style={styles.filterSelect}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">All branches</option>
            {displayBranchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <select
            style={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            {displayRoleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <span style={styles.filterCount}>{filtered.length} users</span>
        </div>

        {(isLoadingUsers || usersError) && (
          <div style={styles.statusRow}>
            {isLoadingUsers ? 'Loading users...' : usersError}
          </div>
        )}

        <UserTable users={filtered} onEdit={handleEdit} onRequestLeave={handleRequestLeave} />
      </div>


      {showModal && (
        <InviteModal
          nextUserId={nextUserId}
          branchOptions={displayBranchOptions}
          roleOptions={displayRoleOptions}
          onClose={() => setShowModal(false)}
          onInvite={handleInvite}
        />
      )}

      {editingUser && (
        <UserEditModal
          user={editingUser}
          branchOptions={displayBranchOptions}
          roleOptions={displayRoleOptions}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveEdit}
        />
      )}

      {leaveTargetUser && (
        <RequestLeaveModal
          user={leaveTargetUser}
          onClose={() => setLeaveTargetUser(null)}
          onSave={handleSaveLeave}
        />
      )}
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
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--app-border-soft)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  countBadge: {
    color: 'var(--app-muted)',
    fontWeight: 400,
  },
  tabGroup: {
    display: 'flex',
    gap: 4,
  },
  tab: {
    padding: '5px 12px',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    color: 'var(--app-muted)',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: 'var(--app-surface-muted)',
    color: 'var(--app-text-strong)',
    fontWeight: 500,
  },
  filtersRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderBottom: '1px solid var(--app-border-soft)',
  },
  filterSelect: {
    padding: '5px 10px',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--app-input-text)',
    background: 'var(--app-input-bg)',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  filterCount: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--app-muted)',
  },
  statusRow: {
    padding: '10px 20px',
    fontSize: 12,
    color: 'var(--app-muted)',
    borderBottom: '1px solid var(--app-border-soft)',
  },
  tableWrap: {
    overflowX: 'auto',
    padding: '0 20px 20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate' as const,
    borderSpacing: '0 8px',
    minWidth: 800,
  },
  th: {
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 800,
    color: '#534AB7',
    padding: '10px 16px',
    borderBottom: '1px solid rgba(83,74,183,0.12)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  tr: {
    background: 'var(--app-surface-soft)',
    transition: 'background 0.1s',
  },
  trAlt: {
    background: 'var(--app-surface)',
  },
  td: {
    padding: '12px 16px',
    fontSize: 13,
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid var(--app-border-soft)',
    verticalAlign: 'middle',
    color: 'var(--app-text)',
  },
  tdId: {
    padding: '12px 16px',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--app-muted)',
    borderTop: '1px solid var(--app-border-soft)',
    borderBottom: '1px solid var(--app-border-soft)',
  },
  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#EEEDFE',
    color: '#534AB7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600 as const,
  },
  uName: {
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  badge: {
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    background: 'var(--app-accent-soft)',
    color: 'var(--app-accent-strong)',
    fontWeight: 600 as const,
  },
  badgePaid: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800 as const,
    background: '#EAF3DE',
    color: '#3B6D11',
  },
  emptyCell: {
    textAlign: 'center',
    padding: 32,
    color: 'var(--app-muted)',
    fontSize: 13,
  },
};

export default UserManagement;
