/**
 * =================================================================================
 * SCRIPT.JS - LifeMirror SPA Core Logic
 * =================================================================================
 *
 * This script manages Auth0 authentication, API interaction, global state, SPA
 * navigation, and per-page logic for the LifeMirror application.
 *
 * NOTE: The final conflicting initialization blocks have been merged into a single,
 * robust, and reliable asynchronous execution flow (DOMContentLoaded listener).
 *
 * =================================================================================
 */

// ============================
// I. ENVIRONMENT CONFIG
// ============================

// Inject .env values into window for browser access (Defaults for local development)
window.AUTH0_DOMAIN = window.AUTH0_DOMAIN || "kuberbassi.us.auth0.com";
window.AUTH0_CLIENT_ID = window.AUTH0_CLIENT_ID || "nXisVu6Vmw1MI9xG2K0Uubupg1DNhx26";
window.AUTH0_AUDIENCE = window.AUTH0_AUDIENCE || "https://lifemirror-api.com";

// Backend base URL (auto for local or production)
window.API_BASE_URL = window.location.origin.includes('localhost')
    ? "http://localhost:5000/api" // FIX 1: Explicitly include /api in the base URL
    // 👇 CRITICAL CHANGE: Use the current origin for non-local deployment
    : window.location.origin + "/api";

// Central API URL helper
/**
 * Constructs the full API URL. Ensures the resource is appended with a trailing slash.
 */
function getApiUrl(resource) {
    // FIX 2: Only append the resource name and ensure a trailing slash.
    const cleanResource = resource.startsWith('/') ? resource.substring(1) : resource;
    const resourcePath = cleanResource.endsWith('/') ? cleanResource : cleanResource + '/'; // <--- THIS ADDS THE TRAILING SLASH

    return `${window.API_BASE_URL}/${resourcePath}`;
}

// Global Auth0 Constants (redundant but kept for explicit configuration functions)
const AUTH0_DOMAIN = window.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = window.AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = window.AUTH0_AUDIENCE;


// ===============================================
// II. GLOBAL STATE & CORE HELPERS
// ===============================================

let auth0 = null; // Holds the initialized Auth0 client (deprecated, use window.auth0Client)
let auth0Client; // Holds the initialized Auth0 client
var calendar = null; // Holds the FullCalendar instance
let sleepCheckInterval = null; // Placeholder for future use
let IS_SMART_NOTIFICATIONS_MOCK = true; // Placeholder for future use
let IS_NOTIFICATION_PANEL_OPEN = false;
let activeTimer = null; // Used for Mood page (meditation timer)

// --- GLOBAL CHART INSTANCES ---
let lifeScoreChartInstance = null;
let fitnessTrendChartInstance = null;
let moodTrendChartInstance = null;
let insightsTaskChartInstance = null; // For Insights page

// --- GLOBAL DATA STATE (Populated by API) ---
let taskState = [];
let billState = [];
let assetState = [];
let fitnessHistory = [];
let moodHistory = [];
let completedSuggestions = []; // For Fitness page UI state

// --- SPA STATE VARIABLES ---
let mainContentElement = null; // Holds the <main> element
let currentPageName = 'index.html'; // Tracks the active page
let isNavigating = false; // Prevents rapid double-clicks

