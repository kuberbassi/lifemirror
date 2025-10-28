/*
 * ========================================
 * LifeMirror MONGODB SEEDER SCRIPT (v2 - 30 Days)
 * ========================================
 *
 * This script injects 30 days of mock data for 2 users
 * for presentation purposes.
 *
 * TO RUN:
 * 1. npm install mongodb dotenv
 * 2. node seed.js
 *
 */

require('dotenv').config(); // This loads your .env file
const { MongoClient } = require('mongodb');

// ================================================================
// ⬇️ 1. CONFIGURE YOUR DETAILS HERE ⬇️
// ================================================================

const CONFIG = {
    // ✅ This will now be read automatically from your .env file
    MONGO_URI: process.env.MONGO_URI, 

    // 💡 FIX #1: Pointing the seeder to your 'test' database
    DB_NAME: "test", 

    // 💡 FIX #2: Corrected your Auth0 ID (3068 instead of 3066)
    USER_ONE_AUTH_ID: "google-oauth2|114177825713068485063", // Kuber Bassi
    USER_TWO_AUTH_ID: "google-oauth2|109860976003764099748"  // Smarth Sharma
};

// ================================================================
// ⬆️ 1. CONFIGURE YOUR DETAILS HERE ⬆️
// ================================================================


// --- Helper Functions ---

/** Gets a date string 'YYYY-MM-DD' for 'dayOffset' days ago (0 = today) */
const getDateString = (dayOffset) => {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    return date.toISOString().split('T')[0];
};

/** Gets a random time string 'HH:MM' */
const getRandomTime = () => {
    const hour = Math.floor(Math.random() * 12 + 8).toString().padStart(2, '0'); // 8am - 8pm
    const minute = Math.floor(Math.random() * 60).toString().padStart(2, '0');
    return `${hour}:${minute}`;
};

/** Generates a random integer between min and max (inclusive) */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;


// --- Mock Data Generation ---

/**
 * Generates a full 30-day data profile for a user
 * @param {string} auth0Id - The user's Auth0 ID
 * @param {'dev' | 'fitness'} profileType - The type of profile to generate
 */
