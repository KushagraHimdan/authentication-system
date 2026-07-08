import mongoose from "mongoose";
import config from "./config.js";
import dns from "dns";;

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function connectDB() {
    try {
        await mongoose.connect(config.MONGO_URI);
        console.log(`Database connected successfully`);
    } catch (err) {
        console.error(`Database connection error: `, err.message);
        process.exit(1); // stop the app if DB fails — don't run a server with no DB
    }
}

export default connectDB;