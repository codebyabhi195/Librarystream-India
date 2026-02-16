// 1. Mongoose ko sabse upar declare kiya taaki ReferenceError na aaye
const mongoose = require('mongoose'); 

const UserSchema = new mongoose.Schema({
    // --- BASIC INFO ---
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    state: { type: String, default: "India" }, // Leaderboard ke liye
    profilePic: { type: String, default: "" }, // Base64 Photo String

    // --- GAMIFICATION & TRACKING ---
    studyPoints: { type: Number, default: 0 }, // Score
    attendance: { type: [String], default: [] }, // Calendar dots
    lastLogin: { type: String }, // Daily streak logic
    
    // --- TOOLS DATA ---
    tasks: { type: [String], default: [] }, // To-Do List
    notes: { type: String, default: "" }, // Auto-save Notepad

    // --- NEW FEATURES (Live Count & Exam Timer) ---
    lastSeen: { type: Date, default: Date.now }, // Heartbeat (Online Count)
    examName: { type: String, default: "" }, // Exam Name (e.g. JEE)
    examDate: { type: String, default: "" }  // Exam Date (Countdown)
});

module.exports = mongoose.model('User', UserSchema);