const express = require('express');
const FitnessLog = require('../models/FitnessLog');
const router = express.Router();

// GET all fitness logs for the user
router.get('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const logs = await FitnessLog.find({ auth0Id })
            .select('-auth0Id -__v')
            .sort({ date: -1, time: -1 });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST a new fitness log
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const newLog = new FitnessLog({
            ...req.body,
            auth0Id
        });
        await newLog.save();
        res.status(201).json({ 
            message: 'Log created successfully', 
            log: { ...newLog.toObject(), auth0Id: undefined, __v: undefined }
        });
    } catch (error) {
        res.status(400).json({ message: 'Invalid log data' });
    }
});

module.exports = router;