import { useState } from "react";
import AgentWidget from "./AgentWidget.jsx";

const SERVICES = [
  { icon: "✨", name: "HydraFacial", desc: "Deep cleanse, exfoliate & hydrate with our signature treatment." },
  { icon: "💉", name: "Botox & Fillers", desc: "Natural-looking results from our board-certified practitioners." },
  { icon: "⚡", name: "Laser Treatments", desc: "Precision laser resurfacing for tone, texture & pigmentation." },
  { icon: "🌿", name: "Chemical Peels", desc: "Medical-grade peels customized to your skin concerns." },
];

export default function App() {
  const [sessionActive, setSessionActive] = useState(false);

  return (
    <div className="app">
      {/* Nav */}
      <nav className="nav">
        <div>
          <div className="nav-logo">Local<span>Desk</span></div>
          <div className="nav-tagline">AI Receptionist · Powered by Napster</div>
        </div>
        <div style={{ display: "flex", gap: "2rem", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--ink-light)" }}>
          <span>Services</span>
          <span>About</span>
          <span>Contact</span>
        </div>
      </nav>

      {/* Hero — two column: copy left, agent right */}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">Serenity Med Spa · Austin, TX</div>
          <h1 className="hero-headline">
            Your wellness journey<br />
            starts with a<br />
            <em>conversation.</em>
          </h1>
          <p className="hero-sub">
            Meet Maya — our AI receptionist. She'll help you explore treatments,
            check availability, and book your appointment — all in real time,
            day or night.
          </p>

          {!sessionActive && (
            <button
              className="hero-cta"
              onClick={() => document.querySelector(".agent-panel .hero-cta")?.click()}
            >
              <span className="dot" />
              Book a consultation
            </button>
          )}

          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-label">Response time</span>
              <span className="feature-value">~300ms</span>
            </div>
            <div className="feature-item">
              <span className="feature-label">Availability</span>
              <span className="feature-value">24 / 7</span>
            </div>
            <div className="feature-item">
              <span className="feature-label">Languages</span>
              <span className="feature-value">30+</span>
            </div>
          </div>
        </div>

        {/* Napster agent lives here */}
        <AgentWidget onActivate={() => setSessionActive(true)} />
      </section>

      {/* Services */}
      <section className="services">
        <div className="services-header">
          <span className="services-eyebrow">Treatments</span>
          <h2 className="services-headline">What can Maya book for you?</h2>
        </div>
        <div className="services-grid">
          {SERVICES.map((s) => (
            <div className="service-card" key={s.name}>
              <div className="service-icon">{s.icon}</div>
              <div className="service-name">{s.name}</div>
              <div className="service-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-copy">© 2026 LocalDesk · Built with Napster Omniagent API</div>
        <div className="footer-badge">Hackathon Submission · May–June 2026</div>
      </footer>
    </div>
  );
}