const generateMockData = (auth0Id, profileType) => {
    console.log(`- Generating 30 DAYS of data for ${profileType} profile...`);
    let data = {
        tasks: [],
        bills: [],
        assets: [],
        fitnessLogs: [],
        moodLogs: []
    };

    // --- Profile 1: Kuber (Busy Developer/Student) ---
    if (profileType === 'dev') {
        data.tasks = [
            { auth0Id, text: "Complete API endpoints for LifeMirror", priority: 'high', date: getDateString(0), type: 'task', completed: false },
            { auth0Id, text: "Debug login page CSS error", priority: 'high', date: getDateString(1), type: 'task', completed: true },
            { auth0Id, text: "Practice guitar scales (Funk)", priority: 'medium', date: getDateString(1), type: 'task', completed: true },
            { auth0Id, text: "Buy groceries for the week", priority: 'low', date: getDateString(2), type: 'task', completed: false },
            { auth0Id, text: "Research AI agents paper", priority: 'medium', date: getDateString(3), type: 'task', completed: true },
            { auth0Id, text: "Monthly project review", priority: 'medium', date: getDateString(28), type: 'task', completed: true },
        ];
        data.bills = [
            // Subscriptions
            { auth0Id, name: "Spotify Premium", amount: 129, dueDate: getDateString(-3), frequency: 'monthly', paymentLink: "https://spotify.com", icon: "music", paid: false },
            { auth0Id, name: "Netflix", amount: 499, dueDate: getDateString(5), frequency: 'monthly', paymentLink: "https://netflix.com", icon: "tv", paid: true },
            { auth0Id, name: "AWS (Personal)", amount: 850, dueDate: getDateString(2), frequency: 'monthly', paymentLink: "https://aws.amazon.com", icon: "server", paid: false }, // Overdue!
            { auth0Id, name: "Vercel Pro", amount: 1500, dueDate: getDateString(10), frequency: 'monthly', paymentLink: "https://vercel.com", icon: "globe", paid: false },
        ];
        data.assets = [
            { auth0Id, name: "GitHub Repo - LifeMirror", type: 'Dev', icon: 'code', url: 'https://github.com' },
            { auth0Id, name: "Figma Designs", type: 'Design', icon: 'layout', url: 'https://figma.com' },
            { auth0Id, name: "Cory Wong Funk Riffs", type: 'Creative', icon: 'music', url: 'https://youtube.com' },
            { auth0Id, name: "LinkedIn Profile", type: 'Social', icon: 'linkedin', url: 'https://linkedin.com' },
            { auth0Id, name: "Twitter / X", type: 'Social', icon: 'twitter', url: 'https://x.com' },
        ];
        
        // 30 Days of History
        for (let i = 29; i >= 0; i--) {
            let date = getDateString(i);
            // Mood: Once per day
            let stress = randInt(45, 75); // Higher stress
            let mood = (stress > 60) ? 2 : 3; // Neutral or Happy
            data.moodLogs.push({ auth0Id, date, mood, stress, note: "Busy with project work.", isFinal: true });

            // Fitness: Multiple logs per day
            data.fitnessLogs.push({ auth0Id, date, time: '09:00', type: 'steps', value: randInt(5000, 8000), unit: 'steps' });
            data.fitnessLogs.push({ auth0Id, date, time: '10:00', type: 'water_intake', value: 500, unit: 'ml' });
            data.fitnessLogs.push({ auth0Id, date, time: '14:00', type: 'water_intake', value: 500, unit: 'ml' });
            data.fitnessLogs.push({ auth0Id, date, time: '18:00', type: 'water_intake', value: 500, unit: 'ml' });
            data.fitnessLogs.push({ auth0Id, date, time: '23:00', type: 'sleep', value: randInt(6, 8), unit: 'hours' }); // 6-8 hrs
            data.fitnessLogs.push({ auth0Id, date, time: '19:00', type: 'calories_out', value: randInt(1800, 2200), unit: 'kcal' });
            
            if (i % 3 === 0) { // Workout every 3 days
                data.fitnessLogs.push({ auth0Id, date, time: '18:00', type: 'workout', value: 45, unit: 'min' });
            }
        }
    }

    // --- Profile 2: Smarth (Fitness Enthusiast) ---
    if (profileType === 'fitness') {
        data.tasks = [
            { auth0Id, text: "Morning Run - 5k", priority: 'medium', date: getDateString(0), type: 'task', completed: true },
            { auth0Id, text: "Meal prep for 3 days", priority: 'medium', date: getDateString(0), type: 'task', completed: false },
            { auth0Id, text: "Call Mom", priority: 'low', date: getDateString(1), type: 'task', completed: true },
            { auth0Id, text: "Buy new running shoes", priority: 'low', date: getDateString(3), type: 'task', completed: false },
        ];
        data.bills = [
            // Subscriptions
            { auth0Id, name: "Gym Membership", amount: 2000, dueDate: getDateString(-5), frequency: 'monthly', paymentLink: "https://cult.fit", icon: "activity", paid: false },
            { auth0Id, name: "Phone Bill", amount: 399, dueDate: getDateString(-2), frequency: 'monthly', paymentLink: "https://airtel.in", icon: "smartphone", paid: true },
            { auth0Id, name: "HealthifyMe", amount: 799, dueDate: getDateString(8), frequency: 'monthly', paymentLink: "https://healthifyme.com", icon: "heart", paid: false },
        ];
        data.assets = [
            { auth0Id, name: "MyFitnessPal", type: 'Health', icon: 'bar-chart-2', url: 'https://myfitnesspal.com' },
            { auth0Id, name: "Gym Workout Plan", type: 'Health', icon: 'check-square', url: 'https://docs.google.com' },
            { auth0Id, name: "Instagram", type: 'Social', icon: 'instagram', url: 'https://instagram.com' },
        ];
        
        // 30 Days of History
        for (let i = 29; i >= 0; i--) {
            let date = getDateString(i);
            // Mood: Once per day
            let stress = randInt(20, 40); // Lower stress
            let mood = randInt(3, 4); // Happy or Great
            data.moodLogs.push({ auth0Id, date, mood, stress, note: "Feeling energetic!", isFinal: true });

            // Fitness: Multiple logs per day
            data.fitnessLogs.push({ auth0Id, date, time: '07:00', type: 'steps', value: randInt(10000, 15000), unit: 'steps' });
            data.fitnessLogs.push({ auth0Id, date, time: '09:00', type: 'water_intake', value: 1000, unit: 'ml' });
            data.fitnessLogs.push({ auth0Id, date, time: '13:00', type: 'water_intake', value: 1000, unit: 'ml' });
            data.fitnessLogs.push({ auth0Id, date, time: '17:00', type: 'water_intake', value: 1000, unit: 'ml' });
            data.fitnessLogs.push({ auth0Id, date, time: '22:00', type: 'sleep', value: randInt(7, 9), unit: 'hours' }); // 7-9 hrs
            data.fitnessLogs.push({ auth0Id, date, time: '18:00', type: 'calories_out', value: randInt(2500, 3000), unit: 'kcal' });
            
            if (i % 2 === 0) { // Workout every 2 days
                data.fitnessLogs.push({ auth0Id, date, time: '17:00', type: 'workout', value: 60, unit: 'min' });
            }
        }
    }

    // Add random times to all fitness logs
    data.fitnessLogs.forEach(log => {
        if (!log.time) log.time = getRandomTime();
    });

    return data;
};


