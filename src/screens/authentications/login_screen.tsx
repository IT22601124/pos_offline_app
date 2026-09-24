import React, { useEffect, useState } from "react";
import { userLogin } from "../../hooks/authentication/login";
import axios from "axios";
import AlertTitle from '@mui/material/AlertTitle';
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

const LoginPage: React.FC = () => {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ show: false, title: "", message: "" });
  const isFormValid = mobile.trim() !== "" && password.trim() !== "";

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
    if (mobile.length < 10) {
      setAlert({
        show: true,
        title: "Validation Error",
        message: "Please enter a valid mobile number",
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
        console.log(response);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      }
    }
    catch (err: unknown) {
      let errorMessage = "An error occurred during login";

      if (axios.isAxiosError(err)) {
        errorMessage =
          err.response?.data?.error || "An error occurred during login";
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

          {/* Mobile */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
              Mobile Number
            </label>

            <input
              type="tel"
              placeholder="Enter mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "25px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
              Password
            </label>

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
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
