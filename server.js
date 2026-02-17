const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); // Limit badhaya taaki Photo Upload ho sake
app.use(express.static('Public')); // Frontend folder

// --- MODELS & AUTH ---
const User = require('./models/User'); 
const Message = require('./models/Message'); 
const PrivateMessage = require('./models/PrivateMessage');

// 💰 NEW: Doubt Bounty Schema
const BountySchema = new mongoose.Schema({
    question: String,
    asker: String,
    bountyPoints: Number,
    answers: [{ solver: String, reply: String }]
});
const Bounty = mongoose.model('Bounty', BountySchema);

// Auth Middleware (Ise yahi define kar diya taaki alag file ka jhanjhat na ho)
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).send("Access Denied");
    try {
        const verified = jwt.verify(token, 'SecretKey123');
        req.user = verified.id;
        next();
    } catch (err) { res.status(400).send("Invalid Token"); }
};

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/studystream")
    .then(() => console.log("MongoDB Connected! ✅"))
    .catch((err) => console.log("DB Error: ❌", err));

// ==============================================
// 1. AUTHENTICATION (Signup/Login/Reset)
// ==============================================
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password, state } = req.body;
        const existing = await User.findOne({ email });
        if(existing) return res.status(400).send("Email already exists");

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ 
            username, email, password: hashedPassword, state: state || "India", 
            studyPoints: 0, attendance: [new Date().toDateString()], lastLogin: new Date().toDateString(),
            lastSeen: new Date(), profilePic: ""
        });
        await newUser.save();
        res.status(201).send("Account Created!");
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ message: "Invalid Credentials" });
        
        const token = jwt.sign({ id: user._id }, 'SecretKey123', { expiresIn: '24h' });
        res.json({ token });
    } catch (err) { res.status(500).send("Login error"); }
});

app.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).send("User not found");
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.send("Password Reset Successful!");
    } catch (err) { res.status(500).send("Error"); }
});

// ==============================================
// 2. CORE FEATURES (Profile, Pic, Exam, Heartbeat)
// ==============================================
app.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user).select('-password');
        const today = new Date().toDateString();
        
        if (user.lastLogin !== today) {
            user.studyPoints += 20; 
            user.lastLogin = today;
            if (!user.attendance.includes(today)) user.attendance.push(today);
            await user.save();
        }
        res.json(user);
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/upload-pic', auth, async (req, res) => {
    try {
        const { image } = req.body;
        await User.findByIdAndUpdate(req.user, { profilePic: image });
        res.sendStatus(200);
    } catch (err) { res.status(500).send("Error uploading"); }
});

app.post('/update-exam', auth, async (req, res) => {
    try {
        const { examName, examDate } = req.body;
        await User.findByIdAndUpdate(req.user, { examName, examDate });
        res.sendStatus(200);
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/heartbeat', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user, { lastSeen: new Date() });
        res.sendStatus(200);
    } catch (err) { res.sendStatus(500); }
});

app.get('/online-count', async (req, res) => {
    try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const count = await User.countDocuments({ lastSeen: { $gte: fiveMinAgo } });
        res.json({ count: count + 42 }); // +42 for motivation
    } catch (err) { res.json({ count: 0 }); }
});

// ==============================================
// 3. GAMIFICATION & TOOLS (Tasks, Notes, Leaderboard)
// ==============================================
app.get('/leaderboard', async (req, res) => {
    const { state } = req.query;
    let query = (state && state !== "All") ? { state } : {};
    const top = await User.find(query).select('username studyPoints state _id').sort({ studyPoints: -1 }).limit(10);
    res.json(top);
});

app.get('/tasks', auth, async (req, res) => {
    const user = await User.findById(req.user);
    res.json(user.tasks || []);
});
app.post('/tasks', auth, async (req, res) => {
    await User.findByIdAndUpdate(req.user, { tasks: req.body.tasks });
    res.send("Saved");
});

app.get('/notes', auth, async (req, res) => {
    const user = await User.findById(req.user);
    res.json({ notes: user.notes || "" });
});
app.post('/notes', auth, async (req, res) => {
    await User.findByIdAndUpdate(req.user, { notes: req.body.notes });
    res.send("Saved");
});

// ==============================================
// 4. CHAT SYSTEM (Group & Private)
// ==============================================
app.get('/messages/:room', auth, async (req, res) => {
    const msgs = await Message.find({ room: req.params.room }).sort({ timestamp: -1 }).limit(50);
    res.json(msgs.reverse());
});
app.post('/messages', auth, async (req, res) => {
    const user = await User.findById(req.user);
    const msg = new Message({ username: user.username, text: req.body.text, room: req.body.room });
    await msg.save(); 
    res.json(msg);
});

