import userModel from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import sessionModel from "../models/session.model.js";
import { sendEmail } from "../services/email.service.js";
import { generateOtp, getOtpHtml } from "../utils/utils.js";
import otpModel from "../models/otp.model.js";

// Registers a new user, hashes their password, sends an OTP for email verification
export async function register(req, res) {
    try {
        const { username, email, password } = req.body;

        const isAlreadyRegistered = await userModel.findOne({
            $or: [
                { username },
                { email }
            ]
        });

        if (isAlreadyRegistered) {
            return res.status(409).json({
                message: "Username or email already exist"
            });
        }

        const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");

        const user = await userModel.create({
            username,
            email,
            password: hashedPassword
        });

        const otp = generateOtp();
        const html = getOtpHtml(otp);

        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
        await otpModel.create({
            email,
            user: user._id,
            otpHash
        });

        await sendEmail(email, "OTP Verification", `Your OTP code is ${otp}`, html);

        res.status(201).json({
            message: "User registered successfully",
            user: {
                username: user.username,
                email: user.email,
                verified: user.verified,
            },
        });
    } catch (error) {
        console.error("register error:", error);
        res.status(500).json({ message: "Something went wrong during registration" });
    }
}

// Logs in a verified user, creates a session, and issues access + refresh tokens
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (!user.verified) {
            return res.status(401).json({
                message: "Email not verified"
            });
        }

        const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");

        const isPasswordValid = hashedPassword === user.password;

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const refreshToken = jwt.sign({
            id: user._id
        }, config.JWT_SECRET, {
            expiresIn: "7d"
        });

        const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const session = await sessionModel.create({
            user: user._id,
            refreshTokenHash,
            ip: req.ip,
            userAgent: req.headers["user-agent"]
        });

        const accessToken = jwt.sign({
            id: user._id,
            sessionId: session._id,
        }, config.JWT_SECRET,
            {
                expiresIn: "15m"
            });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({
            message: "logged in successfully",
            user: {
                username: user.username,
                email: user.email,
            },
            accessToken,

        });
    } catch (error) {
        console.error("login error:", error);
        res.status(500).json({ message: "Something went wrong during login" });
    }
}

// Returns the currently logged-in user's info, based on their access token
export async function getMe(req, res) {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Token not found"
            });
        }

        const decoded = jwt.verify(token, config.JWT_SECRET);

        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "user fetched successfully",
            user: {
                username: user.username,
                email: user.email,
            }
        });
    } catch (error) {
        console.error("getMe error:", error);
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

// Issues a new access token (and rotates the refresh token) using the refresh token cookie
export async function refreshToken(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                message: "Refresh token not found"
            })
        }

        const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

        const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const session = await sessionModel.findOne({
            refreshTokenHash,
            revoked: false
        });

        if (!session) {
            return res.status(401).json({
                message: "Invalid refresh token"
            });
        }

        const accessToken = jwt.sign({
            id: decoded.id
        }, config.JWT_SECRET, {
            expiresIn: "15m"
        });

        const newRefreshToken = jwt.sign({
            id: decoded.id
        }, config.JWT_SECRET, {
            expiresIn: "7d"
        });

        const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");
        session.refreshTokenHash = newRefreshTokenHash;
        await session.save();

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(200).json({
            message: "Access token refreshed successfully",
            accessToken
        });
    } catch (error) {
        console.error("refreshToken error:", error);
        res.status(401).json({ message: "Invalid or expired refresh token" });
    }
}

// Logs the user out of the current device by revoking its session
export async function logout(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                message: "Refresh token not found"
            });
        }

        const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

        const session = await sessionModel.findOne({
            refreshTokenHash,
            revoked: false
        });

        if (!session) {
            return res.status(400).json({
                message: "Invalid refresh token"
            });
        }

        session.revoked = true;
        await session.save();

        res.clearCookie("refreshToken");

        return res.status(200).json({
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("logout error:", error);
        res.status(500).json({ message: "Something went wrong during logout" });
    }
}

// Logs the user out of all devices by revoking every active session for that user
export async function logoutAll(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                message: "Refresh token not found"
            });
        }

        const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

        await sessionModel.updateMany({
            user: decoded.id,
            revoked: false
        }, {
            revoked: true
        });

        res.clearCookie("refreshToken");

        return res.status(200).json({
            message: "Logged out successfully from all devices"
        });
    } catch (error) {
        console.error("logoutAll error:", error);
        res.status(401).json({ message: "Invalid or expired refresh token" });
    }
}

// Verifies a user's email using the OTP sent to them, and marks their account as verified
export async function verifyEmail(req, res) {
    try {
        const { otp, email } = req.body;

        if (!otp || !email) {
            return res.status(400).json({
                message: "Email and OTP are required"
            });
        }

        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

        const otpDoc = await otpModel.findOne({
            email,
            otpHash
        });

        if (!otpDoc) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        const user = await userModel.findByIdAndUpdate(otpDoc.user, {
            verified: true
        });

        await otpModel.deleteMany({
            user: otpDoc.user
        });

        return res.status(200).json({
            message: "Email verified successfully",
            user: {
                username: user.username,
                email: user.email,
                verified: user.verified
            },
        });
    } catch (error) {
        console.error("verifyEmail error:", error);
        res.status(500).json({ message: "Something went wrong during email verification" });
    }
}