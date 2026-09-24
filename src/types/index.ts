export type UserStatus = 'Active' | 'Inactive';
export type NavPage =
  | 'dashboard'
  | 'pos'
  | 'posManagement'
  | 'users'
  | 'branches'
  | 'roles'
  | 'analytics'
  | 'settings'
  | 'profile'
  | 'permissions'
  | 'audit'
  | 'hr';

export type UserRole = string;

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  branch: string;
  role: UserRole;
  status: UserStatus;
  joined: string;
  password?: string;
  designation?: string;
  department?: string;
  salary?: number;
  shift?: string;
  emergency_contact?: string;
  arrival_time?: string;
  leave_time?: string;
  salary_paid?: boolean;
}

export interface Branch {
  id: number;
  name: string;
  code: string;
  location: string;
  manager: string;
  status: 'Active' | 'Inactive';
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  status: 'Active' | 'Draft';
}

export interface StatCard {
  label: string;
  value: string | number;
  delta: string;
  trend: 'up' | 'down' | 'neutral';
}