// --- DATE HELPERS ---
const getTodayDateString = (date = new Date()) => { // Allow passing a date
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
const TODAY_DATE = getTodayDateString();

// --- MOOD MAP (Constant) ---
const moodMap = {
    'awful': { label: 'Awful', value: 0, color: 'var(--c-accent-red)' },
    'sad': { label: 'Sad', value: 1, color: 'var(--c-accent-yellow)' },
    'neutral': { label: 'Neutral', value: 2, color: 'var(--c-accent-yellow)' },
    'happy': { label: 'Happy', value: 3, color: 'var(--c-primary)' },
    'great': { label: 'Great', value: 4, color: 'var(--c-primary)' }
};

// --- Helper to generate profile pic ---
const generateInitials = (name, imgElement) => {
    if (!name || !imgElement) return;
    // Safely extract initials, using '??' as fallback for no name
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const parent = imgElement.parentNode;
    if (!parent) return;

    // Check if the current element is already the initialsDiv to prevent errors
    if (imgElement.classList?.contains('profile-pic-initials') && imgElement.textContent === initials) {
        return; // Already correct initials are displayed
    }

    const initialsDiv = document.createElement('div');
    initialsDiv.className = 'profile-pic-initials'; // You can style this
    Object.assign(initialsDiv.style, {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'var(--c-primary)',
        color: 'var(--c-text-dark)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: '600',
        fontSize: '16px',
        border: '2px solid var(--c-primary)',
        flexShrink: '0'
    });
    initialsDiv.textContent = initials;

    // Safely replace the element
    parent.replaceChild(initialsDiv, imgElement);
};

// --- Mongoose ObjectId Stub for basic validation ---
const mongoose = {
    Types: {
        ObjectId: {
            isValid: (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
        }
    }
};

// ===============================================
// III. AUTHENTICATION & TOKEN MANAGEMENT
// ===============================================

/**
 * Initializes Auth0 client and sets window.auth0Client.
 * Also loads the Auth0 SDK if it's missing (assumes /vendor/auth0-spa-js.production.js is the target).
 */
async function initAuth() {
    console.log("Phase 1: Initializing Auth...");

    // Load SDK if missing or if window.auth0 is not yet defined by a script tag
    if (typeof window.auth0 === "undefined" || !window.auth0 || !window.auth0.createAuth0Client) {
        console.log("Loading Auth0 SDK from CDN...");
        await new Promise((resolve) => {
            const s = document.createElement("script");
            s.src = "https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js";
            s.onload = resolve;
            // Fallback for failed CDN load (e.g., if you only serve from /vendor/)
            s.onerror = () => {
                console.warn("CDN load failed, trying local vendor path...");
                const localS = document.createElement("script");
                localS.src = "/vendor/auth0-spa-js.production.js";
                localS.onload = resolve;
                localS.onerror = () => {
                    console.error("Local SDK load also failed.");
                    resolve(); // Resolve anyway to not block the flow entirely
                };
                document.head.appendChild(localS);
            };
            document.head.appendChild(s);
        });
        // Check again after loading attempt
        if (typeof window.auth0 === "undefined" || !window.auth0 || !window.auth0.createAuth0Client) {
            throw new Error("Auth0 SDK failed to load.");
        }
    }

    const domain = window.AUTH0_DOMAIN;
    const clientId = window.AUTH0_CLIENT_ID;
    const audience = window.AUTH0_AUDIENCE;

    try {
        window.auth0Client = await window.auth0.createAuth0Client({
            domain,
            clientId,
            authorizationParams: {
                audience,
                redirect_uri: window.location.origin + '/index.html', // Always redirect to SPA root
            },
            useRefreshTokens: true,
            cacheLocation: "localstorage",
        });

        auth0Client = window.auth0Client; // Update local reference for convenience
        console.log("✅ Auth0 Client Initialized Successfully.");
        return window.auth0Client;
    } catch (err) {
        console.error("Auth0 initialization failed:", err);
        throw new Error("Auth0 initialization failed: " + err.message);
    }
}

/**
 * Ensures Auth0 client is ready (SDK loaded and client created) before proceeding.
 */
async function waitForAuth(timeout = 10000) { // 10s max wait
    const start = Date.now();

    while (true) {
        // Check for both Auth0 SDK and created client
        if (window.auth0Client) {
            // console.log("✅ Auth0 client ready for use.");
            return true;
        }

        if (Date.now() - start > timeout) {
            console.error("Auth0 client initialization timed out.");
            throw new Error("Auth0 client initialization timed out.");
        }

        console.warn("Auth0 client not initialized yet. Waiting...");
        await new Promise(r => setTimeout(r, 150));
    }
}


/**
 * Guard to ensure Auth0 client is initialized and user is logged in.
 * Use this *before* any action that requires authentication (API calls, tokens, user data).
 */
async function ensureAuthReady() {
    if (!window.auth0Client) {
        await waitForAuth();
    }

    const isAuth = await window.auth0Client.isAuthenticated();
    if (!isAuth) {
        console.warn("User not logged in. Redirecting...");
        // NEW: Capture current path for appState
        const targetPath = window.location.pathname;
        await window.auth0Client.loginWithRedirect({
            authorizationParams: {
                redirect_uri: window.location.origin + "/index.html",
                audience: AUTH0_AUDIENCE
            },
            appState: { targetPath } // Preserve the original path
        });
        // Throw an error to stop the execution flow immediately, as a redirect is happening
        throw new Error("Login required");
    }
}


/**
 * Retrieves the access token for API calls. Handles refresh/redirects gracefully.
 * This is the primary function for getting the token.
 */
async function getAccessToken() {
    // Ensure the client is ready and authenticated
    await ensureAuthReady(); // This throws 'Login required' if not authenticated

    try {
        const token = await window.auth0Client.getTokenSilently({
            authorizationParams: {
                audience: AUTH0_AUDIENCE
            }
        });

        if (!token) {
            console.error("getTokenSilently returned undefined or null.");
            throw new Error("Failed to obtain access token silently.");
        }

        // Cache token locally for non-Auth0 logic (e.g., in service layer)
        window.localStorage.setItem("lifemirror_access_token", token);
        return token;

    } catch (error) {
        // Handle common Auth0 re-login cases gracefully
        if (
            error.error === "login_required" ||
            error.error === "consent_required" ||
            error.error === "interaction_required"
        ) {
            console.log("Silent token acquisition failed — user must log in again.");
            // NEW: Capture current path for appState
            const targetPath = window.location.pathname;
            await window.auth0Client.loginWithRedirect({
                authorizationParams: {
                    redirect_uri: window.location.origin + "/index.html",
                    audience: AUTH0_AUDIENCE
                },
                appState: { targetPath } // Preserve the original path
            });
            throw new Error("Login required"); // Throw to stop flow
        }
    }
}


/**
 * Handles the redirect callback from Auth0 after login.
 * Returns true if a callback was processed and successful, false otherwise.
 */
const handleAuthCallback = async () => {
    if (!window.auth0Client) {
        console.warn("handleAuthCallback skipped: Auth0 client not initialized.");
        return false;
    }
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        console.log("Auth0 callback detected. Handling redirect...");
        try {
            // Process the callback and capture appState
            const result = await window.auth0Client.handleRedirectCallback();

            // NEW: Determine the target path: default to index.html or use appState
            const targetPath = result?.appState?.targetPath || '/index.html';
            const pageName = targetPath.split('/').pop() || 'index.html';

            console.log(`Auth0 callback handled successfully. Target path: ${targetPath}`);

            // **SPA Fix**: Clean URL after successful callback, using the target path
            window.history.replaceState({ page: pageName }, document.title, targetPath);
            console.log("URL cleaned.");

            window.appStateTargetPage = pageName; // NEW: Store the intended target page

            return true; // Indicate success
        } catch (err) {
            console.error("Error handling Auth0 callback:", err);
            return false; // Indicate failure
        }
    }
    return false; // No callback detected
};


/**
 * Logs the user out.
 */
const logout = () => {
    if (!window.auth0Client) {
        console.error("Auth0 client not initialized for logout.");
        alert("Logout failed: Authentication system not ready.");
        return;
    }
    console.log("Initiating logout...");
    try {
        // Clear local app state before redirecting (good practice)
        taskState = []; billState = []; assetState = []; fitnessHistory = []; moodHistory = [];
        window.localStorage.removeItem("lifemirror_access_token");
        console.log("Local state cleared.");

        window.auth0Client.logout({
            logoutParams: {
                returnTo: window.location.origin + '/login.html' // Redirect back to login page
            }
        });
        // Redirect happens via Auth0
    } catch (err) {
        console.error("Error initiating logout:", err);
        alert("Logout failed. Please try again or clear your browser's site data if the problem persists.");
    }
};


/**
 * Attaches login listener for the login.html page.
 */
function initializeLoginPage() {
    console.log("Initializing Login Page Logic...");
    const loginButton = document.getElementById('login-button');
    const loadingMessage = document.getElementById('loading-message');

    if (loginButton) {
        // Ensure only one listener is attached using cloneNode trick
        const newLoginButton = loginButton.cloneNode(true);
        loginButton.parentNode.replaceChild(newLoginButton, loginButton);

        newLoginButton.addEventListener('click', async () => {
            if (!window.auth0Client) {
                alert("Authentication client is not ready. Please refresh the page.");
                return;
            }
            if (loadingMessage) loadingMessage.style.display = 'block';
            newLoginButton.disabled = true;
            newLoginButton.innerHTML = '<i data-feather="loader" class="spin"></i> Signing In...';
            try { feather.replace(); } catch (e) { } // Render spinner icon

            try {
                await window.auth0Client.loginWithRedirect({
                    authorizationParams: {
                        redirect_uri: window.location.origin + '/index.html', // Ensure redirect to SPA root
                        audience: AUTH0_AUDIENCE
                    }
                });
                // Browser redirects, script execution effectively stops here for this page load
            } catch (err) {
                console.error("Error initiating login redirect:", err);
                if (loadingMessage) loadingMessage.style.display = 'none';
                newLoginButton.disabled = false;
                newLoginButton.innerHTML = '<i data-feather="log-in"></i> Sign In / Sign Up'; // Restore button text
                try { feather.replace(); } catch (e) { }
                alert("Error starting the login process. Please check the console for details.");
            }
        });
    } else {
        console.warn("Login button not found on login page.");
    }
}

// =======================================
// IV. TEMPORARY SESSION CACHE (Offline Writes)
// =======================================

// This stores unsynced user actions if backend is unreachable
const offlineCache = JSON.parse(localStorage.getItem("lifemirror_cache") || "{}");

// Save offline cache to localStorage
function saveCache() {
    localStorage.setItem("lifemirror_cache", JSON.stringify(offlineCache));
}

// Try sending cached actions back to server
async function flushCache() {
    const keys = Object.keys(offlineCache);
    if (keys.length === 0) return;

    // 1. CRITICAL CHECK: Ensure Auth is ready and user is logged in.
    // Use a try-catch on getAccessToken to fail gracefully if not ready/authenticated.
    let token;
    try {
        if (!window.auth0Client) {
            // console.log("⏳ Skipping cache flush — Auth0 client not ready yet.");
            return;
        }
        // Use the robust global function to get a fresh token.
        token = await getAccessToken();
    } catch (e) {
        if (e.message === 'Login required') {
            // This is expected if the user hasn't fully authenticated yet.
            // console.log("🔒 Skipping cache flush — login required.");
            return;
        }
        // For other silent token errors (network, etc.), skip flush but log.
        console.warn("Skipping cache flush: Failed to get token silently.", e.message);
        return;
    }

    if (!token) {
        console.warn("Skipping cache flush: Token is null after check.");
        return;
    }


    console.log("Flushing cached updates:", keys);

    for (const key of keys) {
        const { collectionName, action, payload, id } = offlineCache[key];
        const baseUrl = getApiUrl(collectionName); // Use the correct URL generation
        const url = id ? `${baseUrl}/${id}` : baseUrl;

        try {
            let res;
            if (action === "create") {
                res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(payload),
                });
            } else if (action === "update") {
                res = await fetch(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(payload),
                });
            } else if (action === "delete") {
                res = await fetch(url, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` },
                });
            } else {
                delete offlineCache[key]; // Remove unknown actions
                saveCache();
                continue;
            }

            if (!res.ok) {
                // Check specifically for the 404/400 range errors and skip deletion
                if (res.status >= 400 && res.status < 500) {
                    console.warn(`Still failing sync with HTTP ${res.status}. Action may be invalid/expired on server. Removing cache entry.`, url);
                    delete offlineCache[key];
                } else {
                    throw new Error(`HTTP ${res.status}`); // Re-throw for 5xx errors or network issues
                }
            } else {
                console.log(`✅ Successfully synced cached action: ${action} ${collectionName} ${id || ''}`);
                delete offlineCache[key]; // remove after success
            }

        } catch (err) {
            // Keep the item in cache if sync failed due to network or 5xx error
            console.warn("Still offline or failed to sync cached action:", err.message, key);
        }
    }

    saveCache();
}

// Retry syncing every 10s or when online again
// NOTE: This interval will now only proceed if Auth0 is ready (via getAccessToken check inside flushCache)
setInterval(flushCache, 10000);
window.addEventListener("online", flushCache);


// ===============================================
// V. API SERVICE LAYER
// ===============================================

/**
 * Creates a generic API service. Includes error handling and offline caching.
 */
function createApiService(resourceName, stateVarName) { // <<-- ADDED stateVarName
    // ✅ Match frontend names to backend route prefixes
    const routeMap = {
        'fitness-logs': 'fitness-logs',
        'mood-logs': 'mood-logs', // Use the full route prefix
        'tasks': 'tasks',
        'assets': 'assets',
        'bills': 'bills',
        'dashboard': 'dashboard'
    };

    const routeName = routeMap[resourceName] || resourceName;
    const baseUrl = `/api/${routeName}`;

    // --- ADDED: Define collectionName and stateVar from function arguments ---
    const collectionName = routeName;
    const stateVar = stateVarName;
    // ------------------------------------------------------------------------


    // Helper to safely get access token
    async function getAccessTokenInternal() {
        if (!window.auth0Client) {
            console.error("Auth0 client not initialized yet.");
            throw new Error("Login required");
        }
        return await getAccessToken();
    }

    // Centralized response handler
    const handleResponse = async (response, operation) => {
        if (!response.ok) {
            const status = response.status;
            let errorMsg = `HTTP error ${status} during ${operation} ${resourceName}`;
            try {
                const text = await response.text();
                errorMsg += `: ${text}`;
            } catch { /* Ignore if body is not text */ }
            console.error(errorMsg);

            if (status === 401 || status === 403) {
                showFlashMessage('Session expired. Please re-login.', 'log-out');
            }

            throw new Error(errorMsg);
        }

        if (response.status === 204) return true;

        try {
            return await response.json();
        } catch (jsonError) {
            return null;
        }
    };

    // Actual API methods
    const api = {
        async fetchAll() {
            try {
                const token = await getAccessTokenInternal();
                const res = await fetch(baseUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await handleResponse(res, "fetch");
                if (stateVar && Array.isArray(globalThis[stateVar])) {
                    globalThis[stateVar].splice(0, globalThis[stateVar].length, ...(data || []).map(d => ({ ...d, id: d._id })));
                }
                if (typeof renderFn === "function") renderFn();
                return data;
            } catch (err) {
                if (err.message === 'Login required') throw err;
                console.error(`Failed to fetch all ${resourceName}:`, err);
                throw err;
            }
        },

        async create(data) {
            try {
                const token = await getAccessTokenInternal();
                const res = await fetch(baseUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(data),
                });

                const created = await handleResponse(res, "create");
                return created;

            } catch (err) {
                if (err.message === 'Login required') throw err;

                if (err.message.includes('HTTP error 404') || err.message.includes('Network issue')) {
                    console.warn(`Network issue or 404 detected, caching action for ${resourceName}:`, err);
                    showFlashMessage('Offline or API endpoint not found. Will try syncing later.', 'cloud-off');

                    offlineCache[`create-${collectionName}-${Date.now()}`] = {
                        collectionName,
                        action: "create",
                        payload: data,
                    };
                    saveCache();
                } else {
                    console.error(`Failed to create ${resourceName}:`, err);
                }

                throw err;
            }
        },


        // 1. Fix api.update (around line 681)
        async update(id, data) {
            // FIX: Trim trailing slash from baseUrl before appending ID
            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const url = `${cleanBaseUrl}/${id}`; // CORRECT: /api/tasks/69050c...
            try {
                const token = await getAccessTokenInternal();
                const res = await fetch(url, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(data),
                });

                const updated = await handleResponse(res, "update");
                return updated;

            } catch (err) {
                if (err.message === 'Login required') throw err;

                if (err.message.includes('HTTP error 404') || err.message.includes('Network issue')) {
                    console.warn(`Network issue or 404 detected, caching update for ${resourceName} ID ${id}:`, err);
                    showFlashMessage('Offline or API endpoint not found. Will try syncing later.', 'cloud-off');

                    offlineCache[`update-${collectionName}-${id}`] = {
                        collectionName,
                        action: "update",
                        payload: data,
                        id,
                    };
                    saveCache();
                } else {
                    console.error(`Failed to update ${resourceName}:`, err);
                }

                throw err;
            }
        },

        // 2. Fix api.delete (around line 726)
        async delete(id) {
            // FIX: Trim trailing slash from baseUrl before appending ID
            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            const url = `${cleanBaseUrl}/${id}`; // CORRECT: /api/tasks/69050c...
            try {
                const token = await getAccessTokenInternal();
                const res = await fetch(url, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
                await handleResponse(res, "delete");
                return true;

            } catch (err) {
                if (err.message === 'Login required') throw err;

                if (err.message.includes('HTTP error 404') || err.message.includes('Network issue')) {
                    console.warn(`Network issue or 404 detected, caching delete for ${resourceName} ID ${id}:`, err);
                    showFlashMessage('Offline or API endpoint not found. Will try syncing later.', 'cloud-off');

                    offlineCache[`delete-${collectionName}-${id}`] = {
                        collectionName,
                        action: "delete",
                        id,
                    };
                    saveCache();
                } else {
                    console.error(`Failed to delete ${resourceName}:`, err);
                }

                throw err;
            }
        },


    };
    return api;
}


// Instantiate API services
const taskApiService = createApiService('tasks', 'taskState');
const billApiService = createApiService('bills', 'billState');
const assetApiService = createApiService('assets', 'assetState');
const fitnessApiService = createApiService('fitness-logs', 'fitnessHistory');
const moodApiService = createApiService('mood-logs', 'moodHistory');

const dashboardApiService = {
    async fetchAllData() {
        try {
            const token = await getAccessToken();
            // FIX: Use the new getApiUrl structure for the dashboard endpoint
            const response = await fetch(getApiUrl('dashboard/all'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const status = response.status;
                let errorMsg = `HTTP error ${status} during fetch dashboard data`;
                let errorDetails = response.statusText;
                try {
                    const errorBody = await response.json();
                    errorDetails = errorBody.message || JSON.stringify(errorBody);
                } catch (e) { /* Ignore if body isn't json */ }
                errorMsg += `: ${errorDetails}`;
                console.error('Fetch Dashboard failed:', errorMsg);
                if (status === 401 || status === 403) throw new Error('Unauthorized');
                throw new Error(errorMsg);
            }
            return await response.json();
        } catch (error) {
            if (error.message === 'Login required') throw error;
            console.error('API Error (Fetch Dashboard Data):', error.message);
            if (error.message !== 'Unauthorized') {
                showFlashMessage(`Error loading initial data. Check console.`, 'alert-triangle');
            }
            throw error;
        }
    }
};


// ===============================================
// VI. GLOBAL DATA SYNC & UTILITY FUNCTIONS
// ===============================================

/**
 * Helper to initialize page-specific logic based on the page name.
 * This function centralizes the logic for re-rendering the currently active page.
 */
async function initializePageLogic(pageName) {
    try {
        switch (pageName) {
            case 'index.html': if (typeof initializeDashboardPage === 'function') initializeDashboardPage(); break;
            case 'tasks.html': if (typeof initializeTasksPageLogic === 'function') initializeTasksPageLogic(); break;
            case 'finance.html': if (typeof initializeFinancePage === 'function') initializeFinancePage(); break;
            case 'fitness.html': if (typeof initializeFitnessPage === 'function') initializeFitnessPage(); break;
            case 'mood.html': if (typeof initializeMoodPage === 'function') initializeMoodPage(); break;
            case 'vault.html': if (typeof initializeVaultPage === 'function') initializeVaultPage(); break;
            case 'insights.html': if (typeof initializeInsightsPage === 'function') initializeInsightsPage(); break;
            case 'settings.html': if (typeof initializeSettingsPage === 'function') initializeSettingsPage(); break;
            default: console.warn(`[Init] No specific initialization logic found for page: ${pageName}`);
        }
    } catch (pageInitError) {
        console.error(`Error during JavaScript initialization for ${pageName}:`, pageInitError);
        // Do NOT re-throw here to prevent failing the parent refreshState function,
        // which would cause the error loop seen in the console.
        showFlashMessage(`Error setting up ${pageName} view. Check console.`, 'alert-triangle');
    }
}

/**
 * Fetches all data and populates global state. Runs ONCE after auth confirmed.
 */
async function syncApplicationState() {
    // Throws 'Login required' if not authenticated/ready
    await ensureAuthReady();
    console.log("Starting application state sync...");
    showFlashMessage('Syncing your data...', 'rotate-cw'); // Use loading icon

    try {
        const data = await dashboardApiService.fetchAllData(); // Fetch everything

        // Safely update global state, handling potential missing data fields
        taskState = (data?.tasks || []).map(t => ({ ...t, id: t._id }));
        billState = (data?.bills || []).map(b => ({ ...b, id: b._id }));
        assetState = (data?.assets || []).map(a => ({ ...a, id: a._id }));
        fitnessHistory = (data?.fitnessLogs || []).map(f => ({ ...f, id: f._id }));
        moodHistory = (data?.moodLogs || []).map(m => ({ ...m, id: m._id }));

        console.log(`✅ Application state synced: ${taskState.length} tasks, ${billState.length} bills, ${assetState.length} assets, ${fitnessHistory.length} fitness, ${moodHistory.length} mood.`);

        // Hide the "Syncing" message after success
        const syncMessages = document.querySelectorAll('#flash-message-container .flash-message');
        syncMessages.forEach(msg => {
            if (msg.textContent.includes('Syncing your data')) {
                msg.style.opacity = '0';
                setTimeout(() => msg.remove(), 500);
            }
        });

    } catch (error) {
        if (error.message === 'Login required') throw error;
        console.error('FATAL: Could not sync application state. The application might not function correctly.', error);
        showFlashMessage('Failed to load initial data. Please refresh.', 'alert-triangle');
    }
}


/**
 * Re-fetches one part of the state (e.g., tasks) and re-renders the *currently active view*.
 */
async function refreshState(stateName) {
    if (!window.auth0Client || !(await window.auth0Client.isAuthenticated())) {
        console.warn(`Refresh ${stateName} skipped: User not authenticated.`);
        return; // Stop if not authenticated
    }
    console.log(`Refreshing state for: ${stateName}...`);
    // NOTE: Flash message for refresh is usually too chatty, omitting unless needed.

    let service, stateVarName;
    try {
        switch (stateName) {
            case 'tasks': service = taskApiService; stateVarName = 'taskState'; break;
            case 'bills': service = billApiService; stateVarName = 'billState'; break;
            case 'assets': service = assetApiService; stateVarName = 'assetState'; break;
            case 'fitness': service = fitnessApiService; stateVarName = 'fitnessHistory'; break;
            case 'mood': service = moodApiService; stateVarName = 'moodHistory'; break;
            default:
                console.error(`Invalid state name provided to refreshState: ${stateName}`);
                return;
        }

        // --- Step 1: Fetch Data ---
        // The fetchAll method now updates the global state (e.g., taskState) internally.
        const data = await service.fetchAll();

        console.log(`✅ Refreshed state for: ${stateName}. Found ${globalThis[stateVarName]?.length || 0} items.`);

        // --- Step 2: Re-initialize Page Logic (Re-render UI) ---
        await initializePageLogic(currentPageName);

        // Ensure Feather icons are re-rendered after page re-init
        setTimeout(() => {
            try { feather.replace(); } catch (e) { }
        }, 50);

    } catch (error) {
        // --- Step 3: Global Error Handling ---
        // This catch block is responsible for the error shown in your image.
        // It catches errors thrown from the API service or from initializePageLogic.
        if (error.message === 'Login required') throw error; // Re-throw fatal auth error

        console.error(`❌ Failed to refresh state for ${stateName}.`, error);
        // The API service or initializePageLogic should already show a user-friendly error.

        // This is where line 819 was, ensure no further complex operations are here.
        // If the error came from initializePageLogic, it was already handled and logged.

        throw error; // Re-throw the error so the calling function (like toggleTaskCompleted) can handle it.
    }
}


/**
 * Shows a temporary flash notification message.
 */
function showFlashMessage(message, iconName = 'check-circle') {
    const container = document.getElementById('flash-message-container');
    if (!container) {
        console.warn("Flash message container not found.");
        return;
    }

    const flash = document.createElement('div');
    flash.className = 'flash-message';
    // Sanitize message basic HTML - replace < and > to prevent injection
    const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    flash.innerHTML = `<i data-feather="${iconName}"></i> <span>${safeMessage}</span>`;
    container.appendChild(flash);
    try { feather.replace(); } catch (e) { /* Ignore feather errors */ }

    // Animate in
    requestAnimationFrame(() => {
        flash.style.opacity = '1';
        flash.style.transform = 'translateY(0)';
    });


    // Auto-remove after a delay
    setTimeout(() => {
        if (container.contains(flash)) {
            flash.style.opacity = '0';
            flash.style.transform = 'translateY(10px)'; // Animate out
            // Remove from DOM after animation
            flash.addEventListener('transitionend', () => {
                if (container.contains(flash)) {
                    container.removeChild(flash);
                }
            }, { once: true }); // Ensure listener runs only once
        }
    }, 4500); // Start fade out slightly before 5s total duration
}


/**
 * Sets up modal interactions using event delegation. Should be called *once* per modal element ID.
 */
function setupModal(modalElement, openTriggers, closeTriggers, resetFn) {
    if (!modalElement) {
        // console.warn("setupModal failed: modalElement provided is null or undefined for triggers:", openTriggers);
        return { show: () => { }, hide: () => { } }; // Return dummy controls
    }
    const modalId = modalElement.id;
    if (!modalId) {
        console.error("setupModal requires the modalElement to have an ID.", modalElement);
        return { show: () => { }, hide: () => { } };
    }


    const show = () => {
        if (resetFn) {
            try { resetFn(); } catch (e) { console.error(`Error during modal reset for ${modalId}:`, e); }
        }
        modalElement.style.display = 'flex';
        // Add animation class - ensure CSS has @keyframes popIn
        const dialog = modalElement.querySelector('.modal-dialog');
        if (dialog) dialog.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        // console.log(`Modal shown: ${modalId}`);
    };

    const hide = () => {
        const dialog = modalElement.querySelector('.modal-dialog');
        // Add fade-out animation - ensure CSS has @keyframes popOut
        if (dialog) {
            dialog.style.animation = 'popOut 0.2s ease-out forwards';
            // Wait for animation before hiding
            setTimeout(() => {
                modalElement.style.display = 'none';
                dialog.style.animation = ''; // Reset for next time
            }, 200); // Match animation duration in CSS
        } else {
            modalElement.style.display = 'none'; // Hide immediately if no dialog found
        }
        // console.log(`Modal hidden: ${modalId}`);
    };

    // --- Event Listener Management using a global store ---
    // Use a unique key based on the modal ID to store/retrieve the listener
    const listenerKey = `_modalClickListener_${modalId}`;

    // Remove any previously attached listener for this specific modal ID
    if (globalThis[listenerKey]) {
        // console.log(`Removing previous listener for modal: ${modalId}`);
        document.removeEventListener('click', globalThis[listenerKey]);
        delete globalThis[listenerKey]; // Clean up the stored reference
    } else {
        // console.log(`No previous listener found for modal: ${modalId}, attaching new one.`);
    }


    // Define the new listener function
    const clickListener = (e) => {
        // Check for open triggers associated *with this modal instance*
        if (openTriggers.some(selector => e.target.closest(selector))) {
            // Prevent opening if another modal is already displayed
            const anyModalOpen = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (anyModalOpen && anyModalOpen !== modalElement) {
                // console.warn("Prevented opening modal - another modal is already open.");
                return;
            }
            // Only show if it's not already shown
            if (modalElement.style.display !== 'flex') {
                show();
            }
        }

        // Check for close triggers *within this specific modal instance*
        if (closeTriggers.some(selector => e.target.closest(selector) && e.target.closest('.modal-overlay') === modalElement)) {
            hide();
        }

        // Check for click directly on the overlay (background) *of this modal instance*
        if (e.target === modalElement) {
            hide();
        }
    };

    // Add the new listener to the document
    document.addEventListener('click', clickListener);
    // Store the listener function reference globally, associated with the modal ID
    globalThis[listenerKey] = clickListener;
    // console.log(`Attached new listener for modal: ${modalId}`);


    return { show, hide }; // Return controls
}



// --- Date & Automation Helpers ---
function calculateDueDays(dueDateString) {
    if (!dueDateString) return 999;
    try {
        const today = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z'); // Today at UTC midnight
        const due = new Date(dueDateString + 'T00:00:00Z'); // Due date at UTC midnight
        if (isNaN(due.getTime())) throw new Error("Invalid date string provided"); // Validate date
        const diffTime = due.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Calculate difference in days
    } catch (e) {
        console.error("Error calculating due days for:", dueDateString, e);
        return 999; // Return a high number on error
    }
}


function calculateNextDueDate(currentDueDate, frequency) {
    if (frequency === 'one-time') return null; // No next date for one-time
    try {
        const date = new Date(currentDueDate + 'T00:00:00Z'); // Parse as UTC date part
        if (isNaN(date.getTime())) throw new Error("Invalid current due date string"); // Validate date

        switch (frequency) {
            case 'monthly':
                date.setUTCMonth(date.getUTCMonth() + 1);
                break;
            case 'quarterly':
                date.setUTCMonth(date.getUTCMonth() + 3);
                break;
            case 'annually':
                date.setUTCFullYear(date.getUTCFullYear() + 1);
                break;
            default:
                console.warn(`Unknown frequency "${frequency}" in calculateNextDueDate.`);
                return currentDueDate; // Return original if frequency is unknown
        }

        // Format back to 'YYYY-MM-DD'
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error calculating next due date for:", currentDueDate, frequency, e);
        return currentDueDate; // Return original date on error
    }
}



// --- Notification Panel ---
function toggleNotificationPanel() {
    const panel = document.getElementById('global-notification-panel');
    if (!panel) return;
    const bellIconWrapper = document.querySelector('.global-controls .control-icon-wrapper');

    // Calculate position relative to the bell icon
    if (bellIconWrapper) {
        const rect = bellIconWrapper.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 12}px`;
        panel.style.right = `${window.innerWidth - rect.right - 10}px`; // Adjust alignment
    } else { // Fallback position if icon not found
        panel.style.top = '70px';
        panel.style.right = '40px';
    }

    IS_NOTIFICATION_PANEL_OPEN = !IS_NOTIFICATION_PANEL_OPEN;
    panel.classList.toggle('active', IS_NOTIFICATION_PANEL_OPEN); // Use class for visibility

    if (IS_NOTIFICATION_PANEL_OPEN) {
        renderNotificationPanel(panel); // Refresh content when opening
    }
}

function renderNotificationPanel(panel) {
    if (!panel) return;
    // Mock notifications - replace with dynamic data fetching/state later
    const notifications = [];

    // Add critical notifications based on state
    const overdueBills = (Array.isArray(billState) ? billState : []).filter(b => !b.paid && calculateDueDays(b.dueDate) < 0);
    overdueBills.forEach(bill => {
        notifications.push({ id: `bill-${bill.id}`, type: 'critical', text: `Bill "${bill.name}" is overdue!` });
    });
    // Add tasks due today
    const tasksDueToday = (Array.isArray(taskState) ? taskState : []).filter(t => t.type === 'task' && !t.completed && t.date === TODAY_DATE);
    tasksDueToday.forEach(task => {
        notifications.push({ id: `task-${task.id}`, type: 'low', text: `Task "${task.text}" due today.` });
    });

    panel.innerHTML = '<h4>Notifications</h4>'; // Set title

    if (notifications.length === 0) {
        panel.innerHTML += '<div class="notification-item-empty">No new notifications.</div>';
    } else {
        notifications.forEach(n => {
            const item = document.createElement('div');
            item.className = `notification-item ${n.type}`; // Add type class for styling
            // Sanitize text content
            const safeText = n.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            item.innerHTML = `
                <i data-feather="${n.type === 'critical' ? 'alert-triangle' : 'info'}"></i>
                <p>${safeText}</p>
            `;
            panel.appendChild(item);
        });
    }
    try { feather.replace(); } catch (e) { console.warn("Feather error in notification panel:", e); }
}

// --- Sleep Check (Placeholder) ---
function startSleepNotificationCheck() { console.log("Mock: Start Sleep Notification Check"); }

// --- Add Task from Vault ---
async function addNewTaskFromVault(text, duration) {
    // Duration isn't used in task creation currently, but kept for potential future use
    showFlashMessage(`Adding task: "${text}"...`, 'loader');
    try {
        const newTaskData = {
            text: text.trim(),
            priority: 'medium', // Default priority when added from Vault
            date: getTodayDateString(), // Default to today
            type: 'task'
        };
        const result = await taskApiService.create(newTaskData);
        // The API service handles the local state update for optimisim if offline
        showFlashMessage(`Task "${newTaskData.text}" added!`, 'check-square');
        await refreshState('tasks'); // Refresh the task list
    } catch (error) {
        console.error("Failed to add task from Vault.");
        // API service already logs and shows flash message
    }
}


/**
 * Updates global UI elements (clock, profile picture) after navigation or data changes.
 */
async function updateGlobalUIElements() {
    // --- Update Clock ---
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    // --- FIX: Re-attach Notification Bell Listener ---
    const bellIconWrapper = document.querySelector('.global-controls .control-icon-wrapper');
    if (bellIconWrapper && !bellIconWrapper._listenerAttached) {
        const newBellIconWrapper = bellIconWrapper.cloneNode(true);
        // Ensure the correct class is used for the bell wrapper
        newBellIconWrapper.className = bellIconWrapper.className;

        bellIconWrapper.parentNode.replaceChild(newBellIconWrapper, bellIconWrapper);
        newBellIconWrapper.addEventListener('click', toggleNotificationPanel);
        // Use a property on the parent to check if the listener is active
        newBellIconWrapper._listenerAttached = true;
    }

    // --- Profile Picture Update (Retains Google/Auth0 Picture) ---
    const profilePicContainer = document.querySelector('.global-controls');
    let profilePicElement = profilePicContainer?.querySelector('.profile-pic, .profile-pic-initials');

    if (profilePicElement) {
        try {
            // FIX: Added 'await' here for correctness.
            if (window.auth0Client && await window.auth0Client.isAuthenticated()) {
                const user = await window.auth0Client.getUser();

                if (user?.picture) {
                    if (profilePicElement.tagName === 'IMG' && profilePicElement.src === user.picture) {
                        // Already correct, do nothing
                    } else {
                        const newImg = (profilePicElement.tagName === 'IMG') ? profilePicElement : document.createElement('img');
                        newImg.className = 'profile-pic';
                        newImg.src = user.picture;
                        newImg.alt = "Profile";
                        newImg.onerror = () => {
                            generateInitials(user?.name || 'User', newImg);
                        };
                        if (profilePicElement !== newImg) {
                            profilePicContainer.replaceChild(newImg, profilePicElement);
                        }
                    }
                } else if (user?.name) {
                    generateInitials(user.name, profilePicElement);
                } else {
                    generateInitials('??', profilePicElement);
                }
            } else {
                // If not authenticated, ensure the element is a generic placeholder or initials '??'
                if (profilePicElement.tagName !== 'IMG' || profilePicElement.src) {
                    generateInitials('??', profilePicElement);
                }
            }
        } catch (e) {
            console.error("Error updating profile picture:", e);
            // Attempt fallback to initials even on error, if possible
            if (profilePicElement && window.auth0Client && await window.auth0Client.isAuthenticated()) {
                try {
                    const user = await window.auth0Client.getUser();
                    generateInitials(user?.name || '??', profilePicElement);
                } catch { }
            }
        }
    }
}

/**
 * Helper to initialize page-specific logic based on the page name.
 */
async function initializePageLogic(pageName) {
    try {
        switch (pageName) {
            case 'index.html': if (typeof initializeDashboardPage === 'function') initializeDashboardPage(); break;
            case 'tasks.html': if (typeof initializeTasksPageLogic === 'function') initializeTasksPageLogic(); break;
            case 'finance.html': if (typeof initializeFinancePage === 'function') initializeFinancePage(); break;
            case 'fitness.html': if (typeof initializeFitnessPage === 'function') initializeFitnessPage(); break;
            case 'mood.html': if (typeof initializeMoodPage === 'function') initializeMoodPage(); break;
            case 'vault.html': if (typeof initializeVaultPage === 'function') initializeVaultPage(); break;
            case 'insights.html': if (typeof initializeInsightsPage === 'function') initializeInsightsPage(); break;
            case 'settings.html': if (typeof initializeSettingsPage === 'function') initializeSettingsPage(); break;
            default: console.warn(`[Init] No specific initialization logic found for page: ${pageName}`);
        }
    } catch (pageInitError) {
        console.error(`Error during JavaScript initialization for ${pageName}:`, pageInitError);
        showFlashMessage(`Error setting up ${pageName}. Some features may not work. Check console.`, 'alert-triangle');
    }
}


// ===============================================
// VII. SPA NAVIGATION ENGINE
// ===============================================

/**
 * Fetches HTML content for a given page, injects its <main> content
 * into the current page, updates history, and initializes page-specific logic.
 */
async function navigateToPage(pageName, isInitialLoad = false) {
    // Prevent rapid double-clicks or concurrent navigations
    if (isNavigating) {
        console.warn(`Navigation to ${pageName} blocked: Navigation already in progress.`);
        return;
    }
    isNavigating = true;
    console.log(`Navigating to ${pageName}...`);

    // 1. Visual Feedback: Fade out current content
    if (mainContentElement) {
        mainContentElement.style.transition = 'opacity 0.15s ease-out';
        mainContentElement.style.opacity = '0.3'; // Fade to partial opacity
    }

    let pageContent = '';
    let success = false;

    try {
        // 2. Fetch New Page HTML
        // Add cache-busting query parameter to ensure fresh HTML is fetched
        const response = await fetch(`/${pageName}?v=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Could not load ${pageName}: ${response.status} ${response.statusText}`);
        }
        const htmlText = await response.text();

        // 3. Parse and Extract <main class="main-content">
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const newMain = doc.querySelector('.main-content');
        if (!newMain) {
            throw new Error(`<main class="main-content"> element not found in the fetched HTML for ${pageName}. Check the HTML file structure.`);
        }
        pageContent = newMain.innerHTML;
        success = true;

    } catch (error) {
        console.error("SPA Navigation failed:", error);
        showFlashMessage(`Error loading page content: ${error.message}`, 'alert-triangle');
        pageContent = `
            <section class="hero-header">
                <h2><i data-feather="alert-triangle"></i> Error Loading Page</h2>
                <p>Could not load content for ${pageName}. Please try again later.</p>
                <p style="font-size: 0.8em; color: var(--c-text-muted); margin-top: 10px;">Details: ${error.message}</p>
            </section>`;
        success = false;
    }

    // 4. Inject Content into the DOM
    if (mainContentElement) {
        mainContentElement.innerHTML = pageContent;
        mainContentElement.scrollTop = 0;
        setTimeout(() => { // Short delay allows content to render before fade-in
            mainContentElement.style.opacity = '1';
        }, 50);
    } else {
        console.error("CRITICAL: mainContentElement is null. Cannot inject page content.");
        isNavigating = false;
        return;
    }

    // 5. Update Global State (Current Page Name)
    currentPageName = pageName;

    // --- FIX: Force full data sync when navigating to the Dashboard ---
    if (pageName === 'index.html' && !isInitialLoad) {
        console.log("Dashboard navigation detected. Forcing full state sync.");
        // syncApplicationState() will re-fetch all 5 data streams (tasks, bills, etc.)
        await syncApplicationState();
    }

    // 6. Update Browser History/URL Bar
    if (!isInitialLoad) {
        window.history.pushState({ page: pageName }, '', '/' + pageName);
    }

    // 7. Update Sidebar Active State
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // 8. Destroy Previous Page's Chart Instances
    if (lifeScoreChartInstance) { lifeScoreChartInstance.destroy(); lifeScoreChartInstance = null; }
    if (fitnessTrendChartInstance) { fitnessTrendChartInstance.destroy(); fitnessTrendChartInstance = null; }
    if (moodTrendChartInstance) { moodTrendChartInstance.destroy(); moodTrendChartInstance = null; }
    if (globalThis.insightsTaskChartInstance) { globalThis.insightsTaskChartInstance.destroy(); globalThis.insightsTaskChartInstance = null; }

    // CRITICAL FIX: Ensure FullCalendar is destroyed and explicitly nulled.
    if (window.calendar) { // <-- This is the instance created on tasks.html reload
        console.log(`[Destroy] Destroying FullCalendar instance from ${currentPageName}.`);
        window.calendar.destroy(); // <--- Must call the library's destruction method
        window.calendar = null; // <--- Must explicitly null the global reference
    }

    // 9. Initialize Page-Specific JavaScript Logic for the *new* content
    console.log(`Initializing JS for ${pageName}...`);
    await initializePageLogic(pageName);

    // 10. Update Global UI Elements (Clock, Profile Pic)
    await updateGlobalUIElements();

    // 11. Re-render Feather Icons for the new content
    try { feather.replace(); } catch (e) { console.warn("Feather icon replacement failed after navigation:", e); }

    // 12. Release Navigation Lock
    isNavigating = false;
    console.log(`Navigation to ${pageName} complete.`);
}


