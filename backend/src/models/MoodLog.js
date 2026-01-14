const mongoose = require('mongoose');

const MoodLogSchema = new mongoose.Schema({
    auth0Id: { type: String, required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    mood: { type: Number, required: true }, // 0=awful, 1=sad, 2=neutral, 3=happy, 4=great
    note: { type: String, trim: true },
    stress: { type: Number, required: true }, // 0-100
    isFinal: { type: Boolean, default: false } // To mark the one "official" log per day
}, { timestamps: true });

// Unique index to enforce one final log per user per day
MoodLogSchema.index({ auth0Id: 1, date: 1, isFinal: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.MoodLog || mongoose.model('MoodLog', MoodLogSchema);