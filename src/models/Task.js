const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    // CRITICAL: Auth0 user ID (sub field in JWT) for multi-tenancy/security
    auth0Id: {
        type: String,
        required: true,
        index: true
    },
    text: {
        type: String,
        required: true,
        trim: true // Removes whitespace from both ends of a string
    },
    priority: {
        type: String,
        // Enforce that priority can only be one of these values, matching frontend logic
        enum: ['low', 'medium', 'high', 'meeting', 'holiday'], 
        default: 'medium'
    },
    date: {
        type: String, // Stored as 'YYYY-MM-DD' string for easy sorting and comparison
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        // Enforce task type, matching frontend logic
        enum: ['task', 'meeting', 'holiday'],
        default: 'task'
    }
}, {
    // Adds 'createdAt' and 'updatedAt' fields automatically
    timestamps: true 
});

module.exports = mongoose.model('Task', TaskSchema);