// ===============================================
// VIII. DASHBOARD CORE LOGIC
// ===============================================

// Placeholder functions to ensure they exist before being assigned
let renderDashboardMetrics = () => { console.warn("renderDashboardMetrics called before assignment."); };
let updateLifeScore = () => { console.warn("updateLifeScore called before assignment."); };

function initializeDashboardPage() {
    console.log("Initializing Dashboard Page...");
    const lifeScoreElement = document.getElementById('life-score-number');

    // --- Local helper to update score display with animation ---
    updateLifeScore = (newScore) => {
        if (!lifeScoreElement) return;
        // Animate score change (optional, simple version)
        lifeScoreElement.textContent = Math.round(newScore); // Update immediately
        lifeScoreElement.classList.add('pop');
        // Remove class after animation to allow re-triggering
        setTimeout(() => lifeScoreElement.classList.remove('pop'), 300);
    };

    // --- Main Rendering Logic ---
    renderDashboardMetrics = () => {
        // console.log("Rendering Dashboard Metrics...");
        if (!mainContentElement) return; // Don't render if container isn't ready

        // --- 1. CALCULATE METRICS ---
        const safeTaskState = Array.isArray(taskState) ? taskState : [];
        const safeBillState = Array.isArray(billState) ? billState : [];
        const safeAssetState = Array.isArray(assetState) ? assetState : [];
        const safeFitnessHistory = Array.isArray(fitnessHistory) ? fitnessHistory : [];
        const safeMoodHistory = Array.isArray(moodHistory) ? moodHistory : [];

        // Task calculations
        const pendingTasks = safeTaskState.filter(t => t.type === 'task' && !t.completed);
        const completedTasks = safeTaskState.filter(t => t.type === 'task' && t.completed);
        const totalTasks = pendingTasks.length + completedTasks.length;
        const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 100;

        // Schedule items for today
        const scheduleItemsToday = safeTaskState.filter(item => item.date === TODAY_DATE);

        // Finance calculations
        const overdueBills = safeBillState.filter(b => !b.paid && calculateDueDays(b.dueDate) < 0);
        const totalDueAmountThisWeek = safeBillState
            .filter(b => !b.paid && calculateDueDays(b.dueDate) >= 0 && calculateDueDays(b.dueDate) <= 7)
            .reduce((sum, bill) => sum + (bill.amount || 0), 0);
        const paidBillsCount = safeBillState.filter(b => b.paid).length;
        const totalBillCount = safeBillState.length;
        const financialHealth = totalBillCount > 0 ? Math.round((paidBillsCount / totalBillCount) * 100) : 100;
        const activeSubscriptionTotal = safeBillState
            .filter(b => b.frequency !== 'one-time' && !b.paid)
            .reduce((sum, bill) => sum + (bill.amount || 0), 0);

        // Fitness calculations
        const totalStepsToday = safeFitnessHistory
            .filter(log => log.date === TODAY_DATE && log.type === 'steps')
            .reduce((sum, log) => sum + (log.value || 0), 0);
        const totalCaloriesOutToday = safeFitnessHistory
            .filter(log => log.date === TODAY_DATE && log.type === 'calories_out')
            .reduce((sum, log) => sum + (log.value || 0), 0);
        const totalWaterIntake = safeFitnessHistory
            .filter(log => log.date === TODAY_DATE && log.type === 'water_intake')
            .reduce((sum, log) => sum + (log.value || 0), 0);
        const sleepLog = safeFitnessHistory
            .filter(log => log.type === 'sleep')
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || { value: 0 };
        const sleepLastNight = sleepLog.value || 0;

        // Mood calculations
        const latestMoodEntry = safeMoodHistory[0] || { mood: 2, stress: 45, note: 'No data available.', isFinal: false };
        const moodLabel = Object.values(moodMap).find(m => m.value === latestMoodEntry.mood)?.label || 'Neutral';
        const stressIndex = latestMoodEntry.stress || 45;
        const moodNote = latestMoodEntry.note || (latestMoodEntry.isFinal ? 'No note recorded.' : 'Daily check-in pending.');

        // Vault calculations
        const totalVaultLinks = safeAssetState.length;
        const uniqueCategories = [...new Set(safeAssetState.map(a => a.type))].length;

        // --- Calculate Component Scores & Life Score ---
        const componentScores = {
            tasks: taskCompletionRate,
            finance: financialHealth,
            mood: Math.max(0, 100 - stressIndex), // Score inversely related to stress
            // Fitness score based on sleep (up to 50%) and steps (up to 50%)
            fitness: Math.min(100, Math.round((Math.min(sleepLastNight, 8) / 8) * 50 + (Math.min(totalStepsToday, 10000) / 10000) * 50))
        };
        const digitalScore = Math.min(100, Math.round((Math.min(totalVaultLinks, 10) / 10) * 50 + (Math.min(uniqueCategories, 5) / 5) * 50));

        const lifeScoreWeights = { tasks: 0.25, finance: 0.20, fitness: 0.20, mood: 0.20, digital: 0.15 };
        let weightedScoreSum = 0;
        weightedScoreSum += (componentScores.tasks || 0) * lifeScoreWeights.tasks;
        weightedScoreSum += (componentScores.finance || 0) * lifeScoreWeights.finance;
        weightedScoreSum += (componentScores.fitness || 0) * lifeScoreWeights.fitness;
        weightedScoreSum += (componentScores.mood || 0) * lifeScoreWeights.mood;
        weightedScoreSum += (digitalScore || 0) * lifeScoreWeights.digital;
        const currentLifeScore = Math.min(100, Math.max(0, Math.round(weightedScoreSum)));

        // --- 2. UPDATE UI ELEMENTS ---
        const updateElementText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const updateElementHTML = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };

        // Update Life Score display
        updateLifeScore(currentLifeScore);

        // Update Radar Chart labels/weights display
        updateElementText('score-tasks', `Tasks (${Math.round(componentScores.tasks)}%)`);
        updateElementText('score-finance', `Financial Health (${Math.round(componentScores.finance)}%)`);
        updateElementText('score-fitness', `Fitness (${Math.round(componentScores.fitness)}%)`);
        updateElementText('score-mood', `Mood/Stress (${Math.round(componentScores.mood)}%)`);
        updateElementText('score-digital', `Digital Org (${Math.round(digitalScore)}%)`);

        // Update KPI Cards
        updateElementText('kpi-mood-value', moodLabel);
        updateElementText('kpi-stress-index', `Stress Index: ${stressIndex}%`);
        updateElementText('kpi-mood-note', moodNote);

        updateElementHTML('kpi-steps-value', `<span class="kpi-steps-label">Steps: </span><span id="steps-number-val">${totalStepsToday.toLocaleString()}</span>`);
        updateElementText('kpi-calories-value-label', `Calories Burned: ${totalCaloriesOutToday.toLocaleString()}`);
        updateElementText('kpi-sleep-value-label', `Last Sleep: ${sleepLastNight > 0 ? sleepLastNight : '--'} hr`);
        updateElementText('kpi-water-value-label', `Water Intake: ${totalWaterIntake.toLocaleString()} ml`);

        updateElementHTML('kpi-finance-value', `₹${totalDueAmountThisWeek.toLocaleString()} <span class="kpi-label" id="finance-due-label">Due</span>`);
        updateElementText('kpi-finance-health-percent', `Health: ${financialHealth}%`);
        updateElementText('kpi-finance-subs-monthly', `Subscriptions: ₹${activeSubscriptionTotal.toLocaleString()} / mo`);

        updateElementText('kpi-vault-links', `${totalVaultLinks} Links`);
        updateElementText('kpi-vault-categories', `${uniqueCategories} Categories`);

        // src/js/script.js - Inside renderDashboardMetrics function
        // ... around line 1700
        // --- Radar Chart ---
        const radarCtx = document.getElementById('life-score-radar-chart')?.getContext('2d');
        if (radarCtx) {
            setTimeout(() => { // Introduce delay
                if (typeof Chart === 'undefined') {
                    console.warn("Chart.js missing for Dashboard Radar Chart.");
                    return;
                }

                const chartData = {
                    labels: ['Tasks', 'Financial', 'Fitness', 'Mood/Stress', 'Digital Org'],
                    datasets: [{
                        label: 'Score',
                        data: [
                            componentScores.tasks || 0,
                            componentScores.finance || 0,
                            componentScores.fitness || 0,
                            componentScores.mood || 0,
                            digitalScore || 0
                        ],
                        backgroundColor: 'rgba(0, 199, 166, 0.4)',
                        borderColor: 'var(--c-primary)',
                        borderWidth: 1.5,
                        pointRadius: 4,
                        pointBackgroundColor: 'var(--c-primary)'
                    }]
                };

                if (lifeScoreChartInstance) {
                    lifeScoreChartInstance.destroy();
                    lifeScoreChartInstance = null;
                }

                try {
                    lifeScoreChartInstance = new Chart(radarCtx, {
                        type: 'radar',
                        data: chartData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: {
                                padding: 20
                            },
                            scales: {
                                r: {
                                    suggestedMin: 0,
                                    suggestedMax: 100,
                                    ticks: { stepSize: 25, backdropColor: 'transparent' },
                                    pointLabels: { padding: 10, font: { size: 12 } },
                                    grid: { color: '#eaeaea' },
                                    angleLines: { color: '#eaeaea' }
                                }
                            },
                            plugins: {
                                legend: { display: false }
                            }
                        }
                    });
                } catch (chartError) {
                    console.error("Error creating Radar Chart:", chartError);
                }
            }, 100); // End of setTimeout
        }


        // --- Today's Schedule List ---
        const scheduleList = document.getElementById('task-list-container');
        if (scheduleList) {
            scheduleItemsToday.sort((a, b) => (a.completed - b.completed) || ({ 'high': 3, 'medium': 2, 'low': 1 }[b.priority] || 0) - ({ 'high': 3, 'medium': 2, 'low': 1 }[a.priority] || 0));

            scheduleList.innerHTML = ''; // Clear previous items
            if (scheduleItemsToday.length === 0) {
                scheduleList.innerHTML = `<li class="task-item-empty">Nothing scheduled for today.</li>`;
            } else {
                scheduleItemsToday.forEach(item => {
                    const isTask = item.type === 'task';
                    const li = document.createElement('li');
                    li.className = `task-item ${item.completed ? 'completed' : ''}`;
                    li.innerHTML = `
                        <input type="checkbox" id="dash-${item.id}" data-task-id="${item.id}" ${item.completed ? 'checked' : ''} ${!isTask ? 'disabled style="visibility:hidden;"' : ''}>
                        <label for="dash-${item.id}" style="margin-left: ${isTask ? '12px' : '0'};">${item.text} ${item.type !== 'task' ? `(${item.type})` : ''}</label>
                    `;
                    scheduleList.appendChild(li);
                });
            }
        }


        // --- Actions for Today List ---
        const remedyList = document.getElementById('dashboard-actions-list');
        if (remedyList) {
            let actionItems = [];
            overdueBills.forEach(bill => actionItems.push({ id: `remedy-bill-${bill.id}`, status: 'finance', icon: 'alert-triangle', text: `Overdue: ${bill.name}. Pay Now.`, buttonText: 'Pay', action: 'pay', dataId: bill.id, priorityScore: 10 }));
            if (stressIndex >= 70) actionItems.push({ id: 'remedy-high-stress', status: 'health', icon: 'zap', text: `High Stress (${stressIndex}%). Consider break/meditation.`, buttonText: 'Log Break', action: 'log-break', priorityScore: 9 });
            if (sleepLastNight < 6 && sleepLastNight > 0) actionItems.push({ id: 'remedy-low-sleep', status: 'health', icon: 'moon', text: `Low Sleep (${sleepLastNight}h). Plan for more tonight.`, buttonText: 'Acknowledge', action: 'ack-sleep', priorityScore: 8 });
            pendingTasks.filter(task => task.date === TODAY_DATE).forEach(task => actionItems.push({ id: `task-action-${task.id}`, status: 'task', icon: 'check-square', text: `Task: ${task.text} (${task.priority}).`, buttonText: 'Complete', action: 'complete-task', dataId: task.id, priorityScore: task.priority === 'high' ? 7 : (task.priority === 'medium' ? 6 : 5) }));

            actionItems.sort((a, b) => b.priorityScore - a.priorityScore);

            remedyList.innerHTML = '';
            if (actionItems.length === 0) {
                remedyList.innerHTML = `<li class="remedy-item" data-status="info"><i data-feather="thumbs-up"></i><p>All clear! No critical actions or tasks for today.</p></li>`;
            } else {
                actionItems.forEach(item => {
                    let isItemCompleted = false;
                    if (item.action === 'pay') {
                        isItemCompleted = safeBillState.find(b => b.id === item.dataId)?.paid || false;
                    } else if (item.action === 'complete-task') {
                        isItemCompleted = safeTaskState.find(t => t.id === item.dataId)?.completed || false;
                    }

                    const li = document.createElement('li');
                    li.className = `remedy-item ${isItemCompleted ? 'completed' : ''}`;
                    li.dataset.status = item.status;
                    li.dataset.actionType = item.action;
                    li.dataset.id = item.dataId || item.id;

                    li.innerHTML = `
                        <i data-feather="${item.icon}"></i>
                        <p>${item.text}</p>
                        <button class="remedy-button" data-action="${item.action}" data-id="${item.dataId || item.id}" ${isItemCompleted ? 'disabled' : ''}>
                            ${isItemCompleted ? (item.action === 'pay' ? 'Paid' : 'Done') : item.buttonText}
                        </button>
                    `;
                    remedyList.appendChild(li);
                });
            }
        }

        try { feather.replace(); } catch (e) { console.warn("Feather replace failed at end of dashboard render:", e); }
        // console.log("Dashboard rendering complete.");
    }; // End of renderDashboardMetrics

    // --- Event Listener Setup ---
    function attachDashboardListeners() {
        // console.log("Attaching dashboard listeners...");
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        // Listener for Task Checkboxes in Schedule
        if (mainContent._taskChangeListener) mainContent.removeEventListener('change', mainContent._taskChangeListener);
        mainContent._taskChangeListener = async (e) => {
            if (e.target.matches('#task-list-container input[type="checkbox"]')) {
                const checkbox = e.target;
                const taskId = checkbox.dataset.taskId;
                const isChecked = checkbox.checked;

                checkbox.disabled = true;
                try {
                    await taskApiService.update(taskId, { completed: isChecked });
                    showFlashMessage(`Task ${isChecked ? 'completed' : 'marked incomplete'}.`, 'check-circle');
                    await refreshState('tasks');
                } catch (error) {
                    console.error("Failed to update task completion:", error);
                    checkbox.checked = !isChecked; // Revert UI on error
                    checkbox.disabled = false;
                }
            }
        };
        mainContent.addEventListener('change', mainContent._taskChangeListener);


        // Listener for Remedy Buttons
        if (mainContent._remedyClickListener) mainContent.removeEventListener('click', mainContent._remedyClickListener);
        mainContent._remedyClickListener = async (e) => {
            const button = e.target.closest('#dashboard-actions-list .remedy-button');
            if (!button || button.disabled) return;

            const action = button.dataset.action;
            const itemId = button.dataset.id;
            const remedyItem = button.closest('.remedy-item');

            button.disabled = true;
            button.innerHTML = '<i data-feather="loader" class="spin"></i>';
            try { feather.replace(); } catch (fe) { }

            try {
                let stateToRefresh = null;

                if (action === 'pay') {
                    const bill = billState.find(b => b.id === itemId);
                    if (bill) {
                        const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
                        const updateData = {
                            paid: bill.frequency === 'one-time',
                            dueDate: nextDueDate || bill.dueDate
                        };
                        await billApiService.update(itemId, updateData);
                        showFlashMessage(`${bill.name} ${bill.frequency === 'one-time' ? 'paid' : 'logged'}.`, 'check-circle');
                        stateToRefresh = 'bills';
                    } else { throw new Error(`Bill with ID ${itemId} not found.`); }
                } else if (action === 'log-break') {
                    showFlashMessage('Break logged. Take it easy!', 'coffee');
                    stateToRefresh = null;
                    if (remedyItem) remedyItem.classList.add('completed');
                    button.textContent = 'Logged';
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Keep 'Logged' visible
                } else if (action === 'ack-sleep') {
                    showFlashMessage('Low sleep acknowledged. Aim for more rest!', 'moon');
                    if (remedyItem) remedyItem.classList.add('completed');
                    button.textContent = 'Acknowledged';
                    stateToRefresh = null;
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } else if (action === 'complete-task') {
                    await taskApiService.update(itemId, { completed: true });
                    showFlashMessage('Task completed!', 'check-circle');
                    stateToRefresh = 'tasks';
                } else {
                    console.warn(`Unknown remedy action: ${action}`);
                    button.textContent = 'Unknown';
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                if (stateToRefresh) {
                    await refreshState(stateToRefresh);
                } else if (!remedyItem.classList.contains('completed')) {
                    // Re-enable if no refresh and not marked complete by local logic
                    button.disabled = false;
                    button.textContent = originalText;
                }

            } catch (error) {
                console.error(`Failed action '${action}' for item ${itemId}:`, error);
                // Restore button state after a short delay
                setTimeout(() => {
                    if (button && remedyItem && !remedyItem.classList.contains('completed')) {
                        button.textContent = remedyItem.querySelector('p').textContent.includes('Pay') ? 'Pay' :
                            remedyItem.querySelector('p').textContent.includes('Break') ? 'Log Break' :
                                remedyItem.querySelector('p').textContent.includes('Acknowledge') ? 'Acknowledge' :
                                    'Complete';
                        button.disabled = false;
                        try { feather.replace(); } catch (fe) { }
                    }
                }, 1500);
            }
        };
        mainContent.addEventListener('click', mainContent._remedyClickListener);

    } // End of attachDashboardListeners

    // --- Initial Setup ---
    renderDashboardMetrics();
    attachDashboardListeners();
}


