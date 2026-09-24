import React, { useMemo, useState } from 'react';
import { User } from '../types';

interface RequestLeaveModalProps {
  user: User;
  onClose: () => void;
  onSave: (data: {
    userId: number;
    userName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => void;
}

const LEAVE_TYPES = [
  'Sick Leave',
  'Casual Leave',
  'Annual Leave',
  'Unpaid Leave',
  'Maternity/Paternity Leave',
];

const RequestLeaveModal: React.FC<RequestLeaveModalProps> = ({
  user,
  onClose,
  onSave,
}) => {
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [reason, setReason] = useState('');

  const dateDiffDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [startDate, endDate]);

  const canSubmit = useMemo(() => {
    return Boolean(startDate && endDate && dateDiffDays > 0 && reason.trim());
  }, [startDate, endDate, dateDiffDays, reason]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSave({
      userId: user.id,
      userName: user.name,
      leaveType,
      startDate,
      endDate,
      reason: reason.trim(),
    });
    onClose();
  };

  return (
    <div style={styles.overlay}>
      <form onSubmit={handleSubmit} style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="leave-modal-title">
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h3 id="leave-modal-title" style={styles.headerTitle}>
              Request Leave for Employee
            </h3>
            <p style={styles.headerSub}>Log leave requests. These leaves will automatically adjust monthly payroll balances.</p>
          </div>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Employee Name</label>
            <input
              type="text"
              value={user.name}
              disabled
              style={styles.inputDisabled}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="leave-type">
              Leave Type
            </label>
            <select
              id="leave-type"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              style={styles.input}
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="start-date">
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="end-date">
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          {dateDiffDays > 0 && (
            <div style={styles.durationBanner}>
              <i className="ti ti-calendar" style={{ marginRight: 6 }} />
              Duration: <strong>{dateDiffDays} {dateDiffDays === 1 ? 'day' : 'days'}</strong> of leave.
            </div>
          )}

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="leave-reason">
              Reason / Remarks
            </label>
            <textarea
              id="leave-reason"
              placeholder="Provide a reason for the leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={styles.textarea}
              rows={3}
              required
            />
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" style={styles.ghostBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            style={{
              ...styles.primaryBtn,
              opacity: canSubmit ? 1 : 0.55,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
            disabled={!canSubmit}
          >
            <i className="ti ti-calendar-plus" style={{ marginRight: 6 }} />
            Record Leave
          </button>
        </div>
      </form>
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
    width: 'min(460px, 100%)',
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
  body: {
    padding: 20,
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
  },
  inputDisabled: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#f8fafc',
    color: '#64748b',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'not-allowed',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1e293b',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  durationBanner: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
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
  },
};

export default RequestLeaveModal;
