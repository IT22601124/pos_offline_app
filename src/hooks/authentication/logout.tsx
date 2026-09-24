import apiClient from "../../api/clients";

export const userLogout = async (): Promise<boolean> => {
  try {
    await apiClient.post("auth/logout");
  } catch (err) {
    console.error("Logout API request error:", err);
  } finally {
    // Always clear localStorage credentials even if the backend request fails
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }
  return true;
};