// ===============================================
// IX. TASKS PAGE LOGIC
// ===============================================

// Global function for rendering the task list
let renderTaskList = () => { console.warn("renderTaskList called before assignment."); };

function initializeTasksPageLogic() {
    console.log("Initializing Tasks Page Logic...");
    let activeTaskFilter = 'date'; // Default filter state
    let taskToDeleteId = null;

    // --- DOM Element References ---
    const mainTaskList = mainContentElement?.querySelector('#main-task-list');
    const taskFilterBar = mainContentElement?.querySelector('#task-filter-bar');
    const addModal = document.getElementById('add-task-modal');
    const editModal = document.getElementById('edit-task-modal');
    const deleteConfirmModal = document.getElementById('delete-task-confirm-modal');
    const calendarEl = mainContentElement?.querySelector('#calendar');
    const calendarOverlay = mainContentElement?.querySelector('#auth-signin-overlay');
    const calendarSignInButton = mainContentElement?.querySelector('#auth-open-signin');

    // --- Core Render Function ---
    renderTaskList = () => {
        if (!mainTaskList) return;
        // console.log("Rendering task list with filter:", activeTaskFilter);

        let displayTasks = (Array.isArray(taskState) ? taskState : []).filter(task => {
            if (task.type && task.type !== 'task') return false;
            switch (activeTaskFilter) {
                case 'completed': return task.completed;
                case 'pending': return !task.completed;
                default: return true;
            }
        });

        displayTasks.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            const priorityA = priorityOrder[a.priority] || 0;
            const priorityB = priorityOrder[b.priority] || 0;

            if (activeTaskFilter !== 'completed' && a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }

            if (activeTaskFilter === 'priority') {
                return priorityB - priorityA;
            }
            const dateA = a.date ? new Date(a.date).getTime() : Infinity;
            const dateB = b.date ? new Date(b.date).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;
            return priorityB - priorityA;
        });

        // --- Render List Items ---
        mainTaskList.innerHTML = '';
        if (displayTasks.length === 0) {
            mainTaskList.innerHTML = `<li class="task-item-empty" style="padding: 20px; text-align: center; color: var(--c-text-muted);">No tasks found matching filter '${activeTaskFilter}'.</li>`;
        } else {
            displayTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;
                let formattedDate = task.date
                    ? new Date(task.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                    : 'No date';

                li.innerHTML = `
                    <input type="checkbox" id="task-${task.id}" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <label for="task-${task.id}" title="${task.text}">${task.text}</label> <span class="task-date">${formattedDate}</span>
                    <span class="task-tag ${task.priority || 'medium'}">${task.priority || 'medium'}</span> <div class="task-actions">
                        <button class="edit-task-button" data-id="${task.id}" title="Edit Task"><i data-feather="edit-2" style="width: 14px; height: 14px;"></i></button>
                        <button class="delete-task-button" data-id="${task.id}" title="Delete Task"><i data-feather="trash-2" style="width: 14px; height: 14px;"></i></button>
                    </div>
                 `;
                mainTaskList.appendChild(li);
            });
        }
        try { feather.replace(); } catch (e) { console.warn("Feather error during task list render:", e); }

        if (window.calendar) {
            // console.log("Refetching FullCalendar events after task list render.");
            window.calendar.refetchEvents();
        }
        attachTaskItemListeners();
    };

    // --- Task Action Handlers ---
    async function toggleTaskCompleted(taskId, isChecked) {
        // Find the checkbox element to modify its state if an error occurs
        const checkbox = mainTaskList.querySelector(`input[data-task-id="${taskId}"]`);
        if (checkbox) checkbox.disabled = true; // Temporarily disable to prevent rapid clicks

        try {
            // Step 1: Attempt the API update
            await taskApiService.update(taskId, { completed: isChecked });
            showFlashMessage(`Task ${isChecked ? 'completed' : 'marked incomplete'}.`, 'check-circle');

            // Step 2: Attempt to refresh the entire state and re-render the view
            await refreshState('tasks');

        } catch (error) {
            console.error("Failed to toggle task completion. Reverting UI state.", error);
            // The API service or refreshState already shows a flash message on error.

            // Revert UI on error:
            if (checkbox) {
                checkbox.checked = !isChecked; // Revert the checkbox state
            }

        } finally {
            // Ensure the checkbox is re-enabled, unless refreshState succeeded
            // In a failed scenario, re-enabling lets the user try again
            if (checkbox) {
                checkbox.disabled = false;
            }
        }
    }

    async function deleteTask(taskId) {
        showFlashMessage('Deleting task...', 'loader');
        try {
            await taskApiService.delete(taskId);
            showFlashMessage('Task deleted successfully.', 'trash-2');
            await refreshState('tasks');
        } catch (error) {
            console.error("Failed to delete task:", error);
            // API service handles error flash message
        }
    }

    // --- Modal Setup ---
    const addModalControls = setupModal(addModal, ['#add-task-button-main'], ['#modal-cancel-button'], () => {
        const textInput = addModal?.querySelector('#task-text-input');
        const prioritySelect = addModal?.querySelector('#task-priority-select');
        const dateInput = addModal?.querySelector('#task-date-input');
        if (textInput) textInput.value = '';
        if (prioritySelect) prioritySelect.value = 'medium';
        if (dateInput) dateInput.value = getTodayDateString();
    });

    const editModalControls = setupModal(editModal, [], ['#edit-modal-cancel-button']);
    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-task-cancel-button']);

    const openEditModal = (taskId) => {
        const task = taskState.find(t => t.id === taskId);
        if (!task || !editModal) return;
        editModal.querySelector('#edit-task-id-input').value = task.id;
        editModal.querySelector('#edit-task-text-input').value = task.text;
        editModal.querySelector('#edit-task-priority-select').value = task.priority || 'medium';
        editModal.querySelector('#edit-task-date-input').value = task.date || '';
        editModal.querySelector('#edit-modal-title').textContent = `Edit Task: ${task.text.substring(0, 30)}${task.text.length > 30 ? '...' : ''}`;
        editModalControls.show();
    };

    const showDeleteConfirmModal = (id, name) => {
        if (!deleteConfirmModal) return;
        taskToDeleteId = id;
        const messageEl = deleteConfirmModal.querySelector('#delete-task-confirm-message');
        if (messageEl) messageEl.textContent = `Are you sure you want to permanently delete task: "${name}"?`;
        deleteModalControls.show();
    };

    // --- Modal Action Event Listeners (Re-attached on every init to ensure they target current DOM) ---
    const attachModalActionListeners = () => {
        const attachListener = (id, handler) => {
            const el = document.getElementById(id);
            if (el) {
                // Clone/replace node to ensure a single event listener is attached
                const newEl = el.cloneNode(true);
                el.parentNode.replaceChild(newEl, el);
                newEl.addEventListener('click', handler);
            }
        };

        // We attach the locally scoped handlers directly here:
        attachListener('modal-add-button', handleAddTask);
        attachListener('edit-modal-save-button', handleEditTask);

        // Use the local function defined below
        attachListener('edit-modal-delete-button', function () { // <--- FIX HERE: Inline the definition or reference the local
            handleDeleteTaskTrigger(); // Call the local function
        });

        attachListener('delete-task-confirm-button', handleDeleteTaskConfirm);
    };


    // --- Modal Handler Functions ---
    async function handleAddTask() {
        const textInput = addModal?.querySelector('#task-text-input');
        const prioritySelect = addModal?.querySelector('#task-priority-select');
        const dateInput = addModal?.querySelector('#task-date-input');
        const text = textInput?.value.trim();
        if (!text) return alert('Task description cannot be empty.');

        const newTask = {
            text: text,
            priority: prioritySelect?.value || 'medium',
            date: dateInput?.value || getTodayDateString(),
            type: 'task'
        };

        addModalControls.hide();
        showFlashMessage('Adding task...', 'loader');
        try {
            await taskApiService.create(newTask);
            showFlashMessage('Task added successfully!', 'plus-circle');
            await refreshState('tasks'); // <-- CRITICAL: Ensures instant UI update
        } catch (error) { console.error("Failed to add task:", error); }
    }

    async function handleEditTask() {
        if (!editModal) return;
        const id = editModal.querySelector('#edit-task-id-input')?.value;
        const textInput = editModal.querySelector('#edit-task-text-input');
        const text = textInput?.value.trim();
        if (!text) return alert('Task description cannot be empty.');

        const updatedTaskData = {
            text: text,
            priority: editModal.querySelector('#edit-task-priority-select')?.value || 'medium',
            date: editModal.querySelector('#edit-task-date-input')?.value || null
        };

        editModalControls.hide();
        showFlashMessage('Saving changes...', 'loader');
        try {
            await taskApiService.update(id, updatedTaskData);
            showFlashMessage('Task updated successfully!', 'save');
            await refreshState('tasks');
        } catch (error) { console.error("Failed to update task:", error); }
    }

    async function deleteTask(taskId) {
        showFlashMessage('Deleting task...', 'loader');
        try {
            await taskApiService.delete(taskId);
            showFlashMessage('Task deleted successfully.', 'trash-2');
            await refreshState('tasks');
        } catch (error) {
            console.error("Failed to delete task:", error);
            // API service handles error flash message
        }
    }

    async function handleDeleteTaskConfirm() {
        if (taskToDeleteId) {
            deleteModalControls.hide();
            await deleteTask(taskToDeleteId);
            taskToDeleteId = null;
        }
    }


    // --- Task List Item Event Listeners (using delegation) ---
    function attachTaskItemListeners() {
        if (mainTaskList?._taskItemClickListener) mainTaskList.removeEventListener('click', mainTaskList._taskItemClickListener);
        if (mainTaskList?._taskItemChangeListener) mainTaskList.removeEventListener('change', mainTaskList._taskItemChangeListener);
        if (!mainTaskList) return;

        // Listener for checkbox changes
        mainTaskList._taskItemChangeListener = (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                // Pass the checkbox state directly
                toggleTaskCompleted(e.target.dataset.taskId, e.target.checked);
            }
        };
        mainTaskList.addEventListener('change', mainTaskList._taskItemChangeListener);


        // Listener for edit/delete button clicks
        mainTaskList._taskItemClickListener = (e) => {
            const editButton = e.target.closest('.edit-task-button');
            const deleteButton = e.target.closest('.delete-task-button');

            if (editButton) {
                e.stopPropagation();
                openEditModal(editButton.dataset.id);
            } else if (deleteButton) {
                e.stopPropagation();
                const task = taskState.find(t => t.id === deleteButton.dataset.id);
                if (task) showDeleteConfirmModal(task.id, task.text);
            }
        };
        mainTaskList.addEventListener('click', mainTaskList._taskItemClickListener);
    }


    // --- Filter Bar Listener ---
    if (taskFilterBar) {
        if (taskFilterBar._filterClickListener) taskFilterBar.removeEventListener('click', taskFilterBar._filterClickListener);
        taskFilterBar._filterClickListener = (e) => {
            if (e.target.classList.contains('filter-item')) {
                taskFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                activeTaskFilter = e.target.dataset.filter;
                renderTaskList();
            }
        };
        taskFilterBar.addEventListener('click', taskFilterBar._filterClickListener);
    }


    // --- Calendar Initialization & Logic ---
    function tryInitializeCalendar() {
        if (!calendarEl || typeof FullCalendar === 'undefined') {
            if (calendarOverlay) calendarOverlay.style.display = 'flex';
            return;
        }

        if (window.calendar) {
            window.calendar.destroy(); // <--- This ensures the old one is properly removed
            window.calendar = null;
        }

        try {
            window.calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
                events: function (fetchInfo, successCallback, failureCallback) {
                    const events = (Array.isArray(taskState) ? taskState : [])
                        .filter(t => t.date)
                        .map(task => ({
                            id: task.id,
                            title: task.text,
                            start: task.date,
                            allDay: true,
                            classNames: [task.type || 'task', task.priority || 'medium', task.completed ? 'completed-event' : ''],
                        }));
                    successCallback(events);
                },
                eventClick: function (info) {
                    openEditModal(info.event.id);
                },
                dateClick: function (info) {
                    if (addModal) {
                        const dateInput = addModal.querySelector('#task-date-input');
                        if (dateInput) dateInput.value = info.dateStr;
                        addModalControls.show();
                    }
                }
            });

            window.calendar.render();
            if (calendarOverlay) calendarOverlay.style.display = 'none';

        } catch (renderErr) {
            console.error("Error initializing or rendering FullCalendar:", renderErr);
            if (calendarOverlay) calendarOverlay.style.display = 'flex';
        }
    }

    async function checkCalendarAccess() {
        if (!calendarOverlay) return;

        if (!window.auth0Client) {
            calendarOverlay.style.display = 'flex';
            return;
        }

        try {
            const isAuthenticated = await window.auth0Client.isAuthenticated();
            if (isAuthenticated) {
                // CRITICAL FIX: Wrap initialization in a delay to wait for FullCalendar's script to execute
                setTimeout(() => {
                    if (typeof FullCalendar === 'undefined') {
                        console.warn("FullCalendar library object not yet loaded, aborting calendar init.");
                        return;
                    }
                    tryInitializeCalendar();
                    calendarOverlay.style.display = 'none';
                }, 100); // 100ms delay to ensure library loads
            } else {
                calendarOverlay.style.display = 'flex';
                if (window.calendar) { window.calendar.destroy(); window.calendar = null; }
                if (calendarEl) calendarEl.innerHTML = '';
            }
            try { feather.replace({ 'stroke-width': 2, width: 24, height: 24 }); } catch (e) { }

        } catch (authError) {
            console.error("Error checking authentication status for calendar:", authError);
            calendarOverlay.style.display = 'flex';
        }
    }

    // Sign-in button listener within the calendar overlay
    if (calendarSignInButton) {
        const newSignInButton = calendarSignInButton.cloneNode(true);
        calendarSignInButton.parentNode.replaceChild(newSignInButton, calendarSignInButton);
        newSignInButton.addEventListener('click', async () => {
            if (window.auth0Client) {
                try {
                    await window.auth0Client.loginWithRedirect({ authorizationParams: { redirect_uri: window.location.origin + '/index.html' } });
                } catch (loginErr) {
                    console.error("Error initiating login from calendar overlay:", loginErr);
                    alert("Could not start login process.");
                }
            } else {
                alert("Authentication system not ready.");
            }
        });
    }


    // --- Initial Render & Setup ---
    attachModalActionListeners(); // Re-attach modal listeners
    renderTaskList();
    checkCalendarAccess();
    attachTaskItemListeners();
}


