const nodemailer = require('nodemailer');

/**
 * Send an email via SMTP or fall back to a console mock.
 *
 * Railway gotcha: if SMTP_HOST / SMTP_USER / SMTP_PASS are partially set
 * (e.g. only one or two vars present), nodemailer will try real SMTP and
 * fail with an auth error which propagates as a 500. We require ALL THREE
 * before attempting real SMTP.
 */
const sendEmail = async (options) => {
  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (!hasSmtp) {
    // ── Console mock (dev / missing SMTP config) ──────────────────────────
    console.warn('⚠️  SMTP not fully configured — falling back to console mock.');
    console.log('\n======= MOCK EMAIL =======');
    console.log(`To      : ${options.email}`);
    console.log(`Subject : ${options.subject}`);
    console.log(`Body    : ${options.message}`);
    console.log('==========================\n');
    return;
  }

  // ── Real SMTP ─────────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465', // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // allow self-signed certs; fine for most providers
    },
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
  } catch (smtpErr) {
    // Log the full SMTP error so it shows up in Railway logs for debugging
    console.error('[sendEmail] SMTP delivery failed:', smtpErr.message);
    // Re-throw so the caller (auth route) can return a proper error response
    throw new Error(`Failed to send verification email: ${smtpErr.message}`);
  }
};

module.exports = sendEmail;
