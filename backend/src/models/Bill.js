const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
    auth0Id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    dueDate: { type: String, required: true }, // 'YYYY-MM-DD'
    frequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'annually', 'one-time'],
        default: 'one-time'
    },
    category: { type: String, default: 'Other Bill' },
    icon: { type: String, default: 'credit-card' },
    paymentLink: { type: String, trim: true },
    paid: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.Bill || mongoose.model('Bill', BillSchema);