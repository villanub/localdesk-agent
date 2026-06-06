import { useEffect, useRef, useState } from "react";
import { NapsterCompanionApiSdk } from "@touchcastllc/napster-companion-api";
import "@touchcastllc/napster-companion-api/styles";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

function getOrCreateVisitorId() {
  let id = localStorage.getItem("ld_visitor_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("ld_visitor_id", id);
  }
  return id;
}

function getVisitorProfile() {
  const name = localStorage.getItem("ld_visitor_name");
  const lastService = localStorage.getItem("ld_last_service");
  return { name, lastService };
}

export default function AgentWidget({ onActivate }) {
  const containerRef = useRef(null);
  const sdkRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | active | error
  const [errorMsg, setErrorMsg] = useState("");

  async function startSession() {
    setStatus("loading");
    setErrorMsg("");

    try {
      const visitorId = getOrCreateVisitorId();
      const { name, lastService } = getVisitorProfile();

      console.log("[LocalDesk] Requesting session from backend...");

      const res = await fetch(`${BACKEND}/api/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Bypass ngrok browser warning page on first request
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ visitorId, visitorName: name, lastService }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Session request failed: ${res.status}`);
      }

      const { token, connectionId } = await res.json();
      console.log("[LocalDesk] Session token received, connectionId:", connectionId);

      if (!token) throw new Error("No token returned from backend");

      if (!containerRef.current) throw new Error("Container not ready");

      console.log("[LocalDesk] Initializing Napster SDK...");
      const instance = await NapsterCompanionApiSdk.init(token, {
        mountContainer: containerRef.current,
        position: "fill",
      });

      sdkRef.current = instance;
      setStatus("active");
      if (onActivate) onActivate();
      console.log("[LocalDesk] SDK initialized successfully");
    } catch (err) {
      console.error("[LocalDesk] Session error:", err);
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  useEffect(() => {
    return () => {
      sdkRef.current?.destroy?.();
    };
  }, []);

  return (
    <div className="agent-panel">
      {status === "idle" && (
        <div className="agent-placeholder">
          <div className="agent-avatar-ring">
            <div className="agent-avatar-inner">M</div>
          </div>
          <div>
            <div className="agent-name">Maya</div>
            <div className="agent-role">Your AI Receptionist</div>
          </div>
          <div className="agent-status">Available now · Video consultation</div>
          <button className="hero-cta" onClick={startSession}>
            <span className="dot" />
            Talk to Maya
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Connecting to Maya…</p>
        </div>
      )}

      {status === "error" && (
        <div className="error-state">
          <div style={{ fontSize: "1.5rem" }}>⚠️</div>
          <strong style={{ color: "var(--blush)", fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
            Connection failed
          </strong>
          <p>{errorMsg}</p>
          <button className="retry-btn" onClick={startSession}>
            Try again
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="sdk-container"
        style={{ display: status === "active" ? "block" : "none" }}
      />
    </div>
  );
}
