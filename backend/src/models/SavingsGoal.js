const mongoose = require('mongoose');

const SavingsGoalSchema = new mongoose.Schema({
    auth0Id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: String } // Optional 'YYYY-MM-DD'
}, { timestamps: true });

module.exports = mongoose.models.SavingsGoal || mongoose.model('SavingsGoal', SavingsGoalSchema);
