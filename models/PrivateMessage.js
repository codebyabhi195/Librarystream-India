const mongoose = require('mongoose');

const PrivateMessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    isRead: { type: Boolean, default: false }, // For notification dot
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrivateMessage', PrivateMessageSchema);