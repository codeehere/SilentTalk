import { useState, useEffect, useRef } from 'react';
import { FiArrowRight, FiShield, FiBriefcase, FiLock, FiZap, FiEye, FiGlobe } from 'react-icons/fi';

/* ---------- tiny floating particles ---------- */
function Particles() {
  const count = 24;
  return (
    <div className="lp-particles" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="lp-particle" style={{
          '--x': `${Math.random() * 100}%`,
          '--y': `${Math.random() * 100}%`,
          '--d': `${4 + Math.random() * 10}s`,
          '--delay': `${Math.random() * 6}s`,
          '--size': `${2 + Math.random() * 3}px`,
          '--op': `${0.3 + Math.random() * 0.5}`,
        }} />
      ))}
    </div>
  );
}

/* ---------- animated ring badge ---------- */
function RingBadge({ icon, label, color, delay }) {
  return (
    <div className="lp-ring-badge" style={{ '--delay': delay, '--color': color }}>
      <span className="lp-ring-badge-icon">{icon}</span>
      <span className="lp-ring-badge-label">{label}</span>
    </div>
  );
}

/* ---------- feature pill ---------- */
function Pill({ text, icon }) {
  return (
    <div className="lp-pill">
      <span className="lp-pill-dot" />
      {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
      {text}
    </div>
  );
}

export default function LandingPage({ onGoToLogin }) {
  const [loaded, setLoaded] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const heroRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Parallax tilt on desktop
  useEffect(() => {
    const handleMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  const tiltX = (mousePos.y - 0.5) * 6;
  const tiltY = (mousePos.x - 0.5) * -6;

  return (
    <div className={`lp-root ${loaded ? 'lp-loaded' : ''}`}>
      {/* animated mesh background */}
      <div className="lp-mesh" aria-hidden="true">
        <div className="lp-mesh-orb lp-orb-1" />
        <div className="lp-mesh-orb lp-orb-2" />
        <div className="lp-mesh-orb lp-orb-3" />
        <div className="lp-mesh-grid" />
      </div>

      <Particles />

      {/* ── Header ── */}
      <header className="lp-header">
        <div className="lp-header-logo">
          <div className="lp-logo-icon">
            <FiShield size={20} />
          </div>
          <span className="lp-logo-text">SilentTalk</span>
          <span className="lp-logo-badge">E2EE</span>
        </div>
        <button className="lp-login-btn" onClick={() => onGoToLogin('normal')}>
          Open App <FiArrowRight size={14} />
        </button>
      </header>

      {/* ── Hero ── */}
      <main ref={heroRef} className="lp-hero">

        {/* floating stat badges */}
        <div className="lp-badges-wrap" aria-hidden="true">
          <RingBadge icon="🔐" label="Zero Knowledge" color="#7c6af7" delay="0s" />
          <RingBadge icon="⚡" label="Real-time" color="#22c55e" delay="0.15s" />
          <RingBadge icon="🌐" label="Global" color="#38bdf8" delay="0.3s" />
        </div>

        {/* phone mockup */}
        <div
          className="lp-phone-wrap"
          style={{ '--tx': `${tiltY}deg`, '--ty': `${tiltX}deg` }}
        >
          <div className="lp-phone">
            <div className="lp-phone-notch" />
            <div className="lp-phone-screen">
              {/* chat UI inside phone */}
              <div className="lp-phone-header">
                <div className="lp-phone-avatar" />
                <div>
                  <div className="lp-phone-name">Sarah K.</div>
                  <div className="lp-phone-status">● Online</div>
                </div>
              </div>
              <div className="lp-phone-msgs">
                <div className="lp-pmsg lp-pin">Hey! How's the new app? 🔒</div>
                <div className="lp-pmsg lp-pout">It's incredible. Fully E2EE!</div>
                <div className="lp-pmsg lp-pin">No one can read this? 👀</div>
                <div className="lp-pmsg lp-pout">Not even the servers 🛡️</div>
                <div className="lp-phone-typing">
                  <span /><span /><span />
                </div>
              </div>
              <div className="lp-phone-input">
                <div className="lp-phone-input-bar">Type a message…</div>
              </div>
            </div>
            <div className="lp-phone-home-bar" />
          </div>
          {/* glow ring behind phone */}
          <div className="lp-phone-glow" />
        </div>

        {/* copy */}
        <div className="lp-copy">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            Privacy-First Messaging
          </div>

          <h1 className="lp-headline">
            Talk Freely.<br />
            <span className="lp-headline-accent">Stay Invisible.</span>
          </h1>

          <p className="lp-sub">
            Military-grade end-to-end encryption. Zero logs, zero data brokers,
            zero compromise. Your conversations belong to you — and only you.
          </p>

          <div className="lp-pills">
            <Pill text="NaCl Curve25519" icon="🔑" />
            <Pill text="No metadata stored" icon="🕵️" />
            <Pill text="Open Source ready" icon="⚙️" />
          </div>

          <div className="lp-cta-row">
            <button className="lp-cta-primary" onClick={() => onGoToLogin('normal')}>
              <FiLock size={16} />
              Start Securely — Free
              <FiArrowRight size={16} />
            </button>
            <button className="lp-cta-secondary" onClick={() => onGoToLogin('business')}>
              <FiBriefcase size={15} />
              Business Plan
            </button>
          </div>

          <p className="lp-fine">No account required · No phone number · No data sold</p>
        </div>
      </main>

      {/* ── Feature strip ── */}
      <section className="lp-features">
        {[
          { icon: <FiZap size={22} />, title: 'Instant Delivery', desc: 'Socket.IO real-time with 99.9% uptime SLA.' },
          { icon: <FiShield size={22} />, title: 'True E2EE', desc: 'Messages encrypted before leaving your device.' },
          { icon: <FiEye size={22} />, title: 'Zero Logs', desc: 'We cannot read your messages. Ever.' },
          { icon: <FiGlobe size={22} />, title: 'Cross Platform', desc: 'Works on any device, any browser, instantly.' },
        ].map((f, i) => (
          <div key={i} className="lp-feature-card" style={{ '--i': i }}>
            <div className="lp-feature-icon">{f.icon}</div>
            <strong>{f.title}</strong>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <span>© 2025 SilentTalk — All Rights Reserved</span>
        <FiLock size={12} style={{ opacity: 0.4 }} />
        <span>End-to-End Encrypted</span>
      </footer>

      <style>{`
        /* ═══ ROOT ═══ */
        .lp-root {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: #080a10;
          color: #f0f2ff;
          font-family: 'Inter', sans-serif;
          overflow-x: hidden;
          overflow-y: auto;
          position: relative;
        }

        /* ═══ MESH BG ═══ */
        .lp-mesh {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .lp-mesh-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.22;
          animation: lp-float 14s ease-in-out infinite alternate;
        }
        .lp-orb-1 {
          width: 540px; height: 540px;
          background: radial-gradient(circle, #7c6af7, transparent 70%);
          top: -120px; left: -160px;
          animation-duration: 16s;
        }
        .lp-orb-2 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, #c084fc, transparent 70%);
          bottom: -80px; right: -100px;
          animation-duration: 12s; animation-delay: -4s;
        }
        .lp-orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #38bdf8, transparent 70%);
          top: 40%; left: 55%;
          opacity: 0.12;
          animation-duration: 18s; animation-delay: -8s;
        }
        .lp-mesh-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(124,106,247,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,247,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
        }
        @keyframes lp-float {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.08); }
        }

        /* ═══ PARTICLES ═══ */
        .lp-particles {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .lp-particle {
          position: absolute;
          left: var(--x);
          top: var(--y);
          width: var(--size);
          height: var(--size);
          border-radius: 50%;
          background: #7c6af7;
          opacity: var(--op);
          animation: lp-particle-float var(--d) var(--delay) ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes lp-particle-float {
          from { transform: translate(0, 0); opacity: var(--op); }
          to   { transform: translate(12px, -20px); opacity: calc(var(--op) * 0.3); }
        }

        /* ═══ HEADER ═══ */
        .lp-header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: rgba(8,10,16,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          opacity: 0;
          transform: translateY(-16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .lp-loaded .lp-header {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-header-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .lp-logo-icon {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #7c6af7, #a78bfa);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          box-shadow: 0 0 20px rgba(124,106,247,0.5);
          flex-shrink: 0;
        }
        .lp-logo-text {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 19px;
          letter-spacing: -0.5px;
          background: linear-gradient(90deg, #f0f2ff, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .lp-logo-badge {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          background: rgba(124,106,247,0.15);
          border: 1px solid rgba(124,106,247,0.3);
          color: #a78bfa;
          padding: 2px 7px;
          border-radius: 99px;
        }
        .lp-login-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          border-radius: 99px;
          border: 1.5px solid rgba(124,106,247,0.45);
          background: rgba(124,106,247,0.12);
          color: #a78bfa;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .lp-login-btn:hover, .lp-login-btn:active {
          background: rgba(124,106,247,0.24);
          border-color: #7c6af7;
          color: #fff;
          transform: scale(1.03);
        }

        /* ═══ HERO ═══ */
        .lp-hero {
          flex: 1;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 56px 24px 32px;
          gap: 48px;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
        }

        /* ═══ BADGES ═══ */
        .lp-badges-wrap {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s 0.1s ease, transform 0.6s 0.1s ease;
        }
        .lp-loaded .lp-badges-wrap { opacity: 1; transform: translateY(0); }
        .lp-ring-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          border-radius: 99px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 12px;
          font-weight: 500;
          color: rgba(240,242,255,0.8);
          backdrop-filter: blur(8px);
          opacity: 0;
          animation: lp-badge-in 0.5s var(--delay) cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .lp-loaded .lp-ring-badge { }
        @keyframes lp-badge-in {
          from { opacity: 0; transform: translateY(12px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .lp-ring-badge-icon { font-size: 14px; }

        /* ═══ PHONE MOCKUP ═══ */
        .lp-phone-wrap {
          position: relative;
          flex-shrink: 0;
          opacity: 0;
          transform: translateY(32px) scale(0.95);
          transition: opacity 0.7s 0.2s ease, transform 0.7s 0.2s cubic-bezier(0.34,1.2,0.64,1);
          transform-style: preserve-3d;
          perspective: 900px;
        }
        .lp-loaded .lp-phone-wrap {
          opacity: 1;
          transform: translateY(0) scale(1) rotateX(var(--ty, 0deg)) rotateY(var(--tx, 0deg));
        }
        .lp-phone {
          width: 220px;
          height: 440px;
          border-radius: 36px;
          background: linear-gradient(160deg, #1a1d28, #0f1220);
          border: 1.5px solid rgba(255,255,255,0.12);
          box-shadow:
            0 40px 80px rgba(0,0,0,0.8),
            0 0 0 1px rgba(255,255,255,0.04) inset,
            inset 0 1px 0 rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        .lp-phone-notch {
          width: 90px; height: 24px;
          background: #080a10;
          border-radius: 0 0 16px 16px;
          margin: 0 auto;
          flex-shrink: 0;
          box-shadow: inset 0 -2px 4px rgba(0,0,0,0.5);
        }
        .lp-phone-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding-bottom: 4px;
        }
        .lp-phone-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(124,106,247,0.08);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .lp-phone-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c6af7, #e879f9);
          flex-shrink: 0;
          box-shadow: 0 0 10px rgba(124,106,247,0.5);
        }
        .lp-phone-name {
          font-size: 11px; font-weight: 700; color: #f0f2ff;
        }
        .lp-phone-status {
          font-size: 9px; color: #22c55e; font-weight: 500;
        }
        .lp-phone-msgs {
          flex: 1;
          padding: 10px 10px 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow: hidden;
        }
        .lp-pmsg {
          font-size: 10px;
          padding: 6px 10px;
          border-radius: 12px;
          max-width: 80%;
          line-height: 1.4;
          animation: lp-msg-pop 0.4s cubic-bezier(0.34,1.4,0.64,1) both;
        }
        .lp-pin {
          background: rgba(255,255,255,0.07);
          align-self: flex-start;
          border-bottom-left-radius: 3px;
        }
        .lp-pout {
          background: linear-gradient(135deg, #6d5be6, #8b6cf7);
          color: #fff;
          align-self: flex-end;
          border-bottom-right-radius: 3px;
        }
        .lp-pmsg:nth-child(1) { animation-delay: 0.5s; }
        .lp-pmsg:nth-child(2) { animation-delay: 0.9s; }
        .lp-pmsg:nth-child(3) { animation-delay: 1.3s; }
        .lp-pmsg:nth-child(4) { animation-delay: 1.7s; }
        @keyframes lp-msg-pop {
          from { opacity: 0; transform: scale(0.85) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .lp-phone-typing {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
          width: 44px;
          align-self: flex-start;
          animation: lp-msg-pop 0.4s 2.2s both;
        }
        .lp-phone-typing span {
          width: 5px; height: 5px;
          background: rgba(255,255,255,0.5);
          border-radius: 50%;
          animation: lp-typing-dot 1.2s infinite;
        }
        .lp-phone-typing span:nth-child(2) { animation-delay: 0.2s; }
        .lp-phone-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes lp-typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .lp-phone-input {
          padding: 6px 10px;
          flex-shrink: 0;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .lp-phone-input-bar {
          background: rgba(255,255,255,0.05);
          border-radius: 99px;
          padding: 6px 12px;
          font-size: 9px;
          color: rgba(255,255,255,0.3);
        }
        .lp-phone-home-bar {
          width: 80px; height: 5px;
          background: rgba(255,255,255,0.18);
          border-radius: 99px;
          margin: 6px auto 10px;
          flex-shrink: 0;
        }
        .lp-phone-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,106,247,0.25), transparent 70%);
          z-index: -1;
          filter: blur(20px);
          animation: lp-glow-pulse 3s ease-in-out infinite alternate;
        }
        @keyframes lp-glow-pulse {
          from { opacity: 0.6; transform: scale(1); }
          to   { opacity: 1; transform: scale(1.08); }
        }

        /* ═══ COPY ═══ */
        .lp-copy {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s 0.35s ease, transform 0.7s 0.35s ease;
        }
        .lp-loaded .lp-copy { opacity: 1; transform: translateY(0); }

        .lp-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #a78bfa;
          background: rgba(124,106,247,0.1);
          border: 1px solid rgba(124,106,247,0.25);
          padding: 5px 14px;
          border-radius: 99px;
        }
        .lp-eyebrow-dot {
          width: 6px; height: 6px;
          background: #7c6af7;
          border-radius: 50%;
          box-shadow: 0 0 6px #7c6af7;
          animation: lp-dot-pulse 1.5s ease infinite;
        }
        @keyframes lp-dot-pulse {
          0%, 100% { box-shadow: 0 0 4px #7c6af7; }
          50% { box-shadow: 0 0 12px #7c6af7, 0 0 24px rgba(124,106,247,0.4); }
        }

        .lp-headline {
          font-family: 'Space Grotesk', sans-serif;
          font-size: clamp(2.4rem, 9vw, 4.2rem);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -2px;
          color: #f0f2ff;
          margin: 0;
        }
        .lp-headline-accent {
          background: linear-gradient(90deg, #7c6af7 0%, #e879f9 50%, #38bdf8 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: lp-gradient-shift 4s linear infinite;
        }
        @keyframes lp-gradient-shift {
          from { background-position: 0% center; }
          to   { background-position: 200% center; }
        }

        .lp-sub {
          font-size: clamp(14px, 3.5vw, 16px);
          color: rgba(155,163,192,0.9);
          max-width: 480px;
          line-height: 1.65;
          margin: 0;
        }

        /* ═══ PILLS ═══ */
        .lp-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .lp-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(155,163,192,0.85);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 5px 12px;
          border-radius: 99px;
          white-space: nowrap;
        }
        .lp-pill-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #7c6af7;
          opacity: 0.7;
          flex-shrink: 0;
        }

        /* ═══ CTA ═══ */
        .lp-cta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }
        .lp-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 14px 28px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #7c6af7, #9b7eff);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 32px rgba(124,106,247,0.45), 0 0 0 1px rgba(255,255,255,0.1) inset;
          transition: all 0.22s cubic-bezier(0.34,1.3,0.64,1);
          -webkit-tap-highlight-color: transparent;
          position: relative;
          overflow: hidden;
        }
        .lp-cta-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .lp-cta-primary:hover::before { opacity: 1; }
        .lp-cta-primary:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 14px 40px rgba(124,106,247,0.6);
        }
        .lp-cta-primary:active { transform: scale(0.97); }

        .lp-cta-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: 14px;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: rgba(240,242,255,0.8);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
          backdrop-filter: blur(8px);
        }
        .lp-cta-secondary:hover {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.08);
          color: #fff;
          transform: translateY(-1px);
        }
        .lp-cta-secondary:active { transform: scale(0.97); }

        .lp-fine {
          font-size: 11px;
          color: rgba(155,163,192,0.5);
          margin: -8px 0 0;
        }

        /* ═══ FEATURE CARDS ═══ */
        .lp-features {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 0 20px 32px;
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
        }
        .lp-feature-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.25s ease;
          animation: lp-card-in 0.5s calc(0.6s + var(--i) * 0.1s) cubic-bezier(0.34,1.2,0.64,1) forwards;
        }
        @keyframes lp-card-in {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .lp-feature-card:hover {
          border-color: rgba(124,106,247,0.3);
          background: rgba(124,106,247,0.06);
          transform: translateY(-2px);
        }
        .lp-feature-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: rgba(124,106,247,0.12);
          border: 1px solid rgba(124,106,247,0.2);
          display: flex; align-items: center; justify-content: center;
          color: #a78bfa;
          margin-bottom: 2px;
        }
        .lp-feature-card strong {
          font-size: 13px;
          font-weight: 700;
          color: #f0f2ff;
        }
        .lp-feature-card p {
          font-size: 12px;
          color: rgba(155,163,192,0.75);
          line-height: 1.5;
          margin: 0;
        }

        /* ═══ FOOTER ═══ */
        .lp-footer {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 20px 24px;
          font-size: 11px;
          color: rgba(155,163,192,0.4);
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* ═══ DESKTOP LAYOUT (side by side) ═══ */
        @media (min-width: 768px) {
          .lp-hero {
            flex-direction: row;
            justify-content: center;
            align-items: center;
            padding: 80px 60px 60px;
            gap: 72px;
            min-height: calc(100dvh - 200px);
          }
          .lp-badges-wrap {
            position: absolute;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
          }
          .lp-loaded .lp-badges-wrap {
            transform: translateX(-50%) translateY(0);
          }
          .lp-phone-wrap {
            flex-shrink: 0;
            order: 2;
          }
          .lp-phone { width: 260px; height: 520px; }
          .lp-copy {
            text-align: left;
            align-items: flex-start;
            max-width: 480px;
            order: 1;
          }
          .lp-pills { justify-content: flex-start; }
          .lp-cta-row { justify-content: flex-start; }
          .lp-features {
            grid-template-columns: repeat(4, 1fr);
            max-width: 1000px;
            padding: 0 60px 60px;
          }
        }

        /* ═══ MOBILE FINE-TUNING ═══ */
        @media (max-width: 400px) {
          .lp-headline { font-size: 2.1rem; letter-spacing: -1.5px; }
          .lp-cta-primary, .lp-cta-secondary { width: 100%; justify-content: center; }
          .lp-features { grid-template-columns: 1fr; }
          .lp-phone { width: 190px; height: 380px; }
        }
      `}</style>
    </div>
  );
}