// ===============================================
// X. FINANCE PAGE LOGIC
// ===============================================

// Global function for rendering the bill list
let renderBills = () => { console.warn("renderBills called before assignment."); };

function initializeFinancePage() {
    console.log("Initializing Finance Page Logic...");
    let activeBillFilter = 'upcoming'; // Default filter
    let showAllBills = false;
    const MAX_BILLS_TO_SHOW = 3;
    let billToDeleteId = null;

    // --- DOM Element References ---
    const mainBillList = mainContentElement?.querySelector('#main-bill-list');
    const billFilterBar = mainContentElement?.querySelector('#bill-filter-bar');
    const showMoreButton = mainContentElement?.querySelector('#show-more-bills-button');
    const addBillModal = document.getElementById('add-bill-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');

    // --- Core Render Function ---
    renderBills = () => {
        if (!mainBillList) return;
        // console.log("Rendering bills with filter:", activeBillFilter);

        const processedBillState = (Array.isArray(billState) ? billState : []).map(bill => {
            let dueDays = 999;
            let overdue = false;
            if (!bill.paid && bill.dueDate) {
                dueDays = calculateDueDays(bill.dueDate);
                overdue = dueDays < 0;
            } else if (bill.paid) {
                dueDays = Infinity;
            }
            return { ...bill, dueDays, overdue };
        });

        // --- Filtering ---
        let filteredBills = processedBillState.filter(bill => {
            switch (activeBillFilter) {
                case 'subscriptions': return bill.frequency !== 'one-time';
                case 'paid': return bill.paid;
                case 'upcoming': return !bill.paid;
                default: return true;
            }
        });

        // --- Sorting ---
        filteredBills.sort((a, b) => {
            if (a.paid !== b.paid) return a.paid ? 1 : -1;
            if (a.overdue !== b.overdue) return b.overdue ? -1 : 1;
            return a.dueDays - b.dueDays;
        });

        // --- KPI Calculation ---
        const totalDueThisWeek = processedBillState
            .filter(b => !b.paid && b.dueDays >= 0 && b.dueDays <= 7)
            .reduce((sum, b) => sum + (b.amount || 0), 0);
        const activeSubscriptionTotal = processedBillState
            .filter(b => b.frequency !== 'one-time' && !b.paid)
            .reduce((sum, b) => sum + (b.amount || 0), 0);
        const financialHealth = processedBillState.length > 0
            ? Math.round(processedBillState.filter(b => b.paid).length / processedBillState.length * 100)
            : 100;

        // Update KPI elements safely
        const kpiDueEl = mainContentElement?.querySelector('#kpi-due');
        const kpiSubsEl = mainContentElement?.querySelector('#kpi-subs');
        const kpiHealthEl = mainContentElement?.querySelector('#kpi-health');
        if (kpiDueEl) kpiDueEl.textContent = `₹${totalDueThisWeek.toLocaleString('en-IN')}`;
        if (kpiSubsEl) kpiSubsEl.textContent = `₹${activeSubscriptionTotal.toLocaleString('en-IN')} / mo`;
        if (kpiHealthEl) kpiHealthEl.textContent = `${financialHealth}%`;


        // --- Show More/Less Logic ---
        let billsToDisplay = filteredBills;
        const hiddenCount = (activeBillFilter === 'upcoming' && !showAllBills && filteredBills.length > MAX_BILLS_TO_SHOW)
            ? filteredBills.length - MAX_BILLS_TO_SHOW
            : 0;

        if (hiddenCount > 0) {
            billsToDisplay = filteredBills.slice(0, MAX_BILLS_TO_SHOW);
        }

        // Update the "Show More/Less" button visibility and text
        if (showMoreButton) {
            const showMoreTextEl = showMoreButton.querySelector('#show-more-text');
            const showMoreIconEl = showMoreButton.querySelector('i');
            if (activeBillFilter === 'upcoming' && filteredBills.length > MAX_BILLS_TO_SHOW) {
                showMoreButton.style.display = 'flex';
                if (showMoreTextEl) showMoreTextEl.textContent = showAllBills ? 'Show Less Upcoming' : `Show All Upcoming (${hiddenCount} more)`;
                if (showMoreIconEl) showMoreIconEl.setAttribute('data-feather', showAllBills ? 'chevron-up' : 'chevron-down');
            } else {
                showMoreButton.style.display = 'none';
            }
        }

        // --- Rendering List ---
        mainBillList.innerHTML = '';
        if (billsToDisplay.length === 0) {
            mainBillList.innerHTML = `<li class="placeholder-text" style="padding: 20px; text-align: center; color: var(--c-text-muted);">No bills found for filter '${activeBillFilter}'.</li>`;
        } else {
            billsToDisplay.forEach(bill => {
                const li = document.createElement('li');
                let urgencyClass = bill.paid ? 'completed' : (bill.overdue ? 'overdue' : (bill.dueDays <= 3 ? 'urgent' : ''));
                let dueDateText = bill.paid ? 'Paid' : (
                    bill.overdue ? `Overdue by ${Math.abs(bill.dueDays)}d` : (
                        bill.dueDays === 0 ? 'Due Today' : (
                            bill.dueDays <= 998 ? `Due in ${bill.dueDays}d` : 'No Due Date'
                        )
                    )
                );
                const formattedDatePart = bill.dueDate
                    ? `(${new Date(bill.dueDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })})`
                    : '';


                li.className = `bill-item ${urgencyClass}`;
                li.dataset.id = bill.id;
                li.dataset.link = bill.paymentLink || '#';

                li.innerHTML = `
                    <i data-feather="${bill.icon || 'credit-card'}" class="icon"></i>
                    <div class="details">
                        <p title="${bill.name}">${bill.name}</p> <span class="due-date">${dueDateText} ${formattedDatePart}</span>
                    </div>
                    <span class="bill-amount">₹${(bill.amount || 0).toLocaleString('en-IN')}</span>
                    <div class="bill-actions">
                        <button class="edit-button" data-id="${bill.id}" title="Edit Bill"><i data-feather="edit-2" style="width:16px; height: 16px;"></i></button>
                        <button class="pay-button" data-action="${bill.paid ? 'paid' : 'pay'}" ${bill.paid ? 'disabled' : ''}>
                            ${bill.paid ? 'Paid' : 'Mark as Paid'}
                        </button>
                    </div>
                 `;
                mainBillList.appendChild(li);
            });
        }
        try { feather.replace(); } catch (e) { console.warn("Feather error during bill list render:", e); }

        attachBillItemListeners();
    };

    // --- Bill Action Handlers ---
    async function markBillAsPaid(billId) {
        const bill = billState.find(b => b.id === billId);
        if (!bill || bill.paid) return;

        showFlashMessage(`Processing payment for ${bill.name}...`, 'loader');
        try {
            const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
            const updateData = {
                paid: bill.frequency === 'one-time',
                dueDate: nextDueDate || bill.dueDate
            };
            await billApiService.update(billId, updateData);
            showFlashMessage(`${bill.name} ${bill.frequency === 'one-time' ? 'marked paid' : 'payment logged'}.`, 'check-circle');
            await refreshState('bills'); // <-- CRITICAL: Ensures instant UI update
        } catch (error) {
            console.error("Failed to mark bill paid:", error);
        }
    }

    async function deleteBill(billId) {
        const billName = billState.find(b => b.id === billId)?.name || 'this bill';
        showFlashMessage(`Deleting ${billName}...`, 'loader');
        try {
            await billApiService.delete(billId);
            showFlashMessage('Bill deleted successfully.', 'trash-2');
            await refreshState('bills');
        } catch (error) {
            console.error("Failed to delete bill:", error);
        }
    }

    // --- Modal Setup ---
    const addModalControls = setupModal(addBillModal, ['#add-bill-button'], ['#bill-modal-cancel-button'], () => {
        addBillModal.querySelector('#bill-modal-title').textContent = 'Add New Bill';
        const actionButton = addBillModal.querySelector('#bill-modal-action-button');
        actionButton.textContent = 'Add Bill';
        actionButton.dataset.mode = 'add';
        addBillModal.querySelector('#bill-modal-delete-button').style.display = 'none';
        addBillModal.querySelector('#bill-id-input').value = '';
        addBillModal.querySelector('#bill-name-input').value = '';
        addBillModal.querySelector('#bill-amount-input').value = '';
        addBillModal.querySelector('#bill-due-date-input').value = getTodayDateString();
        addBillModal.querySelector('#bill-frequency-select').value = 'monthly';
        addBillModal.querySelector('#bill-link-input').value = '';
    });

    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-confirm-cancel-button']);

    const openEditBillModal = (billId) => {
        const bill = billState.find(b => b.id === billId);
        if (!bill || !addBillModal) return;

        addBillModal.querySelector('#bill-modal-title').textContent = `Edit Bill: ${bill.name}`;
        const actionButton = addBillModal.querySelector('#bill-modal-action-button');
        actionButton.textContent = 'Save Changes';
        actionButton.dataset.mode = 'edit';
        addBillModal.querySelector('#bill-modal-delete-button').style.display = 'block';
        addBillModal.querySelector('#bill-id-input').value = bill.id;
        addBillModal.querySelector('#bill-name-input').value = bill.name;
        addBillModal.querySelector('#bill-amount-input').value = bill.amount;
        addBillModal.querySelector('#bill-due-date-input').value = bill.dueDate;
        addBillModal.querySelector('#bill-frequency-select').value = bill.frequency;
        addBillModal.querySelector('#bill-link-input').value = bill.paymentLink || '';

        addModalControls.show();
    };

    const showDeleteConfirmModal = (id, name) => {
        if (!deleteConfirmModal) return;
        billToDeleteId = id;
        const messageEl = deleteConfirmModal.querySelector('#delete-confirm-message');
        if (messageEl) messageEl.textContent = `Are you sure you want to permanently delete bill: "${name}"? This cannot be undone.`;
        deleteModalControls.show();
    };

    // --- Modal Action Event Listeners (Re-attached) ---
    const attachModalActionListeners = () => {
        const attachListener = (id, handler) => {
            const el = document.getElementById(id);
            if (el) {
                const newEl = el.cloneNode(true);
                el.parentNode.replaceChild(newEl, el);
                newEl.addEventListener('click', handler);
            }
        };

        attachListener('bill-modal-action-button', handleSaveBill);
        attachListener('bill-modal-delete-button', handleDeleteBillTrigger);
        attachListener('delete-confirm-button', handleDeleteBillConfirm);
    };

    // --- Modal Handler Functions ---
    async function handleSaveBill() {
        if (!addBillModal) return;
        const mode = addBillModal.querySelector('#bill-modal-action-button').dataset.mode;
        const billData = {
            id: addBillModal.querySelector('#bill-id-input').value,
            name: addBillModal.querySelector('#bill-name-input').value.trim(),
            amount: parseFloat(addBillModal.querySelector('#bill-amount-input').value),
            dueDate: addBillModal.querySelector('#bill-due-date-input').value,
            frequency: addBillModal.querySelector('#bill-frequency-select').value,
            paymentLink: addBillModal.querySelector('#bill-link-input').value.trim() || undefined,
            icon: 'credit-card'
        };

        if (!billData.name || isNaN(billData.amount) || billData.amount <= 0 || !billData.dueDate) {
            alert('Bill Name, a valid positive Amount, and Due Date are required.');
            return;
        }

        addModalControls.hide();
        showFlashMessage(mode === 'add' ? 'Adding bill...' : 'Saving changes...', 'loader');
        try {
            if (mode === 'add') {
                const { id, ...createData } = billData;
                await billApiService.create(createData);
                showFlashMessage('Bill added successfully!', 'plus-circle');
            } else {
                const { id, ...updateData } = billData;
                await billApiService.update(billData.id, updateData);
                showFlashMessage('Bill updated successfully!', 'save');
            }
            await refreshState('bills'); // <-- CRITICAL: Ensures instant UI update
        } catch (error) {
            console.error(`Failed to ${mode} bill:`, error);
        }
    }

    function handleDeleteBillTrigger() {
        if (!addBillModal) return;
        const billId = addBillModal.querySelector('#bill-id-input').value;
        const bill = billState.find(b => b.id === billId);
        if (bill) {
            addModalControls.hide();
            showDeleteConfirmModal(bill.id, bill.name);
        }
    }

    async function handleDeleteBillConfirm() {
        if (billToDeleteId) {
            deleteModalControls.hide();
            await deleteBill(billToDeleteId);
            billToDeleteId = null;
        }
    }


    // --- Bill List Item Event Listeners (using delegation) ---
    function attachBillItemListeners() {
        if (mainBillList?._billItemClickListener) mainBillList.removeEventListener('click', mainBillList._billItemClickListener);
        if (!mainBillList) return;

        mainBillList._billItemClickListener = (e) => {
            const editButton = e.target.closest('.edit-button');
            const payButton = e.target.closest('.pay-button');
            const billItem = e.target.closest('.bill-item');

            if (editButton) {
                e.stopPropagation();
                openEditBillModal(editButton.dataset.id);
            } else if (payButton && !payButton.disabled) {
                e.stopPropagation();
                const billId = billItem?.dataset.id;
                const paymentLink = billItem?.dataset.link;

                if (paymentLink && paymentLink !== '#') {
                    const billName = billItem?.querySelector('.details p')?.textContent || 'bill';
                    showFlashMessage(`Opening payment link for ${billName}...`, 'link');
                    window.open(paymentLink, '_blank');
                }
                markBillAsPaid(billId);
            }
        };
        mainBillList.addEventListener('click', mainBillList._billItemClickListener);
    }


    // --- Filter Bar Listener ---
    if (billFilterBar) {
        if (billFilterBar._filterClickListener) billFilterBar.removeEventListener('click', billFilterBar._filterClickListener);
        billFilterBar._filterClickListener = (e) => {
            if (e.target.classList.contains('filter-item')) {
                billFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                activeBillFilter = e.target.dataset.filter;
                showAllBills = false;
                renderBills();
            }
        };
        billFilterBar.addEventListener('click', billFilterBar._filterClickListener);
    }

    // --- Show More/Less Button Listener ---
    if (showMoreButton) {
        if (showMoreButton._showMoreClickListener) showMoreButton.removeEventListener('click', showMoreButton._showMoreClickListener);
        showMoreButton._showMoreClickListener = () => {
            showAllBills = !showAllBills;
            renderBills();
        };
        showMoreButton.addEventListener('click', showMoreButton._showMoreClickListener);
    }


    // --- Initial Render & Setup ---
    renderBills();
    attachBillItemListeners();
    attachModalActionListeners();
}


// ===============================================
// XI. FITNESS PAGE LOGIC
// ===============================================

// Global function for rendering the fitness page content
let renderFitnessPage = () => { console.warn("renderFitnessPage called before assignment."); };

