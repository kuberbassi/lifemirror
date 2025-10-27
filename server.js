// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // Ensure path is required

// Imports for JWT validation
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

// Import all API routes
const taskRoutes = require('./src/routes/taskRoutes');
const billRoutes = require('./src/routes/billRoutes');
const assetRoutes = require('./src/routes/assetRoutes');
const fitnessRoutes = require('./src/routes/fitnessRoutes');
const moodRoutes = require('./src/routes/moodRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

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
// 2.5. Static Frontend Server
// =======================================================

// 1. Serve specific vendor scripts first
// This ensures the request for the Auth0 SDK is handled correctly
// before the general static middleware.
app.get('/vendor/auth0-spa-js.production.js', (req, res) => {
    const auth0SdkPath = path.join(__dirname, 'node_modules', '@auth0', 'auth0-spa-js', 'dist', 'auth0-spa-js.production.js');
    res.type('application/javascript').sendFile(auth0SdkPath, (err) => {
        if (err) {
            console.error(`Auth0 SDK file not found at path: ${auth0SdkPath}. Did you run 'npm install @auth0/auth0-spa-js'?`);
            res.status(404).send('Auth0 SDK file not found.');
        }
    });
});

// 2. Serve the 'assets' folder (for your favicon)
// This makes files in the 'assets' directory available at '/assets'
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// 3. Serve the 'src' folder (for /js, /css)
// This is your general static handler for CSS and JS
app.use(express.static(path.join(__dirname, 'src')));

// 4. Intercept the root path to serve the login page
app.get('/', (req, res) => {
    // Redirect root to login.html within the 'src/pages' structure
    res.redirect('/login.html');
});

// Handle direct requests for HTML files (e.g., /tasks.html)
app.get('/:pageName.html', (req, res) => {
    // Basic validation for pageName
    const safePageName = req.params.pageName.replace(/[^a-z0-9\-_]/gi, '');
    if (safePageName !== req.params.pageName) {
        return res.status(403).send("Forbidden");
    }

    const pagePath = path.join(__dirname, 'src', 'pages', safePageName + '.html');

    res.sendFile(pagePath, (err) => {
        if (err) {
            // Handle cases where the specific page isn't found
            // You might want to serve a 404 page or redirect to index/login
            console.warn(`Page not found: ${pagePath}`);
            // Fallback for missing pages or login.html itself might need adjustment
            // depending on your desired behavior. For now, send 404.
            res.status(404).sendFile(path.join(__dirname, 'src', 'pages', '404.html'), (err404) => {
                 if(err404) res.status(404).send("Page not found"); // Simple text fallback if 404.html is also missing
            });
        }
    });
});

// =======================================================
// 2.6. Serve Vendor Scripts (Like Auth0 SDK) <<<< ADDED SECTION
// =======================================================
app.get('/vendor/auth0-spa-js.production.js', (req, res) => {
    // Construct the path to the file within node_modules
    const auth0SdkPath = path.join(__dirname, 'node_modules', '@auth0', 'auth0-spa-js', 'dist', 'auth0-spa-js.production.js');

    // Send the file, ensuring correct Content-Type
    res.type('application/javascript').sendFile(auth0SdkPath, (err) => {
        if (err) {
            console.error('Error sending Auth0 SDK file:', err);
            // Check if file exists to give a clearer error
            require('fs').access(auth0SdkPath, require('fs').constants.F_OK, (fsErr) => {
                if (fsErr) {
                    console.error(`Auth0 SDK file not found at path: ${auth0SdkPath}. Did you run 'npm install @auth0/auth0-spa-js'?`);
                }
                res.status(404).send('Auth0 SDK file not found.');
            });
        } else {
            console.log('Served Auth0 SDK file successfully.');
        }
    });
});


// =======================================================
// 3. Auth0 JWT Middleware (Backend Security)
// =======================================================
// Ensure required environment variables are set
if (!process.env.AUTH0_ISSUER_BASE_URL || !process.env.AUTH0_AUDIENCE) {
    console.error("FATAL ERROR: AUTH0_ISSUER_BASE_URL and/or AUTH0_AUDIENCE are not defined in the .env file.");
    process.exit(1);
}

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

// Global error handler specifically for JWT errors
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        console.warn(`[Auth Error] ${err.code}: ${err.message}. Request to: ${req.originalUrl}`);
        // Optionally provide more specific messages based on err.code
        // e.g., 'invalid_token', 'credentials_required'
        return res.status(401).send({ message: 'Unauthorized: Invalid token.' });
    }
    // Pass other errors along
    next(err);
});

// =======================================================
// 4. API Route Registration (Protected by Auth0)
// =======================================================
// Apply the checkJwt middleware BEFORE each protected route group
app.use('/api/tasks', checkJwt, taskRoutes);
app.use('/api/bills', checkJwt, billRoutes);
app.use('/api/assets', checkJwt, assetRoutes);
app.use('/api/fitness-logs', checkJwt, fitnessRoutes);
app.use('/api/mood-logs', checkJwt, moodRoutes);
app.use('/api/dashboard', checkJwt, dashboardRoutes);

// =======================================================
// 5. Catch-all for API routes not found (after protected routes)
// =======================================================
app.use('/api/*', (req, res) => {
    res.status(404).send({ message: 'API endpoint not found.' });
});

// =======================================================
// 6. Final Fallback / Start Server
// =======================================================
// Optional: Add a general error handler for other server errors
app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    res.status(500).send({ message: "Internal Server Error" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`🔗 Frontend running at http://localhost:${PORT}`);
    console.log(`🔑 Auth0 Audience: ${process.env.AUTH0_AUDIENCE}`);
    console.log(`🔑 Auth0 Issuer Base URL: ${process.env.AUTH0_ISSUER_BASE_URL}`);
});