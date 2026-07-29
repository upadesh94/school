const nodemailer = require('nodemailer');

// ── Gmail SMTP with App Password ────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "kunalkandke@gmail.com",
    pass: "xtpbiuvrhjtrwcvo"
  }
});

// Verify on startup
transporter.verify((err, success) => {
  if (err) console.error('❌ Mailer config error:', err.message);
  else console.log('✅ Mailer ready — Gmail SMTP connected');
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: '"तुलजाभवानी माध्यमिक विद्यालय ERP" <kunalkandke@gmail.com>',
      to,
      subject,
      html,
    });
    console.log('📧 Email sent to', to, '— ID:', info.messageId);
    return true;
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    return false;
  }
};

const teacherWelcomeEmail = (teacher, rawPassword) => ({
  to: teacher.email,
  subject: 'Welcome to तुलजाभवानी माध्यमिक विद्यालय ERP — Your Login Credentials',
  html: `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1a237e,#283593);padding:32px;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">🎓</div>
        <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px;">तुलजाभवानी माध्यमिक विद्यालय</h1>
        <p style="color:#90caf9;margin:6px 0 0;font-size:13px;letter-spacing:2px;text-transform:uppercase;">ERP System — Account Created</p>
      </div>
      <div style="padding:32px;background:#fff;">
        <h2 style="color:#1a237e;margin:0 0 12px;">Welcome, ${teacher.name}! 👋</h2>
        <p style="color:#555;line-height:1.6;">Your teacher account has been successfully created by the Principal. Below are your login credentials:</p>
        <div style="background:#f3f4f9;border-left:4px solid #1a237e;border-radius:6px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="padding:6px 0;color:#666;width:140px;">👤 Employee ID</td><td style="font-weight:700;color:#1a237e;">${teacher.employeeId}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">📧 Login Email</td><td style="font-weight:700;color:#1a237e;">${teacher.email}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">🔑 Password</td><td><code style="background:#fff;border:1px solid #c5cae9;padding:4px 10px;border-radius:4px;font-size:15px;font-weight:700;color:#c62828;">${rawPassword}</code></td></tr>
            <tr><td style="padding:6px 0;color:#666;">📚 Class</td><td style="font-weight:700;">${teacher.classAssigned ? 'Class ' + teacher.classAssigned : 'Not assigned yet'}</td></tr>
          </table>
        </div>
        <div style="background:#fff3e0;border-radius:6px;padding:14px;margin-bottom:20px;">
          <p style="margin:0;color:#e65100;font-size:13px;">⚠️ <strong>Important:</strong> Please log in and change your password immediately for security.</p>
        </div>
        <p style="color:#888;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #eee;">This is an automated message from तुलजाभवानी माध्यमिक विद्यालय ERP System. Please do not reply to this email.</p>
      </div>
    </div>
  `
});

const teacherUpdateEmail = (teacher, updateDetails) => ({
  to: teacher.email,
  subject: 'Profile Updated — तुलजाभवानी माध्यमिक विद्यालय ERP',
  html: `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1a237e,#283593);padding:28px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;">🎓 तुलजाभवानी माध्यमिक विद्यालय ERP</h1>
      </div>
      <div style="padding:28px;background:#fff;">
        <h2 style="color:#1a237e;margin:0 0 12px;">Profile Updated 📝</h2>
        <p style="color:#555;">Dear <strong>${teacher.name}</strong>, your profile has been updated by the Principal.</p>
        <div style="background:#fff8e1;border-left:4px solid #ffa000;border-radius:4px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#555;"><strong>Changes Made:</strong> ${updateDetails}</p>
        </div>
        <p style="color:#555;font-size:14px;">If you did not expect this change or have any questions, please contact the Principal's office.</p>
        <p style="color:#888;font-size:12px;margin-top:20px;padding-top:16px;border-top:1px solid #eee;">This is an automated message from तुलजाभवानी माध्यमिक विद्यालय ERP System.</p>
      </div>
    </div>
  `
});

const teacherPasswordResetEmail = (teacher, newPassword) => ({
  to: teacher.email,
  subject: 'Password Reset — तुलजाभवानी माध्यमिक विद्यालय ERP',
  html: `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1a237e,#283593);padding:28px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🔐</div>
        <h1 style="color:#fff;margin:0;font-size:20px;">Password Reset</h1>
      </div>
      <div style="padding:28px;background:#fff;">
        <h2 style="color:#1a237e;margin:0 0 12px;">Your Password Has Been Reset</h2>
        <p style="color:#555;">Dear <strong>${teacher.name}</strong>, your ERP system password has been reset by the Principal.</p>
        <div style="background:#f3f4f9;border-left:4px solid #1a237e;border-radius:6px;padding:20px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 8px;color:#666;font-size:13px;">Your New Password:</p>
          <code style="background:#fff;border:2px solid #c5cae9;padding:8px 20px;border-radius:6px;font-size:20px;font-weight:700;color:#c62828;letter-spacing:2px;">${newPassword}</code>
        </div>
        <div style="background:#ffebee;border-radius:6px;padding:14px;margin-bottom:20px;">
          <p style="margin:0;color:#c62828;font-size:13px;">🚨 <strong>Action Required:</strong> Please log in immediately and change this password to something only you know.</p>
        </div>
        <p style="color:#888;font-size:12px;margin-top:20px;padding-top:16px;border-top:1px solid #eee;">This is an automated message from तुलजाभवानी माध्यमिक विद्यालय ERP System.</p>
      </div>
    </div>
  `
});

module.exports = { sendEmail, teacherWelcomeEmail, teacherUpdateEmail, teacherPasswordResetEmail };
