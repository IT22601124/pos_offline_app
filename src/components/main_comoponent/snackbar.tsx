import { LinearProgress } from "@mui/material";
import React from "react";

const Snackbar: React.FC<{
  message: string;
  onClose?: () => void;
}> = ({ message, onClose }) => {
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    // progress animation
    const interval = setInterval(() => {
      setProgress((old) => Math.min(old + Math.random() * 8, 100));
    }, 120);

    // auto close
    const timer = setTimeout(() => {
      setVisible(false); // start exit animation
      setTimeout(() => {
        onClose?.();
      }, 300); // wait for animation
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transition: "all 0.3s ease",
        minWidth: "280px",
        background: "rgba(15, 23, 42, 0.95)",
        color: "#fff",
        padding: "14px 16px",
        borderRadius: "12px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        backdropFilter: "blur(10px)",
        fontSize: "14px",
      }}
    >
      {/* message */}
      <div style={{ marginBottom: 10, fontWeight: 500 }}>
        {message}
      </div>

      {/* progress */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 4,
          borderRadius: 5,
          backgroundColor: "rgba(255,255,255,0.2)",
          "& .MuiLinearProgress-bar": {
            backgroundColor: "#38bdf8",
          },
        }}
      />
    </div>
  );
};

export default Snackbar;