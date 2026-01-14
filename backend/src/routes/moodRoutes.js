const express = require('express');
const MoodLog = require('../models/MoodLog');
const router = express.Router();

// GET all mood logs for the user
router.get('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const logs = await MoodLog.find({ auth0Id })
            .select('-auth0Id -__v')
            .sort({ date: -1 });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST (Upsert) a new mood log
// This will update today's log if it exists and isn't final,
// or create a new one.
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const { date, mood, note, stress, isFinal } = req.body;

        // Try to find and update an existing non-final log for today
        const updatedLog = await MoodLog.findOneAndUpdate(
            { 
                auth0Id, 
                date,
                isFinal: false // Only update if it's the "placeholder"
            },
            {
                mood,
                note,
                stress,
                isFinal
            },
            { new: true, runValidators: true }
        ).select('-auth0Id -__v');

        if (updatedLog) {
            // Found and updated the placeholder
            return res.status(200).json(updatedLog);
        }

        // If no placeholder was found, create a new log
        // This will fail if a *final* log for today already exists (due to the unique index)
        const newLog = new MoodLog({
            auth0Id,
            date,
            mood,
            note,
            stress,
            isFinal
        });
        await newLog.save();
        res.status(201).json({ ...newLog.toObject(), auth0Id: undefined, __v: undefined });

    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'A final mood log for this date already exists.' });
        }
        res.status(400).json({ message: 'Invalid log data' });
    }
});

module.exports = router;