import axios from "axios";

const BACKEND_API_URL = "https://mpos.studiorespectweddings.com";
const runtimeDefaultApiBase = window.location.protocol === "file:" ? BACKEND_API_URL : "/api/";

const apiClient = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || runtimeDefaultApiBase,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.url && config.url.startsWith("/")) {
    config.url = config.url.slice(1);
  }

  return config;
});

// interceptor (like Flutter Dio)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("API 401 Unauthorized - using local offline state if available.");
    } else {
      console.error("API Error:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
