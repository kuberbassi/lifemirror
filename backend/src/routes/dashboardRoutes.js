const express = require('express');
const router = express.Router();

// --- Robust Model Imports with Logging ---
// We wrap this in a try/catch to see if the files can even be found.
let Task, Bill, Asset, FitnessLog, MoodLog;
try {
    Task = require('../models/Task');
    if (!Task) console.error('❌ Model: Task is undefined after require.');
    
    Bill = require('../models/Bill');
    if (!Bill) console.error('❌ Model: Bill is undefined after require.');

    Asset = require('../models/Asset');
    if (!Asset) console.error('❌ Model: Asset is undefined after require.');

    FitnessLog = require('../models/FitnessLog');
    if (!FitnessLog) console.error('❌ Model: FitnessLog is undefined after require.');

    MoodLog = require('../models/MoodLog');
    if (!MoodLog) console.error('❌ Model: MoodLog is undefined after require.');

    console.log('✅ All models imported successfully.');

} catch (importError) {
    console.error('❌ FATAL ERROR DURING MODEL IMPORT:', importError);
    // This will help debug if a require path is wrong.
}
// -------------------------------------------


// GET all data for the authenticated user
router.get('/all', async (req, res) => {
    console.log('--- [Debug] /api/dashboard/all route handler triggered ---');
    try {
        const auth0Id = req.auth.sub;
        if (!auth0Id) {
            console.error('❌ [Debug] Auth0 ID (sub) not found on req.auth.payload.');
            return res.status(401).json({ message: 'User identifier not found in token.' });
        }
        console.log(`[Debug] Fetching data for auth0Id: ...${auth0Id.slice(-6)}`);


        // Get today's date string, e.g., "2025-10-27"
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const TODAY_DATE = `${year}-${month}-${day}`;
        console.log(`[Debug] Today's date set to: ${TODAY_DATE}`);


        // Fetch all data in parallel, but with individual try/catch
        console.log('[Debug] Starting parallel data fetch...');
        
        // Use Promise.allSettled to prevent one failure from crashing all queries.
        // We also add .exec() to make sure they are real promises.
        const results = await Promise.allSettled([
            Task.find({ auth0Id }).select('-auth0Id -__v').sort({ date: 1 }).exec(),
            Bill.find({ auth0Id }).select('-auth0Id -__v').sort({ dueDate: 1 }).exec(),
            Asset.find({ auth0Id }).select('-auth0Id -__v').sort({ type: 1 }).exec(),
            FitnessLog.find({ auth0Id }).select('-auth0Id -__v').sort({ date: -1, time: -1 }).exec(),
            MoodLog.find({ auth0Id }).select('-auth0Id -__v').sort({ date: -1 }).exec()
        ]);

        let tasks, bills, assets, fitnessLogs, moodLogs;
        
        if (results[0].status === 'fulfilled') {
            tasks = results[0].value;
            console.log(`✅ [Debug] Fetched ${tasks.length} tasks.`);
        } else {
            console.error('❌ [Debug] Error fetching Tasks:', results[0].reason);
            throw new Error(`Failed to fetch Tasks: ${results[0].reason.message}`);
        }

        if (results[1].status === 'fulfilled') {
            bills = results[1].value;
            console.log(`✅ [Debug] Fetched ${bills.length} bills.`);
        } else {
            console.error('❌ [Debug] Error fetching Bills:', results[1].reason);
            throw new Error(`Failed to fetch Bills: ${results[1].reason.message}`);
        }
        
        if (results[2].status === 'fulfilled') {
            assets = results[2].value;
            console.log(`✅ [Debug] Fetched ${assets.length} assets.`);
        } else {
            console.error('❌ [Debug] Error fetching Assets:', results[2].reason);
            throw new Error(`Failed to fetch Assets: ${results[2].reason.message}`);
        }

        if (results[3].status === 'fulfilled') {
            fitnessLogs = results[3].value;
            console.log(`✅ [Debug] Fetched ${fitnessLogs.length} fitness logs.`);
        } else {
            console.error('❌ [Debug] Error fetching FitnessLogs:', results[3].reason);
            throw new Error(`Failed to fetch FitnessLogs: ${results[3].reason.message}`);
        }

        if (results[4].status === 'fulfilled') {
            moodLogs = results[4].value;
            console.log(`✅ [Debug] Fetched ${moodLogs.length} mood logs.`);
        } else {
            console.error('❌ [Debug] Error fetching MoodLogs:', results[4].reason);
            throw new Error(`Failed to fetch MoodLogs: ${results[4].reason.message}`);
        }

        console.log('[Debug] All data fetched successfully.');
        
        // Create a placeholder mood entry if one doesn't exist for today
        let latestMood = moodLogs.length > 0 ? moodLogs[0] : null;
        if (!latestMood || (latestMood.date !== TODAY_DATE)) {
            console.log('[Debug] No mood log for today. Creating placeholder.');
            const placeholder = {
                _id: 'temp-mood',
                date: TODAY_DATE,
                mood: 2,
                note: 'Daily check-in pending.',
                stress: 45,
                isFinal: false
            };
            moodLogs.unshift(placeholder); // Add to the front
        } else {
            console.log('[Debug] Today\'s mood log already exists.');
        }

        console.log('--- [Debug] Sending 200 OK response ---');
        res.status(200).json({
            tasks,
            bills,
            assets,
            fitnessLogs,
            moodLogs
        });
    } catch (error) {
        // This is the block that is sending your 500 error.
        console.error('❌❌❌ [Debug] Error in /api/dashboard/all catch block: ❌❌❌', error.message);
        console.error(error); // Log the full error stack to the terminal
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

module.exports = router;