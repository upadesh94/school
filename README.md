# 🎓 Riya International School — ERP System

A complete school management ERP built with **Node.js**, **Express**, **MongoDB**, **ERP**, **JWT Auth**, and **Nodemailer**.

---

## 📁 Project Structure

```
school-erp/
├── app.js                    # Main Express app entry point
├── .env                      # Environment variables (configure this!)
├── package.json
├── config/
│   └── db.js                 # MongoDB connection
├── models/
│   ├── Admin.js              # Admin (Principal) model with bcrypt
│   ├── Teacher.js            # Teacher model with bcrypt + auto Employee ID
│   ├── Student.js            # Student model with all TC fields
│   └── ActivityLog.js        # Audit trail for all actions
├── middleware/
│   ├── auth.js               # JWT protect middleware (admin + teacher)
│   └── upload.js             # Multer: photo & Excel file uploads
├── routes/
│   ├── auth.js               # Login / Logout routes
│   ├── admin.js              # All admin panel routes
│   └── teacher.js            # All teacher panel routes
├── utils/
│   ├── jwtHelper.js          # generateToken / verifyToken
│   ├── mailer.js             # Nodemailer email templates
│   └── seedAdmin.js          # Run once to create admin account
├── views/
│   ├── auth/login.ejs        # Login page (role tabs)
│   ├── admin/                # Admin panel views
│   ├── teacher/              # Teacher panel views
│   └── partials/             # Shared sidebars + head
└── public/
    ├── css/admin.css         # Full stylesheet (Navy + Gold theme)
    └── uploads/              # Photo + Excel uploads
```

---

## 🚀 Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env` file:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/school_erp
JWT_SECRET=your_very_secure_secret_here
SESSION_SECRET=your_session_secret_here

# Admin Login
ADMIN_USERNAME=principal
ADMIN_PASSWORD=Admin@123
ADMIN_EMAIL=principal@riyaschool.com

# Gmail SMTP (use App Password, not real Gmail password)
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_16_char_app_password
```

### 3. Start MongoDB
```bash
mongod
```

### 4. Start the App
```bash
npm start        # Production
npm run dev      # Development (with nodemon)
```

### 5. Open Browser
```
http://localhost:3000
```
Admin auto-creates on first startup. Login: `principal / Admin@123`

---

## 🔐 Authentication

- **JWT Tokens** stored in **HTTP-only cookies** + session
- **bcryptjs** hashing (salt rounds: 12)
- Protected routes via middleware (`protectAdmin`, `protectTeacher`)
- Auto redirect if already logged in

---

## 📊 Admin Panel Features

| Feature | Route |
|---------|-------|
| Dashboard with stats | `/admin/dashboard` |
| Add/Edit/Delete Teachers | `/admin/teachers` |
| Reset Teacher Password (email) | POST `/admin/teachers/reset-password/:id` |
| View All Students Class-wise | `/admin/students` |
| View Student Details | `/admin/students/:id` |
| Activity Log (all changes) | `/admin/activities` |
| Profile + Password Update | `/admin/profile` |

---

## 👨‍🏫 Teacher Panel Features

| Feature | Route |
|---------|-------|
| Dashboard | `/teacher/dashboard` |
| Students Grid/List View | `/teacher/students` |
| Add Student (manual) | `/teacher/students/add` |
| Import via Excel | `/teacher/upload-excel` |
| Edit Student Details | `/teacher/students/:id/edit` |
| TC Preview + Print PDF | `/teacher/students/:id/tc` |
| Profile + Password Update | `/teacher/profile` |

---

## 📄 Transfer Certificate (TC)

The TC preview exactly matches the Riya International School format with all fields:
- Student personal & family details
- Date of birth (figures + words)
- Admission class & dates
- Last exam with result
- Subjects studied (5 slots)
- Promotion details
- Dues clearance
- Fee concession details
- Working days & attendance
- NCC/Scout/Guide
- Extra-curricular activities
- General conduct
- Reason for leaving
- Signature blocks (3)

**To save as PDF:** Open TC preview → Click Print → Save as PDF in browser dialog

---

## 📥 Excel Import Format

Required columns (case-insensitive):
```
Roll No | Name* | Father Name | Mother Name | DOB | Gender | 
Nationality | Category | Aadhar | Class* | Section | 
Admission Date | Parent Contact
```
`*` = Required

---

## 📧 Email Notifications (Nodemailer)

Emails are sent automatically when:
- ✅ Teacher is **added** (welcome email with credentials)
- ✅ Teacher profile is **updated** (change summary)
- ✅ Teacher password is **reset** (new password)

---

## 🎨 Design

- **Theme:** Deep Navy (`#0f1f3d`) + Antique Gold (`#c9a84c`)
- **Typography:** Playfair Display (headings) + DM Sans (body)
- **Layout:** Persistent sidebar + sticky topbar
- **Responsive:** Mobile-friendly with collapsible sidebar
