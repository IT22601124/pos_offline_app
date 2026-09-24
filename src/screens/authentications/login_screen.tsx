import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userLogin } from "../../hooks/authentication/login";
import { initializeOfflineDatabase } from "../../offline/seed";
import axios from "axios";
import AlertTitle from '@mui/material/AlertTitle';
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ show: false, title: "", message: "" });
  const isFormValid = mobile.trim() !== "" && password.trim() !== "";

  useEffect(() => {
    initializeOfflineDatabase().catch((err) => {
      console.error("Failed to seed offline database on login page:", err);
    });
  }, []);

  useEffect(() => {
    if (!alert.show) return;

    const timer = setTimeout(() => {
      setAlert((previousAlert) => ({ ...previousAlert, show: false }));
    }, 3000);

    return () => clearTimeout(timer);
  }, [alert.show, alert.message]);

  const validations = () => {
    if (!mobile || !password) {
      setAlert({
        show: true,
        title: "Validation Error",
        message: "Please fill in all fields",
      });
      return false;
    }
    if (mobile.trim().length < 1) {
      setAlert({
        show: true,
        title: "Validation Error",
        message: "Please enter a valid mobile number or account ID",
      });
      return false;
    }
    return true;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!validations()) return;
      const response = await userLogin(mobile, password);
      if (response) {
        console.log("Login successful:", response);
        navigate("/dashboard", { replace: true });
      }
    }
    catch (err: any) {
      let errorMessage = "An error occurred during login";

      if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
        errorMessage = err.message;
      } else if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || "An error occurred during login";
      }

      setAlert({
        show: true,
        title: "Login Error",
        message: errorMessage,
      });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background:
          "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
      }}
    >
      {/* Left Side */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          padding: "40px",
        }}
      >
        <div>
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "20px",
              background: "white",
              color: "#0F172A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: "bold",
              marginBottom: "24px",
            }}
          >
            POS
          </div>

          <h1
            style={{
              fontSize: "3rem",
              marginBottom: "10px",
            }}
          >
            POS System
          </h1>

          <p
            style={{
              color: "#CBD5E1",
              fontSize: "1.1rem",
            }}
          >
            Smart Business Management Solution
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div
        style={{
          width: "450px",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
          boxShadow: "-10px 0 30px rgba(0,0,0,0.1)",
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            width: "100%",
            maxWidth: "350px",
          }}
        >
          <h2
            style={{
              marginBottom: "10px",
              color: "#0F172A",
            }}
          >
            Welcome Back
          </h2>

          <p
            style={{
              color: "#64748B",
              marginBottom: "30px",
            }}
          >
            Sign in to continue
          </p>

          {/* Mobile / Account ID */}
          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="login-mobile-input"
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 500,
                color: "#0F172A",
              }}
            >
              Mobile Number / Account ID
            </label>

            <input
              id="login-mobile-input"
              name="username"
              type="text"
              placeholder="Enter mobile number or username"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#ffffff",
                color: "#0F172A",
                cursor: "text",
                pointerEvents: "auto",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "25px" }}>
            <label
              htmlFor="login-password-input"
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 500,
                color: "#0F172A",
              }}
            >
              Password
            </label>

            <input
              id="login-password-input"
              name="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                background: "#ffffff",
                color: "#0F172A",
                cursor: "text",
                pointerEvents: "auto",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            type="submit"
            disabled={!isFormValid}
            style={{
              width: "100%",
              padding: "14px",
              background: isFormValid ? "#0F172A" : "#94A3B8",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: isFormValid ? "pointer" : "not-allowed",
              fontWeight: 600,
              fontSize: "15px",
              opacity: isFormValid ? 1 : 0.6,
            }}
          >
            Sign In
          </button>



          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              marginTop: "25px",
              color: "#94A3B8",
              fontSize: "14px",
            }}
          >
            POS System v1.0.0
          </div>
        </form>
      </div>
      {alert.show && (
        <div style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          transform: "translateY(0)",
          opacity: 1,
          transition: "all 0.3s ease",
          minWidth: "280px",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          backdropFilter: "blur(10px)",
          fontSize: "14px",
        }}>
          <Stack sx={{ width: '100%' }} spacing={2}>
            <Alert severity="error" style={{ backgroundColor: "rgba(3, 4, 54, 0.95)", color: "#fff" }} >
              <AlertTitle></AlertTitle>
              {alert.message}
            </Alert>
          </Stack>
        </div>
      )}
    </div>

  );
};

export default LoginPage;
