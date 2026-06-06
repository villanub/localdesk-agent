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
  return {
    name: localStorage.getItem("ld_visitor_name"),
    lastService: localStorage.getItem("ld_last_service"),
  };
}

export default function AgentWidget({ onActivate }) {
  const containerRef = useRef(null);
  const sdkRef = useRef(null);
  const [status, setStatus] = useState("checking"); // checking | ready | loading | active | error | unconfigured
  const [errorMsg, setErrorMsg] = useState("");
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Check backend status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${BACKEND}/api/status`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        const data = await res.json();
        setToolsEnabled(data.toolsEnabled);
        setStatus(data.ready ? "ready" : "unconfigured");
      } catch {
        // Backend not reachable yet — retry a few times
        if (retryCount < 5) {
          setTimeout(() => setRetryCount((c) => c + 1), 2000);
        } else {
          setStatus("error");
          setErrorMsg("Backend not reachable. Is Docker running?");
        }
      }
    }
    checkStatus();
  }, [retryCount]);

  async function startSession() {
    setStatus("loading");
    setErrorMsg("");

    try {
      const visitorId = getOrCreateVisitorId();
      const { name, lastService } = getVisitorProfile();

      console.log("[LocalDesk] Requesting session...");

      const res = await fetch(`${BACKEND}/api/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ visitorId, visitorName: name, lastService }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Session failed: ${res.status}`);
      }

      const { token, connectionId } = await res.json();
      console.log("[LocalDesk] Token received, connectionId:", connectionId);

      if (!token) throw new Error("No token returned from backend");
      if (!containerRef.current) throw new Error("Container not ready");

      console.log("[LocalDesk] Initializing SDK...");
      const instance = await NapsterCompanionApiSdk.init(token, {
        mountContainer: containerRef.current,
        position: "fill",
      });

      sdkRef.current = instance;
      setStatus("active");
      if (onActivate) onActivate();
    } catch (err) {
      console.error("[LocalDesk] Error:", err);
      setErrorMsg(err.message || "Connection failed. Please try again.");
      setStatus("error");
    }
  }

  useEffect(() => {
    return () => sdkRef.current?.destroy?.();
  }, []);

  return (
    <div className="agent-panel">

      {/* Checking backend */}
      {status === "checking" && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Initializing…</p>
        </div>
      )}

      {/* Unconfigured */}
      {status === "unconfigured" && (
        <div className="error-state">
          <div style={{ fontSize: "1.5rem" }}>⚙️</div>
          <strong style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
            Setup required
          </strong>
          <p>Run <code>node setup.js</code> in the backend directory, then restart Docker.</p>
        </div>
      )}

      {/* Ready — idle state */}
      {status === "ready" && (
        <div className="agent-placeholder">
          <div className="agent-avatar-ring">
            <div className="agent-avatar-inner">M</div>
          </div>
          <div>
            <div className="agent-name">Maya</div>
            <div className="agent-role">Your AI Receptionist</div>
          </div>
          <div className="agent-status">
            Available now · Video consultation
            {!toolsEnabled && (
              <span style={{ display: "block", color: "rgba(212,164,164,0.7)", fontSize: "0.6rem", marginTop: "0.25rem" }}>
                ⚠ Tools disabled — set BACKEND_PUBLIC_URL for booking
              </span>
            )}
          </div>
          <button className="hero-cta" onClick={startSession}>
            <span className="dot" />
            Talk to Maya
          </button>
        </div>
      )}

      {/* Connecting */}
      {status === "loading" && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Connecting to Maya…</p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="error-state">
          <div style={{ fontSize: "1.5rem" }}>⚠️</div>
          <strong style={{ color: "var(--blush)", fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
            Connection failed
          </strong>
          <p>{errorMsg}</p>
          <button className="retry-btn" onClick={() => setStatus("ready")}>
            Try again
          </button>
        </div>
      )}

      {/* SDK mount point */}
      <div
        ref={containerRef}
        className="sdk-container"
        style={{ display: status === "active" ? "block" : "none" }}
      />
    </div>
  );
}
