const express = require('express');
const Asset = require('../models/Asset');
const router = express.Router();

// GET all assets for the user
router.get('/', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const assets = await Asset.find({ auth0Id })
            .select('-auth0Id -__v')
            .sort({ type: 1, name: 1 });
        res.status(200).json(assets);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST a new asset
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const newAsset = new Asset({
            ...req.body,
            auth0Id
        });
        await newAsset.save();
        res.status(201).json({ 
            message: 'Asset created successfully', 
            asset: { ...newAsset.toObject(), auth0Id: undefined, __v: undefined }
        });
    } catch (error) {
        res.status(400).json({ message: 'Invalid asset data' });
    }
});

// PUT (update) an existing asset
router.put('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const assetId = req.params.id;
        const updateData = req.body;

        const updatedAsset = await Asset.findOneAndUpdate(
            { _id: assetId, auth0Id },
            updateData,
            { new: true, runValidators: true }
        ).select('-auth0Id -__v');

        if (!updatedAsset) {
            return res.status(404).json({ message: 'Asset not found or unauthorized' });
        }
        res.status(200).json(updatedAsset);
    } catch (error) {
        res.status(400).json({ message: 'Invalid update data' });
    }
});

// DELETE an asset
router.delete('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const assetId = req.params.id;

        const result = await Asset.findOneAndDelete({ _id: assetId, auth0Id });

        if (!result) {
            return res.status(404).json({ message: 'Asset not found or unauthorized' });
        }
        res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;