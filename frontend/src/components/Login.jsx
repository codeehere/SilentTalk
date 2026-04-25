import { useState, useRef, useEffect } from 'react';
import { FiLock, FiMail, FiArrowRight, FiRefreshCw, FiShield, FiEye, FiEyeOff, FiUserPlus, FiLogIn, FiZap } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, register } = useAuth();

  const [mode, setMode]         = useState('login');     // 'login' | 'register'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [loaded, setLoaded]     = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  // First-visit notice (localStorage so it only shows once ever)
  const [showNotice, setShowNotice] = useState(() => !localStorage.getItem('st_welcome_seen'));

  const slowTimer = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const dismissNotice = () => {
    localStorage.setItem('st_welcome_seen', '1');
    setShowNotice(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSlowHint(false);
    slowTimer.current = setTimeout(() => setSlowHint(true), 3000);
    try {
      if (mode === 'register') {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      clearTimeout(slowTimer.current);
      setSlowHint(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
    setPassword('');
  };

  return (
    <div className={`lx-root ${loaded ? 'lx-loaded' : ''}`}>
      {/* Animated background */}
      <div className="lx-bg" aria-hidden="true">
        <div className="lx-orb lx-orb-1" />
        <div className="lx-orb lx-orb-2" />
        <div className="lx-grid" />
      </div>

      {/* ── First-visit welcome / notice modal ─────────────────────────── */}
      {showNotice && (
        <div className="lx-modal-backdrop" onClick={dismissNotice}>
          <div className="lx-modal" onClick={e => e.stopPropagation()}>
            <div className="lx-modal-icon">
              <FiZap size={26} color="#a78bfa" />
            </div>
            <h3 className="lx-modal-title">Welcome to SilentTalk</h3>
            <p className="lx-modal-body">
              SilentTalk is an end-to-end encrypted messaging platform.
              You can sign up and start chatting right now using a <strong>password</strong>.
            </p>
            <div className="lx-notice-coming">
              <div className="lx-notice-badge">Coming Soon</div>
              <p>
                We&apos;re switching to <strong>one-time password (OTP) login via email</strong> —
                no passwords stored, maximum security. Once our mail service is configured
                this will replace the current password system automatically.
              </p>
            </div>
            <button className="lx-btn-primary" onClick={dismissNotice}>
              <FiArrowRight size={16} /> Let&apos;s go
            </button>
          </div>
        </div>
      )}

      {/* ── Login / Register card ───────────────────────────────────────── */}
      <div className="lx-card">
        {/* Logo */}
        <div className="lx-logo">
          <div className="lx-logo-icon">
            <FiShield size={22} color="#fff" />
            <div className="lx-logo-pulse" />
          </div>
          <span className="lx-logo-text">SilentTalk</span>
        </div>

        <form onSubmit={handleSubmit} className="lx-form">
          <div className="lx-heading-group">
            <h2 className="lx-heading">{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p className="lx-subtext">
              {mode === 'login'
                ? 'Sign in with your email and password'
                : 'Choose a strong password to protect your account'}
            </p>
          </div>

          {/* Email */}
          <div className="lx-field">
            <label className="lx-label" htmlFor="lx-email">Email address</label>
            <div className="lx-input-wrap">
              <FiMail size={15} className="lx-input-icon" />
              <input
                id="lx-email"
                className="lx-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="lx-field">
            <label className="lx-label" htmlFor="lx-password">Password</label>
            <div className="lx-input-wrap">
              <FiLock size={15} className="lx-input-icon" />
              <input
                id="lx-password"
                className="lx-input lx-input-pass"
                type={showPass ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="lx-pass-toggle"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </div>

          {/* Server wakeup hint */}
          {loading && slowHint && (
            <div className="lx-wakeup-hint">
              <FiRefreshCw size={13} className="lx-spin" style={{ flexShrink: 0 }} />
              <span><strong>Server is waking up</strong> — Railway free tier may take ~30s. Retrying automatically…</span>
            </div>
          )}

          {error && <p className="lx-error">{error}</p>}

          <button className="lx-btn-primary" type="submit" disabled={loading}>
            {loading
              ? <FiRefreshCw size={16} className="lx-spin" />
              : mode === 'login'
                ? <><FiLogIn size={15} /><span>Sign In</span></>
                : <><FiUserPlus size={15} /><span>Create Account</span></>}
          </button>

          {/* Mode switch */}
          <button type="button" className="lx-btn-ghost" onClick={switchMode}>
            {mode === 'login'
              ? "Don't have an account? Register"
              : 'Already have an account? Sign in'}
          </button>
        </form>

        <p className="lx-fine">
          <FiLock size={11} /> End-to-end encrypted · OTP login coming soon
        </p>
      </div>

      <style>{`
        /* ═══ ROOT ═══ */
        .lx-root {
          min-height: 100dvh;
          display: flex; align-items: center; justify-content: center;
          padding: 20px 16px;
          background: #080a10;
          position: relative; overflow: hidden;
        }

        /* ═══ BG ═══ */
        .lx-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .lx-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.2;
          animation: lx-float 12s ease-in-out infinite alternate;
        }
        .lx-orb-1 { width:420px; height:420px; background:radial-gradient(circle,#7c6af7,transparent 70%); top:-100px; left:-100px; }
        .lx-orb-2 { width:320px; height:320px; background:radial-gradient(circle,#e879f9,transparent 70%); bottom:-80px; right:-80px; animation-delay:-5s; animation-duration:10s; }
        .lx-grid {
          position:absolute; inset:0;
          background-image:linear-gradient(rgba(124,106,247,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,106,247,.04) 1px,transparent 1px);
          background-size:44px 44px;
          mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,black,transparent);
        }
        @keyframes lx-float { from{transform:translate(0,0) scale(1)} to{transform:translate(30px,20px) scale(1.06)} }

        /* ═══ CARD ═══ */
        .lx-card {
          position:relative; z-index:2;
          width:100%; max-width:400px;
          background:rgba(19,22,30,.78);
          border:1px solid rgba(255,255,255,.08);
          border-radius:28px; padding:36px 32px 28px;
          box-shadow:0 32px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04) inset;
          backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
          opacity:0; transform:translateY(28px) scale(.97);
          transition:opacity .55s ease,transform .55s cubic-bezier(.34,1.2,.64,1);
        }
        .lx-loaded .lx-card { opacity:1; transform:translateY(0) scale(1); }

        /* ═══ LOGO ═══ */
        .lx-logo { display:flex; align-items:center; gap:12px; margin-bottom:32px; }
        .lx-logo-icon {
          width:44px; height:44px;
          background:linear-gradient(135deg,#7c6af7,#a78bfa);
          border-radius:14px; display:flex; align-items:center; justify-content:center;
          position:relative; box-shadow:0 0 24px rgba(124,106,247,.5);
        }
        .lx-logo-pulse {
          position:absolute; inset:-4px; border-radius:18px;
          border:2px solid rgba(124,106,247,.35);
          animation:lx-ring-pulse 2s ease infinite;
        }
        @keyframes lx-ring-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.1)} }
        .lx-logo-text {
          font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:22px; letter-spacing:-.5px;
          background:linear-gradient(90deg,#f0f2ff,#a78bfa);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
        }

        /* ═══ FORM ═══ */
        .lx-form { display:flex; flex-direction:column; gap:18px; }
        .lx-heading-group { display:flex; flex-direction:column; gap:6px; }
        .lx-heading { font-family:'Space Grotesk',sans-serif; font-size:1.5rem; font-weight:700; color:#f0f2ff; letter-spacing:-.5px; margin:0; }
        .lx-subtext { font-size:13px; color:rgba(155,163,192,.85); margin:0; line-height:1.5; }

        /* ═══ FIELD ═══ */
        .lx-field { display:flex; flex-direction:column; gap:7px; }
        .lx-label { font-size:12px; font-weight:600; color:rgba(155,163,192,.9); letter-spacing:.03em; }
        .lx-input-wrap { position:relative; }
        .lx-input-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:rgba(155,163,192,.5); pointer-events:none; }
        .lx-input {
          width:100%; box-sizing:border-box;
          background:rgba(255,255,255,.04); border:1.5px solid rgba(255,255,255,.09);
          border-radius:12px; padding:13px 16px 13px 40px;
          color:#f0f2ff; font-family:'Inter',sans-serif; font-size:14px; outline:none;
          transition:border-color .2s,box-shadow .2s,background .2s;
        }
        .lx-input-pass { padding-right:44px; }
        .lx-input:focus { border-color:rgba(124,106,247,.7); background:rgba(124,106,247,.05); box-shadow:0 0 0 3px rgba(124,106,247,.15); }
        .lx-input::placeholder { color:rgba(155,163,192,.4); }
        .lx-pass-toggle {
          position:absolute; right:12px; top:50%; transform:translateY(-50%);
          background:none; border:none; color:rgba(155,163,192,.5);
          cursor:pointer; padding:4px; display:flex; align-items:center;
          transition:color .15s;
        }
        .lx-pass-toggle:hover { color:#a78bfa; }

        /* ═══ WAKEUP HINT ═══ */
        .lx-wakeup-hint {
          display:flex; align-items:center; gap:8px;
          background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25);
          border-radius:10px; padding:10px 14px; font-size:12px;
          color:rgba(245,158,11,.9); line-height:1.5;
        }

        /* ═══ BUTTONS ═══ */
        .lx-btn-primary {
          display:flex; align-items:center; justify-content:center; gap:9px;
          padding:14px; border-radius:14px; border:none;
          background:linear-gradient(135deg,#7c6af7,#9b7eff);
          color:#fff; font-family:'Inter',sans-serif; font-size:15px; font-weight:700;
          cursor:pointer; box-shadow:0 6px 28px rgba(124,106,247,.45);
          transition:all .22s cubic-bezier(.34,1.2,.64,1);
          -webkit-tap-highlight-color:transparent; width:100%;
          position:relative; overflow:hidden;
        }
        .lx-btn-primary::after { content:''; position:absolute; inset:0; background:linear-gradient(rgba(255,255,255,.1),transparent); pointer-events:none; }
        .lx-btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 10px 36px rgba(124,106,247,.6); }
        .lx-btn-primary:active:not(:disabled) { transform:scale(.97); }
        .lx-btn-primary:disabled { opacity:.5; cursor:not-allowed; }

        .lx-btn-ghost {
          display:flex; align-items:center; justify-content:center; gap:8px;
          padding:12px; border-radius:12px;
          border:1.5px solid rgba(255,255,255,.08); background:transparent;
          color:rgba(155,163,192,.8); font-family:'Inter',sans-serif; font-size:13px; font-weight:500;
          cursor:pointer; transition:all .18s ease;
          -webkit-tap-highlight-color:transparent; width:100%;
        }
        .lx-btn-ghost:hover { background:rgba(255,255,255,.05); color:#f0f2ff; border-color:rgba(255,255,255,.15); }
        .lx-btn-ghost:active { transform:scale(.97); }

        /* ═══ ERROR ═══ */
        .lx-error {
          font-size:13px; color:#f87171;
          background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.2);
          padding:10px 14px; border-radius:10px; margin:-6px 0;
          animation:lx-shake .35s ease;
        }
        @keyframes lx-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }

        /* ═══ FINE PRINT ═══ */
        .lx-fine { display:flex; align-items:center; justify-content:center; gap:6px; font-size:11px; color:rgba(155,163,192,.4); margin-top:16px; }

        /* ═══ WELCOME MODAL ═══ */
        .lx-modal-backdrop {
          position:fixed; inset:0; z-index:100;
          background:rgba(0,0,0,.8); backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center; padding:20px;
          animation:lx-fadein .2s ease;
        }
        @keyframes lx-fadein { from{opacity:0} to{opacity:1} }
        .lx-modal {
          background:#13161e;
          border:1px solid rgba(124,106,247,.25);
          border-radius:24px; padding:32px 28px 28px;
          width:100%; max-width:420px;
          box-shadow:0 24px 80px rgba(0,0,0,.85),0 0 0 1px rgba(255,255,255,.04) inset;
          animation:lx-slideup .25s cubic-bezier(.34,1.2,.64,1);
          display:flex; flex-direction:column; gap:16px;
        }
        @keyframes lx-slideup { from{transform:translateY(20px) scale(.97);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        .lx-modal-icon {
          width:52px; height:52px;
          background:rgba(124,106,247,.1); border:1px solid rgba(124,106,247,.25);
          border-radius:16px; display:flex; align-items:center; justify-content:center;
        }
        .lx-modal-title { font-family:'Space Grotesk',sans-serif; font-size:1.25rem; font-weight:700; color:#f0f2ff; margin:0; }
        .lx-modal-body { font-size:13.5px; color:rgba(155,163,192,.85); line-height:1.6; margin:0; }
        .lx-modal-body strong { color:#f0f2ff; }
        .lx-notice-coming {
          background:rgba(124,106,247,.07);
          border:1px solid rgba(124,106,247,.2);
          border-radius:12px; padding:14px 16px;
          display:flex; flex-direction:column; gap:8px;
        }
        .lx-notice-badge {
          display:inline-flex; align-items:center;
          background:linear-gradient(135deg,#7c6af7,#a78bfa);
          color:#fff; font-size:10px; font-weight:700;
          letter-spacing:.06em; text-transform:uppercase;
          border-radius:6px; padding:3px 8px; width:fit-content;
        }
        .lx-notice-coming p { font-size:12.5px; color:rgba(155,163,192,.8); line-height:1.6; margin:0; }
        .lx-notice-coming strong { color:#a78bfa; }

        /* ═══ SPIN ═══ */
        .lx-spin { animation:lx-spin .8s linear infinite; }
        @keyframes lx-spin { to{transform:rotate(360deg)} }

        /* ═══ MOBILE ═══ */
        @media (max-width:380px) {
          .lx-card { padding:28px 20px 24px; border-radius:24px; }
          .lx-modal { padding:24px 18px 20px; }
        }
      `}</style>
    </div>
  );
}