function initializeFitnessPage() {
    console.log("Initializing Fitness Page Logic...");
    let selectedWaterVolume = 0;

    // --- DOM Element References ---
    const kpiStepsEl = mainContentElement?.querySelector('#kpi-steps');
    const kpiCaloriesOutEl = mainContentElement?.querySelector('#kpi-calories-out');
    const kpiWorkoutsEl = mainContentElement?.querySelector('#kpi-workouts');
    const kpiWaterEl = mainContentElement?.querySelector('#kpi-water');
    const kpiSleepEl = mainContentElement?.querySelector('#kpi-sleep');
    const suggestionListEl = mainContentElement?.querySelector('#health-suggestion-list');
    const logListEl = mainContentElement?.querySelector('#daily-log-list');
    const logEmptyEl = mainContentElement?.querySelector('#log-history-empty');
    const fitnessChartCanvas = mainContentElement?.querySelector('#fitness-trend-chart');
    const chartPlaceholder = mainContentElement?.querySelector('#fitness-chart-placeholder');

    const activityModal = document.getElementById('log-activity-modal');
    const waterModal = document.getElementById('log-water-modal');

    // --- Core Render Function ---
    renderFitnessPage = () => {
        // console.log("Rendering fitness page...");
        if (!mainContentElement) return;

        // --- Calculate KPIs from global fitnessHistory ---
        const safeHistory = Array.isArray(fitnessHistory) ? fitnessHistory : [];
        const todayLogs = safeHistory.filter(log => log.date === TODAY_DATE);

        const totalStepsToday = todayLogs.filter(log => log.type === 'steps').reduce((sum, log) => sum + (log.value || 0), 0);
        const totalCaloriesOutToday = todayLogs.filter(log => log.type === 'calories_out').reduce((sum, log) => sum + (log.value || 0), 0);
        const totalWaterIntake = todayLogs.filter(log => log.type === 'water_intake').reduce((sum, log) => sum + (log.value || 0), 0);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const sevenDaysAgoStr = getTodayDateString(sevenDaysAgo);
        const workoutsThisWeek = safeHistory.filter(log =>
            log.type === 'workout' && (log.date >= sevenDaysAgoStr && log.date <= TODAY_DATE)
        ).length;

        const sleepLog = safeHistory
            .filter(log => log.type === 'sleep')
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || { value: 0 };
        const sleepLastNight = sleepLog.value || 0;

        // --- Update KPI Elements ---
        if (kpiStepsEl) kpiStepsEl.textContent = totalStepsToday.toLocaleString();
        if (kpiCaloriesOutEl) kpiCaloriesOutEl.textContent = totalCaloriesOutToday.toLocaleString();
        if (kpiWorkoutsEl) kpiWorkoutsEl.textContent = workoutsThisWeek;
        if (kpiWaterEl) kpiWaterEl.textContent = `${totalWaterIntake.toLocaleString()} ml`;
        if (kpiSleepEl) kpiSleepEl.textContent = `${sleepLastNight} hr`;

        // --- Render Suggestions ---
        if (suggestionListEl) {
            suggestionListEl.querySelectorAll('.suggestion-item').forEach(item => {
                const suggestionId = item.dataset.suggestionId;
                item.classList.toggle('completed', completedSuggestions.includes(suggestionId));
                const button = item.querySelector('.remedy-button');
                if (button) {
                    button.disabled = completedSuggestions.includes(suggestionId);
                }
            });
        }


        // --- Render Daily Log History ---
        if (logListEl && logEmptyEl) {
            const sortedTodayLogs = todayLogs.sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));

            logListEl.innerHTML = '';
            if (sortedTodayLogs.length === 0) {
                logListEl.style.display = 'none';
                logEmptyEl.style.display = 'block';
            } else {
                logListEl.style.display = 'block';
                logEmptyEl.style.display = 'none';
                sortedTodayLogs.forEach(log => {
                    const li = document.createElement('li');
                    li.className = 'log-item';
                    let typeText = (log.type || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let valueUnit = log.unit || '';
                    if (valueUnit === 'calories_out') valueUnit = 'kcal';
                    if (valueUnit === 'water_intake') valueUnit = 'ml';
                    if (valueUnit === 'sleep') valueUnit = 'hr';
                    if (valueUnit === 'workout') valueUnit = 'min';


                    li.innerHTML = `
                        <span class="time">${log.time || '--:--'}</span>
                        <span>${typeText}</span>
                        <span class="value">${(log.value || 0).toLocaleString()} ${valueUnit}</span>
                    `;
                    logListEl.appendChild(li);
                });
            }
        }

        // --- Render Fitness Trend Chart ---
        const fitnessChartCtx = fitnessChartCanvas?.getContext('2d');
        if (fitnessChartCtx) {
            setTimeout(() => { // Introduce delay
                if (typeof Chart === 'undefined') {
                    console.warn("Chart.js missing for Fitness Trend Chart.");
                    if (chartPlaceholder) chartPlaceholder.style.display = 'flex';
                    if (fitnessChartCanvas) fitnessChartCanvas.style.display = 'none';
                    return;
                }

                // ... (data preparation is unchanged) ...
                const last7DaysLabels = [];
                const last7DaysSteps = [];
                const last7DaysWorkout = [];

                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = getTodayDateString(d);
                    last7DaysLabels.push(dateStr);

                    const steps = safeHistory
                        .filter(log => log.date === dateStr && log.type === 'steps')
                        .reduce((sum, log) => sum + (log.value || 0), 0);
                    last7DaysSteps.push(steps);

                    const workoutMins = safeHistory
                        .filter(log => log.date === dateStr && log.type === 'workout')
                        .reduce((sum, log) => sum + (log.value || 0), 0);
                    last7DaysWorkout.push(workoutMins);
                }

                const chartData = {
                    labels: last7DaysLabels.map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })),
                    datasets: [
                        {
                            label: 'Steps',
                            data: last7DaysSteps,
                            borderColor: 'var(--c-primary)',
                            backgroundColor: 'rgba(0, 199, 166, 0.1)',
                            tension: 0.3,
                            yAxisID: 'ySteps',
                            fill: true,
                            order: 1
                        },
                        {
                            label: 'Workout (min)',
                            data: last7DaysWorkout,
                            borderColor: 'var(--c-accent-blue)',
                            backgroundColor: 'rgba(2, 119, 189, 0.5)',
                            type: 'bar',
                            yAxisID: 'yWorkout',
                            order: 2
                        }
                    ]
                };

                if (fitnessTrendChartInstance) {
                    fitnessTrendChartInstance.destroy();
                    fitnessTrendChartInstance = null;
                }

                try {
                    fitnessTrendChartInstance = new Chart(fitnessChartCtx, {
                        type: 'bar',
                        data: chartData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { grid: { display: false } },
                                ySteps: {
                                    position: 'left',
                                    title: { display: true, text: 'Steps' },
                                    beginAtZero: true,
                                    grid: { color: '#eaeaea' }
                                },
                                yWorkout: {
                                    position: 'right',
                                    title: { display: true, text: 'Workout (min)' },
                                    beginAtZero: true,
                                    grid: { drawOnChartArea: false }
                                }
                            },
                            plugins: {
                                legend: { position: 'bottom' },
                                tooltip: { mode: 'index', intersect: false }
                            },
                            interaction: {
                                mode: 'index',
                                intersect: false,
                            },
                        }
                    });
                    if (chartPlaceholder) chartPlaceholder.style.display = 'none';
                    if (fitnessChartCanvas) fitnessChartCanvas.style.display = 'block';
                } catch (chartError) {
                    console.error("Error creating Fitness Trend Chart:", chartError);
                    if (chartPlaceholder) chartPlaceholder.style.display = 'flex';
                    if (fitnessChartCanvas) fitnessChartCanvas.style.display = 'none';
                }
            }, 100); // End of setTimeout
        } else if (fitnessChartCanvas) {
            if (chartPlaceholder) chartPlaceholder.style.display = 'flex';
            fitnessChartCanvas.style.display = 'none';
        } else {
            if (chartPlaceholder) chartPlaceholder.style.display = 'flex';
        }

        try { feather.replace(); } catch (e) { console.warn("Feather replace failed in fitness render:", e); }

        attachFitnessListeners();
    };

    // --- Action Handler for Logging Fitness Data ---
    async function logFitnessEntry(type, value, unit) {
        const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const newLog = {
            date: TODAY_DATE,
            time: nowTime,
            type: type,
            value: Number(value),
            unit: unit
        };

        showFlashMessage(`Logging ${value} ${unit}...`, 'loader');
        try {
            await fitnessApiService.create(newLog);
            showFlashMessage('Activity logged successfully!', 'check-circle');
            await refreshState('fitness'); // <-- CRITICAL: Ensures instant UI update
        } catch (error) {
            console.error("Failed to log fitness entry:", error);
        }
    }


    // --- Modal Specific Logic ---
    const updateActivityUnit = () => {
        if (!activityModal) return;
        const type = activityModal.querySelector('#activity-type-select')?.value;
        const valueLabel = activityModal.querySelector('#activity-value-label');
        const unitLabel = activityModal.querySelector('#activity-unit-label');
        if (!valueLabel || !unitLabel) return;

        switch (type) {
            case 'steps': unitLabel.value = 'steps'; valueLabel.textContent = 'Steps Count'; break;
            case 'workout': unitLabel.value = 'min'; valueLabel.textContent = 'Duration (minutes)'; break;
            case 'sleep': unitLabel.value = 'hours'; valueLabel.textContent = 'Duration (hours)'; break;
            case 'calories_out': unitLabel.value = 'kcal'; valueLabel.textContent = 'Calories Burned'; break;
            default: unitLabel.value = ''; valueLabel.textContent = 'Value';
        }
    };


    // --- Modal Setup ---
    const activityModalControls = setupModal(activityModal, ['#add-manual-entry-button'], ['#activity-modal-cancel-button']);
    const waterModalControls = setupModal(waterModal, ['#log-water-button'], ['#water-modal-cancel-button']);

    // --- Modal Action Event Listeners (Re-attached) ---
    const attachModalListeners = () => {
        const attachListener = (id, handler) => {
            const el = document.getElementById(id);
            if (el) {
                const newEl = el.cloneNode(true);
                el.parentNode.replaceChild(newEl, el);
                newEl.addEventListener('click', handler);
            }
        };

        document.getElementById('activity-type-select')?.removeEventListener('change', updateActivityUnit);
        document.getElementById('activity-type-select')?.addEventListener('change', updateActivityUnit);
        attachListener('activity-modal-log-button', () => {
            const type = document.getElementById('activity-type-select')?.value;
            const valueInput = document.getElementById('activity-value-input');
            const value = parseFloat(valueInput?.value);
            const unit = document.getElementById('activity-unit-label')?.value;

            if (!type || !valueInput || !unit || isNaN(value) || value <= 0) {
                alert('Please select an activity type and enter a valid positive value.');
                return;
            }
            activityModalControls.hide();
            logFitnessEntry(type, value, unit);
        });

        // Water Log Modal
        document.getElementById('water-quick-select')?.removeEventListener('click', handleWaterQuickSelect);
        document.getElementById('water-quick-select')?.addEventListener('click', handleWaterQuickSelect);

        document.getElementById('water-custom-input')?.removeEventListener('input', handleWaterCustomInput);
        document.getElementById('water-custom-input')?.addEventListener('input', handleWaterCustomInput);

        attachListener('water-modal-log-button', () => {
            if (selectedWaterVolume > 0) {
                waterModalControls.hide();
                logFitnessEntry('water_intake', selectedWaterVolume, 'ml');
            } else {
                alert("Please select a quick option or enter a custom water volume.");
            }
        });
    };

    function handleWaterQuickSelect(e) {
        const btn = e.target.closest('.water-option');
        if (btn) {
            document.querySelectorAll('#water-quick-select .water-option').forEach(b => b.classList.remove('active-select'));
            btn.classList.add('active-select');
            selectedWaterVolume = parseInt(btn.dataset.volume);
            const customInput = document.getElementById('water-custom-input');
            if (customInput) customInput.value = '';
            document.getElementById('water-modal-log-button').disabled = false;
        }
    }

    function handleWaterCustomInput(e) {
        const volume = parseInt(e.target.value);
        const logButton = document.getElementById('water-modal-log-button');
        if (!isNaN(volume) && volume > 0) {
            selectedWaterVolume = volume;
            if (logButton) logButton.disabled = false;
            document.querySelectorAll('#water-quick-select .water-option').forEach(btn => btn.classList.remove('active-select'));
        } else {
            selectedWaterVolume = 0;
            if (logButton && !document.querySelector('#water-quick-select .water-option.active-select')) {
                logButton.disabled = true;
            }
        }
    }


    // --- Page-Specific Event Listeners ---
    function attachFitnessListeners() {
        if (suggestionListEl) {
            if (suggestionListEl._suggestionClickListener) suggestionListEl.removeEventListener('click', suggestionListEl._suggestionClickListener);
            suggestionListEl._suggestionClickListener = (e) => {
                const item = e.target.closest('.suggestion-item');
                if (item && !item.classList.contains('completed')) {
                    const id = item.dataset.suggestionId;
                    if (id && !completedSuggestions.includes(id)) {
                        completedSuggestions.push(id);
                        showFlashMessage('Suggestion marked complete!', 'check');
                        renderFitnessPage();
                    }
                }
            };
            suggestionListEl.addEventListener('click', suggestionListEl._suggestionClickListener);
        }

        const viewLogToggle = mainContentElement?.querySelector('.view-log-toggle');
        if (viewLogToggle) {
            if (viewLogToggle.dataset.listenerAttached) viewLogToggle.removeEventListener('click', viewLogToggle._clickListener); // Clean up
            viewLogToggle._clickListener = (e) => { // Store listener reference
                if (!logListEl) return;
                const action = e.currentTarget.dataset.action;
                if (action === 'hide') {
                    logListEl.style.maxHeight = '0';
                    logListEl.style.opacity = '0';
                    logListEl.style.marginTop = '0';
                    logListEl.style.overflow = 'hidden';
                    e.currentTarget.dataset.action = 'show';
                    e.currentTarget.innerHTML = '<i data-feather="chevron-down"></i> Show Log History';
                } else {
                    logListEl.style.maxHeight = '250px';
                    logListEl.style.opacity = '1';
                    logListEl.style.marginTop = '12px';
                    logListEl.style.overflow = 'auto';
                    e.currentTarget.dataset.action = 'hide';
                    e.currentTarget.innerHTML = '<i data-feather="chevron-up"></i> Hide Log History';
                }
                try { feather.replace(); } catch (fe) { }
            };
            viewLogToggle.addEventListener('click', viewLogToggle._clickListener);
            viewLogToggle.dataset.listenerAttached = 'true';
        }
    }

    // --- Initial Render & Setup ---
    updateActivityUnit(); // Initial unit setup
    renderFitnessPage();
    attachModalListeners();
}


// ===============================================
// XII. MOOD PAGE LOGIC
// ===============================================

// Global function for rendering the mood page
let renderMoodPage = () => { console.warn("renderMoodPage called before assignment."); };

