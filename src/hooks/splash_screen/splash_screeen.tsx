import API_RESOURCES from "../../api/api_resources";
import apiClient from "../../api/clients";

export const checkConnection = async () => {
  try {
    const response = await apiClient.get(API_RESOURCES.CHECK_CONNECTION);
    return response.status === 200;
  } catch (err) {
    console.error("Connection failed:", err);
    return false;
  }
};
