/**
 * Email service using Nodemailer.
 * Sends verification, password reset, and notification emails.
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendMail(options) {
    if (!process.env.EMAIL_USER) {
      console.log('[EmailService] Email not configured. Would send:', options.subject);
      return;
    }

    return this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Chatterbox <noreply@chatterbox.io>',
      ...options,
    });
  }

  async sendVerificationEmail(email, name, token) {
    const url = `${process.env.CLIENT_URL}/verify-email/${token}`;
    return this.sendMail({
      to: email,
      subject: 'Verify your Chatterbox email',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#36393f;color:#dcddde;padding:40px;border-radius:8px;">
          <h1 style="color:#5865f2;margin-bottom:8px;">Chatterbox</h1>
          <h2 style="margin-top:0;">Verify your email</h2>
          <p>Hi ${name},</p>
          <p>Thanks for registering! Click the button below to verify your email address.</p>
          <a href="${url}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;margin:16px 0;">Verify Email</a>
          <p style="color:#72767d;font-size:12px;">This link expires in 24 hours. If you didn't register, you can ignore this email.</p>
        </div>
      `,
    });
  }

  async sendPasswordResetEmail(email, name, token) {
    const url = `${process.env.CLIENT_URL}/reset-password/${token}`;
    return this.sendMail({
      to: email,
      subject: 'Reset your Chatterbox password',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#36393f;color:#dcddde;padding:40px;border-radius:8px;">
          <h1 style="color:#5865f2;margin-bottom:8px;">Chatterbox</h1>
          <h2 style="margin-top:0;">Reset your password</h2>
          <p>Hi ${name},</p>
          <p>You requested a password reset. Click the button below to create a new password.</p>
          <a href="${url}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;margin:16px 0;">Reset Password</a>
          <p style="color:#72767d;font-size:12px;">This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  }

  async sendFriendRequestEmail(email, fromName, toName) {
    return this.sendMail({
      to: email,
      subject: `${fromName} sent you a friend request on Chatterbox`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#36393f;color:#dcddde;padding:40px;border-radius:8px;">
          <h1 style="color:#5865f2;margin-bottom:8px;">Chatterbox</h1>
          <p>Hi ${toName},</p>
          <p><strong>${fromName}</strong> sent you a friend request on Chatterbox.</p>
          <a href="${process.env.CLIENT_URL}/friends" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;margin:16px 0;">View Friend Requests</a>
        </div>
      `,
    });
  }
}

module.exports = new EmailService();
