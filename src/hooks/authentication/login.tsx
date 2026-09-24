import { offlineLogin } from '../../offline/offlineAdapter';

export const userLogin = async (mobile: string, password: string) => {
  try {
    const res = await offlineLogin(mobile, password);
    localStorage.setItem("token", res.access_token);
    localStorage.setItem("access_token", res.access_token);
    localStorage.setItem("user", JSON.stringify(res.user));
    return 200;
  } catch (err) {
    console.error("Login error:", err);
    throw err;
  }
};

