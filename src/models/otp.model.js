import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"]
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "User is required"]
    },
    otpHash: {
        type: String,
        required: [true, "OTP hash is required"]
    },
    // Auto-deletes this document 5 minutes (300 seconds) after creation
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300
    }
}, {
    timestamps: { createdAt: false, updatedAt: true }
    // createdAt is defined manually above so the TTL index can be attached to it;
    // updatedAt is still handled automatically by timestamps.
});

const otpModel = mongoose.model("otps", otpSchema);

export default otpModel;