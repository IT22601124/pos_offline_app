import apiClient from "../../api/clients";

export const userLogout = async (_navigate?: (path: string, options?: any) => void): Promise<boolean> => {
  try {
    await apiClient.post("auth/logout").catch(() => {});
  } catch (err) {
    console.error("Logout API request error:", err);
  } finally {
    // Clear only authentication credentials so cash drawer shift sessions and store profiles persist
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    // Perform clean browser reload so inputs and window states are fully fresh
    if (window.location.protocol === 'file:' || window.location.hash) {
      window.location.hash = '#/login';
      window.location.reload();
    } else {
      window.location.href = '/login';
    }
  }
  return true;
};
