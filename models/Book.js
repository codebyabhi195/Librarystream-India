const mongoose = require('mongoose');

// Book ka naksha (Schema)
const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },  // Book ka naam
    author: { type: String, required: true }, // Author ka naam
    isAvailable: { type: Boolean, default: true } // Book abhi library mein hai ya nahi
});

module.exports = mongoose.model('Book', bookSchema);