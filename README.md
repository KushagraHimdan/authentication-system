# Authentication System

A backend authentication system built with Node.js, Express, and MongoDB. Supports user registration with email OTP verification, JWT-based login sessions (access + refresh tokens), and multi-device session management.

## Features

- User registration with hashed passwords
- Email OTP verification (via Gmail, OAuth2)
- OTP auto-expires after 5 minutes
- Login with JWT access tokens (short-lived) and refresh tokens (long-lived, stored as httpOnly cookies)
- Refresh token rotation
- Logout from current device
- Logout from all devices (revokes all active sessions)
- Centralized error handling on all routes

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MongoDB (Mongoose)
- **Auth:** JSON Web Tokens (JWT)
- **Email:** Nodemailer (Gmail OAuth2)

## Project Structure

```
src/
├── config/        # Environment config & database connection
├── controllers/    # Route handlers (register, login, verify, etc.)
├── models/         # Mongoose schemas (user, session, otp)
├── routes/         # Express route definitions
├── services/        # Email sending service
└── utils/           # Helper functions (OTP generation, email templates)
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/auth-system.git
cd auth-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to a new file named `.env` and fill in your own values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `MONGO_URI` | Your MongoDB connection string |
| `JWT_SECRET` | Secret key used to sign JWTs |
| `GOOGLE_USER` | Gmail address used to send OTP emails |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth2 refresh token |

### 4. Run the server

```bash
npm start
```

The server will run on `http://localhost:3000` by default.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user, sends OTP to email |
| POST | `/api/auth/verify-email` | Verify email using OTP |
| POST | `/api/auth/login` | Log in and receive access + refresh tokens |
| GET | `/api/auth/get-me` | Get current logged-in user's info |
| GET | `/api/auth/refresh-token` | Get a new access token using refresh token cookie |
| GET | `/api/auth/logout` | Log out of current device |
| GET | `/api/auth/logout-all` | Log out of all devices |

## Notes

- Passwords are hashed before storage.
- OTPs are hashed before storage and automatically expire after 5 minutes.
- Refresh tokens are stored as `httpOnly` cookies for security.