import { offlineAddRole, offlineGetRoles } from "../../offline/offlineAdapter";
import { type Role } from "../../types";

export const getAllRoles = async (): Promise<Role[]> => {
  try {
    return await offlineGetRoles();
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
};

export const createRole = async (role: Omit<Role, 'id'>): Promise<Role> => {
  return await offlineAddRole(role);
};

