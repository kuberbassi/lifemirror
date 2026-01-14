// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import all API routes
const taskRoutes = require('./src/routes/taskRoutes');
const billRoutes = require('./src/routes/billRoutes');
const assetRoutes = require('./src/routes/assetRoutes');
const fitnessRoutes = require('./src/routes/fitnessRoutes');
const moodRoutes = require('./src/routes/moodRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const habitRoutes = require('./src/routes/habitRoutes'); // New Habit Routes
const savingsRoutes = require('./src/routes/savingsRoutes'); // New Savings Routes

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

// =======================================================
// 1. MongoDB Connection
// =======================================================
if (!MONGO_URI || MONGO_URI.includes('<username>')) {
    console.error("⚠️  WARNING: MONGO_URI is not defined or is valid in the .env file.");
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ MongoDB connected successfully.'))
        .catch(err => {
            console.error('❌ MongoDB connection error:', err.message);
        });
}

// =======================================================
// 2. Middleware Setup
// =======================================================
const allowedOrigins = [
    'http://localhost:5000',
    'http://localhost:5001',
    'http://localhost:5173',
    'https://lifemirror.vercel.app',
    /https:\/\/lifemirror(-[a-z0-9]+)?\.vercel\.app$/
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        let isAllowed = false;
        if (allowedOrigins.indexOf(origin) !== -1) {
            isAllowed = true;
        }
        if (!isAllowed) {
            for (const allowedOrigin of allowedOrigins) {
                if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
                    isAllowed = true;
                    break;
                }
            }
        }
        if (!isAllowed) {
            return callback(new Error('CORS blocked this origin.'), false);
        }
        return callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
    res.send("LifeMirror Backend API is running.");
});

// =======================================================
// 3. API Route Registration (Protected by Google Auth)
// =======================================================
const verifyGoogleToken = require('./src/middleware/auth');

app.use('/api/tasks', verifyGoogleToken, taskRoutes);
app.use('/api/bills', verifyGoogleToken, billRoutes);
app.use('/api/assets', verifyGoogleToken, assetRoutes);
app.use('/api/fitness-logs', verifyGoogleToken, fitnessRoutes);
app.use('/api/mood-logs', verifyGoogleToken, moodRoutes);
app.use('/api/dashboard', verifyGoogleToken, dashboardRoutes);
app.use('/api/habits', verifyGoogleToken, habitRoutes); // Register Habit Routes
app.use('/api/savings', verifyGoogleToken, savingsRoutes); // Register Savings Routes

// =======================================================
// 4. Start Server
// =======================================================
app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    res.status(500).send({ message: "Internal Server Error" });
});


// ... (Routes)

// Export for Vercel
module.exports = app;

// Start Server (Only if not in Vercel/Serverless environment)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server listening on port ${PORT}`);
    });
}
