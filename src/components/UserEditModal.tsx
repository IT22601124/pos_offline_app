import React, { useMemo, useState } from 'react';
import { User, UserRole, UserStatus } from '../types';

interface UserEditModalProps {
  user: User;
  branchOptions: string[];
  roleOptions: string[];
  onClose: () => void;
  onSave: (updatedUser: User) => void;
}

type EditTab = 'basic' | 'hr';

const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  branchOptions,
  roleOptions,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<EditTab>('basic');

  // Basic Info States
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [role, setRole] = useState<UserRole>(user.role);
  const [branch, setBranch] = useState(user.branch);
  const [status, setStatus] = useState<UserStatus>(user.status);

  // HR Info States
  const [designation, setDesignation] = useState(user.designation ?? '');
  const [department, setDepartment] = useState(user.department ?? '');
  const [salary, setSalary] = useState(user.salary ? String(user.salary) : '');
  const [shift, setShift] = useState(user.shift ?? 'Full-time');
  const [emergencyContact, setEmergencyContact] = useState(user.emergency_contact ?? '');
  const [arrivalTime, setArrivalTime] = useState(user.arrival_time ?? '09:00');
  const [leaveTime, setLeaveTime] = useState(user.leave_time ?? '18:00');
  const [salaryPaid, setSalaryPaid] = useState(user.salary_paid ?? false);

  const canSave = useMemo(() => {
    return Boolean(name.trim() && email.trim() && phone.trim() && role && branch);
  }, [branch, email, name, phone, role]);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...user,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      branch,
      status,
      designation: designation.trim() || undefined,
      department: department.trim() || undefined,
      salary: salary ? Number(salary) : undefined,
      shift: shift || undefined,
      emergency_contact: emergencyContact.trim() || undefined,
      arrival_time: arrivalTime || undefined,
      leave_time: leaveTime || undefined,
      salary_paid: salaryPaid,
    });
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h3 id="edit-modal-title" style={styles.headerTitle}>
              Edit User & HR Profile
            </h3>
            <p style={styles.headerSub}>Update basic credentials and HR operational data for {user.name}.</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div style={styles.tabBar}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'basic' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('basic')}
          >
            <i className="ti ti-user-cog" style={{ marginRight: 6 }} />
            Basic Profile
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'hr' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('hr')}
          >
            <i className="ti ti-briefcase" style={{ marginRight: 6 }} />
            HR Management
          </button>
        </div>

        {/* Content Area */}
        <div style={styles.body}>
          {activeTab === 'basic' && (
            <div style={styles.tabContent}>
              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-role">
                    Role
                  </label>
                  <select
                    id="edit-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={styles.input}
                  >
                    {roleOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-status">
                    Account Status
                  </label>
                  <select
                    id="edit-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    style={styles.input}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="edit-name">
                  Full Name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-email">
                    Email Address
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-phone">
                    Phone Number
                  </label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="edit-branch">
                  Assigned Branch
                </label>
                <select
                  id="edit-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  style={styles.input}
                >
                  {branchOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'hr' && (
            <div style={styles.tabContent}>
              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-designation">
                    Job Title / Designation
                  </label>
                  <input
                    id="edit-designation"
                    type="text"
                    placeholder="e.g. Lead Cashier"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-department">
                    Department
                  </label>
                  <input
                    id="edit-department"
                    type="text"
                    placeholder="e.g. Sales"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-salary">
                    Base Salary (Monthly)
                  </label>
                  <input
                    id="edit-salary"
                    type="number"
                    placeholder="e.g. 50000"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-shift">
                    Scheduled Shift
                  </label>
                  <select
                    id="edit-shift"
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    style={styles.input}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Morning Shift">Morning Shift</option>
                    <option value="Evening Shift">Evening Shift</option>
                    <option value="Night Shift">Night Shift</option>
                    <option value="Part-time">Part-time</option>
                  </select>
                </div>
              </div>

              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-arrival">
                    Shift Arrival Time
                  </label>
                  <input
                    id="edit-arrival"
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-leave">
                    Shift Leave Time
                  </label>
                  <input
                    id="edit-leave"
                    type="time"
                    value={leaveTime}
                    onChange={(e) => setLeaveTime(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.fieldRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-salary-paid">
                    Salary Paid Status
                  </label>
                  <select
                    id="edit-salary-paid"
                    value={salaryPaid ? 'Paid' : 'Unpaid'}
                    onChange={(e) => setSalaryPaid(e.target.value === 'Paid')}
                    style={styles.input}
                  >
                    <option value="Unpaid">Unpaid / Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="edit-emergency">
                    Emergency Contact Phone
                  </label>
                  <input
                    id="edit-emergency"
                    type="tel"
                    placeholder="e.g. +94 77 987 6543"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.ghostBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...styles.primaryBtn,
              opacity: canSave ? 1 : 0.55,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSave}
            disabled={!canSave}
          >
            <i className="ti ti-device-floppy" style={{ marginRight: 4 }} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 16,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    border: '0.5px solid rgba(0,0,0,0.1)',
    width: 'min(520px, 100%)',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  header: {
    padding: '18px 20px',
    borderBottom: '0.5px solid rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1e293b',
  },
  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '0.5px solid rgba(0,0,0,0.12)',
    background: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    color: '#64748b',
    flexShrink: 0,
  },
  tabBar: {
    display: 'flex',
    background: '#f8fafc',
    borderBottom: '0.5px solid rgba(0,0,0,0.08)',
    padding: '0 12px',
  },
  tab: {
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 13,
    fontWeight: 500,
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'inherit',
  },
  tabActive: {
    color: '#534AB7',
    borderBottomColor: '#534AB7',
  },
  body: {
    padding: 20,
    maxHeight: 'min(450px, 55vh)',
    overflowY: 'auto',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#64748b',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  footer: {
    padding: '14px 20px',
    borderTop: '0.5px solid rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    background: '#f8fafc',
  },
  ghostBtn: {
    padding: '7px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: '#64748b',
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
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
  },
};

export default UserEditModal;
