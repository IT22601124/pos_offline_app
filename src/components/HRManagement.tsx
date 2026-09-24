import React, { useEffect, useMemo, useState } from 'react';
import {
  PayrollRecord,
  AdvancePayRequest,
  LeaveRequest,
  getMonthlyPayroll,
  savePayrollRecord,
  paySalary,
  getAdvancePayRequests,
  requestAdvancePay,
  approveAdvancePay,
  calculateNetSalary,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
} from '../hooks/hr/hr_controller';
import { getAllUsers } from '../hooks/users/user_controller';
import { User } from '../types';
import StatCard from './StatCard';

const MONTHS_LIST = [
  { value: '01', name: 'January' },
  { value: '02', name: 'February' },
  { value: '03', name: 'March' },
  { value: '04', name: 'April' },
  { value: '05', name: 'May' },
  { value: '06', name: 'June' },
  { value: '07', name: 'July' },
  { value: '08', name: 'August' },
  { value: '09', name: 'September' },
  { value: '10', name: 'October' },
  { value: '11', name: 'November' },
  { value: '12', name: 'December' },
];

const YEARS_LIST = ['2026', '2027', '2028'];

type HRTab = 'payroll' | 'advance' | 'leaves';

const HRManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HRTab>('payroll');
  
  // Date Selection State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return String(today.getMonth() + 1).padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));

  const currentMonthKey = useMemo(() => `${selectedYear}-${selectedMonth}`, [selectedMonth, selectedYear]);

  // Main Data States
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [advanceRequests, setAdvanceRequests] = useState<AdvancePayRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Advance Pay Modal States
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const records = await getMonthlyPayroll(currentMonthKey);
        const requests = await getAdvancePayRequests();
        const userList = await getAllUsers();
        const leaves = await getLeaveRequests();
        setPayrollRecords(records);
        setAdvanceRequests(requests);
        setUsers(userList);
        setLeaveRequests(leaves);
      } catch (err) {
        console.error('Error fetching HR data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentMonthKey]);

  // Handle Inline Inputs Blur
  const handleRecordChange = async (
    record: PayrollRecord,
    field: 'leaveCount' | 'workHours' | 'advancePay',
    val: number
  ) => {
    const updatedRecord: PayrollRecord = {
      ...record,
      [field]: val,
    };
    
    // Recalculate net salary on change
    updatedRecord.netSalary = calculateNetSalary(
      updatedRecord.baseSalary,
      updatedRecord.leaveCount,
      updatedRecord.advancePay
    );

    setPayrollRecords((prev) => prev.map((r) => (r.id === record.id ? updatedRecord : r)));
    await savePayrollRecord(updatedRecord);
  };

  // Pay Salary Action
  const handlePaySalary = async (recordId: number) => {
    const result = await paySalary(recordId);
    if (result) {
      setPayrollRecords((prev) => prev.map((r) => (r.id === recordId ? result : r)));
    }
  };

  // Submit Advance Request Action
  const handleAddAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((u) => u.id === Number(targetUserId));
    if (!user || !advanceAmount) return;

    try {
      const newRequest = await requestAdvancePay(
        user.id,
        user.name,
        Number(advanceAmount),
        advanceReason
      );
      setAdvanceRequests((prev) => [newRequest, ...prev]);
      
      // Clear inputs and close
      setAdvanceAmount('');
      setAdvanceReason('');
      setShowAdvanceModal(false);
      
      // Refresh current payroll numbers to account for advance addition
      const records = await getMonthlyPayroll(currentMonthKey);
      setPayrollRecords(records);
    } catch (err) {
      console.error('Error submitting advance:', err);
    }
  };

  // Approve Advance Action
  const handleApproveAdvance = async (requestId: number) => {
    const success = await approveAdvancePay(requestId);
    if (success) {
      setAdvanceRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'Approved' } : r))
      );
      
      // Sync payroll
      const request = advanceRequests.find((r) => r.id === requestId);
      if (request) {
        const matchingPayroll = payrollRecords.find((p) => p.userId === request.userId);
        if (matchingPayroll) {
          const updated: PayrollRecord = {
            ...matchingPayroll,
            advancePay: Number(matchingPayroll.advancePay) + request.amount,
          };
          updated.netSalary = calculateNetSalary(updated.baseSalary, updated.leaveCount, updated.advancePay);
          setPayrollRecords((prev) => prev.map((p) => (p.id === matchingPayroll.id ? updated : p)));
          await savePayrollRecord(updated);
        }
      }
    }
  };

  const handleApproveLeave = async (requestId: number) => {
    const success = await approveLeaveRequest(requestId);
    if (success) {
      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'Approved' } : r))
      );
      // Refresh current payroll numbers to account for leave addition
      const records = await getMonthlyPayroll(currentMonthKey);
      setPayrollRecords(records);
    }
  };

  const handleRejectLeave = async (requestId: number) => {
    const success = await rejectLeaveRequest(requestId);
    if (success) {
      setLeaveRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'Rejected' } : r))
      );
    }
  };

  // Summary Metrics calculations
  const totalBasePayroll = useMemo(() => payrollRecords.reduce((sum, r) => sum + r.baseSalary, 0), [payrollRecords]);
  const totalPaidSalary = useMemo(() => payrollRecords.reduce((sum, r) => sum + (r.paymentStatus === 'Paid' ? r.netSalary : 0), 0), [payrollRecords]);
  const totalPendingObligations = useMemo(() => payrollRecords.reduce((sum, r) => sum + (r.paymentStatus !== 'Paid' ? r.netSalary : 0), 0), [payrollRecords]);
  const totalLeaves = useMemo(() => payrollRecords.reduce((sum, r) => sum + r.leaveCount, 0), [payrollRecords]);
  const totalAdvancePaid = useMemo(() => payrollRecords.reduce((sum, r) => sum + r.advancePay, 0), [payrollRecords]);

  const stats = [
    { label: 'Total Base Payroll', value: `LKR ${totalBasePayroll.toLocaleString()}`, delta: 'Monthly base total', trend: 'neutral' as const },
    { label: 'Total Paid Salaries', value: `LKR ${totalPaidSalary.toLocaleString()}`, delta: 'Transferred payouts', trend: 'up' as const },
    { label: 'Pending Obligations', value: `LKR ${totalPendingObligations.toLocaleString()}`, delta: `${totalLeaves} leave days taken`, trend: 'down' as const },
    { label: 'Approved Advance Pay', value: `LKR ${totalAdvancePaid.toLocaleString()}`, delta: `Across all users`, trend: 'neutral' as const },
  ];

  return (
    <div style={styles.container}>
      {/* Header section */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>HR Payroll & Operations</h1>
          <p style={styles.pageSubtitle}>Manage monthly employee leaves, shifts, work hours, advances, and payouts</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.selectGroup}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={styles.filterSelect}
            >
              {MONTHS_LIST.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={styles.filterSelect}
            >
              {YEARS_LIST.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button style={styles.primaryBtn} onClick={() => {
            if (users.length > 0) {
              setTargetUserId(users[0].id);
              setShowAdvanceModal(true);
            }
          }}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} />
            Request Advance
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div style={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} card={s} />
        ))}
      </div>

      {/* Navigation tabs */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.tabGroup}>
            <button
              style={{ ...styles.tab, ...(activeTab === 'payroll' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('payroll')}
            >
              <i className="ti ti-cash" style={{ marginRight: 6 }} />
              Monthly Payroll Sheets ({MONTHS_LIST.find((m) => m.value === selectedMonth)?.name} {selectedYear})
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'advance' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('advance')}
            >
              <i className="ti ti-receipt" style={{ marginRight: 6 }} />
              Advance Pay Request Logs
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'leaves' ? styles.tabActive : {}) }}
              onClick={() => setActiveTab('leaves')}
            >
              <i className="ti ti-calendar-event" style={{ marginRight: 6 }} />
              Leave Requests ({leaveRequests.length})
            </button>
          </div>
        </div>

        {/* Tab contents */}
        {isLoading ? (
          <div style={styles.loadingRow}>Loading HR Operational sheets...</div>
        ) : activeTab === 'payroll' ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Employee', 'Role', 'Base Salary', 'Leaves Taken', 'Total Hours', 'Advance Deductions', 'Net Payout', 'Status', ''].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map((record, i) => {
                  const isPaid = record.paymentStatus === 'Paid';
                  return (
                    <tr key={record.id} style={{ ...styles.tr, ...(i % 2 ? styles.trAlt : {}) }}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <div style={styles.avatarMini}>{record.userName.substring(0, 2).toUpperCase()}</div>
                          <div>
                            <div style={styles.uName}>{record.userName}</div>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>{record.userRole}</td>
                      <td style={styles.td}>LKR {record.baseSalary.toLocaleString()}</td>
                      
                      {/* Leave inputs */}
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={record.leaveCount}
                          disabled={isPaid}
                          onChange={(e) => handleRecordChange(record, 'leaveCount', Math.max(0, Number(e.target.value)))}
                          style={isPaid ? styles.inlineInputDisabled : styles.inlineInput}
                          min="0"
                        />
                      </td>

                      {/* Work hours input */}
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={record.workHours}
                          disabled={isPaid}
                          onChange={(e) => handleRecordChange(record, 'workHours', Math.max(0, Number(e.target.value)))}
                          style={isPaid ? styles.inlineInputDisabled : styles.inlineInput}
                          min="0"
                        />
                      </td>

                      {/* Advance pay inputs */}
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={record.advancePay}
                          disabled={isPaid}
                          onChange={(e) => handleRecordChange(record, 'advancePay', Math.max(0, Number(e.target.value)))}
                          style={isPaid ? styles.inlineInputDisabled : styles.inlineInput}
                          min="0"
                        />
                      </td>

                      <td style={{ ...styles.td, fontWeight: 600 }}>LKR {record.netSalary.toLocaleString()}</td>
                      
                      {/* Payout status badge */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(isPaid ? styles.badgePaid : styles.badgeUnpaid),
                          }}
                        >
                          {record.paymentStatus}
                        </span>
                      </td>

                      {/* Payout Action button */}
                      <td style={styles.td}>
                        {!isPaid ? (
                          <button
                            style={styles.payBtn}
                            onClick={() => handlePaySalary(record.id)}
                            title="Confirm transfer payout"
                          >
                            <i className="ti ti-cash-banknote" style={{ marginRight: 4 }} />
                            Pay Salary
                          </button>
                        ) : (
                          <span style={styles.paidDateText}>Paid on {record.paidAt}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'advance' ? (
          /* Tab: Advance Requests */
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['ID', 'Employee', 'Requested Amount', 'Request Date', 'Reason', 'Status', ''].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {advanceRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={styles.emptyCell}>
                      No advance pay request logs found.
                    </td>
                  </tr>
                ) : (
                  advanceRequests.map((req, i) => {
                    const isPending = req.status === 'Pending';
                    const isApproved = req.status === 'Approved';
                    return (
                      <tr key={req.id} style={{ ...styles.tr, ...(i % 2 ? styles.trAlt : {}) }}>
                        <td style={styles.tdId}>#{req.id}</td>
                        <td style={styles.td}>
                          <div style={styles.userCell}>
                            <div style={styles.avatarMini}>{req.userName.substring(0, 2).toUpperCase()}</div>
                            <span style={styles.uName}>{req.userName}</span>
                          </div>
                        </td>
                        <td style={{ ...styles.td, fontWeight: 600 }}>LKR {req.amount.toLocaleString()}</td>
                        <td style={styles.td}>{req.requestDate}</td>
                        <td style={styles.td}>{req.reason || 'N/A'}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              ...(isApproved
                                ? styles.badgePaid
                                : isPending
                                ? styles.badgePending
                                : styles.badgeUnpaid),
                            }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {isPending && (
                            <button
                              style={styles.payBtn}
                              onClick={() => handleApproveAdvance(req.id)}
                            >
                              <i className="ti ti-check" style={{ marginRight: 4 }} />
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab: Leave Requests */
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['ID', 'Employee', 'Leave Type', 'Dates', 'Duration', 'Reason', 'Status', ''].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={styles.emptyCell}>
                      No leave requests found.
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((req, idx) => {
                    const start = new Date(req.startDate);
                    const end = new Date(req.endDate);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    const isPending = req.status === 'Pending';
                    const isApproved = req.status === 'Approved';
                    return (
                      <tr key={req.id} style={{ ...styles.tr, ...(idx % 2 ? styles.trAlt : {}) }}>
                        <td style={styles.tdId}>#{req.id}</td>
                        <td style={styles.td}>
                          <div style={styles.userCell}>
                            <div style={styles.avatarMini}>{req.userName.substring(0, 2).toUpperCase()}</div>
                            <span style={styles.uName}>{req.userName}</span>
                          </div>
                        </td>
                        <td style={styles.td}>{req.leaveType}</td>
                        <td style={styles.td}>
                          {req.startDate} to {req.endDate}
                        </td>
                        <td style={{ ...styles.td, fontWeight: 600 }}>
                          {diffDays} {diffDays === 1 ? 'day' : 'days'}
                        </td>
                        <td style={styles.td}>{req.reason}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              ...(isApproved
                                ? styles.badgePaid
                                : isPending
                                ? styles.badgePending
                                : styles.badgeUnpaid),
                            }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {isPending && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                style={styles.payBtn}
                                onClick={() => handleApproveLeave(req.id)}
                              >
                                <i className="ti ti-check" style={{ marginRight: 4 }} />
                                Approve
                              </button>
                              <button
                                style={{ ...styles.payBtn, background: '#ef4444' }}
                                onClick={() => handleRejectLeave(req.id)}
                              >
                                <i className="ti ti-x" style={{ marginRight: 4 }} />
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Advance Pay Modal */}
      {showAdvanceModal && (
        <div style={styles.overlay}>
          <form onSubmit={handleAddAdvanceSubmit} style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Request Advance Payout</h3>
                <p style={styles.modalSub}>Log advance salaries to be auto-deducted at monthly settlements.</p>
              </div>
              <button
                type="button"
                style={styles.closeBtn}
                onClick={() => setShowAdvanceModal(false)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="advance-user">
                  Choose Employee
                </label>
                <select
                  id="advance-user"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(Number(e.target.value))}
                  style={styles.input}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="advance-amount">
                  Advance Amount (LKR)
                </label>
                <input
                  id="advance-amount"
                  type="number"
                  placeholder="e.g. 5000"
                  required
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  style={styles.input}
                  min="1"
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="advance-reason">
                  Reason for Advance Request
                </label>
                <textarea
                  id="advance-reason"
                  placeholder="Details/Reason for requesting advance salary..."
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  style={styles.textarea}
                  rows={3}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.ghostBtn}
                onClick={() => setShowAdvanceModal(false)}
              >
                Cancel
              </button>
              <button type="submit" style={styles.primaryBtn}>
                <i className="ti ti-check" style={{ marginRight: 4 }} />
                Submit Advance Request
              </button>
            </div>
          </form>
        </div>
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  selectGroup: {
    display: 'flex',
    gap: 8,
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--app-input-text)',
    background: 'var(--app-input-bg)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
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
    padding: '0 20px',
    borderBottom: '1px solid var(--app-border-soft)',
    background: '#f8fafc',
  },
  tabGroup: {
    display: 'flex',
    gap: 16,
  },
  tab: {
    padding: '16px 8px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 13.5,
    fontWeight: 500,
    color: 'var(--app-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'inherit',
  },
  tabActive: {
    color: '#534AB7',
    borderBottomColor: '#534AB7',
  },
  loadingRow: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--app-muted)',
    fontSize: 13,
  },
  tableWrap: {
    overflowX: 'auto',
    padding: '12px 20px 20px',
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
    padding: '10px 16px',
    borderBottom: '1px solid rgba(83,74,183,0.12)',
    textTransform: 'uppercase',
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
  emptyCell: {
    textAlign: 'center',
    padding: 32,
    color: 'var(--app-muted)',
    fontSize: 13,
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
    fontWeight: 600,
  },
  uName: {
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  inlineInput: {
    width: 70,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-input-bg)',
    color: 'var(--app-input-text)',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 13,
    textAlign: 'center',
  },
  inlineInputDisabled: {
    width: 70,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: 'none',
    color: 'var(--app-muted)',
    textAlign: 'center',
    fontSize: 13,
  },
  badge: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
  },
  badgePaid: {
    background: '#EAF3DE',
    color: '#3B6D11',
  },
  badgeUnpaid: {
    background: '#FAEEDA',
    color: '#854F0B',
  },
  badgePending: {
    background: '#E8F1FF',
    color: '#1E5BA8',
  },
  payBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  paidDateText: {
    fontSize: 12,
    color: 'var(--app-muted)',
  },
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
    width: 'min(440px, 100%)',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '0.5px solid rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1e293b',
  },
  modalSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 4,
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#64748b',
    padding: 0,
  },
  modalBody: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
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
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    background: '#fff',
    color: '#1e293b',
  },
  textarea: {
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    background: '#fff',
    color: '#1e293b',
  },
  modalFooter: {
    padding: '12px 20px',
    background: '#f8fafc',
    borderTop: '0.5px solid rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  ghostBtn: {
    padding: '7px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    fontSize: 13,
    color: '#64748b',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default HRManagement;
