import React, { useEffect } from "react";
import { checkConnection } from "../../hooks/splash_screen/splash_screeen";
import { Alert, AlertTitle, Stack } from "@mui/material";
import { verifyToken } from "../../hooks/users/user_controller";
import { useNavigate } from "react-router-dom";

const SplashScreen: React.FC = () => {
  const [alert, setAlert] = React.useState({ show: false, title: "", message: "" });
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const verifyConnection = async () => {
      try {
        const isConnected = await checkConnection();

        if (!isMounted) return;

        if (!isConnected) {
          setAlert({ show: true, title: "Connection Error", message: "Backend is not healthy. Please check your connection." });
          return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        const isValid = await verifyToken();

        if (!isMounted) return;

        if (isValid) {
          navigate("/dashboard", { replace: true });
          return;
        }

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
      } catch (err) {
        console.error("Error checking connection:", err);
        if (isMounted) {
          setAlert({ show: true, title: "Connection Error", message: "Unable to verify the backend connection." });
        }
      }
    };

    verifyConnection();

    return () => {
      isMounted = false;
    };
  }, [navigate]);



  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
      }}
    >
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
      <div
        style={{
          textAlign: "center",
          color: "#fff",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 100,
            height: 100,
            margin: "0 auto 20px",
            borderRadius: 20,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: "bold",
            color: "#0F172A",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
        >
          POS
        </div>

        {/* App Name */}
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "1px",
          }}
        >
        NOVA POS 
        </h1>

        <p
          style={{
            marginTop: 8,
            color: "#CBD5E1",
            fontSize: "0.95rem",
          }}
        >
          Smart Business Management
        </p>

        {/* Loader */}
        <div
          style={{
            margin: "30px auto 0",
            width: 50,
            height: 50,
            border: "4px solid rgba(255,255,255,0.2)",
            borderTop: "4px solid #fff",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />

        <p
          style={{
            marginTop: 20,
            color: "#94A3B8",
            fontSize: "0.9rem",
          }}
        >
          Loading...
        </p>

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default SplashScreen;