function initializeMoodPage() {
    console.log("Initializing Mood Page Logic...");
    let activeTimer = null; // Timer state for meditation remedy

    // --- DOM Element References ---
    const stressValueEl = mainContentElement?.querySelector('#stress-index-value');
    const stressLabelEl = mainContentElement?.querySelector('#stress-index-label');
    const addMoodButton = mainContentElement?.querySelector('#add-mood-entry-button');
    const remedyListEl = mainContentElement?.querySelector('#remedy-list');
    const moodChartCanvas = mainContentElement?.querySelector('#mood-trend-chart');
    const moodChartPlaceholder = mainContentElement?.querySelector('#mood-chart-placeholder');

    const moodModal = document.getElementById('add-mood-modal');

    // --- Core Render Function ---
    renderMoodPage = () => {
        // console.log("Rendering mood page...");
        if (!mainContentElement) return;

        // --- Calculate KPIs ---
        const safeMoodHistory = Array.isArray(moodHistory) ? moodHistory : [];
        const latestEntry = safeMoodHistory[0] || { mood: 2, stress: 45, isFinal: false };
        let stressScore = latestEntry.stress || 45;
        let stressLevel = stressScore > 75 ? 'High' : (stressScore > 40 ? 'Moderate' : 'Low');
        let stressColor = stressScore > 75 ? 'var(--c-accent-red)' : (stressScore > 40 ? 'var(--c-accent-yellow)' : 'var(--c-primary)');

        // --- Update KPI Elements ---
        if (stressValueEl) {
            stressValueEl.textContent = `${stressScore}%`;
            stressValueEl.style.color = stressColor;
        }
        if (stressLabelEl) {
            stressLabelEl.textContent = stressLevel;
        }

        // --- Update "Add Mood Entry" Button State ---
        const hasLoggedTodayFinal = safeMoodHistory.some(e => e.date === TODAY_DATE && e.isFinal);
        if (addMoodButton) {
            addMoodButton.disabled = hasLoggedTodayFinal;
            addMoodButton.innerHTML = hasLoggedTodayFinal
                ? '<i data-feather="check"></i> Logged Today'
                : '<i data-feather="plus"></i> Add Mood Entry';
            addMoodButton.style.opacity = hasLoggedTodayFinal ? 0.6 : 1;
            addMoodButton.style.cursor = hasLoggedTodayFinal ? 'default' : 'pointer';
        }

        // --- Render Mood Trend Chart ---
        const moodChartCtx = moodChartCanvas?.getContext('2d');
        if (moodChartCtx) {
            setTimeout(() => { // Introduce delay
                if (typeof Chart === 'undefined') {
                    console.warn("Chart.js missing for Mood Trend Chart.");
                    if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
                    if (moodChartCanvas) moodChartCanvas.style.display = 'none';
                    return;
                }

                // ... (data preparation is unchanged) ...
                const safeMoodHistory = Array.isArray(moodHistory) ? moodHistory : [];
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
                const thirtyDaysAgoStr = getTodayDateString(thirtyDaysAgo);

                const last30DaysData = safeMoodHistory
                    .filter(log => log.id !== 'temp-mood' && log.date >= thirtyDaysAgoStr && log.date <= TODAY_DATE)
                    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

                const chartData = {
                    labels: last30DaysData.map(log => new Date(log.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })),
                    datasets: [{
                        label: 'Mood',
                        data: last30DaysData.map(log => log.mood),
                        borderColor: 'var(--c-primary)',
                        backgroundColor: 'rgba(0, 199, 166, 0.1)',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: 'var(--c-primary)'
                    }]
                };

                if (moodTrendChartInstance) {
                    moodTrendChartInstance.destroy();
                    moodTrendChartInstance = null;
                }

                try {
                    moodTrendChartInstance = new Chart(moodChartCtx, {
                        type: 'line',
                        data: chartData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { grid: { display: false } },
                                y: {
                                    min: 0,
                                    max: 4,
                                    ticks: {
                                        stepSize: 1,
                                        callback: function (value) {
                                            return Object.values(moodMap).find(m => m.value === value)?.label || '';
                                        }
                                    },
                                    grid: { color: '#eaeaea' }
                                }
                            },
                            plugins: {
                                legend: { display: false }
                            }
                        }
                    });
                    if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'none';
                    if (moodChartCanvas) moodChartCanvas.style.display = 'block';

                } catch (chartError) {
                    console.error("Error creating Mood Trend Chart:", chartError);
                    if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
                    if (moodChartCanvas) moodChartCanvas.style.display = 'none';
                }
            }, 100); // End of setTimeout
        } else if (moodChartCanvas) {
            if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
            moodChartCanvas.style.display = 'none';
        } else {
            if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
        }


        try { feather.replace(); } catch (e) { console.warn("Feather replace failed in mood render:", e); }

        attachMoodListeners();
    };

    // --- Action Handler for Logging Mood ---
    async function logMoodEntry(moodValue, note) {
        let currentStress = (moodHistory[0] || { stress: 45 }).stress;
        let newStress = currentStress;
        if (moodValue < 2) {
            newStress = Math.min(95, currentStress + 10);
        } else if (moodValue > 2) {
            newStress = Math.max(10, currentStress - 15);
        }

        const newEntry = {
            date: TODAY_DATE,
            mood: moodValue,
            note: note || null,
            stress: newStress,
            isFinal: true
        };

        showFlashMessage('Logging your mood...', 'loader');
        try {
            await moodApiService.create(newEntry);
            showFlashMessage('Mood logged successfully!', 'check-circle');
            await refreshState('mood');
        } catch (error) {
            console.error("Failed to log mood:", error);
        }
    }


    // --- Modal Setup ---
    const moodModalControls = setupModal(moodModal, ['#add-mood-entry-button'], ['#mood-modal-cancel-button'], () => {
        const defaultMood = 'neutral';
        const moodValueInput = moodModal?.querySelector('#current-mood-value');
        const moodLabelEl = moodModal?.querySelector('#selected-mood-label');
        const notesInput = moodModal?.querySelector('#mood-notes-input');
        const moodSelector = moodModal?.querySelector('#mood-selector');

        if (moodValueInput) moodValueInput.value = defaultMood;
        if (moodLabelEl) {
            moodLabelEl.textContent = moodMap[defaultMood].label;
            moodLabelEl.style.color = moodMap[defaultMood].color;
        }
        if (notesInput) notesInput.value = '';
        moodSelector?.querySelectorAll('span').forEach(s => {
            const isDefault = s.dataset.mood === defaultMood;
            s.style.opacity = isDefault ? '1' : '0.5';
            s.style.transform = isDefault ? 'scale(1.2)' : 'scale(1)';
        });
    });


    // --- Modal Action Event Listeners (Re-attached) ---
    const attachModalListeners = () => {
        document.getElementById('mood-selector')?.removeEventListener('click', handleMoodSelection);
        document.getElementById('mood-selector')?.addEventListener('click', handleMoodSelection);

        const moodLogButton = document.getElementById('mood-modal-add-button');
        if (moodLogButton) {
            const newBtn = moodLogButton.cloneNode(true);
            moodLogButton.parentNode.replaceChild(newBtn, moodLogButton);
            newBtn.addEventListener('click', () => {
                const moodKey = document.getElementById('current-mood-value')?.value;
                const note = document.getElementById('mood-notes-input')?.value.trim();
                const moodValue = moodMap[moodKey]?.value;

                if (moodValue === undefined) {
                    alert("Please select your current mood.");
                    return;
                }
                moodModalControls.hide();
                logMoodEntry(moodValue, note);
            });
        }
    };

    function handleMoodSelection(e) {
        const span = e.target.closest('span[data-mood]');
        if (span) {
            const moodKey = span.dataset.mood;
            const moodData = moodMap[moodKey];
            const moodValueInput = document.getElementById('current-mood-value');
            const moodLabelEl = document.getElementById('selected-mood-label');

            if (moodValueInput) moodValueInput.value = moodKey;
            if (moodLabelEl) {
                moodLabelEl.textContent = moodData.label;
                moodLabelEl.style.color = moodData.color;
            }
            document.querySelectorAll('#mood-selector span').forEach(s => {
                const isSelected = s === span;
                s.style.opacity = isSelected ? '1' : '0.5';
                s.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
            });
        }
    }


    // --- Remedy Timer Logic ---
    function markRemedyComplete(button, originalText, type) {
        const remedyItem = button.closest('.suggestion-item');
        if (!remedyItem) return;
        remedyItem.classList.add('completed');
        button.textContent = 'Done!';
        button.disabled = true;
        if (type === 'timer') {
            showFlashMessage('Meditation complete. Stress hopefully reduced!', 'smile');
        } else {
            showFlashMessage('Activity logged as completed.', 'check');
        }
    }

    // --- Page-Specific Event Listeners ---
    function attachMoodListeners() {
        if (!remedyListEl) return;

        if (remedyListEl._remedyClickListener) remedyListEl.removeEventListener('click', remedyListEl._remedyClickListener);

        remedyListEl._remedyClickListener = (e) => {
            const button = e.target.closest('.remedy-button');
            const remedyItem = e.target.closest('.suggestion-item');
            if (!button || !remedyItem || button.disabled || remedyItem.classList.contains('completed')) {
                return;
            }

            const remedyType = remedyItem.dataset.remedy;
            const originalText = button.textContent;
            let duration = 0;

            if (remedyType === 'meditate') duration = 5;

            if (activeTimer && duration > 0) {
                alert("Another timed activity (like meditation) is already in progress.");
                return;
            }

            if (duration > 0) {
                showFlashMessage(`Starting ${duration} min ${remedyType}...`, 'clock');
                button.disabled = true;
                button.innerHTML = `<i data-feather="loader" class="spin"></i> ${duration}:00`;
                try { feather.replace(); } catch (fe) { }

                let remainingSeconds = duration * 60;
                activeTimer = setInterval(() => {
                    remainingSeconds--;
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    button.innerHTML = `<i data-feather="loader" class="spin"></i> ${minutes}:${seconds.toString().padStart(2, '0')}`;
                    try { feather.replace(); } catch (fe) { }

                    if (remainingSeconds <= 0) {
                        clearInterval(activeTimer);
                        activeTimer = null;
                        markRemedyComplete(button, originalText, 'timer');
                    }
                }, 1000);
            } else {
                showFlashMessage(`${remedyType === 'break' ? 'Break' : 'Reading'} logged.`, 'check');
                markRemedyComplete(button, originalText, 'log');
            }
        };
        remedyListEl.addEventListener('click', remedyListEl._remedyClickListener);
    }

    // --- Initial Render & Setup ---
    renderMoodPage();
    attachModalListeners();
}


// ===============================================
// XIII. VAULT PAGE LOGIC
// ===============================================

// Global function for rendering vault assets
let renderAssets = () => { console.warn("renderAssets called before assignment."); };

function initializeVaultPage() {
    console.log("Initializing Vault Page Logic...");
    let activeFilter = 'All';
    let searchQuery = '';
    let assetToDeleteId = null;
    let currentModalAsset = null;

    // --- DOM Element References ---
    const mainVaultGrid = mainContentElement?.querySelector('#main-vault-grid');
    const assetFilterBar = mainContentElement?.querySelector('#asset-filter-bar');
    const assetSearchInput = mainContentElement?.querySelector('#asset-search-input');
    const vaultEmptyMessage = mainContentElement?.querySelector('#vault-empty-message');

    const assetModal = document.getElementById('asset-modal');
    const deleteConfirmModal = document.getElementById('delete-asset-confirm-modal');
    const taskSchedulerModal = document.getElementById('task-scheduler-modal');


    // --- Core Render Function ---
    renderAssets = () => {
        if (!mainVaultGrid) return;
        // console.log(`Rendering assets. Filter: ${activeFilter}, Search: "${searchQuery}"`);

        const safeAssetState = Array.isArray(assetState) ? assetState : [];
        const lowerSearchQuery = searchQuery.toLowerCase();
        let filteredAssets = safeAssetState.filter(asset => {
            const matchesFilter = activeFilter === 'All' || asset.type === activeFilter;
            const matchesSearch = !searchQuery ||
                (asset.name && asset.name.toLowerCase().includes(lowerSearchQuery)) ||
                (asset.type && asset.type.toLowerCase().includes(lowerSearchQuery)) ||
                (asset.url && asset.url.toLowerCase().includes(lowerSearchQuery));
            return matchesFilter && matchesSearch;
        });

        filteredAssets.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // --- Rendering Grid Items ---
        mainVaultGrid.innerHTML = '';
        if (filteredAssets.length === 0) {
            if (vaultEmptyMessage) {
                vaultEmptyMessage.textContent = `No links found matching filter "${activeFilter}" ${searchQuery ? `and search "${searchQuery}"` : ''}.`;
                vaultEmptyMessage.style.display = 'block';
                vaultEmptyMessage.style.gridColumn = '1 / -1';
            } else {
                mainVaultGrid.innerHTML = `<div style="text-align: center; color: var(--c-text-muted); padding: 20px; grid-column: 1 / -1;">No links found.</div>`;
            }
        } else {
            if (vaultEmptyMessage) vaultEmptyMessage.style.display = 'none';

            filteredAssets.forEach(asset => {
                const item = document.createElement('div');
                item.className = 'vault-item';
                item.dataset.id = asset.id;
                item.dataset.url = asset.url;
                if (['Dev', 'Video', 'Creative'].includes(asset.type)) {
                    item.classList.add('action-task');
                }

                const iconName = asset.icon || 'link';

                item.innerHTML = `
                    <div class="context-menu">
                        <button class="edit-asset-button" data-id="${asset.id}" title="Edit"><i data-feather="edit-2" style="width: 16px; height: 16px;"></i></button>
                        <button class="delete-asset-button" data-id="${asset.id}" title="Delete"><i data-feather="x" style="width: 16px; height: 16px;"></i></button>
                    </div>
                    <i data-feather="${iconName}"></i>
                    <p title="${asset.name}">${asset.name}</p> <span>${asset.type || 'Link'}</span> `;
                mainVaultGrid.appendChild(item);
            });
        }

        // --- Add the "Add New" Tile Dynamically ---
        const addTile = document.createElement('div');
        addTile.className = 'vault-item add-new';
        addTile.id = 'add-new-vault-tile';
        addTile.innerHTML = `<i data-feather="plus-circle"></i><p>Add New Link</p><span>Click to add</span>`;
        mainVaultGrid.appendChild(addTile);

        try { feather.replace(); } catch (e) { console.warn("Feather error during asset render:", e); }

        attachAssetItemListeners();
    };

    // --- Action Handler for Deleting Asset ---
    async function deleteAsset(assetId) {
        const assetName = assetState.find(a => a.id === assetId)?.name || 'this link';
        showFlashMessage(`Deleting ${assetName}...`, 'loader');
        try {
            await assetApiService.delete(assetId);
            showFlashMessage('Link deleted successfully.', 'trash-2');
            await refreshState('assets');
        } catch (error) {
            console.error("Failed to delete asset:", error);
        }
    }

    // --- Modal Setup ---
    const assetModalControls = setupModal(assetModal, ['#add-asset-button', '#add-new-vault-tile'], ['#asset-modal-cancel-button'], () => {
        assetModal.querySelector('#asset-modal-title').textContent = 'Add New Link';
        const actionButton = assetModal.querySelector('#asset-modal-action-button');
        actionButton.textContent = 'Add Link';
        actionButton.dataset.mode = 'add';
        assetModal.querySelector('#asset-modal-delete-button').style.display = 'none';
        assetModal.querySelector('#asset-id-input').value = '';
        assetModal.querySelector('#asset-name-input').value = '';
        assetModal.querySelector('#asset-type-select').value = 'Social';
        assetModal.querySelector('#asset-icon-select').value = 'link';
        assetModal.querySelector('#asset-url-input').value = '';
    });

    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-asset-cancel-button']);
    const taskSchedulerControls = setupModal(taskSchedulerModal, [], ['#task-scheduler-cancel-button']);


    const openEditAssetModal = (assetId) => {
        const asset = assetState.find(a => a.id === assetId);
        if (!asset || !assetModal) return;

        assetModal.querySelector('#asset-modal-title').textContent = `Edit Link: ${asset.name}`;
        const actionButton = assetModal.querySelector('#asset-modal-action-button');
        actionButton.textContent = 'Save Changes';
        actionButton.dataset.mode = 'edit';
        assetModal.querySelector('#asset-modal-delete-button').style.display = 'block';
        assetModal.querySelector('#asset-id-input').value = asset.id;
        assetModal.querySelector('#asset-name-input').value = asset.name;
        assetModal.querySelector('#asset-type-select').value = asset.type || 'Social';
        assetModal.querySelector('#asset-icon-select').value = asset.icon || 'link';
        assetModal.querySelector('#asset-url-input').value = asset.url;

        assetModalControls.show();
    };

    const showDeleteConfirmModal = (id, name) => {
        if (!deleteConfirmModal) return;
        assetToDeleteId = id;
        const messageEl = deleteConfirmModal.querySelector('#delete-asset-confirm-message');
        if (messageEl) messageEl.textContent = `Are you sure you want to delete the link: "${name}"?`;
        deleteModalControls.show();
    };

    const openTaskSchedulerModal = () => {
        if (!currentModalAsset || !taskSchedulerModal) return;

        taskSchedulerModal.querySelector('#task-scheduler-title').textContent = `Schedule Focus: ${currentModalAsset.name}`;
        const textInput = taskSchedulerModal.querySelector('#task-scheduler-text-input');
        textInput.value = '';
        textInput.placeholder = (currentModalAsset.type === 'Dev') ? 'e.g., Work on feature X' :
            (currentModalAsset.type === 'Video' || currentModalAsset.type === 'Creative') ? 'e.g., Edit project Y' :
                'Describe the task...';
        taskSchedulerModal.querySelector('#task-scheduler-duration-input').value = '60';

        taskSchedulerControls.show();
    };

    // --- Modal Action Event Listeners (Re-attached) ---
    const attachModalActionListeners = () => {
        const attachListener = (id, handler) => {
            const el = document.getElementById(id);
            if (el) {
                const newEl = el.cloneNode(true);
                el.parentNode.replaceChild(newEl, el);
                newEl.addEventListener('click', handler);
            }
        };

        attachListener('asset-modal-action-button', handleSaveAsset);
        attachListener('asset-modal-delete-button', handleDeleteAssetTrigger);
        attachListener('delete-asset-confirm-button', handleDeleteAssetConfirm);
        attachListener('task-scheduler-add-button', handleScheduleTask);
    };


    // --- Modal Handler Functions ---
    async function handleSaveAsset() {
        if (!assetModal) return;
        const mode = assetModal.querySelector('#asset-modal-action-button').dataset.mode;
        const assetData = {
            id: assetModal.querySelector('#asset-id-input').value,
            name: assetModal.querySelector('#asset-name-input').value.trim(),
            type: assetModal.querySelector('#asset-type-select').value,
            icon: assetModal.querySelector('#asset-icon-select').value,
            url: assetModal.querySelector('#asset-url-input').value.trim()
        };

        if (!assetData.name || !assetData.url) {
            alert('Link Name and URL are required.');
            return;
        }
        try { new URL(assetData.url); } catch (_) { alert('Please enter a valid URL (including http:// or https://)'); return; }


        assetModalControls.hide();
        showFlashMessage(mode === 'add' ? 'Adding link...' : 'Saving changes...', 'loader');
        try {
            if (mode === 'add') {
                const { id, ...createData } = assetData;
                await assetApiService.create(createData);
                showFlashMessage('Link added successfully!', 'plus-circle');
            } else {
                const { id, ...updateData } = assetData;
                await assetApiService.update(assetData.id, updateData);
                showFlashMessage('Link updated successfully!', 'save');
            }
            await refreshState('assets'); // <-- CRITICAL: Ensures instant UI update
        } catch (error) { console.error(`Failed to ${mode} asset:`, error); }
    }

    function handleDeleteAssetTrigger() {
        if (!assetModal) return;
        const assetId = assetModal.querySelector('#asset-id-input').value;
        const asset = assetState.find(a => a.id === assetId);
        if (asset) {
            assetModalControls.hide();
            showDeleteConfirmModal(asset.id, asset.name);
        }
    }

    async function handleDeleteAssetConfirm() {
        if (assetToDeleteId) {
            deleteModalControls.hide();
            await deleteAsset(assetToDeleteId);
            assetToDeleteId = null;
        }
    }

    async function handleScheduleTask() {
        if (!taskSchedulerModal || !currentModalAsset) return;
        const taskText = taskSchedulerModal.querySelector('#task-scheduler-text-input').value.trim();
        const durationInput = taskSchedulerModal.querySelector('#task-scheduler-duration-input');
        const duration = parseInt(durationInput?.value);

        if (!taskText || isNaN(duration) || duration <= 0) {
            alert('Please enter a valid task description and a positive duration in minutes.');
            return;
        }

        taskSchedulerControls.hide();
        await addNewTaskFromVault(`${taskText} (from ${currentModalAsset.name})`, duration);

        if (currentModalAsset.url) {
            showFlashMessage(`Launching ${currentModalAsset.name}...`, 'link');
            window.open(currentModalAsset.url, '_blank');
        }
        currentModalAsset = null;
    }


    // --- Vault Grid Item Event Listeners (using delegation) ---
    function attachAssetItemListeners() {
        if (mainVaultGrid?._assetItemClickListener) mainVaultGrid.removeEventListener('click', mainVaultGrid._assetItemClickListener);
        if (!mainVaultGrid) return;

        mainVaultGrid._assetItemClickListener = (e) => {
            const item = e.target.closest('.vault-item:not(.add-new)');
            const editButton = e.target.closest('.edit-asset-button');
            const deleteButton = e.target.closest('.delete-asset-button');

            if (editButton) {
                e.stopPropagation();
                openEditAssetModal(editButton.dataset.id);
            } else if (deleteButton) {
                e.stopPropagation();
                const asset = assetState.find(a => a.id === deleteButton.dataset.id);
                if (asset) showDeleteConfirmModal(asset.id, asset.name);
            } else if (item) {
                const assetId = item.dataset.id;
                const asset = assetState.find(a => a.id === assetId);
                if (!asset) {
                    return;
                }

                if (item.classList.contains('action-task')) {
                    currentModalAsset = asset;
                    openTaskSchedulerModal();
                } else {
                    if (asset.url) {
                        try {
                            new URL(asset.url);
                            showFlashMessage(`Launching ${asset.name}...`, 'link');
                            window.open(asset.url, '_blank');
                        } catch (_) {
                            showFlashMessage(`Invalid URL for ${asset.name}.`, 'alert-circle');
                            alert(`The stored URL for "${asset.name}" seems invalid:\n${asset.url}`);
                        }
                    } else {
                        showFlashMessage(`No URL defined for ${asset.name}.`, 'alert-circle');
                    }
                }
            }
        };
        mainVaultGrid.addEventListener('click', mainVaultGrid._assetItemClickListener);
    }


    // --- Filter Bar Listener ---
    if (assetFilterBar) {
        if (assetFilterBar._filterClickListener) assetFilterBar.removeEventListener('click', assetFilterBar._filterClickListener);
        assetFilterBar._filterClickListener = (e) => {
            if (e.target.classList.contains('filter-item')) {
                assetFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                activeFilter = e.target.dataset.filter;
                renderAssets();
            }
        };
        assetFilterBar.addEventListener('click', assetFilterBar._filterClickListener);
    }

    // --- Search Input Listener ---
    if (assetSearchInput) {
        if (assetSearchInput._searchInputListener) assetSearchInput.removeEventListener('input', assetSearchInput._searchInputListener);
        assetSearchInput._searchInputListener = (e) => {
            searchQuery = e.target.value;
            renderAssets();
        };
        assetSearchInput.addEventListener('input', assetSearchInput._searchInputListener);
    }


    // --- Initial Render & Setup ---
    renderAssets();
    attachAssetItemListeners();
    attachModalActionListeners();
}


