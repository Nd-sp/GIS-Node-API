const nodemailer = require("nodemailer");
const { generateEmailVerificationToken } = require("../utils/jwt");

/**
 * Email Service
 * Handles sending emails for various purposes (verification, password reset, etc.)
 */

/**
 * Create nodemailer transporter
 */
const createTransporter = () => {
  // Check if email configuration is available
  if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASSWORD
  ) {
    console.warn(
      "⚠️  Email configuration not found. Emails will be logged to console only."
    );
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
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

    // Create verification URL (automatically select based on NODE_ENV)
    const appUrl = process.env.NODE_ENV === 'production'
      ? process.env.APP_URL_PROD
      : process.env.APP_URL_DEV || "http://localhost:3005";
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
            .info-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #4b5563; }
            .info-value { color: #1f2937; }
            .credentials-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
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
              <p>Hi <strong>${user.full_name || user.username}</strong>,</p>
              <p>Thank you for registering with OptiConnect GIS! Please verify your email address to activate your account.</p>

              <p>Click the button below to verify your email:</p>
              <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </center>

              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #667eea;">📋 Your Account Details</h3>
                <div class="info-row">
                  <span class="info-label">Username:</span>
                  <span class="info-value">${user.username}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${user.email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Full Name:</span>
                  <span class="info-value">${user.full_name || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Role:</span>
                  <span class="info-value">${user.role || 'viewer'}</span>
                </div>
              </div>

              <div class="credentials-box">
                <h4 style="margin-top: 0; color: #1e40af;">🔐 Login Credentials</h4>
                <p style="margin: 10px 0;"><strong>Username/Email:</strong> ${user.username} or ${user.email}</p>
                ${user.password ? `
                <p style="margin: 10px 0;"><strong>Password:</strong> <span style="font-family: 'Courier New', monospace; background: #fef3c7; padding: 4px 8px; border-radius: 4px; color: #b45309;">${user.password}</span></p>
                <p style="margin: 10px 0; font-size: 13px; color: #dc2626; background: #fee2e2; padding: 8px; border-radius: 4px;">
                  ⚠️ <strong>Security Notice:</strong> Please save this password securely and delete this email after logging in. Consider changing your password after first login.
                </p>
                ` : `
                <p style="margin: 10px 0;"><strong>Password:</strong> Use the password you set during registration</p>
                `}
                <p style="margin: 10px 0; font-size: 14px; color: #6b7280;">
                  <em>Note: Please verify your email first before logging in. Once verified, you can access your account using the credentials above.</em>
                </p>
              </div>

              <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
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
      Hi ${user.full_name || user.username},

      Thank you for registering with OptiConnect GIS!

      Please verify your email address by clicking the link below:
      ${verificationUrl}

      ═══════════════════════════════════════════
      📋 YOUR ACCOUNT DETAILS
      ═══════════════════════════════════════════

      Username:   ${user.username}
      Email:      ${user.email}
      Full Name:  ${user.full_name || 'N/A'}
      Role:       ${user.role || 'viewer'}

      ═══════════════════════════════════════════
      🔐 LOGIN CREDENTIALS
      ═══════════════════════════════════════════

      Username/Email: ${user.username} or ${user.email}
      ${user.password ? `Password:       ${user.password}

      ⚠️ SECURITY NOTICE:
      Please save this password securely and delete this email
      after logging in. Consider changing your password after
      first login.` : `Password:       Use the password you set during registration`}

      Note: Please verify your email first before logging in.
      Once verified, you can access your account using the
      credentials above.

      ═══════════════════════════════════════════

      IMPORTANT: This verification link will expire in 24 hours.

      If you didn't create an account with OptiConnect GIS, please ignore this email.

      © 2024 OptiConnect GIS. All rights reserved.
    `;

    const transporter = createTransporter();

    // If no transporter (email not configured), log to console
    if (!transporter) {
      console.log("\n📧 EMAIL VERIFICATION (Console Mode):");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${user.email}`);
      console.log(`Subject: Verify your OptiConnect GIS account`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log("\n📋 Account Details:");
      console.log(`   Username:  ${user.username}`);
      console.log(`   Email:     ${user.email}`);
      console.log(`   Full Name: ${user.full_name || 'N/A'}`);
      console.log(`   Role:      ${user.role || 'viewer'}`);
      console.log("\n🔐 Login Credentials:");
      console.log(`   Username:  ${user.username}`);
      if (user.password) {
        console.log(`   Password:  ${user.password}`);
        console.log(`   ⚠️  Password sent in email - User should save it securely`);
      } else {
        console.log(`   Password:  (Not available - resend verification)`);
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return true;
    }

    // Send email
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM || '"OptiConnect GIS" <noreply@opticonnect.com>',
      to: user.email,
      subject: "Verify your OptiConnect GIS account",
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ Verification email sent to ${user.email}`);
    console.log(`Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
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
    // Auto-select URL based on NODE_ENV
    const appUrl = process.env.NODE_ENV === 'production'
      ? process.env.APP_URL_PROD
      : process.env.APP_URL_DEV || "http://localhost:3005";
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
      console.log("\n📧 PASSWORD RESET EMAIL (Console Mode):");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${user.email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return true;
    }

    await transporter.sendMail({
      from:
        process.env.EMAIL_FROM || '"OptiConnect GIS" <noreply@opticonnect.com>',
      to: user.email,
      subject: "Reset your OptiConnect GIS password",
      html: htmlContent
    });

    console.log(`✅ Password reset email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

/**
 * Send manual verification notification
 * Sent when an admin manually verifies a user's email
 * @param {string} email - User's email address
 * @param {string} fullName - User's full name
 * @returns {Promise<boolean>} Success status
 */
const sendManualVerificationNotification = async (email, fullName) => {
  try {
    const appUrl = process.env.NODE_ENV === 'production'
      ? process.env.APP_URL_PROD
      : process.env.APP_URL_DEV || "http://localhost:3005";
    const loginUrl = `${appUrl}/login`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .badge { display: inline-block; padding: 8px 16px; background: #10b981; color: white; border-radius: 20px; font-weight: bold; margin: 10px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .icon { font-size: 48px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">✅</div>
              <h1>🗺️ OptiConnect GIS</h1>
              <h2>Email Verified!</h2>
            </div>
            <div class="content">
              <p>Hi <strong>${fullName}</strong>,</p>
              <p>Great news! Your email address has been verified by our admin team.</p>
              <center>
                <span class="badge">✓ Email Verified</span>
              </center>
              <p>You can now access all features of OptiConnect GIS.</p>
              <center>
                <a href="${loginUrl}" class="button">Login to Your Account</a>
              </center>
              <p>If you have any questions or need assistance, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 OptiConnect GIS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      OptiConnect GIS - Email Verified!

      Hi ${fullName},

      Great news! Your email address has been verified by our admin team.

      ✓ Email Verified

      You can now access all features of OptiConnect GIS.

      Login to your account: ${loginUrl}

      If you have any questions or need assistance, please contact our support team.

      © 2024 OptiConnect GIS. All rights reserved.
    `;

    const transporter = createTransporter();

    // If no transporter (email not configured), log to console
    if (!transporter) {
      console.log("\n📧 MANUAL VERIFICATION NOTIFICATION (Console Mode):");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${email}`);
      console.log(`Subject: Your Email Has Been Verified`);
      console.log(`Login URL: ${loginUrl}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return true;
    }

    // Send email
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM || '"OptiConnect GIS" <noreply@opticonnect.com>',
      to: email,
      subject: "Your Email Has Been Verified - OptiConnect GIS",
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ Manual verification notification sent to ${email}`);
    console.log(`Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error("Error sending manual verification notification:", error);
    throw new Error("Failed to send manual verification notification");
  }
};

/**
 * Send admin password reset notification
 * Sent when admin approves password reset and sets new password
 * @param {Object} user - User object
 * @param {String} newPassword - New password set by admin
 * @returns {Promise<boolean>} Success status
 */
const sendAdminPasswordResetEmail = async (user, newPassword) => {
  try {
    const appUrl = process.env.NODE_ENV === 'production'
      ? process.env.APP_URL_PROD
      : process.env.APP_URL_DEV || "http://localhost:3005";
    const loginUrl = `${appUrl}/login`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .password-box { background: #fff; border: 2px dashed #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .password { font-size: 24px; font-weight: bold; color: #d97706; font-family: 'Courier New', monospace; letter-spacing: 2px; }
            .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 OptiConnect GIS</h1>
              <h2>Password Reset Approved</h2>
            </div>
            <div class="content">
              <p>Hi <strong>${user.full_name || user.username}</strong>,</p>
              <p>Your password reset request has been approved by an administrator. Your new temporary password is:</p>

              <div class="password-box">
                <div class="password">${newPassword}</div>
              </div>

              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This is a temporary password</li>
                  <li>Please change it immediately after logging in</li>
                  <li>Do not share this password with anyone</li>
                  <li>Delete this email after changing your password</li>
                </ul>
              </div>

              <p>You can now log in to your account:</p>
              <center>
                <a href="${loginUrl}" class="button">Login to Your Account</a>
              </center>

              <p><strong>Your Login Details:</strong></p>
              <ul>
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Temporary Password:</strong> (shown above)</li>
              </ul>

              <p>If you did not request a password reset, please contact support immediately.</p>
            </div>
            <div class="footer">
              <p>© 2024 OptiConnect GIS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      OptiConnect GIS - Password Reset Approved

      Hi ${user.full_name || user.username},

      Your password reset request has been approved by an administrator.

      Your new temporary password is: ${newPassword}

      ⚠️ IMPORTANT SECURITY NOTICE:
      - This is a temporary password
      - Please change it immediately after logging in
      - Do not share this password with anyone
      - Delete this email after changing your password

      Login URL: ${loginUrl}

      Your Login Details:
      - Username: ${user.username}
      - Email: ${user.email}
      - Temporary Password: ${newPassword}

      If you did not request a password reset, please contact support immediately.

      © 2024 OptiConnect GIS. All rights reserved.
    `;

    const transporter = createTransporter();

    // If no transporter (email not configured), log to console
    if (!transporter) {
      console.log("\n📧 ADMIN PASSWORD RESET EMAIL (Console Mode):");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${user.email}`);
      console.log(`Subject: Password Reset Approved`);
      console.log(`New Password: ${newPassword}`);
      console.log(`Login URL: ${loginUrl}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return true;
    }

    // Send email
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM || '"OptiConnect GIS" <noreply@opticonnect.com>',
      to: user.email,
      subject: "Password Reset Approved - OptiConnect GIS",
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ Admin password reset email sent to ${user.email}`);
    console.log(`Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error("Error sending admin password reset email:", error);
    throw new Error("Failed to send admin password reset email");
  }
};

/**
 * Send 2FA verification code email
 * @param {string} email - User email address
 * @param {string} name - User full name
 * @param {string} code - 6-digit verification code
 * @returns {Promise<boolean>} Success status
 */
const send2FACode = async (email, name, code) => {
  try {
    const transporter = createTransporter();

    // If no transporter (email not configured), log to console
    if (!transporter) {
      console.log("\n📧 2FA VERIFICATION CODE EMAIL (Not sent - email not configured)");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`To: ${email}`);
      console.log(`Name: ${name}`);
      console.log(`Code: ${code}`);
      console.log("═══════════════════════════════════════════════════════════\n");
      return true; // Return success for development
    }

    // Email HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
            .header h1 { margin: 0 0 10px 0; font-size: 28px; }
            .header p { margin: 0; font-size: 14px; opacity: 0.9; }
            .content { padding: 40px 30px; }
            .greeting { font-size: 18px; margin-bottom: 20px; }
            .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .code { font-size: 48px; font-weight: bold; letter-spacing: 8px; color: white; font-family: 'Courier New', monospace; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
            .code-label { color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .info-box { background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px; }
            .info-box p { margin: 8px 0; font-size: 14px; }
            .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 4px; }
            .warning-box p { margin: 8px 0; font-size: 14px; color: #92400e; }
            .security-tips { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0; }
            .security-tips h3 { margin-top: 0; color: #374151; font-size: 16px; }
            .security-tips ul { margin: 10px 0; padding-left: 20px; }
            .security-tips li { margin: 6px 0; font-size: 14px; color: #6b7280; }
            .footer { background: #f9fafb; padding: 30px 20px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
            .footer p { margin: 5px 0; }
            .footer-link { color: #667eea; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Two-Factor Authentication</h1>
              <p>OptiConnect GIS - Secure Login Verification</p>
            </div>

            <div class="content">
              <p class="greeting">Hello <strong>${name}</strong>,</p>

              <p>Someone (hopefully you!) is trying to log in to your OptiConnect GIS account. To complete the login, please enter the verification code below:</p>

              <div class="code-box">
                <div class="code-label">Your Verification Code</div>
                <div class="code">${code}</div>
              </div>

              <div class="info-box">
                <p><strong>⏱️ This code expires in 10 minutes</strong></p>
                <p>If you don't use this code within 10 minutes, you'll need to request a new one.</p>
              </div>

              <div class="warning-box">
                <p><strong>⚠️ Important Security Notice</strong></p>
                <p>If you did NOT attempt to log in, please:</p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Ignore this email and the code will expire automatically</li>
                  <li>Change your password immediately</li>
                  <li>Contact your administrator if you suspect unauthorized access</li>
                </ul>
              </div>

              <div class="security-tips">
                <h3>🛡️ Security Tips</h3>
                <ul>
                  <li>Never share this code with anyone, including OptiConnect staff</li>
                  <li>OptiConnect will never ask for your verification code via email or phone</li>
                  <li>Make sure you're on the official OptiConnect GIS website before entering the code</li>
                </ul>
              </div>
            </div>

            <div class="footer">
              <p><strong>OptiConnect GIS</strong></p>
              <p>Telecom Infrastructure Management Platform</p>
              <p style="margin-top: 15px;">
                Need help? Contact us at
                <a href="mailto:${process.env.EMAIL_USER}" class="footer-link">${process.env.EMAIL_USER}</a>
              </p>
              <p style="margin-top: 15px; color: #9ca3af;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Email text content (fallback for email clients that don't support HTML)
    const textContent = `
OptiConnect GIS - Two-Factor Authentication

Hello ${name},

Someone (hopefully you!) is trying to log in to your OptiConnect GIS account.

Your verification code is: ${code}

This code expires in 10 minutes.

IMPORTANT:
- Never share this code with anyone
- If you did NOT attempt to log in, ignore this email and change your password immediately

Need help? Contact us at ${process.env.EMAIL_USER}

---
OptiConnect GIS - Telecom Infrastructure Management Platform
    `;

    const mailOptions = {
      from: `"OptiConnect GIS Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 OptiConnect GIS - Your Verification Code",
      text: textContent,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ 2FA code sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending 2FA code email:", error);
    throw new Error("Failed to send verification code email");
  }
};

/**
 * Send developer tools completion notification to admin
 * @param {Object} params - Notification parameters
 * @param {string} params.toolType - Type of tool (code_analysis, security_scan, database_backup, etc.)
 * @param {string} params.reportType - Specific report type (frontend, props_analysis, full, etc.)
 * @param {string} params.status - Status (completed, failed)
 * @param {number} params.duration - Duration in seconds
 * @param {Object} params.stats - Statistics object
 * @param {string} params.errorMessage - Error message if failed
 * @param {string} params.adminEmail - Admin email address
 * @param {string} params.adminName - Admin name
 * @returns {Promise<boolean>} Success status
 */
const sendDevToolsNotification = async ({
  toolType,
  reportType,
  status,
  duration,
  stats = {},
  errorMessage = null,
  adminEmail,
  adminName
}) => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.log(`📧 [DEV MODE] Would send ${toolType} notification to ${adminEmail}`);
      return true;
    }

    // Format tool type for display
    const toolLabels = {
      code_analysis: "Code Analysis",
      security_scan: "Security Scan",
      database_backup: "Database Backup",
      env_validation: "Environment Validation"
    };

    const reportLabels = {
      frontend: "Frontend Analysis",
      fullstack: "Fullstack Analysis",
      architecture: "Architecture Docs",
      dependency_graph: "Dependency Graph",
      hierarchy: "Component Hierarchy",
      props_analysis: "Props Analysis",
      api_analysis: "API Performance Analysis",
      full: "Full Security Scan",
      dependencies: "Dependencies Scan",
      code: "Code Security Scan",
      config: "Configuration Scan"
    };

    const toolLabel = toolLabels[toolType] || toolType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const reportLabel = reportLabels[reportType] || reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Generate stats HTML
    let statsHTML = '';
    if (status === 'completed' && Object.keys(stats).length > 0) {
      statsHTML = `
        <div class="info-box">
          <h3 style="margin-top: 0; color: #10b981;">📊 Report Statistics</h3>
          ${Object.entries(stats).map(([key, value]) => `
            <div class="info-row">
              <span class="info-label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
              <span class="info-value">${value}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Generate status-specific content
    const statusIcon = status === 'completed' ? '✅' : '❌';
    const statusColor = status === 'completed' ? '#10b981' : '#ef4444';
    const statusText = status === 'completed' ? 'Completed Successfully' : 'Failed';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .status-badge { display: inline-block; padding: 8px 16px; background: ${statusColor}; color: white; border-radius: 20px; font-weight: bold; margin: 10px 0; }
            .info-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #4b5563; }
            .info-value { color: #1f2937; }
            .error-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; color: #991b1b; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🗺️ OptiConnect GIS</h1>
              <h2>Developer Tools Notification</h2>
            </div>
            <div class="content">
              <p>Hi <strong>${adminName}</strong>,</p>

              <div style="text-align: center;">
                <h2 style="color: ${statusColor};">${statusIcon} ${toolLabel}</h2>
                <span class="status-badge">${statusText}</span>
              </div>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #667eea;">📋 Task Details</h3>
                <div class="info-row">
                  <span class="info-label">Tool:</span>
                  <span class="info-value">${toolLabel}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Report Type:</span>
                  <span class="info-value">${reportLabel}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value" style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                </div>
                ${duration ? `
                <div class="info-row">
                  <span class="info-label">Duration:</span>
                  <span class="info-value">${duration < 60 ? duration + 's' : Math.floor(duration / 60) + 'm ' + (duration % 60) + 's'}</span>
                </div>
                ` : ''}
              </div>

              ${statsHTML}

              ${errorMessage ? `
              <div class="error-box">
                <strong>❌ Error Details:</strong><br>
                ${errorMessage}
              </div>
              ` : ''}

              <p style="margin-top: 30px;">
                ${status === 'completed'
                  ? 'The report is now available in the Developer Tools section of the admin dashboard.'
                  : 'Please check the Developer Tools section for more details about this failure.'}
              </p>

              <p style="font-size: 12px; color: #666; margin-top: 20px;">
                This is an automated notification from OptiConnect GIS Developer Tools.
              </p>
            </div>
            <div class="footer">
              <p>OptiConnect GIS - Telecom Infrastructure Management Platform</p>
              <p>© 2025 OptiConnect. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"OptiConnect GIS" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `${statusIcon} ${toolLabel} - ${statusText}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Developer tools notification sent to ${adminEmail}`);
    return true;

  } catch (error) {
    console.error("❌ Error sending developer tools notification:", error);
    // Don't throw error - email failure shouldn't break the analysis
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendManualVerificationNotification,
  sendAdminPasswordResetEmail,
  send2FACode,
  sendDevToolsNotification
};
