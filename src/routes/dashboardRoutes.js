const express = require('express');
const Task = require('../models/Task');
const Bill = require('../models/Bill');
const Asset = require('../models/Asset');
const FitnessLog = require('../models/FitnessLog');
const MoodLog = require('../models/MoodLog');
const router = express.Router();

// GET all data for the authenticated user
router.get('/all', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;

        // Get today's date string, e.g., "2025-10-27"
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const TODAY_DATE = `${year}-${month}-${day}`;

        // Fetch all data in parallel for speed
        const [tasks, bills, assets, fitnessLogs, moodLogs] = await Promise.all([
            Task.find({ auth0Id }).select('-auth0Id -__v').sort({ date: 1 }),
            Bill.find({ auth0Id }).select('-auth0Id -__v').sort({ dueDate: 1 }),
            Asset.find({ auth0Id }).select('-auth0Id -__v').sort({ type: 1 }),
            FitnessLog.find({ auth0Id }).select('-auth0Id -__v').sort({ date: -1, time: -1 }),
            MoodLog.find({ auth0Id }).select('-auth0Id -__v').sort({ date: -1 })
        ]);

        
        // Create a placeholder mood entry if one doesn't exist for today
        let latestMood = moodLogs.length > 0 ? moodLogs[0] : null;
        if (!latestMood || (latestMood.date !== TODAY_DATE)) {
            const placeholder = {
                _id: 'temp-mood',
                date: TODAY_DATE,
                mood: 2,
                note: 'Daily check-in pending.',
                stress: 45,
                isFinal: false
            };
            moodLogs.unshift(placeholder); // Add to the front
        }

        res.status(200).json({
            tasks,
            bills,
            assets,
            fitnessLogs,
            moodLogs
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;