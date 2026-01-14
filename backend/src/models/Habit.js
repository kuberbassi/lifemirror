const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema({
    auth0Id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    streak: { type: Number, default: 0 },
    completedDates: [{ type: String }] // Stores 'YYYY-MM-DD' strings
}, { timestamps: true });

module.exports = mongoose.models.Habit || mongoose.model('Habit', HabitSchema);
