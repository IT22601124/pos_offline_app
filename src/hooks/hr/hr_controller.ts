import apiClient from '../../api/clients';
import { getAllUsers } from '../users/user_controller';

export interface PayrollRecord {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  baseSalary: number;
  month: string; // YYYY-MM
  leaveCount: number;
  workHours: number;
  advancePay: number;
  netSalary: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Pending';
  paidAt?: string;
}

export interface AdvancePayRequest {
  id: number;
  userId: number;
  userName: string;
  amount: number;
  requestDate: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  reason?: string;
}

// Local storage mock helpers for seamless local development
const LOCAL_PAYROLL_KEY = 'mpos_payroll_records';
const LOCAL_ADVANCE_KEY = 'mpos_advance_requests';

const getLocalPayroll = (): PayrollRecord[] => {
  try {
    const data = localStorage.getItem(LOCAL_PAYROLL_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalPayroll = (records: PayrollRecord[]) => {
  localStorage.setItem(LOCAL_PAYROLL_KEY, JSON.stringify(records));
};

const getLocalAdvanceRequests = (): AdvancePayRequest[] => {
  try {
    const data = localStorage.getItem(LOCAL_ADVANCE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalAdvanceRequests = (requests: AdvancePayRequest[]) => {
  localStorage.setItem(LOCAL_ADVANCE_KEY, JSON.stringify(requests));
};

// Calculate net salary based on formula
export const calculateNetSalary = (baseSalary: number, leaveCount: number, advancePay: number): number => {
  const dailyRate = baseSalary / 30;
  const leaveDeduction = leaveCount * dailyRate;
  const net = baseSalary - leaveDeduction - advancePay;
  return Math.max(0, Math.round(net));
};

export const getMonthlyPayroll = async (month: string): Promise<PayrollRecord[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; payrolls: PayrollRecord[] }>(`hr/payroll?month=${month}`);
    if (response.data?.success && Array.isArray(response.data.payrolls)) {
      return response.data.payrolls;
    }
  } catch (err) {
    console.warn('Backend HR payroll routes not implemented yet, using local mock storage.', err);
  }

  // Fallback mock logic
  const users = await getAllUsers();
  const localPayroll = getLocalPayroll();
  const monthRecords = localPayroll.filter((r) => r.month === month);

  // If we don't have records for this month yet, initialize them for all users
  if (monthRecords.length === 0) {
    const newRecords: PayrollRecord[] = users.map((user, idx) => {
      const baseSalary = user.salary || 35000; // default base salary
      const record: PayrollRecord = {
        id: Date.now() + idx,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        baseSalary,
        month,
        leaveCount: 0,
        workHours: 160, // default normal work hours
        advancePay: 0,
        netSalary: baseSalary,
        paymentStatus: 'Unpaid',
      };
      return record;
    });

    const updatedPayroll = [...localPayroll, ...newRecords];
    saveLocalPayroll(updatedPayroll);
    return newRecords;
  }

  return monthRecords;
};

export const savePayrollRecord = async (record: PayrollRecord): Promise<PayrollRecord> => {
  try {
    const response = await apiClient.post<PayrollRecord>('hr/payroll', record);
    return response.data;
  } catch (err) {
    console.warn('Backend save payroll failed, updating local mock storage.', err);
  }

  // Fallback mock logic
  const localPayroll = getLocalPayroll();
  const updated = localPayroll.map((r) => (r.id === record.id ? record : r));
  saveLocalPayroll(updated);
  return record;
};

export const paySalary = async (recordId: number): Promise<PayrollRecord | null> => {
  const localPayroll = getLocalPayroll();
  const record = localPayroll.find((r) => r.id === recordId);
  if (!record) return null;

  const updatedRecord: PayrollRecord = {
    ...record,
    paymentStatus: 'Paid',
    paidAt: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };

  try {
    await apiClient.post(`hr/payroll/${recordId}/pay`, { paidAt: updatedRecord.paidAt });
  } catch (err) {
    console.warn('Backend pay salary failed, updating local mock storage.', err);
  }

  const updatedPayroll = localPayroll.map((r) => (r.id === recordId ? updatedRecord : r));
  saveLocalPayroll(updatedPayroll);
  return updatedRecord;
};

export const getAdvancePayRequests = async (): Promise<AdvancePayRequest[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: AdvancePayRequest[] }>('hr/advance-pay');
    if (response.data?.success && Array.isArray(response.data.data)) {
      return response.data.data;
    }
  } catch (err) {
    console.warn('Backend advance-pay endpoints not implemented, using mock data.', err);
  }

  return getLocalAdvanceRequests();
};

export const requestAdvancePay = async (
  userId: number,
  userName: string,
  amount: number,
  reason: string
): Promise<AdvancePayRequest> => {
  const newRequest: AdvancePayRequest = {
    id: Date.now(),
    userId,
    userName,
    amount,
    requestDate: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    status: 'Pending',
    reason,
  };

  try {
    const response = await apiClient.post<AdvancePayRequest>('hr/advance-pay', newRequest);
    return response.data;
  } catch (err) {
    console.warn('Backend submit advance failed, saving locally to mock storage.', err);
  }

  const localAdvance = getLocalAdvanceRequests();
  const updated = [newRequest, ...localAdvance];
  saveLocalAdvanceRequests(updated);

  // Auto-deduct from payroll for the current month if approved (for mock responsiveness)
  // Find current month string (YYYY-MM)
  const currentMonth = new Date().toISOString().substring(0, 7);
  const localPayroll = getLocalPayroll();
  const payrollRecord = localPayroll.find((r) => r.userId === userId && r.month === currentMonth);
  if (payrollRecord) {
    payrollRecord.advancePay = Number(payrollRecord.advancePay) + amount;
    payrollRecord.netSalary = calculateNetSalary(payrollRecord.baseSalary, payrollRecord.leaveCount, payrollRecord.advancePay);
    saveLocalPayroll(localPayroll.map((r) => (r.id === payrollRecord.id ? payrollRecord : r)));
  }

  return newRequest;
};

export const approveAdvancePay = async (requestId: number): Promise<boolean> => {
  const localAdvance = getLocalAdvanceRequests();
  const request = localAdvance.find((r) => r.id === requestId);
  if (!request) return false;

  request.status = 'Approved';
  saveLocalAdvanceRequests(localAdvance.map((r) => (r.id === requestId ? request : r)));
  return true;
};

// Leave Request interface
export interface LeaveRequest {
  id: number;
  userId: number;
  userName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  createdAt: string;
}

const getLocalLeaves = (): LeaveRequest[] => {
  try {
    const data = localStorage.getItem('mpos_leave_requests');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalLeaves = (leaves: LeaveRequest[]) => {
  localStorage.setItem('mpos_leave_requests', JSON.stringify(leaves));
};

export const getLeaveRequests = async (): Promise<LeaveRequest[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; data: LeaveRequest[] }>('hr/leaves');
    if (response.data?.success && Array.isArray(response.data.data)) {
      return response.data.data;
    }
  } catch (err) {
    console.warn('Backend leaves API not implemented, using mock storage.', err);
  }
  return getLocalLeaves();
};

export const createLeaveRequest = async (data: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>): Promise<LeaveRequest> => {
  const newRequest: LeaveRequest = {
    id: Date.now(),
    ...data,
    status: 'Pending',
    createdAt: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  };

  try {
    const response = await apiClient.post<LeaveRequest>('hr/leaves', newRequest);
    return response.data;
  } catch (err) {
    console.warn('Backend leaves submit failed, saving to local mock storage.', err);
  }

  const localLeaves = getLocalLeaves();
  saveLocalLeaves([newRequest, ...localLeaves]);
  return newRequest;
};

export const approveLeaveRequest = async (requestId: number): Promise<boolean> => {
  const localLeaves = getLocalLeaves();
  const request = localLeaves.find((r) => r.id === requestId);
  if (!request) return false;

  request.status = 'Approved';

  try {
    await apiClient.post(`hr/leaves/${requestId}/approve`);
  } catch (err) {
    console.warn('Backend approve leave failed, updating local mock storage.', err);
  }

  saveLocalLeaves(localLeaves.map((r) => (r.id === requestId ? request : r)));

  // Sync leaves tally with corresponding month's payroll record
  const month = request.startDate.substring(0, 7); // YYYY-MM
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const localPayroll = getLocalPayroll();
  const record = localPayroll.find((r) => r.userId === request.userId && r.month === month);
  if (record) {
    record.leaveCount = Number(record.leaveCount) + diffDays;
    record.netSalary = calculateNetSalary(record.baseSalary, record.leaveCount, record.advancePay);
    saveLocalPayroll(localPayroll.map((r) => (r.id === record.id ? record : r)));
  }
  return true;
};

export const rejectLeaveRequest = async (requestId: number): Promise<boolean> => {
  const localLeaves = getLocalLeaves();
  const request = localLeaves.find((r) => r.id === requestId);
  if (!request) return false;

  request.status = 'Rejected';

  try {
    await apiClient.post(`hr/leaves/${requestId}/reject`);
  } catch (err) {
    console.warn('Backend reject leave failed, updating local mock storage.', err);
  }

  saveLocalLeaves(localLeaves.map((r) => (r.id === requestId ? request : r)));
  return true;
};
