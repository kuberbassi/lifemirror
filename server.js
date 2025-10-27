// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // <-- ADDED: For serving static files

// Imports for JWT validation
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const taskRoutes = require('./src/routes/taskRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// =======================================================
// 1. MongoDB Connection
// =======================================================
if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in the .env file.");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected successfully.'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// =======================================================
// 2. Middleware Setup
// =======================================================
app.use(cors());
app.use(express.json());

// =======================================================
// 2.5. Static Frontend Server (CRITICAL FIX)
// =======================================================

// 2.5.1 Serve all static assets (CSS, JS, images, etc.) from the /src directory
app.use(express.static(path.join(__dirname, 'src')));

// 2.5.2 Route for specific pages (e.g., /tasks.html)
// This allows your JS to navigate directly via window.location.href = 'tasks.html'
// or for the server to resolve requests like http://localhost:5000/pages/index.html
app.get('/pages/:pageName', (req, res) => {
    const pagePath = path.join(__dirname, 'src', 'pages', req.params.pageName);
    res.sendFile(pagePath, (err) => {
        if (err) {
            // Optional: Log error or send a specific 404
            res.status(404).send("Page not found");
        }
    });
});

// 2.5.3 Root Route Override (SOLVES "Index of /" ERROR)
// When the browser hits http://localhost:5000/ (or any URL without a file extension)
// this serves the dashboard page.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'pages', 'index.html'));
});

// =======================================================
// 3. Auth0 JWT Middleware (Backend Security)
// =======================================================
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`
    }),
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
    algorithms: ['RS256']
});

// Global error handler for JWT check
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).send({ message: 'Invalid token: ' + err.message });
    }
    next(err);
});

// =======================================================
// 4. API Route Registration (Protected by Auth0)
// =======================================================
app.use('/api/tasks', checkJwt, taskRoutes);

// =======================================================
// 5. Start Server
// =======================================================
app.listen(PORT, () => {
    // NOTE: Application should now be accessed via http://localhost:5000/
    console.log(`Server listening on port ${PORT}`);
});