// --- Main Seeder Function ---

async function seedDatabase() {
    // Check config
    // 💡 FIX: Updated validation check
    if (!CONFIG.MONGO_URI || !CONFIG.MONGO_URI.startsWith('mongodb')) {
        console.error('❌ ERROR: Please make sure your MONGO_URI is set correctly in your .env file!');
        return;
    }

    const client = new MongoClient(CONFIG.MONGO_URI);
    console.log('Connecting to MongoDB...');
    try {
        await client.connect();
        const db = client.db(CONFIG.DB_NAME);
        console.log(`✅ Connected successfully to database: ${CONFIG.DB_NAME}`);

        // Get collections (they will be created if they don't exist)
        // 💡 FIX: Using correct collection names (no hyphens)
        const tasksCol = db.collection('tasks');
        const billsCol = db.collection('bills');
        const assetsCol = db.collection('assets');
        const fitnessLogsCol = db.collection('fitnesslogs'); // NO HYPHEN
        const moodLogsCol = db.collection('moodlogs');     // NO HYPHEN

        // --- 1. Clear Old Mock Data ---
        console.log('🧹 Clearing old data for mock users...');
        const userIds = [CONFIG.USER_ONE_AUTH_ID, CONFIG.USER_TWO_AUTH_ID];
        const taskDel = await tasksCol.deleteMany({ auth0Id: { $in: userIds } });
        const billDel = await billsCol.deleteMany({ auth0Id: { $in: userIds } });
        const assetDel = await assetsCol.deleteMany({ auth0Id: { $in: userIds } });
        const fitDel = await fitnessLogsCol.deleteMany({ auth0Id: { $in: userIds } });
        const moodDel = await moodLogsCol.deleteMany({ auth0Id: { $in: userIds } });
        console.log(`- Deleted ${taskDel.deletedCount} tasks, ${billDel.deletedCount} bills, ${assetDel.deletedCount} assets, ${fitDel.deletedCount} fitnesslogs, ${moodDel.deletedCount} moodlogs.`);

        // --- 2. Generate New Data ---
        console.log('🌱 Generating new 30-DAY mock data...');
        const userOneData = generateMockData(CONFIG.USER_ONE_AUTH_ID, 'dev');
        const userTwoData = generateMockData(CONFIG.USER_TWO_AUTH_ID, 'fitness');

        // --- 3. Insert New Data ---
        console.log('📥 Inserting data for User 1 (Dev Profile)...');
        if (userOneData.tasks.length > 0) await tasksCol.insertMany(userOneData.tasks);
        if (userOneData.bills.length > 0) await billsCol.insertMany(userOneData.bills);
        if (userOneData.assets.length > 0) await assetsCol.insertMany(userOneData.assets);
        if (userOneData.fitnessLogs.length > 0) await fitnessLogsCol.insertMany(userOneData.fitnessLogs);
        if (userOneData.moodLogs.length > 0) await moodLogsCol.insertMany(userOneData.moodLogs);
        console.log('- User 1 data inserted.');

        console.log('📥 Inserting data for User 2 (Fitness Profile)...');
        if (userTwoData.tasks.length > 0) await tasksCol.insertMany(userTwoData.tasks);
        if (userTwoData.bills.length > 0) await billsCol.insertMany(userTwoData.bills);
        if (userTwoData.assets.length > 0) await assetsCol.insertMany(userTwoData.assets);
        if (userTwoData.fitnessLogs.length > 0) await fitnessLogsCol.insertMany(userTwoData.fitnessLogs);
        if (userTwoData.moodLogs.length > 0) await moodLogsCol.insertMany(userTwoData.moodLogs);
        console.log('- User 2 data inserted.');

        console.log('\n✨✨✨ Database 30-DAY seeding complete! ✨✨✨');

    } catch (err) {
        console.error('An error occurred during seeding:', err);
    } finally {
        await client.close();
        console.log('Connection closed.');
    }
}

// --- Execute ---
seedDatabase();