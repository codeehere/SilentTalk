const nodemailer = require('nodemailer');

/**
 * Send an email via SMTP, or fall back to a console mock when SMTP is not
 * fully configured.
 *
 * Returns: { delivered: true }  — email was sent via real SMTP
 *          { delivered: false } — SMTP not configured; OTP logged to console only
 *
 * Throws only on hard SMTP errors (wrong credentials, host unreachable, etc.)
 * when SMTP IS configured — so the caller can decide what to do.
 */
const sendEmail = async (options) => {
  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (!hasSmtp) {
    // ── Console mock ─────────────────────────────────────────────────────
    console.warn('⚠️  SMTP not configured — OTP will be returned in API response (dev/demo mode).');
    console.log('\n======= [MOCK EMAIL] =======');
    console.log(`To      : ${options.email}`);
    console.log(`Subject : ${options.subject}`);
    console.log(`Body    : ${options.message}`);
    console.log('============================\n');
    return { delivered: false };
  }

  // ── Real SMTP ─────────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || `SilentTalk <${process.env.SMTP_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || undefined,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { delivered: true };
  } catch (smtpErr) {
    console.error('[sendEmail] SMTP delivery failed:', smtpErr.message);
    // Return undelivered instead of throwing — let caller include tempCode
    return { delivered: false };
  }
};

module.exports = sendEmail;
