const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: Number.parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function shell(title, body, ctaLabel, ctaUrl) {
  const cta = ctaUrl ? `<p style="margin:28px 0 8px"><a href="${ctaUrl}" style="background:#d4a853;color:#0e0f11;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700">${ctaLabel}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#0e0f11;color:#9096a8;font-family:Arial,sans-serif"><div style="padding:32px"><div style="max-width:520px;margin:auto;background:#1f2128;border:1px solid #2a2d36;border-radius:12px;padding:28px"><h1 style="font-family:Georgia,serif;color:#e8eaf0;font-style:italic;font-weight:400">${title}</h1><div style="font-size:15px;line-height:1.6">${body}</div>${cta}<p style="border-top:1px solid #2a2d36;margin-top:28px;padding-top:18px;color:#565d72">SilverLining-Splits<br><em>Yuvraj owes no one.</em></p></div></div></body></html>`;
}

async function sendMail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`Email skipped for ${to}: SMTP is not configured`);
    return;
  }
  await transporter.sendMail({ from: process.env.FROM_EMAIL, to, subject, html });
}

async function sendVerificationEmail(toEmail, name, token) {
  const link = `${process.env.BASE_URL || 'http://localhost:5000'}/verify.html?token=${token}`;
  await sendMail(toEmail, 'Verify your SilverLining-Splits email', shell('Verify your email', `<p>Hello ${name}, confirm this email to activate your account.</p>`, 'Verify email', link));
}

async function sendGroupInviteEmail(toEmail, inviterName, groupName, inviteLink) {
  await sendMail(toEmail, `Join ${groupName} on SilverLining-Splits`, shell('A group is waiting', `<p>${inviterName} invited you to split expenses in <strong style="color:#e8eaf0">${groupName}</strong>.</p>`, 'Join group', inviteLink));
}

async function sendWelcomeEmail(toEmail, name) {
  await sendMail(toEmail, 'Welcome to SilverLining-Splits', shell('Welcome', `<p>${name}, your account is ready.</p>`, null, null));
}

module.exports = { sendVerificationEmail, sendGroupInviteEmail, sendWelcomeEmail };