// ===============================================
// XIV. INSIGHTS & SETTINGS PAGES
// ===============================================

/**
 * Initializes logic for the Insights page.
 */
function initializeInsightsPage() {
    console.log("Initializing Insights Page");
    if (!mainContentElement) return;

    // --- DOM Element References ---
    const insightsChartCanvas = mainContentElement.querySelector('#insights-trend-chart');
    const insightsChartPlaceholder = mainContentElement.querySelector('#insights-chart-placeholder');
    const recommendationList = mainContentElement.querySelector('#ai-recommendation-feed');

    if (typeof Chart === 'undefined') {
        console.warn("Insights page: Chart.js library not loaded. Cannot render charts.");
        if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'flex';
        if (insightsChartCanvas) insightsChartCanvas.style.display = 'none';
        return;
    }


    // --- Task Completion Trend Chart (Mock/Example) ---
    if (insightsChartCanvas) {
        setTimeout(() => { // Introduce delay
            if (typeof Chart === 'undefined') {
                console.warn("Insights page: Chart.js library not loaded. Cannot render charts.");
                if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'flex';
                if (insightsChartCanvas) insightsChartCanvas.style.display = 'none';
                return;
            }

            const insightsChartCtx = insightsChartCanvas.getContext('2d');
            const weeksLabels = ["Week -3", "Week -2", "Week -1", "This Week"];
            const weeksCompletionData = [75, 80, 70, 85]; // Mock data

            const taskTrendData = {
                labels: weeksLabels,
                datasets: [{
                    label: 'Task Completion %',
                    data: weeksCompletionData,
                    borderColor: 'var(--c-primary)',
                    backgroundColor: 'rgba(0, 199, 166, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            };

            if (globalThis.insightsTaskChartInstance) globalThis.insightsTaskChartInstance.destroy();

            try {
                globalThis.insightsTaskChartInstance = new Chart(insightsChartCtx, {
                    type: 'line',
                    data: taskTrendData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Completion Rate (%)' } } },
                        plugins: { legend: { display: false } }
                    }
                });
                if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'none';
                insightsChartCanvas.style.display = 'block';
            } catch (chartError) {
                console.error("Error creating Insights task trend chart:", chartError);
                if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'flex';
                insightsChartCanvas.style.display = 'none';
            }
        }, 100); // End of setTimeout
    }


    // --- AI Recommendation Feed (Mock) ---
    if (recommendationList) {
        const recommendations = [
            { id: 'rec1', status: 'finance', icon: 'alert-triangle', text: 'Overdue: Netflix Bill. Pay Now.', buttonText: 'Pay', action: 'pay-bill', dataId: (billState.find(b => b.overdue) || { id: 'mock-bill-id' }).id },
            { id: 'rec2', status: 'health', icon: 'moon', text: 'Consistent low sleep detected. Try adjusting bedtime.', buttonText: 'Plan Sleep', action: 'plan-sleep' },
            { id: 'rec3', status: 'task', icon: 'alert-circle', text: 'Task "Project Report" is frequently marked late.', buttonText: 'Review Task', action: 'review-task', dataId: (taskState.find(t => t.priority === 'high') || { id: 'mock-task-id' }).id },
        ];

        recommendationList.innerHTML = '';
        if (recommendations.length === 0) {
            recommendationList.innerHTML = `<li class="remedy-item" data-status="info"><i data-feather="thumbs-up"></i><p>No specific recommendations right now.</p></li>`;
        } else {
            recommendations.forEach(item => {
                const li = document.createElement('li');
                li.className = `remedy-item`;
                li.dataset.status = item.status;
                li.dataset.actionType = item.action;
                li.dataset.id = item.dataId || item.id;
                li.innerHTML = `
                      <i data-feather="${item.icon}"></i>
                      <p>${item.text}</p>
                      <button class="remedy-button" data-action="${item.action}" data-id="${item.dataId || item.id}">${item.buttonText}</button>
                  `;
                recommendationList.appendChild(li);
            });
        }
        try { feather.replace(); } catch (e) { }

        if (recommendationList._recClickListener) recommendationList.removeEventListener('click', recommendationList._recClickListener);
        recommendationList._recClickListener = handleRecommendationClick;
        recommendationList.addEventListener('click', recommendationList._recClickListener);

    }

    console.log("Insights Page Initialized.");
}

// --- Event Handler for Insights Recommendations (Example) ---
async function handleRecommendationClick(e) {
    const button = e.target.closest('.remedy-button');
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const itemId = button.dataset.id;
    // console.log(`Recommendation action: ${action}, ID: ${itemId}`);
    showFlashMessage(`Handling recommendation: ${action}...`, 'loader');

    try {
        if (action === 'pay-bill') {
            await markBillAsPaid(itemId);
            await refreshState('bills');
        } else if (action === 'plan-sleep') {
            navigateToPage('fitness.html');
        } else if (action === 'review-task') {
            navigateToPage('tasks.html');
        } else {
            console.warn("Unknown recommendation action:", action);
            showFlashMessage(`Action "${action}" not implemented yet.`, 'info');
        }

    } catch (error) {
        console.error(`Error handling recommendation action ${action}:`, error);
        showFlashMessage(`Failed to handle recommendation. Check console.`, 'alert-triangle');
    } finally {
        const loadMsg = Array.from(document.querySelectorAll('#flash-message-container .flash-message'))
            .find(m => m.textContent.includes(`Handling recommendation: ${action}`));
        if (loadMsg) {
            loadMsg.style.opacity = '0';
            setTimeout(() => loadMsg.remove(), 500);
        }
    }
}


/**
 * Initializes logic for the Settings page.
 */
function initializeSettingsPage() {
    console.log("Initializing Settings Page...");
    if (!mainContentElement) return;

    // --- DOM Element References ---
    const profileCard = mainContentElement.querySelector('.settings-card');
    const profileNameInput = mainContentElement.querySelector('#profile-name-input');
    const profileEmailInput = mainContentElement.querySelector('#profile-email-input');
    const saveProfileButton = mainContentElement.querySelector('#save-profile-button');
    const deleteDataButton = mainContentElement.querySelector('#delete-data-button');
    const deleteDataConfirmModal = document.getElementById('delete-data-confirm-modal');

    // --- Logout Button ---
    if (profileCard) {
        let logoutButton = profileCard.querySelector('#logout-button');
        if (!logoutButton) {
            logoutButton = document.createElement('button');
            logoutButton.id = 'logout-button';
            logoutButton.className = 'modal-button delete';
            logoutButton.innerHTML = '<i data-feather="log-out"></i> Log Out';
            logoutButton.style.width = '100%';
            logoutButton.style.marginTop = '20px';
            if (saveProfileButton) {
                saveProfileButton.insertAdjacentElement('afterend', logoutButton);
            } else {
                profileCard.appendChild(logoutButton);
            }
            try { feather.replace(); } catch (e) { }
        }
        const newLogoutButton = logoutButton.cloneNode(true);
        logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
        newLogoutButton.addEventListener('click', logout);
    }


    // --- Populate Profile Info ---
    const populateProfile = async () => {
        if (!profileNameInput || !profileEmailInput) return;

        if (!window.auth0Client || !(await window.auth0Client.isAuthenticated())) {
            profileNameInput.value = 'Not logged in';
            profileEmailInput.value = '';
            profileEmailInput.disabled = true;
            return;
        }

        try {
            const user = await window.auth0Client.getUser();
            if (user) {
                profileNameInput.value = user.name || user.nickname || 'Name not set';
                profileEmailInput.value = user.email || 'Email not available';
                profileEmailInput.disabled = true;
                await updateGlobalUIElements();
            } else {
                profileNameInput.value = 'Could not load profile';
                profileEmailInput.value = '';
            }
        } catch (err) {
            console.error("Error fetching user profile for settings:", err);
            profileNameInput.value = 'Error loading profile';
            profileEmailInput.value = '';
        }
    };
    populateProfile();


    // --- Mock Settings Actions ---
    if (saveProfileButton) {
        const newSaveBtn = saveProfileButton.cloneNode(true);
        saveProfileButton.parentNode.replaceChild(newSaveBtn, saveProfileButton);
        newSaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showFlashMessage('Profile save simulated. No changes persisted.', 'save');
        });
    }

    const deleteModalControls = setupModal(deleteDataConfirmModal, ['#delete-data-button'], ['#delete-data-cancel-button']);

    const deleteDataConfirmButton = document.getElementById('delete-data-confirm-button');
    if (deleteDataConfirmButton) {
        const newConfirmBtn = deleteDataConfirmButton.cloneNode(true);
        deleteDataConfirmButton.parentNode.replaceChild(newConfirmBtn, deleteDataConfirmButton);
        newConfirmBtn.addEventListener('click', () => {
            showFlashMessage('Simulating data deletion... (no actual deletion)', 'trash-2');
            deleteModalControls.hide();
        });
    }

    const importButton = mainContentElement.querySelector('#import-data-button');
    const fileInput = mainContentElement.querySelector('#import-file-input');
    if (importButton && fileInput) {
        if (importButton._clickListener) importButton.removeEventListener('click', importButton._clickListener); // Clean up
        if (fileInput._changeListener) fileInput.removeEventListener('change', fileInput._changeListener); // Clean up

        importButton._clickListener = () => fileInput.click();
        importButton.addEventListener('click', importButton._clickListener);

        fileInput._changeListener = (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/json') {
                showFlashMessage(`Simulating import of ${file.name}...`, 'upload');
            } else if (file) {
                alert("Please select a valid JSON file (.json).");
            }
            fileInput.value = '';
        };
        fileInput.addEventListener('change', fileInput._changeListener);
    }

    const exportButton = mainContentElement.querySelector('#export-data-button');
    if (exportButton) {
        if (exportButton._clickListener) exportButton.removeEventListener('click', exportButton._clickListener);
        exportButton._clickListener = () => showFlashMessage('Simulating data export...', 'download');
        exportButton.addEventListener('click', exportButton._clickListener);
    }

    // --- Make all toggles functional for the demo ---
    const attachToggleListeners = () => {
        const toggleSwitches = mainContentElement.querySelectorAll('.toggle-switch');

        toggleSwitches.forEach(toggle => {
            if (toggle._toggleListener) {
                toggle.removeEventListener('change', toggle._toggleListener);
            }

            toggle._toggleListener = () => {
                const settingName = toggle.id.replace('toggle-', '');
                if (toggle.checked) {
                    showFlashMessage(`${settingName} enabled.`, 'toggle-right');
                } else {
                    showFlashMessage(`${settingName} disabled.`, 'toggle-left');
                }
            };
            toggle.addEventListener('change', toggle._toggleListener);
        });
    };

    // Call this new function at the end of initializeSettingsPage:
    attachToggleListeners();

    console.log("Settings Page Initialized.");
}


// ===============================================
// XV. MAIN SCRIPT EXECUTION (ENTRY POINT) - FIXED
// ===============================================

/**
 * Single, robust entry point for the SPA after the DOM is fully loaded.
 */
window.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM Loaded. Starting App Initialization (FIXED FLOW)...");

    // <<< START FIX 1 >>>
    // DECLARE pathPageName here so it's initialized before the login page check
    const pathPageNameFromUrl = window.location.pathname.split('/').pop() || 'index.html';
    let pathPageName = pathPageNameFromUrl;
    // <<< END FIX 1 >>>

    // --- Ensure Flash Message Container Exists ---
    if (!document.getElementById('flash-message-container')) {
        const container = document.createElement('div');
        container.id = 'flash-message-container';
        Object.assign(container.style, {
            position: 'fixed', top: '90px', right: '40px', zIndex: '9999',
            display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
        });
        document.body.appendChild(container);
    }

    // --- Phase 1: Initialize Auth0 Client ---
    try {
        await initAuth();
        await waitForAuth();
    } catch (err) {
        console.error("STOPPING Initialization: Auth0 client failed to configure/load.", err);
        document.body.innerHTML = "<h1>Authentication Error</h1><p>The authentication system could not start. Please check console for details and ensure Auth0 settings are correct.</p>";
        return;
    }

    // --- LOGIC FORK: Login Page vs Protected App ---
    if (pathPageName === 'login.html') { // Uses the pathPageName variable
        // --- On the LOGIN PAGE ---
        console.log("On Login Page. Initializing login logic.");
        initializeLoginPage();
        try { feather.replace(); } catch (e) { }
        return; // Stop SPA flow on the login page
    }


    // --- Protected App Flow ---

    // --- Phase 2: Handle Auth0 Callback ---
    console.log("Phase 2: Handling Potential Auth Callback...");
    const callbackProcessed = await handleAuthCallback();

    // <<< START FIX 2 >>>
    // Update the pathPageName variable declared earlier, using the callback result if available.
    if (window.appStateTargetPage) {
        pathPageName = window.appStateTargetPage;
    }
    // <<< END FIX 2 >>>

    // --- Phase 3: Authentication Guard & Redirect ---
    console.log("Phase 3: Checking Authentication Status...");
    try {
        // ensureAuthReady will either confirm authentication or initiate a redirect
        await ensureAuthReady();
    } catch (err) {
        if (err.message === 'Login required') {
            console.log("Redirect initiated by Auth0. Halting script for this page load.");
            return; // Stop execution if a redirect is in progress
        }
        // Other errors (e.g., Auth0 token failure) should be handled by ensureAuthReady's internal logic
        // but re-throwing here ensures the flow stops.
        console.error("Auth Guard failed unexpectedly:", err);
        return;
    }


    // --- Phase 4: Core SPA UI Setup (Runs Only Once) ---
    console.log("Phase 4: Setting up Global UI (SPA)...");
    mainContentElement = document.querySelector('.main-content');
    if (!mainContentElement) {
        console.error("CRITICAL ERROR: <main class='main-content'> element not found.");
        document.body.innerHTML = "<h1>Application Error</h1><p>Core application structure missing. Cannot load content.</p>";
        return;
    }
    // NEW LOGIC: Inject global modals if not present.
    // Modals are only defined in index.html, so we fetch and inject them to support direct links.
    if (!document.getElementById('add-bill-modal')) { // Check for a known modal ID
        console.log("Injecting global modals from index.html template...");
        try {
            const modalResponse = await fetch('/index.html?v=' + Date.now());
            const modalHtmlText = await modalResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(modalHtmlText, 'text/html');
            // Select ALL modal overlays from the bottom of index.html
            const modalElements = doc.querySelectorAll('.modal-overlay');
            modalElements.forEach(modal => {
                // Append the detached modal element to the current document body
                document.body.appendChild(modal);
            });
            console.log("✅ Global modals injected successfully.");
        } catch (e) {
            console.error("Failed to inject global modal elements:", e);
        }
    }

    // --- Setup Navigation Link Listeners (using delegation on sidebar) ---
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if (sidebar._navClickListener) sidebar.removeEventListener('click', sidebar._navClickListener);
        sidebar._navClickListener = (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                e.preventDefault();
                const page = menuItem.dataset.page;
                if (page && page !== currentPageName) {
                    navigateToPage(page);
                }
            }
        };
        sidebar.addEventListener('click', sidebar._navClickListener);
    }

    // --- Setup Browser Back/Forward Button Listener ---
    window.onpopstate = (event) => {
        const targetPage = event.state?.page || 'index.html';
        console.log("Browser back/forward detected. Navigating to:", targetPage);
        navigateToPage(targetPage, true); // true = isInitialLoad (from history perspective)
    };

    // --- Setup Clock Update Interval ---
    if (globalThis._clockInterval) clearInterval(globalThis._clockInterval);
    globalThis._clockInterval = setInterval(() => {
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
    }, 30000);

    // --- Setup Notification Bell Listener ---
    const bellIconWrapper = document.querySelector('.global-controls .control-icon-wrapper');
    if (bellIconWrapper) {
        const newBellIconWrapper = bellIconWrapper.cloneNode(true);
        bellIconWrapper.parentNode.replaceChild(newBellIconWrapper, bellIconWrapper);
        newBellIconWrapper.addEventListener('click', toggleNotificationPanel);
    }

    console.log("Global UI setup complete.");

    // --- Phase 5: Initial Data Loading ---
    console.log("Phase 5: Starting application state sync...");
    await syncApplicationState(); // CRITICAL: Ensure data is loaded first

    // --- Phase 6: Initial Global UI Update ---
    console.log("Phase 6: Performing Initial Global UI Update...");
    await updateGlobalUIElements();

    // --- Phase 7: Load Initial Page Content ---
    console.log("Phase 7: Initializing page content based on URL:", pathPageName);

    // Get the page name from the actual URL loaded by the browser
    const currentUrlPageName = window.location.pathname.split('/').pop() || 'index.html';

    // 1. Ensure the correct sidebar item is marked active
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pathPageName);
    });

    // 2. Replace history state for the initial load if it wasn't a callback clean
    if (!callbackProcessed) {
        const initialPage = pathPageName === 'index.html' ? '/index.html' : `/${pathPageName}`;
        window.history.replaceState({ page: pathPageName }, '', initialPage);
    }

    // **THE CRITICAL DECISION POINT**
    if (pathPageName === currentUrlPageName && !callbackProcessed) {
        // Scenario A: Direct browser refresh on a sub-page (e.g., /tasks.html).
        // The HTML content is already loaded and correct. Just run the JS initializer.
        console.log(`[Init] Direct load detected for ${pathPageName}. Running JS init only.`);
        currentPageName = pathPageName;
        // This runs the functions like initializeTasksPageLogic()
        await initializePageLogic(pathPageName);
    } else {
        // Scenario B: Auth0 redirecting, or a callback targetting a different page than the static root (e.g. redirect to /tasks.html but we only loaded index.html).
        // Use the full navigation flow to fetch and inject the correct content.
        console.log(`[Init] Dynamic initial load needed for ${pathPageName}. Running full navigation.`);
        await navigateToPage(pathPageName, true);
    }


    // --- Phase 8: Final Icon Rendering ---
    console.log("Phase 8: Rendering Feather Icons for initial page...");
    try { feather.replace(); } catch (e) { console.warn("Initial Feather replace failed:", e); }

    console.log("✨ App Initialization Sequence Complete (User Authenticated) ✨");
});