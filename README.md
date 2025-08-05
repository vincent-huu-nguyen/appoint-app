# Appoint-App 📅

**Appoint-App** is a full-featured appointment booking web application built with React, TypeScript, TailwindCSS, and Firebase. It’s designed to help small businesses, like salons and personal service providers, manage customer bookings while giving users a smooth experience to browse services and book appointments online.

---

## 🌟 Features

### 🔒 Authentication & Roles
- Firebase Authentication for secure login
- Separate dashboard views for:
  - **Customers**: Browse service businesses and book appointments
  - **Business Owners**: Manage services, appointments, and profile info

### 🛍️ Business Profiles
- Public-facing business profiles with:
  - Cover photo, bio, address, and contact info
  - List of services and pricing
  - Profile picture support with upload capability

### 📅 Booking System
- Select service, date, and time with real-time availability checks
- Prevents overlapping appointments
- Automatically stores appointment info in Firestore

### 🧑‍💼 Business Dashboard
- Add, edit, or remove services
- Manage booked appointments
- Update business profile and profile picture

### 🌐 Customer Dashboard
- View upcoming and past bookings
- Edit or cancel appointments
- Browse list of available businesses

### 📱 Responsive Design
- Fully responsive layout using TailwindCSS for seamless use across desktop, tablet, and mobile

---

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend / DB**: Firebase (Authentication, Firestore, Storage)
- **Routing**: React Router DOM
- **Date Selection**: `react-datepicker`
- **Image Uploads**: Firebase Storage + FileReader
