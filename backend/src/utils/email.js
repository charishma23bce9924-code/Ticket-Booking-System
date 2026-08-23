const { Resend } = require('resend');
const QRCode = require('qrcode');
 
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'Ticket Booking <onboarding@resend.dev>';
 
if (!resend) {
  console.log('ℹ️  No RESEND_API_KEY set — emails will be logged to this console instead of actually sent.');
} else {
  console.log('✅ Resend configured — real emails will be sent via Resend API');
}
 
async function generateQRCodeDataUrl(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
}
 
function dataUrlToBase64(dataUrl) {
  return dataUrl.split(',')[1];
}
 
async function sendEmail({ to, subject, html, attachments }) {
  if (!resend) {
    console.log(`📧 [DEV] Would send email to ${to}: ${subject}`);
    return { id: 'dev-mode' };
  }
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    attachments,
  });
  if (error) {
    console.error('❌ Resend send failed:', error);
    throw new Error(error.message || 'Email send failed');
  }
  return data;
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
 
  const info = await sendEmail({
    to,
    subject: `Booking Confirmed - ${eventTitle} (${bookingRef})`,
    html,
    attachments: [
      {
        filename: 'ticket-qr.png',
        content: dataUrlToBase64(qrDataUrl),
        content_id: 'qr-ticket',
      },
    ],
  });
  console.log(`📧 Booking confirmation email sent to ${to} for ${bookingRef}`);
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
 
  const info = await sendEmail({
    to,
    subject: `Your waitlisted ticket is now available - ${eventTitle}`,
    html,
  });
  console.log(`📧 Waitlist offer email sent to ${to}`);
  return info;
}
 
module.exports = { generateQRCodeDataUrl, sendBookingConfirmationEmail, sendWaitlistOfferEmail };