app.post('/direct-message', auth, async (req, res) => {
    const msg = new PrivateMessage({ sender: req.user, recipient: req.body.recipientId, text: req.body.text });
    await msg.save(); res.json(msg);
});
app.get('/direct-messages/:id', auth, async (req, res) => {
    const chat = await PrivateMessage.find({ 
        $or: [{sender: req.user, recipient: req.params.id}, {sender: req.params.id, recipient: req.user}] 
    }).sort({timestamp:1});
    res.json(chat);
});

app.get('/notifications/unread', auth, async (req, res) => {
    const count = await PrivateMessage.countDocuments({ recipient: req.user, isRead: false });
    res.json({ count });
});

// ==============================================
// 5. ADMIN PANEL & SETTINGS
// ==============================================
const checkAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user);
        if (user.email === "admin@studystream.com") next();
        else res.status(403).send("Access Denied");
    } catch (err) { res.status(401).send("Unauthorized"); }
};

app.get('/admin/users', auth, checkAdmin, async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
});
app.delete('/admin/delete/:id', auth, checkAdmin, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.send("User Banned!");
});

app.post('/update-profile', auth, async (req, res) => {
    try {
        const { username, state } = req.body;
        await User.findByIdAndUpdate(req.user, { username, state });
        res.sendStatus(200);
    } catch (err) { res.status(500).send("Error updating profile"); }
});

app.post('/change-password', auth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(req.user, { password: hashedPassword });
        res.sendStatus(200);
    } catch (err) { res.status(500).send("Error changing password"); }
});

app.delete('/delete-account', auth, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user);
        res.sendStatus(200);
    } catch (err) { res.status(500).send("Error deleting account"); }
});

// ==============================================
// 6. AI MENTOR (Gemini API)
// ==============================================
app.post('/ask-ai', auth, async (req, res) => {
    try {
        const userPrompt = req.body.prompt;
        const API_KEY = process.env.GEMINI_API_KEY; // 🔒 Ab key direct Render se aayegi!

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Act as a helpful Indian study mentor. Answer in Hinglish. Keep it short. Student: " + userPrompt }]
                }]
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return res.json({ text: "Error: " + data.error.message });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, koi jawab nahi mila.";
        res.json({ text: aiText });

    } catch (err) {
        console.error("❌ Server Error:", err);
        res.status(500).json({ text: "Server Error: Connection failed." });
    }
});

// ==============================================
// 8. DAILY VOCAB & INTERVIEW PREP
// ==============================================
app.get('/daily-vocab', auth, (req, res) => {
    const todayVocab = [
        { word: "Meticulous", meaning: "Dhyan se kaam karne wala (Careful)", synonym: "Precise", antonym: "Careless" },
        { word: "Resilient", meaning: "Mushkil se jaldi ubharne wala", synonym: "Tough", antonym: "Fragile" },
        { word: "Candid", meaning: "Sacha aur spasht (Honest)", synonym: "Frank", antonym: "Deceitful" },
        { word: "Pragmatic", meaning: "Vyavaharik (Practical)", synonym: "Realistic", antonym: "Idealistic" },
        { word: "Eloquent", meaning: "Achha bolne wala (Fluent in speaking)", synonym: "Articulate", antonym: "Inarticulate" }
    ];
    const todayTask = "DSA Challenge: Write a C++ program to Reverse a Linked List.";
    res.json({ vocab: todayVocab, task: todayTask });
});

// ==============================================
// 9. DOUBT BOUNTY SYSTEM 💰
// ==============================================
app.get('/bounties', async (req, res) => {
    try {
        const bounties = await Bounty.find().sort({ _id: -1 }).limit(10);
        res.json(bounties);
    } catch(err) { res.status(500).send("Error"); }
});

app.post('/bounties', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user);
        const pointsToDeduct = parseInt(req.body.points);
        
        if(user.studyPoints < pointsToDeduct) {
            return res.status(400).json({ error: "Bhai, itne points nahi hain tumhare paas!" });
        }
        
        user.studyPoints -= pointsToDeduct;
        await user.save();

        const newBounty = new Bounty({ 
            question: req.body.question, 
            asker: user.username, 
            bountyPoints: pointsToDeduct 
        });
        await newBounty.save();
        
        res.json({ success: true, remainingPoints: user.studyPoints });
    } catch(err) { res.status(500).send("Error"); }
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));