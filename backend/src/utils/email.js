const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

function buildTransport() {
  // Falls back to a JSON transport (logs to console) if Gmail creds aren't
  // set, so the app is still fully runnable locally without any email account.
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

const transporter = buildTransport();
const FROM = process.env.EMAIL_FROM || `Ticket Booking <${process.env.GMAIL_USER || 'no-reply@ticketbooking.dev'}>`;

if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter.verify((err) => {
    if (err) {
      console.error('❌ Gmail SMTP connection failed — emails will NOT send. Check GMAIL_USER/GMAIL_APP_PASSWORD in .env:', err.message);
    } else {
      console.log('✅ Gmail SMTP connected — real emails will be sent from', process.env.GMAIL_USER);
    }
  });
} else {
  console.log('ℹ️  No GMAIL_USER/GMAIL_APP_PASSWORD set — emails will be logged to this console instead of actually sent.');
}

async function generateQRCodeDataUrl(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
}

// Data URLs (src="data:image/...") get stripped by most clients (Gmail
// included) for security, so the QR wouldn't render. Nodemailer's cid
// attachment support fixes this: attach the image with a Content-ID, then
// reference it in the HTML as src="cid:qr-ticket" — the standard way inline
// email images work.
function dataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function sendBookingConfirmationEmail({ to, name, bookingRef, eventTitle, seatLabels, qrDataUrl }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2>Booking Confirmed 🎟️</h2>
      <p>Hi ${name},</p>
      <p>Your booking for <strong>${eventTitle}</strong> is confirmed.</p>
      <p><strong>Booking Reference:</strong> ${bookingRef}</p>
      <p><strong>Seats:</strong> ${seatLabels.join(', ')}</p>
      <p>Scan the QR code below at the venue entrance:</p>
      <img src="cid:qr-ticket" alt="QR Ticket" style="width:220px;height:220px;" />
      <p style="color:#888;font-size:12px;">This QR encodes your booking reference for verification.</p>
    </div>`;

  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject: `Booking Confirmed - ${eventTitle} (${bookingRef})`,
    html,
    attachments: [
      {
        filename: 'ticket-qr.png',
        content: dataUrlToBuffer(qrDataUrl),
        cid: 'qr-ticket',
      },
    ],
  });
  console.log(`📧 Booking confirmation email sent to ${to} for ${bookingRef}${info.messageId ? ` (messageId: ${info.messageId})` : ''}`);
  return info;
}

async function sendWaitlistOfferEmail({ to, name, eventTitle, category, claimUrl, expiresAt }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2>Good news, ${name}! 🎉</h2>
      <p>The ticket you wished for in the waitlist is now available.</p>
      <p><strong>${eventTitle}</strong> — ${category} seat</p>
      <p>Log in to the app and complete your booking before <strong>${new Date(expiresAt).toLocaleString()}</strong>, or it will be offered to the next person in line.</p>
      <p><a href="${claimUrl}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Go to Booking</a></p>
    </div>`;

  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject: `Your waitlisted ticket is now available - ${eventTitle}`,
    html,
  });
  console.log(`📧 Waitlist offer email sent to ${to}${info.messageId ? ` (messageId: ${info.messageId})` : ''}`);
  return info;
}

module.exports = { generateQRCodeDataUrl, sendBookingConfirmationEmail, sendWaitlistOfferEmail };
