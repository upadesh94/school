# 🎓 Riya International School — ERP System

A complete school management ERP built with **Node.js**, **Express**, **Firebase Firestore**, **ERP**, **JWT Auth**, and **Nodemailer**.

---

## 📁 Project Structure

```
school-erp/
├── app.js                    # Main Express app entry point
├── .env                      # Environment variables (configure this!)
├── package.json
├── config/
│   └── db.js                 # Firebase Firestore initialization
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
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccountKey.json
# OR
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id"}

# Firebase Web Config (required for Firebase Auth sign-in)
FIREBASE_API_KEY=your_firebase_web_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id

JWT_SECRET=your_very_secure_secret_here
SESSION_SECRET=your_session_secret_here

# Demo Principal (Firebase Auth)
DEMO_PRINCIPAL_EMAIL=principle@gmail.com
DEMO_PRINCIPAL_PASSWORD=123123
DEMO_PRINCIPAL_NAME=Principal Demo
DEMO_PRINCIPAL_USERNAME=principal

# Gmail SMTP (use App Password, not real Gmail password)
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_16_char_app_password
```

### 3. Configure Firebase Admin credentials
Download your Firebase service account JSON and either:
- set `GOOGLE_APPLICATION_CREDENTIALS` to that file path, or
- set `FIREBASE_SERVICE_ACCOUNT_KEY` with JSON content in one line.

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
Principal demo account auto-creates in Firebase Auth on first startup.
Login: `principle@gmail.com / 123123`

---

## 🔐 Authentication

- **Firebase Auth** validates Principal credentials (email + password)
- **JWT Tokens** stored in **HTTP-only cookies** + session
- **bcryptjs** hashing remains for local teacher/admin profile data
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
