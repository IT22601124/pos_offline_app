import { offlineAddBranch, offlineGetBranches } from "../../offline/offlineAdapter";
import { type Branch } from "../../types";

export const getAllBranches = async (): Promise<Branch[]> => {
  try {
    return await offlineGetBranches();
  } catch (error) {
    console.error('Error fetching branches:', error);
    throw error;
  }
};

export const createBranch = async (branch: Omit<Branch, 'id'>): Promise<Branch> => {
  return await offlineAddBranch(branch);
};

