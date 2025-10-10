const nodemailer = require('nodemailer');
const { generateEmailVerificationToken } = require('../utils/jwt');

/**
 * Email Service
 * Handles sending emails for various purposes (verification, password reset, etc.)
 */

/**
 * Create nodemailer transporter
 */
const createTransporter = () => {
  // Check if email configuration is available
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️  Email configuration not found. Emails will be logged to console only.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send email verification email
 * @param {Object} user - User object with id, email, username
 * @returns {Promise<boolean>} Success status
 */
const sendVerificationEmail = async (user) => {
  try {
    // Generate verification token
    const verificationToken = generateEmailVerificationToken({
      id: user.id,
      email: user.email
    });

    // Create verification URL
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    // Email HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🗺️ OptiConnect GIS</h1>
              <h2>Email Verification</h2>
            </div>
            <div class="content">
              <p>Hi <strong>${user.username}</strong>,</p>
              <p>Thank you for registering with OptiConnect GIS! Please verify your email address to activate your account.</p>
              <p>Click the button below to verify your email:</p>
              <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </center>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p><strong>Note:</strong> This link will expire in 24 hours.</p>
              <p>If you didn't create an account with OptiConnect GIS, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 OptiConnect GIS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const textContent = `
      Hi ${user.username},

      Thank you for registering with OptiConnect GIS!

      Please verify your email address by clicking the link below:
      ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create an account with OptiConnect GIS, please ignore this email.

      © 2024 OptiConnect GIS. All rights reserved.
    `;

    const transporter = createTransporter();

    // If no transporter (email not configured), log to console
    if (!transporter) {
      console.log('\n📧 EMAIL VERIFICATION (Console Mode):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${user.email}`);
      console.log(`Subject: Verify your OptiConnect GIS account`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return true;
    }

    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"OptiConnect GIS" <noreply@opticonnect.com>',
      to: user.email,
      subject: 'Verify your OptiConnect GIS account',
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Verification email sent to ${user.email}`);
    console.log(`Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email
 * @param {Object} user - User object
 * @param {String} resetToken - Password reset token
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🗺️ OptiConnect GIS</h1>
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <p>Hi <strong>${user.username}</strong>,</p>
              <p>You requested to reset your password. Click the button below to reset it:</p>
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
              <p><strong>Note:</strong> This link will expire in 1 hour.</p>
              <p>If you didn't request a password reset, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 OptiConnect GIS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const transporter = createTransporter();

    if (!transporter) {
      console.log('\n📧 PASSWORD RESET EMAIL (Console Mode):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`To: ${user.email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return true;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"OptiConnect GIS" <noreply@opticonnect.com>',
      to: user.email,
      subject: 'Reset your OptiConnect GIS password',
      html: htmlContent,
    });

    console.log(`✅ Password reset email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
