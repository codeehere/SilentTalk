import { useState, useRef, useEffect, useCallback } from 'react';
import { FiLock, FiMail, FiArrowRight, FiRefreshCw, FiShield, FiArrowLeft, FiAlertTriangle, FiCopy, FiCheck } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, verify } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Dev-mode temp code state
  const [tempCode, setTempCode] = useState('');
  const [showDevModal, setShowDevModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const otpRefs = useRef([]);
  const inputRef = useRef(null);
  const slowTimer = useRef(null);
  const cooldownRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const fillOtpFromCode = useCallback((code) => {
    const digits = code.split('');
    setOtp(digits);
    // focus last box
    setTimeout(() => otpRefs.current[5]?.focus(), 80);
  }, []);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSlowHint(false);
    slowTimer.current = setTimeout(() => setSlowHint(true), 3000);
    try {
      const data = await login(email);
      setStep('otp');
      startResendCooldown();
      // Dev mode: SMTP not configured — show code on screen
      if (data?.tempCode) {
        setTempCode(data.tempCode);
        fillOtpFromCode(data.tempCode);
        const warned = sessionStorage.getItem('st_smtp_warned');
        if (!warned) setShowDevModal(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      clearTimeout(slowTimer.current);
      setSlowHint(false);
    }
  };

  const dismissDevModal = () => {
    sessionStorage.setItem('st_smtp_warned', '1');
    setShowDevModal(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(tempCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    setSlowHint(false);
    slowTimer.current = setTimeout(() => setSlowHint(true), 3000);
    try {
      const data = await login(email);
      setOtp(['', '', '', '', '', '']);
      startResendCooldown();
      if (data?.tempCode) {
        setTempCode(data.tempCode);
        fillOtpFromCode(data.tempCode);
        const warned = sessionStorage.getItem('st_smtp_warned');
        if (!warned) setShowDevModal(true);
      } else {
        otpRefs.current[0]?.focus();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      clearTimeout(slowTimer.current);
      setSlowHint(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every(d => d) && next.join('').length === 6) {
      setTimeout(() => handleVerify(next.join('')), 80);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const next = pasted.split('');
      setOtp(next);
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerify(pasted), 80);
    }
  };

  const handleVerify = async (code) => {
    setError('');
    setLoading(true);
    try {
      await verify(email, code || otp.join(''));
    } catch (err) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`lx-root ${loaded ? 'lx-loaded' : ''}`}>
      {/* animated background */}
      <div className="lx-bg" aria-hidden="true">
        <div className="lx-orb lx-orb-1" />
        <div className="lx-orb lx-orb-2" />
        <div className="lx-grid" />
      </div>

      {/* Dev-mode warning modal — only shown once per session */}
      {showDevModal && (
        <div className="lx-modal-backdrop" onClick={dismissDevModal}>
          <div className="lx-modal" onClick={e => e.stopPropagation()}>
            <div className="lx-modal-icon"><FiAlertTriangle size={28} color="#f59e0b" /></div>
            <h3 className="lx-modal-title">Demo / Dev Mode Active</h3>
            <p className="lx-modal-body">
              Email delivery (SMTP) is <strong>not configured</strong> on this server.
              Your one-time sign-in code is being shown directly on screen instead of
              emailed to you. This is fine for testing, but should not be used in production.
            </p>
            <ul className="lx-modal-list">
              <li>Your code has already been filled in below</li>
              <li>Add <code>SMTP_HOST</code>, <code>SMTP_USER</code> &amp; <code>SMTP_PASS</code> in Railway to enable real emails</li>
              <li>This warning won&apos;t appear again this session</li>
            </ul>
            <button className="lx-btn-primary" onClick={dismissDevModal} style={{marginTop:8}}>
              Got it, continue
            </button>
          </div>
        </div>
      )}

      <div className="lx-card">
        {/* logo */}
        <div className="lx-logo">
          <div className="lx-logo-icon">
            <FiShield size={22} color="#fff" />
            <div className="lx-logo-pulse" />
          </div>
          <span className="lx-logo-text">SilentTalk</span>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="lx-form">
            <div className="lx-heading-group">
              <h2 className="lx-heading">Welcome back</h2>
              <p className="lx-subtext">Enter your email for a secure one-time code</p>
            </div>

            <div className="lx-field">
              <label className="lx-label">Email address</label>
              <div className="lx-input-wrap">
                <FiMail size={15} className="lx-input-icon" />
                <input
                  ref={inputRef}
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

            {loading && slowHint && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 10, padding: '10px 14px', fontSize: 12,
                color: 'rgba(245,158,11,0.9)', lineHeight: 1.5, marginTop: -6
              }}>
                <FiRefreshCw size={13} className="lx-spin" style={{flexShrink:0}} />
                <span><strong>Server is waking up</strong> — Railway free tier may take ~30s on first request. Retrying automatically…</span>
              </div>
            )}

            {error && <p className="lx-error">{error}</p>}

            <button className="lx-btn-primary" type="submit" disabled={loading}>
              {loading
                ? <FiRefreshCw size={16} className="lx-spin" />
                : <><span>Send Code</span><FiArrowRight size={15} /></>}
            </button>
          </form>
        ) : (
          <div className="lx-form">
            <div className="lx-heading-group">
              <h2 className="lx-heading">{tempCode ? 'Your sign-in code' : 'Check your inbox'}</h2>
              <p className="lx-subtext">
                {tempCode
                  ? <><FiAlertTriangle size={12} style={{color:'#f59e0b',verticalAlign:'middle'}} /> SMTP not configured — code shown below
                    </>                  
                  : <>6-digit code sent to <strong>{email}</strong></>}
              </p>
            </div>

            {/* Temp-code display banner */}
            {tempCode && (
              <div className="lx-tempcode-box">
                <div className="lx-tempcode-label">Your temporary sign-in code</div>
                <div className="lx-tempcode-digits">{tempCode}</div>
                <button className="lx-tempcode-copy" onClick={copyCode} title="Copy code">
                  {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
            <div className="lx-otp-grid" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  className={`lx-otp-cell ${digit ? 'lx-otp-filled' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  ref={el => (otpRefs.current[i] = el)}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && <p className="lx-error">{error}</p>}

            <button
              className="lx-btn-primary"
              onClick={() => handleVerify()}
              disabled={loading || otp.some(d => !d)}
            >
              {loading
                ? <FiRefreshCw size={16} className="lx-spin" />
                : <><FiLock size={15} /><span>Verify &amp; Sign In</span></>}
            </button>

            {/* Resend code button with cooldown */}
            <button
              className="lx-btn-ghost"
              onClick={handleResend}
              disabled={loading || resendCooldown > 0}
              style={{ fontSize: 13 }}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : <><FiRefreshCw size={13} /> Resend Code</>}
            </button>

            <button
              className="lx-btn-ghost"
              onClick={() => { setStep('email'); setOtp(['','','','','','']); setError(''); clearInterval(cooldownRef.current); setResendCooldown(0); }}
            >
              <FiArrowLeft size={14} /> Back to email
            </button>
          </div>
        )}

        <p className="lx-fine">
          <FiLock size={11} /> End-to-end encrypted · No passwords stored
        </p>
      </div>

      <style>{`
        /* ═══ ROOT ═══ */
        .lx-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          background: #080a10;
          position: relative;
          overflow: hidden;
        }

        /* ═══ BG ═══ */
        .lx-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .lx-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.2;
          animation: lx-float 12s ease-in-out infinite alternate;
        }
        .lx-orb-1 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, #7c6af7, transparent 70%);
          top: -100px; left: -100px;
        }
        .lx-orb-2 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, #e879f9, transparent 70%);
          bottom: -80px; right: -80px;
          animation-delay: -5s; animation-duration: 10s;
        }
        .lx-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(124,106,247,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,247,0.04) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent);
        }
        @keyframes lx-float {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(30px,20px) scale(1.06); }
        }

        /* ═══ CARD ═══ */
        .lx-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 400px;
          background: rgba(19,22,30,0.75);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 28px;
          padding: 36px 32px 28px;
          box-shadow:
            0 32px 80px rgba(0,0,0,0.7),
            0 0 0 1px rgba(255,255,255,0.04) inset;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          opacity: 0;
          transform: translateY(28px) scale(0.97);
          transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.34,1.2,0.64,1);
        }
        .lx-loaded .lx-card {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        /* ═══ LOGO ═══ */
        .lx-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }
        .lx-logo-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #7c6af7, #a78bfa);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          position: relative;
          box-shadow: 0 0 24px rgba(124,106,247,0.5);
        }
        .lx-logo-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 18px;
          border: 2px solid rgba(124,106,247,0.35);
          animation: lx-ring-pulse 2s ease infinite;
        }
        @keyframes lx-ring-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.1); }
        }
        .lx-logo-text {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: -0.5px;
          background: linear-gradient(90deg, #f0f2ff, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* ═══ FORM ═══ */
        .lx-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .lx-heading-group { display: flex; flex-direction: column; gap: 6px; }
        .lx-heading {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #f0f2ff;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .lx-subtext {
          font-size: 13px;
          color: rgba(155,163,192,0.85);
          margin: 0;
          line-height: 1.5;
        }
        .lx-subtext strong { color: #a78bfa; font-weight: 600; }

        /* ═══ FIELD ═══ */
        .lx-field { display: flex; flex-direction: column; gap: 7px; }
        .lx-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(155,163,192,0.9);
          letter-spacing: 0.03em;
        }
        .lx-input-wrap {
          position: relative;
        }
        .lx-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(155,163,192,0.5);
          pointer-events: none;
        }
        .lx-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 12px;
          padding: 13px 16px 13px 40px;
          color: #f0f2ff;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .lx-input:focus {
          border-color: rgba(124,106,247,0.7);
          background: rgba(124,106,247,0.05);
          box-shadow: 0 0 0 3px rgba(124,106,247,0.15);
        }
        .lx-input::placeholder { color: rgba(155,163,192,0.4); }

        /* ═══ OTP ═══ */
        .lx-otp-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
        }
        .lx-otp-cell {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.09);
          color: #f0f2ff;
          font-size: 22px;
          font-weight: 700;
          font-family: 'Space Grotesk', monospace;
          text-align: center;
          outline: none;
          transition: all 0.18s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .lx-otp-cell:focus {
          border-color: rgba(124,106,247,0.7);
          background: rgba(124,106,247,0.08);
          box-shadow: 0 0 0 3px rgba(124,106,247,0.15);
        }
        .lx-otp-cell.lx-otp-filled {
          border-color: rgba(124,106,247,0.5);
          background: rgba(124,106,247,0.1);
          animation: lx-pop 0.2s cubic-bezier(0.34,1.5,0.64,1);
        }
        @keyframes lx-pop {
          from { transform: scale(0.85); }
          to   { transform: scale(1); }
        }

        /* ═══ DEV HINT ═══ */
        .lx-dev-hint {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(124,106,247,0.08);
          border: 1px solid rgba(124,106,247,0.2);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .lx-dev-label {
          font-size: 10px;
          color: rgba(155,163,192,0.7);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }
        .lx-dev-code {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 6px;
          color: #a78bfa;
          font-family: 'Space Grotesk', monospace;
        }

        /* ═══ BUTTONS ═══ */
        .lx-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 14px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #7c6af7, #9b7eff);
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 28px rgba(124,106,247,0.45);
          transition: all 0.22s cubic-bezier(0.34,1.2,0.64,1);
          -webkit-tap-highlight-color: transparent;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .lx-btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(255,255,255,0.1), transparent);
          pointer-events: none;
        }
        .lx-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 36px rgba(124,106,247,0.6);
        }
        .lx-btn-primary:active:not(:disabled) { transform: scale(0.97); }
        .lx-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .lx-btn-ghost {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.08);
          background: transparent;
          color: rgba(155,163,192,0.8);
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s ease;
          -webkit-tap-highlight-color: transparent;
          width: 100%;
        }
        .lx-btn-ghost:hover {
          background: rgba(255,255,255,0.05);
          color: #f0f2ff;
          border-color: rgba(255,255,255,0.15);
        }
        .lx-btn-ghost:active { transform: scale(0.97); }

        /* ═══ ERROR ═══ */
        .lx-error {
          font-size: 13px;
          color: #f87171;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          padding: 10px 14px;
          border-radius: 10px;
          margin: -6px 0;
          animation: lx-shake 0.35s ease;
        }
        @keyframes lx-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }

        /* ═══ FINE PRINT ═══ */
        .lx-fine {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          color: rgba(155,163,192,0.4);
          margin-top: 16px;
        }

        /* Spin animation */
        .lx-spin { animation: lx-spin 0.8s linear infinite; }
        @keyframes lx-spin { to { transform: rotate(360deg); } }

        /* ═══ DEV-MODE MODAL ═══ */
        .lx-modal-backdrop {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: lx-fadein 0.2s ease;
        }
        @keyframes lx-fadein { from { opacity: 0; } to { opacity: 1; } }
        .lx-modal {
          background: #13161e;
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 24px;
          padding: 32px 28px 28px;
          width: 100%; max-width: 420px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04) inset;
          animation: lx-slideup 0.25s cubic-bezier(0.34,1.2,0.64,1);
          display: flex; flex-direction: column; gap: 14px;
        }
        @keyframes lx-slideup {
          from { transform: translateY(20px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        .lx-modal-icon {
          width: 52px; height: 52px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
        }
        .lx-modal-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.2rem; font-weight: 700;
          color: #f0f2ff; margin: 0; letter-spacing: -0.3px;
        }
        .lx-modal-body {
          font-size: 13px; color: rgba(155,163,192,0.85);
          line-height: 1.6; margin: 0;
        }
        .lx-modal-body strong { color: #f87171; }
        .lx-modal-list {
          font-size: 12.5px; color: rgba(155,163,192,0.8);
          line-height: 1.8; margin: 0; padding-left: 18px;
        }
        .lx-modal-list code {
          background: rgba(124,106,247,0.15);
          border: 1px solid rgba(124,106,247,0.25);
          border-radius: 4px; padding: 1px 5px;
          font-size: 11px; color: #a78bfa;
        }

        /* ═══ TEMP-CODE BOX ═══ */
        .lx-tempcode-box {
          background: rgba(245,158,11,0.07);
          border: 1.5px solid rgba(245,158,11,0.3);
          border-radius: 14px;
          padding: 16px 18px;
          display: flex; flex-direction: column; gap: 6px;
          position: relative;
        }
        .lx-tempcode-label {
          font-size: 10px; font-weight: 600;
          color: rgba(245,158,11,0.7);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .lx-tempcode-digits {
          font-family: 'Space Grotesk', monospace;
          font-size: 32px; font-weight: 800;
          letter-spacing: 10px;
          color: #f0f2ff;
          line-height: 1;
        }
        .lx-tempcode-copy {
          position: absolute; top: 12px; right: 12px;
          display: flex; align-items: center; gap: 5px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 8px; padding: 5px 10px;
          color: rgba(245,158,11,0.9); font-size: 12px;
          cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all 0.15s ease;
        }
        .lx-tempcode-copy:hover {
          background: rgba(245,158,11,0.2);
          color: #f59e0b;
        }

        /* ═══ MOBILE FINE-TUNING ═══ */
        @media (max-width: 380px) {
          .lx-card { padding: 28px 20px 24px; border-radius: 24px; }
          .lx-otp-cell { font-size: 18px; border-radius: 10px; }
          .lx-tempcode-digits { font-size: 26px; letter-spacing: 7px; }
          .lx-modal { padding: 24px 20px 20px; }
        }
      `}</style>
    </div>
  );
}


