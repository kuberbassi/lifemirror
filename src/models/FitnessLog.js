const mongoose = require('mongoose');

const FitnessLogSchema = new mongoose.Schema({
    auth0Id: { type: String, required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    time: { type: String, required: true }, // 'HH:MM'
    type: {
        type: String,
        enum: ['steps', 'workout', 'sleep', 'calories_out', 'water_intake'],
        required: true
    },
    value: { type: Number, required: true },
    unit: { type: String, required: true }
}, { timestamps: true });

// Indexing for faster queries by date
FitnessLogSchema.index({ auth0Id: 1, date: -1 });

module.exports = mongoose.models.FitnessLog || mongoose.model('FitnessLog', FitnessLogSchema);