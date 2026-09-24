import React, { useMemo, useState } from 'react';
import { UserRole } from '../types';

interface InviteModalProps {
  nextUserId: number;
  branchOptions: string[];
  roleOptions: string[];
  onClose: () => void;
  onInvite: (data: {
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
  }) => void;
}

const InviteModal: React.FC<InviteModalProps> = ({
  nextUserId,
  branchOptions,
  roleOptions,
  onClose,
  onInvite,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(roleOptions[0] ?? 'Member');
  const [branch, setBranch] = useState(branchOptions[0] ?? '');

  // HR Specific States
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [salary, setSalary] = useState('');
  const [shift, setShift] = useState('Full-time');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [arrivalTime, setArrivalTime] = useState('09:00');
  const [leaveTime, setLeaveTime] = useState('18:00');
  const [salaryPaid, setSalaryPaid] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim() && email.trim() && phone.trim() && password.trim() && role && branch);
  }, [branch, email, name, password, phone, role]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onInvite({
      id: nextUserId,
      name,
      email,
      phone,
      password,
      role,
      branch,
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
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div style={styles.header}>
          <div>
            <h3 id="modal-title" style={styles.headerTitle}>
              Add new user & HR Info
            </h3>
            <p style={styles.headerSub}>Capture user identity, role, branch, and HR parameters.</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div style={styles.body}>
          {/* Section: Credentials & Basic info */}
          <h4 style={styles.sectionHeader}>Basic Credentials</h4>
          
          <div style={styles.fieldRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="role">
                Role
              </label>
              <select
                id="role"
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
              <label style={styles.label} htmlFor="branch">
                Branch
              </label>
              <select
                id="branch"
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

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+94 71 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* Section: HR Details */}
          <div style={styles.separator} />
          <h4 style={styles.sectionHeader}>HR Management Info</h4>

          <div style={styles.fieldRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="designation">
                Designation
              </label>
              <input
                id="designation"
                type="text"
                placeholder="Senior Cashier"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="department">
                Department
              </label>
              <input
                id="department"
                type="text"
                placeholder="Sales & Checkout"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.fieldRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="salary">
                Monthly Salary
              </label>
              <input
                id="salary"
                type="number"
                placeholder="45000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="shift">
                Working Shift
              </label>
              <select
                id="shift"
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
              <label style={styles.label} htmlFor="arrival_time">
                Shift Arrival Time
              </label>
              <input
                id="arrival_time"
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="leave_time">
                Shift Leave Time
              </label>
              <input
                id="leave_time"
                type="time"
                value={leaveTime}
                onChange={(e) => setLeaveTime(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.fieldRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="salary_paid">
                Salary Paid Status
              </label>
              <select
                id="salary_paid"
                value={salaryPaid ? 'Paid' : 'Unpaid'}
                onChange={(e) => setSalaryPaid(e.target.value === 'Paid')}
                style={styles.input}
              >
                <option value="Unpaid">Unpaid / Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="emergency_contact">
                Emergency Contact
              </label>
              <input
                id="emergency_contact"
                type="tel"
                placeholder="+94 77 123 4567"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.ghostBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...styles.primaryBtn,
              opacity: canSubmit ? 1 : 0.55,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            <i className="ti ti-user-plus" aria-hidden="true" />
            Add user
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
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    border: '0.5px solid rgba(0,0,0,0.1)',
    width: 'min(520px, 100%)',
    overflow: 'hidden',
  },
  header: {
    padding: '18px 20px',
    borderBottom: '0.5px solid rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 500,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#888',
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
    color: '#555',
    flexShrink: 0,
  },
  body: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxHeight: 'min(500px, 60vh)',
    overflowY: 'auto',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: '#534AB7',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '4px 0',
  },
  separator: {
    height: '1px',
    background: 'rgba(0,0,0,0.08)',
    margin: '10px 0',
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
    color: '#888',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '0.5px solid rgba(0,0,0,0.2)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#222',
    outline: 'none',
    boxSizing: 'border-box',
  },
  footer: {
    padding: '14px 20px',
    borderTop: '0.5px solid rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  ghostBtn: {
    padding: '7px 14px',
    border: '0.5px solid rgba(0,0,0,0.2)',
    borderRadius: 8,
    background: 'none',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: '#222',
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
    opacity: 1,
  },
};

export default InviteModal;
