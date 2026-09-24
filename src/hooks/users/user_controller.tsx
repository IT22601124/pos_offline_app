import { db } from "../../offline/db";
import { offlineAddUser, offlineGetUsers } from "../../offline/offlineAdapter";
import type { User } from "../../types";

export const getAllUsers = async (): Promise<User[]> => {
  try {
    return await offlineGetUsers();
  } catch (err) {
    console.error("Error fetching users:", err);
    throw err;
  }
};

export const verifyToken = async (): Promise<boolean> => {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");
  return Boolean(token);
};

export const createBackendUser = async (userPayload: Partial<User>): Promise<User> => {
  try {
    const newUser: Omit<User, 'id'> = {
      name: userPayload.name || 'New User',
      email: userPayload.email || '',
      phone: userPayload.phone || '',
      branch: userPayload.branch || 'Main Branch',
      role: userPayload.role || 'Cashier',
      status: userPayload.status || 'Active',
      joined: userPayload.joined || new Date().toISOString().split('T')[0],
      password: userPayload.password || '123456',
      designation: userPayload.designation || '',
      department: userPayload.department || '',
    };
    return await offlineAddUser(newUser);
  } catch (err) {
    console.error("Error creating user:", err);
    throw err;
  }
};

export const updateBackendUser = async (id: number, userPayload: Partial<User>): Promise<User> => {
  try {
    await db.users.update(id, userPayload);
    const updated = await db.users.get(id);
    if (!updated) throw new Error("User not found after update.");
    return updated;
  } catch (err) {
    console.error("Error updating user:", err);
    throw err;
  }
};
