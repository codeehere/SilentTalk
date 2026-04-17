const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // STARTTLS upgrades the connection; not TLS from the start
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false // allow self-signed certs in dev
      }
    });
  } else {
    console.warn('⚠️ No SMTP config found in .env, using console mock transporter.');
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n\n=== MOCK EMAIL SENT ===');
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Text: ${mailOptions.text}`);
        console.log('=======================\n\n');
        return true;
      }
    };
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || `SilentTalk <${process.env.SMTP_USER || 'noreply@silenttalk.local'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || undefined,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
