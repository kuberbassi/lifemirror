const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
    auth0Id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true }, // e.g., 'Social', 'Dev', 'Video'
    icon: { type: String, required: true }, // e.g., 'instagram', 'github'
    url: { type: String, required: true, trim: true }
}, { timestamps: true });

module.exports = mongoose.models.Asset || mongoose.model('Asset', AssetSchema);