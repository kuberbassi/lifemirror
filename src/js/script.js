// ===============================================
// GLOBAL STATE & CORE HELPERS
// ===============================================
let auth0 = null; // Holds the initialized Auth0 client
var calendar = null; // Holds the FullCalendar instance
let sleepCheckInterval = null;
let IS_SMART_NOTIFICATIONS_MOCK = true;
let IS_NOTIFICATION_PANEL_OPEN = false;
let activeTimer = null;

// --- GLOBAL CHART INSTANCES ---
let lifeScoreChartInstance = null;
let fitnessTrendChartInstance = null;
let moodTrendChartInstance = null;

// --- GLOBAL DATA STATE (Populated by API) ---
let taskState = [];
let billState = [];
let assetState = [];
let fitnessHistory = [];
let moodHistory = [];
let completedSuggestions = []; // For Fitness page UI state

// --- NEW SPA STATE VARIABLES ---
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
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
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


// ===============================================
// AUTH0 CONFIGURATION & INITIALIZATION
// ===============================================
const AUTH0_DOMAIN = 'kuberbassi.us.auth0.com';
const AUTH0_CLIENT_ID = 'nXisVu6Vmw1MI9xG2K0Uubupg1DNhx26';
const AUTH0_AUDIENCE = 'https://lifemirror-api.com';

/**
 * Initializes the Auth0 client.
 */
const configureClient = async () => {
    // console.log("Attempting to configure Auth0 client..."); // Keep less verbose
    try {
        if (typeof window.auth0?.createAuth0Client !== 'function') {
            throw new Error("Auth0 SDK not loaded correctly. Ensure /vendor/auth0-spa-js.production.js is served and loaded before script.js.");
        }
        auth0 = await window.auth0.createAuth0Client({
            domain: AUTH0_DOMAIN,
            clientId: AUTH0_CLIENT_ID,
            authorizationParams: {
                audience: AUTH0_AUDIENCE
            }
        });
        console.log('Auth0 Client Initialized Successfully.');
    } catch (err) {
        console.error("CRITICAL: Error configuring Auth0 client:", err);
        document.body.innerHTML = `<h1>Authentication Error</h1><p>Failed to initialize the authentication system. Check console and Auth0 config. Error: ${err.message}</p>`;
        auth0 = null;
    }
};

/**
 * Handles the redirect callback from Auth0 after login.
 */
const handleAuthCallback = async () => {
    if (!auth0) {
        console.warn("handleAuthCallback skipped: Auth0 client not initialized.");
        return false;
    }
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        console.log("Auth0 callback detected. Handling redirect...");
        try {
            await auth0.handleRedirectCallback();
            console.log("Auth0 callback handled successfully.");
            // **SPA Fix**: Redirect base path to index.html after callback
            window.history.replaceState({}, document.title, '/index.html');
            console.log("URL cleaned.");
            return true; // Indicate success
        } catch (err) {
            console.error("Error handling Auth0 callback:", err);
            alert(`Login failed during callback: ${err.message}. Redirecting to login.`);
            window.location.assign('/login.html');
            return false; // Indicate failure
        }
    }
    return false; // No callback detected
};

/**
 * Checks auth. Redirects to Auth0 login if needed.
 */
const requireAuth = async () => {
    // Skip auth check on the login page itself
    const isLoginPage = window.location.pathname.endsWith('/login.html');
    if (isLoginPage) return true;

    // Ensure Auth0 client is ready
    if (!auth0) {
        console.warn("requireAuth: Auth0 client not ready, attempting to configure...");
        await configureClient();
        if (!auth0) {
            console.error("requireAuth: Auth0 client failed to initialize after attempt.");
            document.body.innerHTML = "<h1>Authentication Error</h1><p>Could not initialize authentication system. Please refresh or contact support.</p>";
            return false; // Indicate failure
        }
    }

    let isAuthenticated = false;
    try {
        isAuthenticated = await auth0.isAuthenticated();
        console.log("requireAuth - Authentication Status:", isAuthenticated);
    } catch (err) {
        // Errors during isAuthenticated usually mean issues with storage or config
        console.error("Error checking authentication status:", err);
        // Optionally redirect to login or show an error
        alert("Could not verify your session. Please try logging in again.");
        window.location.assign('/login.html');
        return false;
    }

    if (!isAuthenticated) {
        console.log("User not authenticated. Initiating redirect to Auth0 login...");
        try {
            await auth0.loginWithRedirect({
                authorizationParams: {
                    redirect_uri: window.location.origin + '/index.html' // Always return to index for SPA
                }
            });
            // Stop script execution here as redirect will happen
            // Return false to signal that the auth process isn't complete for this load
            return false;
        } catch (loginErr) {
            console.error("Error initiating login redirect:", loginErr);
            alert("Could not start the login process. Please check your connection or Auth0 settings and try again.");
            return false; // Indicate failure
        }
    }
    console.log("requireAuth: User is authenticated.");
    return true; // Indicate success
};


/**
 * Retrieves the access token for API calls. Handles refresh/redirects.
 */
async function getAccessToken() {
    if (!auth0) {
        console.error("getAccessToken: Auth0 client not initialized.");
        await configureClient(); // Attempt to re-initialize
        if (!auth0) throw new Error("Authentication system not ready."); // Throw if still not initialized
    }
    try {
        const token = await auth0.getTokenSilently({
             authorizationParams: {
                 audience: AUTH0_AUDIENCE // Ensure audience is requested
             }
        });
        if (!token) {
             console.error("getTokenSilently returned undefined or null.");
             throw new Error("Failed to obtain access token silently.");
        }
        return token;
    } catch (error) {
        console.error("Error getting access token silently:", error.message, error.error || '');
        // Check specific error codes that require user interaction
        if (error.error === 'login_required' || error.error === 'consent_required' || error.error === 'interaction_required') {
            console.log("Silent token acquisition failed, likely due to expired session or changed permissions. Redirecting to login...");
            try {
                // Attempt loginWithRedirect to re-authenticate
                await auth0.loginWithRedirect({
                    authorizationParams: {
                         redirect_uri: window.location.origin + '/index.html', // Return to SPA root
                         audience: AUTH0_AUDIENCE // Re-specify audience if needed
                    }
                });
            } catch (loginErr) {
                console.error("Error redirecting to login after silent auth failure:", loginErr);
                alert("Your session may have expired or requires re-authentication. Redirecting to login page.");
                // Fallback redirect if SDK fails
                window.location.assign('/login.html');
            }
            // Throw an error to stop the original API call that needed the token
            throw new Error("Login required");
        }
        // For other errors (network issues, configuration problems), alert the user
        alert(`Could not retrieve authentication token: ${error.message}. Please try refreshing the page or logging in again.`);
        throw error; // Re-throw the original error
    }
}


/**
 * Logs the user out.
 */
const logout = () => {
    if (!auth0) {
        console.error("Auth0 client not initialized for logout.");
        alert("Logout failed: Authentication system not ready.");
        return;
    }
    console.log("Initiating logout...");
    try {
        // Clear local app state before redirecting (optional but good practice)
        taskState = []; billState = []; assetState = []; fitnessHistory = []; moodHistory = [];
        console.log("Local state cleared.");

        auth0.logout({
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
            if (!auth0) {
                alert("Authentication client is not ready. Please refresh the page.");
                return;
            }
            if (loadingMessage) loadingMessage.style.display = 'block';
            newLoginButton.disabled = true;
            newLoginButton.innerHTML = '<i data-feather="loader" class="spin"></i> Signing In...';
            try { feather.replace(); } catch(e) {} // Render spinner icon

            try {
                await auth0.loginWithRedirect({
                    authorizationParams: {
                        redirect_uri: window.location.origin + '/index.html' // Ensure redirect to SPA root
                    }
                });
                // Browser redirects, script execution effectively stops here for this page load
            } catch (err) {
                console.error("Error initiating login redirect:", err);
                if (loadingMessage) loadingMessage.style.display = 'none';
                newLoginButton.disabled = false;
                 newLoginButton.innerHTML = '<i data-feather="log-in"></i> Sign In / Sign Up'; // Restore button text
                 try { feather.replace(); } catch(e) {}
                alert("Error starting the login process. Please check the console for details.");
            }
        });
    } else {
        console.warn("Login button not found on login page.");
    }
}

// ===============================================
// API SERVICE LAYER
// ===============================================

/**
 * Creates a generic API service. Includes error handling.
 */
function createApiService(resourceName) {
    // 💡 FIX: Use the correct collection names from your MongoDB
    let collectionName = resourceName;
    if (resourceName === 'fitness-logs') {
        collectionName = 'fitnesslogs'; // No hyphen
    }
    if (resourceName === 'mood-logs') {
        collectionName = 'moodlogs'; // No hyphen
    }

    const baseUrl = `/api/${collectionName}`; // Use the corrected name

    // Centralized response handler
    const handleResponse = async (response, operation) => {
        if (!response.ok) {
            const status = response.status;
            let errorMsg = `HTTP error ${status} during ${operation} ${resourceName}`;
            let errorDetails = response.statusText; // Default detail
            try {
                // Try parsing JSON error from backend
                const errorBody = await response.json();
                errorDetails = errorBody.message || JSON.stringify(errorBody);
                errorMsg += `: ${errorDetails}`;
            } catch (e) {
                // If response is not JSON or parsing fails
                try {
                    const errorText = await response.text();
                    if (errorText) errorDetails = errorText;
                } catch (textErr) { /* Ignore further errors reading body */ }
                errorMsg += `: ${errorDetails}`;
            }
            console.error(`${operation} ${resourceName} failed:`, errorMsg);
            // Specific error types for better handling upstream
            if (status === 401 || status === 403) throw new Error('Unauthorized');
            // Include details in the general error
            throw new Error(errorMsg);
        }

        // Handle successful but potentially empty responses (e.g., 204 No Content)
        const contentType = response.headers.get("content-type");
        if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
            // For DELETE or successful updates without content, return success status
            return response.ok; // true if status is 2xx
        }

        // Parse JSON response for GET, POST, PUT returning data
        try {
            return await response.json();
        } catch (jsonError) {
            console.error(`Error parsing JSON response for ${operation} ${resourceName}:`, jsonError);
            throw new Error(`Invalid JSON received from server.`);
        }
    };


    // Define API methods using the handler
    return {
        async fetchAll() {
            try {
                const token = await getAccessToken();
                const response = await fetch(baseUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return await handleResponse(response, 'fetch');
            } catch (error) {
                console.error(`API Error (Fetch ${resourceName}):`, error.message);
                if (error.message !== 'Login required' && error.message !== 'Unauthorized') {
                    showFlashMessage(`Error loading ${resourceName}. Check console.`, 'alert-triangle');
                }
                throw error; // Re-throw to signal failure
            }
        },
        async create(data) {
            try {
                const token = await getAccessToken();
                const response = await fetch(baseUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                return await handleResponse(response, 'create');
            } catch (error) {
                console.error(`API Error (Create ${resourceName}):`, error.message);
                if (error.message !== 'Login required' && error.message !== 'Unauthorized') {
                    showFlashMessage(`Error creating ${resourceName}. Check console.`, 'alert-triangle');
                }
                throw error;
            }
        },
        async update(id, data) {
            // Special handling for temp-mood upsert via POST
            const isTempMoodUpdate = (resourceName === 'mood-logs' && id === 'temp-mood');
            const endpoint = isTempMoodUpdate ? baseUrl : `${baseUrl}/${id}`;
            const method = isTempMoodUpdate ? 'POST' : 'PUT';

            // Basic validation for non-temp IDs
            if (!isTempMoodUpdate && (!id || !mongoose.Types.ObjectId.isValid(id))) {
                console.warn(`Update ${resourceName} skipped: Invalid ID format "${id}"`);
                throw new Error(`Invalid ID format for update: ${id}`);
            }

            try {
                const token = await getAccessToken();
                const response = await fetch(endpoint, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                return await handleResponse(response, 'update');
            } catch (error) {
                console.error(`API Error (Update ${resourceName} ID: ${id}):`, error.message);
                if (error.message !== 'Login required' && error.message !== 'Unauthorized') {
                    showFlashMessage(`Error updating ${resourceName}. Check console.`, 'alert-triangle');
                }
                throw error;
            }
        },
        async delete(id) {
            if (!id || !mongoose.Types.ObjectId.isValid(id)) {
                console.warn(`Delete ${resourceName} skipped: Invalid ID format "${id}"`);
                throw new Error(`Invalid ID format for delete: ${id}`);
            }
            try {
                const token = await getAccessToken();
                const response = await fetch(`${baseUrl}/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // handleResponse returns boolean true on successful 2xx status for DELETE
                return await handleResponse(response, 'delete');
            } catch (error) {
                console.error(`API Error (Delete ${resourceName} ID: ${id}):`, error.message);
                if (error.message !== 'Login required' && error.message !== 'Unauthorized') {
                    showFlashMessage(`Error deleting ${resourceName}. Check console.`, 'alert-triangle');
                }
                throw error;
            }
        }
    };
}

// --- Mongoose ObjectId Stub for basic validation ---
// Lightweight check without needing the full library on frontend
const mongoose = {
    Types: {
        ObjectId: {
            isValid: (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
        }
    }
};

// Instantiate API services
const taskApiService = createApiService('tasks');
const billApiService = createApiService('bills');
const assetApiService = createApiService('assets');
const fitnessApiService = createApiService('fitness-logs');
const moodApiService = createApiService('mood-logs');
const dashboardApiService = {
    async fetchAllData() {
        try {
            const token = await getAccessToken();
            console.log("Fetching all dashboard data...");
            const response = await fetch('/api/dashboard/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Specific handler for dashboard fetch
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
            console.log("Successfully fetched dashboard data.");
            return await response.json(); // Assume success response is JSON
        } catch (error) {
            console.error('API Error (Fetch Dashboard Data):', error.message);
            // Alert only for non-auth errors, as auth errors trigger redirects
            if (error.message !== 'Login required' && error.message !== 'Unauthorized') {
                showFlashMessage(`Error loading dashboard data. Check console.`, 'alert-triangle');
            }
            throw error; // Propagate error
        }
    }
};


// ===============================================
// GLOBAL DATA SYNC & UTILITY FUNCTIONS
// ===============================================

/**
 * Fetches all data and populates global state. Runs ONCE after auth confirmed.
 */
async function syncApplicationState() {
    // Double-check authentication before proceeding
    if (!auth0 || !(await auth0.isAuthenticated())) {
        console.warn("syncApplicationState skipped: User not authenticated.");
        return;
    }
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
         // Find the syncing message and remove it specifically
         const syncMessages = document.querySelectorAll('#flash-message-container .flash-message');
         syncMessages.forEach(msg => {
             if (msg.textContent.includes('Syncing your data')) {
                msg.style.opacity = '0';
                setTimeout(() => msg.remove(), 500);
             }
         });


    } catch (error) {
        // Errors are logged by dashboardApiService, just provide context here
        console.error('FATAL: Could not sync application state. The application might not function correctly.');
        // Consider showing a persistent error message or prompting refresh
        showFlashMessage('Failed to load initial data. Please refresh.', 'alert-triangle');
    }
}


/**
 * Re-fetches one part of the state (e.g., tasks) and re-renders the *currently active view*.
 */
async function refreshState(stateName) {
    if (!auth0 || !(await auth0.isAuthenticated())) {
        console.warn(`Refresh ${stateName} skipped: User not authenticated.`);
        return; // Stop if not authenticated
    }
    console.log(`Refreshing state for: ${stateName}...`);
    // Don't show flash message for every refresh, only for initial sync
    // showFlashMessage(`Refreshing ${stateName}...`, 'rotate-cw');

    let service, stateVar;
    try {
        switch (stateName) {
            case 'tasks': service = taskApiService; stateVar = 'taskState'; break;
            case 'bills': service = billApiService; stateVar = 'billState'; break;
            case 'assets': service = assetApiService; stateVar = 'assetState'; break;
            case 'fitness': service = fitnessApiService; stateVar = 'fitnessHistory'; break;
            case 'mood': service = moodApiService; stateVar = 'moodHistory'; break;
            default:
                console.error(`Invalid state name provided to refreshState: ${stateName}`);
                return; // Stop if invalid name
        }

        const data = await service.fetchAll(); // Fetch the specific data type
        // Use globalThis for explicit global assignment, handle potential null/undefined data
        globalThis[stateVar] = (data || []).map(d => ({ ...d, id: d._id }));

        console.log(`✅ Refreshed state for: ${stateName}. Found ${globalThis[stateVar].length} items.`);

        // Re-initialize the *current* page's logic to make it re-render with the updated data.
        console.log(`[Refresh] Re-initializing active page view: ${currentPageName}`);
        // Wrap in try/catch in case the init function has issues
        try {
            switch (currentPageName) {
                case 'index.html': if (typeof initializeDashboardPage === 'function') initializeDashboardPage(); break;
                case 'tasks.html': if (typeof initializeTasksPageLogic === 'function') initializeTasksPageLogic(); break;
                case 'finance.html': if (typeof initializeFinancePage === 'function') initializeFinancePage(); break;
                case 'fitness.html': if (typeof initializeFitnessPage === 'function') initializeFitnessPage(); break;
                case 'mood.html': if (typeof initializeMoodPage === 'function') initializeMoodPage(); break;
                case 'vault.html': if (typeof initializeVaultPage === 'function') initializeVaultPage(); break;
                case 'insights.html': if (typeof initializeInsightsPage === 'function') initializeInsightsPage(); break;
                case 'settings.html': if (typeof initializeSettingsPage === 'function') initializeSettingsPage(); break;
                 default: console.warn(`[Refresh] No specific re-initialization logic found for ${currentPageName}`);
            }
             // Ensure Feather icons are re-rendered after page re-init
             setTimeout(() => { // Slight delay to ensure DOM updates
                 try { feather.replace(); } catch (e) {}
             }, 50);
        } catch (reinitError) {
            console.error(`Error during page re-initialization after refreshing ${stateName}:`, reinitError);
            showFlashMessage(`Error updating view for ${stateName}. Please refresh.`, 'alert-triangle');
        }

    } catch (error) {
        // API errors are already logged and alerted by the service.
        // Log context here.
        console.error(`Failed to refresh state for ${stateName}.`);
        // Do not re-trigger flash message here, API service handled it.
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
        console.warn("setupModal failed: modalElement provided is null or undefined for triggers:", openTriggers);
        return { show: () => {}, hide: () => {} }; // Return dummy controls
    }
     const modalId = modalElement.id;
     if (!modalId) {
         console.error("setupModal requires the modalElement to have an ID.", modalElement);
         return { show: () => {}, hide: () => {} };
     }


    const show = () => {
        if (resetFn) {
            try { resetFn(); } catch (e) { console.error(`Error during modal reset for ${modalId}:`, e); }
        }
        modalElement.style.display = 'flex';
        // Add animation class - ensure CSS has @keyframes popIn
        const dialog = modalElement.querySelector('.modal-dialog');
        if (dialog) dialog.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        console.log(`Modal shown: ${modalId}`);
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
        console.log(`Modal hidden: ${modalId}`);
    };

    // --- Event Listener Management using a global store ---
    // Use a unique key based on the modal ID to store/retrieve the listener
    const listenerKey = `_modalClickListener_${modalId}`;

    // Remove any previously attached listener for this specific modal ID
    if (globalThis[listenerKey]) {
        console.log(`Removing previous listener for modal: ${modalId}`);
        document.removeEventListener('click', globalThis[listenerKey]);
        delete globalThis[listenerKey]; // Clean up the stored reference
    } else {
        console.log(`No previous listener found for modal: ${modalId}, attaching new one.`);
    }


    // Define the new listener function
    const clickListener = (e) => {
        // Check for open triggers associated *with this modal instance*
        if (openTriggers.some(selector => e.target.closest(selector))) {
            // Prevent opening if another modal is already displayed
            const anyModalOpen = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (anyModalOpen && anyModalOpen !== modalElement) {
                 console.warn("Prevented opening modal - another modal is already open.");
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
     console.log(`Attached new listener for modal: ${modalId}`);


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
    const notifications = [
        { id: 1, type: 'critical', text: 'Bill "Netflix" is overdue!' },
        { id: 2, type: 'low', text: 'Task "Buy groceries" due today.' },
        // { id: 3, type: 'low', text: '5,000 steps reached!' }, // Example
    ];

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
        if (result?.task) { // Check if creation was successful and returned data
             showFlashMessage(`Task "${result.task.text}" added!`, 'check-square');
             await refreshState('tasks'); // Refresh the task list
        } else {
             throw new Error("Task creation response did not contain task data.");
        }
    } catch (error) {
        // API service already logs and shows flash message
        console.error("Failed to add task from Vault.");
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
    } else {
        console.warn("Clock element ('current-time') not found during UI update.");
    }

    // --- Update Profile Picture ---
    // Find the container for the profile picture/initials
    const profilePicContainer = document.querySelector('.global-controls');
    // Find either the image or the initials div within the container
    let profilePicElement = profilePicContainer?.querySelector('.profile-pic, .profile-pic-initials');

    if (profilePicElement) {
        try {
            // Ensure user is authenticated before fetching user data
            if (auth0 && await auth0.isAuthenticated()) {
                 // Consider caching the user object globally after initial login
                 // to avoid repeated calls to auth0.getUser()
                const user = await auth0.getUser();

                if (user?.picture) {
                    // Scenario 1: We have a picture URL
                    // Check if the current element is already an image with the correct src
                    if (profilePicElement.tagName === 'IMG' && profilePicElement.src === user.picture) {
                        // Already correct, do nothing
                    } else {
                        // Need to create or update the image element
                        const newImg = (profilePicElement.tagName === 'IMG') ? profilePicElement : document.createElement('img');
                        newImg.className = 'profile-pic';
                        newImg.src = user.picture;
                        newImg.alt = "Profile";
                        // Crucially, add an error handler to fall back to initials if the image fails to load
                        newImg.onerror = () => {
                             console.warn("Profile picture failed to load, falling back to initials.");
                             generateInitials(user?.name || 'User', newImg); // Pass the img element itself to be replaced
                        };
                        // Replace the old element (img or initials) with the new/updated img
                        if (profilePicElement !== newImg) {
                             profilePicContainer.replaceChild(newImg, profilePicElement);
                        }
                    }
                } else if (user?.name) {
                    // Scenario 2: No picture URL, but we have a name -> Show initials
                    generateInitials(user.name, profilePicElement); // Let generateInitials handle replacement if needed
                } else {
                     // Scenario 3: No picture and no name -> Fallback (e.g., generic icon or hide)
                     // Currently generateInitials handles the 'no name' case internally by showing '??' or similar
                     generateInitials('??', profilePicElement); // Or handle differently
                     console.warn("User has no picture or name for profile display.");
                }
            } else {
                 console.warn("Cannot update profile pic: User not authenticated.");
                 // Optionally display a placeholder if not authenticated
            }
        } catch (e) {
            console.error("Error updating profile picture:", e);
            // Attempt fallback to initials even on error, if possible
             if (profilePicElement && auth0 && await auth0.isAuthenticated()) {
                 try {
                     const user = await auth0.getUser(); // May fail again, but worth trying
                     generateInitials(user?.name || '??', profilePicElement);
                 } catch {} // Ignore error during fallback attempt
             }
        }
    } else {
        console.warn("Profile picture container or element not found during UI update.");
    }
}

// ===============================================
// SPA NAVIGATION ENGINE
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

    let pageContent = ''; // To store the fetched <main> innerHTML
    let success = false;

    try {
        // 2. Fetch New Page HTML
        // Add cache-busting query parameter to ensure fresh HTML is fetched
        const response = await fetch(`/${pageName}?v=${Date.now()}`);
        if (!response.ok) {
            // Throw error with status text for better debugging
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
        pageContent = newMain.innerHTML; // Get only the *inner* HTML
        success = true;

    } catch (error) {
        console.error("SPA Navigation failed:", error);
        showFlashMessage(`Error loading page content: ${error.message}`, 'alert-triangle');
        // Provide fallback content on error
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
        mainContentElement.innerHTML = pageContent; // Replace content
        mainContentElement.scrollTop = 0; // Scroll to the top of the new content
        // Fade in the new content
        setTimeout(() => { // Short delay allows content to render before fade-in
            mainContentElement.style.opacity = '1';
        }, 50);
    } else {
        console.error("CRITICAL: mainContentElement is null. Cannot inject page content.");
        isNavigating = false; // Release lock even on error
        return; // Stop if container doesn't exist
    }

    // 5. Update Global State (Current Page Name)
    currentPageName = pageName;

    // 6. Update Browser History/URL Bar
    // Only push state if it's not the initial page load triggered by URL/back/forward
    if (!isInitialLoad) {
        // Push the new state onto the history stack
        window.history.pushState({ page: pageName }, '', '/' + pageName); // Update URL bar
    }

    // 7. Update Sidebar Active State
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });

    // 8. Destroy Previous Page's Chart Instances (if any)
    // This prevents errors when re-initializing charts on the same canvas ID
    if (fitnessTrendChartInstance) { fitnessTrendChartInstance.destroy(); fitnessTrendChartInstance = null; console.log("[Chart] Destroyed Fitness Trend Chart."); }
    if (moodTrendChartInstance) { moodTrendChartInstance.destroy(); moodTrendChartInstance = null; console.log("[Chart] Destroyed Mood Trend Chart."); }
    // Life Score chart is handled within its own initialization logic (initializeDashboardPage)

    // 9. Initialize Page-Specific JavaScript Logic for the *new* content
    console.log(`Initializing JS for ${pageName}...`);
    try {
        switch (pageName) {
            case 'index.html': initializeDashboardPage(); break;
            case 'tasks.html': initializeTasksPageLogic(); break;
            case 'finance.html': initializeFinancePage(); break;
            case 'fitness.html': initializeFitnessPage(); break;
            case 'mood.html': initializeMoodPage(); break;
            case 'vault.html': initializeVaultPage(); break;
            case 'insights.html': initializeInsightsPage(); break;
            case 'settings.html': initializeSettingsPage(); break;
            default: console.warn(`No specific initialization function found for page: ${pageName}`);
        }
    } catch (pageInitError) {
        console.error(`Error during JavaScript initialization for ${pageName}:`, pageInitError);
        showFlashMessage(`Error setting up ${pageName}. Some features may not work. Check console.`, 'alert-triangle');
    }

    // 10. Update Global UI Elements (Clock, Profile Pic)
    // This needs to happen *after* the new page content is injected and initialized
    await updateGlobalUIElements();

    // 11. Re-render Feather Icons for the new content
    try {
        feather.replace();
    } catch (e) {
        // Ignore if feather is not defined or fails, but log warning
        console.warn("Feather icon replacement failed after navigation:", e);
    }

    // 12. Release Navigation Lock
    isNavigating = false;
    console.log(`Navigation to ${pageName} complete.`);
}


// ===============================================
// DASHBOARD CORE LOGIC
// ===============================================

// Global reference for chart instance moved to the top

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
        console.log("Rendering Dashboard Metrics...");
        if (!mainContentElement) return; // Don't render if container isn't ready

        // --- 1. CALCULATE METRICS ---
        // Ensure state arrays exist before filtering/reducing
        const safeTaskState = Array.isArray(taskState) ? taskState : [];
        const safeBillState = Array.isArray(billState) ? billState : [];
        const safeAssetState = Array.isArray(assetState) ? assetState : [];
        const safeFitnessHistory = Array.isArray(fitnessHistory) ? fitnessHistory : [];
        const safeMoodHistory = Array.isArray(moodHistory) ? moodHistory : [];

        // Task calculations
        const pendingTasks = safeTaskState.filter(t => t.type === 'task' && !t.completed);
        const completedTasks = safeTaskState.filter(t => t.type === 'task' && t.completed);
        const totalTasks = pendingTasks.length + completedTasks.length;
        const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 100; // Default to 100% if no tasks

        // Schedule items for today
        const scheduleItemsToday = safeTaskState.filter(item => item.date === TODAY_DATE);

        // Finance calculations
        const overdueBills = safeBillState.filter(b => !b.paid && calculateDueDays(b.dueDate) < 0);
        const totalDueAmountThisWeek = safeBillState
            .filter(b => !b.paid && calculateDueDays(b.dueDate) >= 0 && calculateDueDays(b.dueDate) <= 7)
            .reduce((sum, bill) => sum + (bill.amount || 0), 0); // Use 0 if amount is missing
        const paidBillsCount = safeBillState.filter(b => b.paid).length;
        const totalBillCount = safeBillState.length;
        const financialHealth = totalBillCount > 0 ? Math.round((paidBillsCount / totalBillCount) * 100) : 100; // Default 100%
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
        // Get the most recent sleep log
        const sleepLog = safeFitnessHistory
            .filter(log => log.type === 'sleep')
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || { value: 0 };
        const sleepLastNight = sleepLog.value || 0; // Default 0

        // Mood calculations (use the latest entry, which might be a placeholder)
        const latestMoodEntry = safeMoodHistory[0] || { mood: 2, stress: 45, note: 'No data available.', isFinal: false };
        const moodLabel = Object.values(moodMap).find(m => m.value === latestMoodEntry.mood)?.label || 'Neutral';
        const stressIndex = latestMoodEntry.stress || 45; // Default if missing
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
        // Simple digital organization score
        const digitalScore = Math.min(100, Math.round((Math.min(totalVaultLinks, 10) / 10) * 50 + (Math.min(uniqueCategories, 5) / 5) * 50));

        const lifeScoreWeights = { tasks: 0.25, finance: 0.20, fitness: 0.20, mood: 0.20, digital: 0.15 };
        let weightedScoreSum = 0;
        weightedScoreSum += (componentScores.tasks || 0) * lifeScoreWeights.tasks;
        weightedScoreSum += (componentScores.finance || 0) * lifeScoreWeights.finance;
        weightedScoreSum += (componentScores.fitness || 0) * lifeScoreWeights.fitness;
        weightedScoreSum += (componentScores.mood || 0) * lifeScoreWeights.mood;
        weightedScoreSum += (digitalScore || 0) * lifeScoreWeights.digital;
        const currentLifeScore = Math.min(100, Math.max(0, Math.round(weightedScoreSum))); // Clamp score between 0 and 100

        // --- 2. UPDATE UI ELEMENTS ---
        // Ensure elements exist before trying to update them
        const updateElementText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
            // else console.warn(`Element with ID ${id} not found in dashboard render.`);
        };
        const updateElementHTML = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };

        // Update Life Score display
        updateLifeScore(currentLifeScore); // Use the helper with animation

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

        // --- Radar Chart ---
        const radarCtx = document.getElementById('life-score-radar-chart')?.getContext('2d');
        if (radarCtx && typeof Chart !== 'undefined') {
            const chartData = {
                labels: ['Tasks', 'Financial', 'Fitness', 'Mood/Stress', 'Digital Org'],
                datasets: [{
                    label: 'Score',
                    data: [
                        componentScores.tasks || 0, // Ensure data points are numbers
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

            // **FIX**: Destroy previous instance before creating new one
            if (lifeScoreChartInstance) {
                console.log("[Chart] Destroying previous life score chart instance.");
                lifeScoreChartInstance.destroy();
                lifeScoreChartInstance = null;
            }

            console.log("[Chart] Creating new life score chart instance.");
            try {
                 lifeScoreChartInstance = new Chart(radarCtx, {
                     type: 'radar',
                     data: chartData,
                     options: {
                         responsive: true,
                         maintainAspectRatio: false,
                         scales: {
                             r: {
                                 suggestedMin: 0,
                                 suggestedMax: 100,
                                 ticks: { stepSize: 25, backdropColor: 'transparent' }, // Make ticks transparent
                                 pointLabels: { padding: 15, font: { size: 12 } }, // Adjust font size
                                 grid: { color: '#eaeaea' }, // Lighter grid lines
                                 angleLines: { color: '#eaeaea' } // Lighter angle lines
                             }
                         },
                         plugins: {
                             legend: { display: false } // Hide legend
                         }
                     }
                 });
             } catch (chartError) {
                 console.error("Error creating Radar Chart:", chartError);
                 // Optionally display fallback if chart fails
             }

        } else if (!radarCtx) {
            console.warn("Dashboard: Canvas element 'life-score-radar-chart' not found for chart.");
        } else if (typeof Chart === 'undefined') {
            console.warn("Dashboard: Chart.js library not loaded, cannot render chart.");
        }


        // --- Today's Schedule List ---
        const scheduleList = document.getElementById('task-list-container');
        if (scheduleList) {
            // Sort: Incomplete first, then by priority (High > Medium > Low)
            scheduleItemsToday.sort((a, b) => (a.completed - b.completed) || ( {'high':3,'medium':2,'low':1}[b.priority] || 0) - ( {'high':3,'medium':2,'low':1}[a.priority] || 0) );

            scheduleList.innerHTML = ''; // Clear previous items
            if (scheduleItemsToday.length === 0) {
                scheduleList.innerHTML = `<li class="task-item-empty">Nothing scheduled for today.</li>`;
            } else {
                scheduleItemsToday.forEach(item => {
                    const isTask = item.type === 'task';
                    const li = document.createElement('li');
                    li.className = `task-item ${item.completed ? 'completed' : ''}`;
                    // Use template literal for cleaner HTML structure
                    li.innerHTML = `
                        <input type="checkbox" id="dash-${item.id}" data-task-id="${item.id}" ${item.completed ? 'checked' : ''} ${!isTask ? 'disabled style="visibility:hidden;"' : ''}>
                        <label for="dash-${item.id}" style="margin-left: ${isTask ? '12px' : '0'};">${item.text} ${item.type !== 'task' ? `(${item.type})` : ''}</label>
                    `;
                    scheduleList.appendChild(li);
                });
            }
        } else {
             console.warn("Dashboard: Element 'task-list-container' not found.");
        }

        // --- Actions for Today List ---
        const remedyList = document.getElementById('dashboard-actions-list');
        if (remedyList) {
            let actionItems = [];
            // Add critical actions based on calculated metrics
            overdueBills.forEach(bill => actionItems.push({ id: `remedy-bill-${bill.id}`, status: 'finance', icon: 'alert-triangle', text: `Overdue: ${bill.name}. Pay Now.`, buttonText: 'Pay', action: 'pay', dataId: bill.id, priorityScore: 10 }));
            if (stressIndex >= 70) actionItems.push({ id: 'remedy-high-stress', status: 'health', icon: 'zap', text: `High Stress (${stressIndex}%). Consider break/meditation.`, buttonText: 'Log Break', action: 'log-break', priorityScore: 9 });
            if (sleepLastNight < 6 && sleepLastNight > 0) actionItems.push({ id: 'remedy-low-sleep', status: 'health', icon: 'moon', text: `Low Sleep (${sleepLastNight}h). Plan for more tonight.`, buttonText: 'Acknowledge', action: 'ack-sleep', priorityScore: 8 });

            // Add pending tasks for today
            pendingTasks.filter(task => task.date === TODAY_DATE).forEach(task => actionItems.push({ id: `task-action-${task.id}`, status: 'task', icon: 'check-square', text: `Task: ${task.text} (${task.priority}).`, buttonText: 'Complete', action: 'complete-task', dataId: task.id, priorityScore: task.priority === 'high' ? 7 : (task.priority === 'medium' ? 6 : 5) }));

            // Sort actions by priority score (descending)
            actionItems.sort((a, b) => b.priorityScore - a.priorityScore);

            remedyList.innerHTML = ''; // Clear previous items
            if (actionItems.length === 0) {
                remedyList.innerHTML = `<li class="remedy-item" data-status="info"><i data-feather="thumbs-up"></i><p>All clear! No critical actions or tasks for today.</p></li>`;
            } else {
                actionItems.forEach(item => {
                    // Check if the corresponding item is actually completed in the state
                    let isItemCompleted = false;
                    if (item.action === 'pay') {
                         isItemCompleted = safeBillState.find(b => b.id === item.dataId)?.paid || false;
                    } else if (item.action === 'complete-task') {
                         isItemCompleted = safeTaskState.find(t => t.id === item.dataId)?.completed || false;
                    } // Add checks for 'log-break', 'ack-sleep' if needed based on state

                    const li = document.createElement('li');
                    li.className = `remedy-item ${isItemCompleted ? 'completed' : ''}`;
                    li.dataset.status = item.status;
                    li.dataset.actionType = item.action;
                    li.dataset.id = item.dataId || item.id; // Use dataId if available, else item id

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
        } else {
            console.warn("Dashboard: Element 'dashboard-actions-list' not found.");
        }


        // Re-render Feather Icons for potentially new elements
        try { feather.replace(); } catch (e) { console.warn("Feather replace failed at end of dashboard render:", e); }
        console.log("Dashboard rendering complete.");
    }; // End of renderDashboardMetrics

    // --- Event Listener Setup ---
    function attachDashboardListeners() {
        console.log("Attaching dashboard listeners...");
        // Use event delegation on stable parent elements
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        // Listener for Task Checkboxes in Schedule
         // Remove previous listener instance if exists to prevent duplicates
         if (mainContent._taskChangeListener) {
             mainContent.removeEventListener('change', mainContent._taskChangeListener);
         }
         mainContent._taskChangeListener = async (e) => {
             if (e.target.matches('#task-list-container input[type="checkbox"]')) {
                 const checkbox = e.target;
                 const taskId = checkbox.dataset.taskId;
                 const isChecked = checkbox.checked;

                 // Disable temporarily to prevent double clicks
                 checkbox.disabled = true;
                 try {
                     await taskApiService.update(taskId, { completed: isChecked });
                     showFlashMessage(`Task ${isChecked ? 'completed' : 'marked incomplete'}.`, 'check-circle');
                     // Refresh state which will re-render the dashboard
                     await refreshState('tasks');
                 } catch (error) {
                     console.error("Failed to update task completion:", error);
                     checkbox.checked = !isChecked; // Revert UI on error
                     checkbox.disabled = false; // Re-enable on error
                     // API service handles flash message
                 }
                 // No finally needed, refreshState handles re-rendering/re-enabling implicitly
             }
         };
         mainContent.addEventListener('change', mainContent._taskChangeListener);


        // Listener for Remedy Buttons
        if (mainContent._remedyClickListener) {
            mainContent.removeEventListener('click', mainContent._remedyClickListener);
        }
        mainContent._remedyClickListener = async (e) => {
            const button = e.target.closest('#dashboard-actions-list .remedy-button');
            if (!button || button.disabled) return; // Ignore clicks on disabled buttons or outside buttons

            const action = button.dataset.action;
            const itemId = button.dataset.id;
            const remedyItem = button.closest('.remedy-item');

            // Provide immediate visual feedback
            button.disabled = true;
            button.innerHTML = '<i data-feather="loader" class="spin"></i>';
            try { feather.replace(); } catch (fe) {} // Render spinner

            try {
                let stateToRefresh = null; // Track which state needs refreshing

                if (action === 'pay') {
                    const bill = billState.find(b => b.id === itemId);
                    if (bill) {
                        const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
                        const updateData = {
                            // Mark as paid only if one-time, otherwise just update date
                            paid: bill.frequency === 'one-time',
                            // Update due date only if recurring and next date calculated
                            dueDate: nextDueDate || bill.dueDate
                        };
                        await billApiService.update(itemId, updateData);
                        showFlashMessage(`${bill.name} ${bill.frequency === 'one-time' ? 'paid' : 'logged'}.`, 'check-circle');
                        stateToRefresh = 'bills';
                    } else { throw new Error(`Bill with ID ${itemId} not found.`); }
                } else if (action === 'log-break') {
                    // Placeholder: Could log a fitness entry or just update UI/state
                    showFlashMessage('Break logged. Take it easy!', 'coffee');
                    // No state refresh needed for mock, but might refresh 'mood' if stress updated
                    stateToRefresh = null; // Or 'mood' if backend updated stress
                    // Visually mark as complete immediately
                     if (remedyItem) remedyItem.classList.add('completed');
                     button.textContent = 'Logged';
                } else if (action === 'ack-sleep') {
                    showFlashMessage('Low sleep acknowledged. Aim for more rest!', 'moon');
                    // No API call or state refresh needed for simple acknowledgement
                     if (remedyItem) remedyItem.classList.add('completed');
                     button.textContent = 'Acknowledged';
                    stateToRefresh = null;
                } else if (action === 'complete-task') {
                    await taskApiService.update(itemId, { completed: true });
                    showFlashMessage('Task completed!', 'check-circle');
                    stateToRefresh = 'tasks';
                } else {
                     console.warn(`Unknown remedy action: ${action}`);
                     button.textContent = 'Unknown'; // Indicate issue on button
                     await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
                }

                // Refresh relevant state if needed
                if (stateToRefresh) {
                    await refreshState(stateToRefresh);
                }

            } catch (error) {
                console.error(`Failed action '${action}' for item ${itemId}:`, error);
                // API service shows flash error
                // Restore button state after a short delay
                 setTimeout(() => {
                     if (button && remedyItem && !remedyItem.classList.contains('completed')) {
                          button.textContent = remedyItem.querySelector('p').textContent.includes('Pay') ? 'Pay' :
                                               remedyItem.querySelector('p').textContent.includes('Break') ? 'Log Break' :
                                               remedyItem.querySelector('p').textContent.includes('Acknowledge') ? 'Acknowledge' :
                                               'Complete'; // Adjust based on original text
                          button.disabled = false;
                          try { feather.replace(); } catch (fe) {}
                     }
                 }, 1500);
            }
             // Spinner is removed implicitly by refreshState re-rendering
        };
        mainContent.addEventListener('click', mainContent._remedyClickListener);

    } // End of attachDashboardListeners

    // --- Initial Setup ---
    // Render metrics based on current (possibly empty) global state
    renderDashboardMetrics();
    // Attach event listeners for interactions
    attachDashboardListeners();

    // If data was already loaded (e.g., navigating back via browser history),
    // ensure the render uses the loaded data. renderDashboardMetrics does this automatically.
    // console.log("Dashboard initialization complete.");
}


// ===============================================
// TASKS PAGE LOGIC
// ===============================================

// Global function for rendering the task list
let renderTaskList = () => { console.warn("renderTaskList called before assignment."); };

function initializeTasksPageLogic() {
    console.log("Initializing Tasks Page Logic...");
    let activeTaskFilter = 'date'; // Default filter state
    let taskToDeleteId = null; // State for delete confirmation

    // --- DOM Element References ---
    // Find elements *within the current mainContentElement*
    const mainTaskList = mainContentElement?.querySelector('#main-task-list');
    const taskFilterBar = mainContentElement?.querySelector('#task-filter-bar');
    const addModal = document.getElementById('add-task-modal'); // Modals are outside main usually
    const editModal = document.getElementById('edit-task-modal');
    const deleteConfirmModal = document.getElementById('delete-task-confirm-modal');
    const calendarEl = mainContentElement?.querySelector('#calendar');
    const calendarOverlay = mainContentElement?.querySelector('#auth-signin-overlay');
    const calendarSignInButton = mainContentElement?.querySelector('#auth-open-signin');


     // --- Check if essential elements exist ---
     if (!mainTaskList) console.warn("Tasks page: '#main-task-list' element not found.");
     if (!calendarEl) console.warn("Tasks page: '#calendar' element not found.");
     // Modals are checked by setupModal

    // --- Core Render Function ---
    renderTaskList = () => {
        if (!mainTaskList) return; // Don't render if list element missing
        console.log("Rendering task list with filter:", activeTaskFilter);

        // Filter tasks based on the active filter
        let displayTasks = (Array.isArray(taskState) ? taskState : []).filter(task => {
            // Ensure we only show items explicitly marked as 'task' or with no type
            if (task.type && task.type !== 'task') return false;
            switch (activeTaskFilter) {
                 case 'completed': return task.completed;
                 case 'pending': return !task.completed; // Example if you add 'pending' filter
                 case 'date': // Falls through to default (all tasks relevant to date sort)
                 case 'priority': // Falls through to default (all tasks relevant to priority sort)
                 default: return true; // Show all 'task' types
            }
        });

        // Sort tasks based on filter and completion status
        displayTasks.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            const priorityA = priorityOrder[a.priority] || 0;
            const priorityB = priorityOrder[b.priority] || 0;

            // Always show incomplete tasks first unless viewing 'completed' filter
            if (activeTaskFilter !== 'completed' && a.completed !== b.completed) {
                return a.completed ? 1 : -1; // Incomplete first (false = 0, true = 1)
            }

            // Apply specific sort order based on filter
            if (activeTaskFilter === 'priority') {
                return priorityB - priorityA; // Highest priority first
            }
            // Default sort: By date ascending, then priority descending
            const dateA = a.date ? new Date(a.date).getTime() : Infinity; // Handle missing dates
            const dateB = b.date ? new Date(b.date).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB; // Sort by date first
            return priorityB - priorityA; // Then by priority (desc) if dates are same
        });

        // --- Render List Items ---
        mainTaskList.innerHTML = ''; // Clear previous items
        if (displayTasks.length === 0) {
            mainTaskList.innerHTML = `<li class="task-item-empty" style="padding: 20px; text-align: center; color: var(--c-text-muted);">No tasks found matching filter '${activeTaskFilter}'.</li>`;
        } else {
            displayTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id; // Store ID for actions
                // Format date nicely, handle missing date
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
        console.log("Task list rendering complete.");

        // Re-attach listeners specifically for items within the list *after* rendering
        attachTaskItemListeners();

        // Refresh calendar events if the calendar exists
        if (window.calendar) {
            console.log("Refetching FullCalendar events after task list render.");
            window.calendar.refetchEvents();
        }
    }; // End of renderTaskList

    // --- Task Action Handlers ---
    async function toggleTaskCompleted(taskId, isChecked) {
        // Find task locally first for immediate UI feedback (optional)
        const task = taskState.find(t => t.id === taskId);
        if (!task) {
             console.error(`Task with ID ${taskId} not found in local state.`);
             return;
        }

        // Optimistic UI update (optional):
        // const listItem = mainTaskList.querySelector(`li[data-id="${taskId}"]`);
        // if (listItem) listItem.classList.toggle('completed', isChecked);
        // showFlashMessage('Updating task...', 'loader'); // Can show loader briefly

        try {
            await taskApiService.update(taskId, { completed: isChecked });
            showFlashMessage(`Task ${isChecked ? 'completed' : 'marked incomplete'}.`, 'check-circle');
            // Refresh state to get confirmed data and re-render the whole list/page
            await refreshState('tasks');
        } catch (error) {
            console.error("Failed to toggle task completion:", error);
            // Revert optimistic UI update if it failed
            // if (listItem) listItem.classList.toggle('completed', !isChecked);
            // API service handles error flash message
        }
    }

    async function deleteTask(taskId) {
        showFlashMessage('Deleting task...', 'loader');
        try {
            const success = await taskApiService.delete(taskId);
            if (success) {
                showFlashMessage('Task deleted successfully.', 'trash-2');
                // Refresh state to remove task from list and re-render
                await refreshState('tasks');
            } else {
                 // This case might happen if handleResponse logic changes or API returns unexpected success
                 throw new Error("Delete operation did not explicitly confirm success.");
            }
        } catch (error) {
            console.error("Failed to delete task:", error);
            // API service handles error flash message
        }
    }

    // --- Modal Setup ---
    // Use the global setupModal function
    const addModalControls = setupModal(addModal, ['#add-task-button-main'], ['#modal-cancel-button'], () => {
        // Reset function for Add Task modal
        const textInput = addModal?.querySelector('#task-text-input');
        const prioritySelect = addModal?.querySelector('#task-priority-select');
        const dateInput = addModal?.querySelector('#task-date-input');
        if (textInput) textInput.value = '';
        if (prioritySelect) prioritySelect.value = 'medium';
        if (dateInput) dateInput.value = getTodayDateString(); // Default to today
    });

    const editModalControls = setupModal(editModal, [], ['#edit-modal-cancel-button']);
    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-task-cancel-button']);

    // Function to populate and show the Edit modal
    const openEditModal = (taskId) => {
        const task = taskState.find(t => t.id === taskId);
        if (!task || !editModal) return; // Exit if task or modal not found
        // Populate modal fields
        editModal.querySelector('#edit-task-id-input').value = task.id;
        editModal.querySelector('#edit-task-text-input').value = task.text;
        editModal.querySelector('#edit-task-priority-select').value = task.priority || 'medium';
        editModal.querySelector('#edit-task-date-input').value = task.date || '';
        editModal.querySelector('#edit-modal-title').textContent = `Edit Task: ${task.text.substring(0, 30)}${task.text.length > 30 ? '...' : ''}`; // Truncate title
        editModalControls.show();
    };

    // Function to show the Delete confirmation modal
    const showDeleteConfirmModal = (id, name) => {
        if (!deleteConfirmModal) return;
        taskToDeleteId = id; // Store ID for confirmation action
        const messageEl = deleteConfirmModal.querySelector('#delete-task-confirm-message');
        if (messageEl) messageEl.textContent = `Are you sure you want to permanently delete task: "${name}"?`;
        deleteModalControls.show();
    };

    // --- Modal Action Event Listeners ---
    // Use event delegation on document or a stable parent for dynamically added elements if needed
    // However, modals are usually stable, so direct listeners are okay IF elements exist on page load.
    // For SPA, it's safer to re-attach or use delegation. Re-attaching here for clarity.

     // Remove previous listeners associated with this page initialization instance
     // (Using a simple flag, could use more robust method if needed)
     if (!initializeTasksPageLogic._listenersAttached) {
        console.log("Attaching Task Modal action listeners...");
        document.getElementById('modal-add-button')?.addEventListener('click', handleAddTask);
        document.getElementById('edit-modal-save-button')?.addEventListener('click', handleEditTask);
        document.getElementById('edit-modal-delete-button')?.addEventListener('click', handleDeleteTaskTrigger);
        document.getElementById('delete-task-confirm-button')?.addEventListener('click', handleDeleteTaskConfirm);
        initializeTasksPageLogic._listenersAttached = true; // Mark as attached
     } else {
        console.log("Task Modal action listeners seem already attached.");
     }


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
            type: 'task' // Ensure type is always 'task' for items created here
        };

        addModalControls.hide(); // Hide modal immediately
        showFlashMessage('Adding task...', 'loader');
        try {
            await taskApiService.create(newTask);
            showFlashMessage('Task added successfully!', 'plus-circle');
            await refreshState('tasks'); // Refresh data and re-render
        } catch (error) { console.error("Failed to add task:", error); /* API service shows flash */ }
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
            date: editModal.querySelector('#edit-task-date-input')?.value || null // Send null if empty? Check backend validation
        };

        editModalControls.hide();
        showFlashMessage('Saving changes...', 'loader');
        try {
            await taskApiService.update(id, updatedTaskData);
            showFlashMessage('Task updated successfully!', 'save');
            await refreshState('tasks');
        } catch (error) { console.error("Failed to update task:", error); /* API service shows flash */ }
    }

    function handleDeleteTaskTrigger() {
        if (!editModal) return;
        const taskId = editModal.querySelector('#edit-task-id-input')?.value;
        const task = taskState.find(t => t.id === taskId);
        if (task) {
            editModalControls.hide(); // Hide edit modal first
            showDeleteConfirmModal(task.id, task.text); // Show confirmation modal
        } else {
            console.warn("Could not find task to delete from edit modal.");
        }
    }

    async function handleDeleteTaskConfirm() {
        if (taskToDeleteId) {
            deleteModalControls.hide(); // Hide confirmation modal
            await deleteTask(taskToDeleteId); // Call the delete action handler
            taskToDeleteId = null; // Reset ID after action
        }
    }


    // --- Task List Item Event Listeners (using delegation) ---
    function attachTaskItemListeners() {
         // Remove previous listeners if they exist to prevent duplicates
        if (mainTaskList?._taskItemClickListener) {
            mainTaskList.removeEventListener('click', mainTaskList._taskItemClickListener);
        }
         if (mainTaskList?._taskItemChangeListener) {
            mainTaskList.removeEventListener('change', mainTaskList._taskItemChangeListener);
        }

        if (!mainTaskList) return; // Don't attach if list doesn't exist

        // Listener for checkbox changes
        mainTaskList._taskItemChangeListener = (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                toggleTaskCompleted(e.target.dataset.taskId, e.target.checked);
            }
        };
        mainTaskList.addEventListener('change', mainTaskList._taskItemChangeListener);


        // Listener for edit/delete button clicks
        mainTaskList._taskItemClickListener = (e) => {
            const editButton = e.target.closest('.edit-task-button');
            const deleteButton = e.target.closest('.delete-task-button');

            if (editButton) {
                e.stopPropagation(); // Prevent potential parent handlers
                openEditModal(editButton.dataset.id);
            } else if (deleteButton) {
                e.stopPropagation();
                const task = taskState.find(t => t.id === deleteButton.dataset.id);
                if (task) showDeleteConfirmModal(task.id, task.text);
                 else console.warn(`Task for delete button (ID: ${deleteButton.dataset.id}) not found.`);
            }
        };
        mainTaskList.addEventListener('click', mainTaskList._taskItemClickListener);
    }


    // --- Filter Bar Listener ---
     if (taskFilterBar && !taskFilterBar._filterClickListener) { // Attach only once
        taskFilterBar._filterClickListener = (e) => {
            if (e.target.classList.contains('filter-item')) {
                // Update active state visually
                taskFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                // Update internal filter state
                activeTaskFilter = e.target.dataset.filter;
                renderTaskList(); // Re-render the list with the new filter
            }
        };
        taskFilterBar.addEventListener('click', taskFilterBar._filterClickListener);
     }


    // --- Calendar Initialization & Logic ---
    function tryInitializeCalendar() {
        if (!calendarEl || typeof FullCalendar === 'undefined') {
             console.warn("Calendar element or FullCalendar library not available.");
             // Ensure overlay is shown if calendar cannot load
             if (calendarOverlay) calendarOverlay.style.display = 'flex';
             return;
        }

        // Destroy previous instance if it exists
        if (window.calendar) {
            console.log("Destroying previous FullCalendar instance.");
            window.calendar.destroy();
            window.calendar = null;
        }

        console.log("Initializing FullCalendar...");
        try {
            window.calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth', // Default view
                headerToolbar: { // Standard controls
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
                events: function (fetchInfo, successCallback, failureCallback) {
                    // Provide events based on the current global taskState
                    const events = (Array.isArray(taskState) ? taskState : [])
                        .filter(t => t.date) // Only include items with a date
                        .map(task => ({
                            id: task.id,
                            title: task.text,
                            start: task.date, // Assumes 'YYYY-MM-DD'
                            allDay: true, // Treat all as all-day events for simplicity
                            // Use classes for styling based on type and priority
                            classNames: [task.type || 'task', task.priority || 'medium'],
                            // Example: Custom color based on priority
                            // backgroundColor: task.priority === 'high' ? '#ffebee' : (task.priority === 'medium' ? '#fef9c3' : '#f4f6f9'),
                            // textColor: task.priority === 'high' ? '#c62828' : (task.priority === 'medium' ? '#b45309' : '#555'),
                            // borderColor: task.priority === 'high' ? '#c62828' : (task.priority === 'medium' ? '#f9a825' : '#ccc'),
                        }));
                    console.log(`Providing ${events.length} events to FullCalendar.`);
                    successCallback(events); // Pass events to calendar
                },
                eventClick: function(info) {
                    // Open edit modal when an event (task) is clicked
                    console.log("Calendar event clicked:", info.event.id);
                    openEditModal(info.event.id);
                },
                dateClick: function(info) {
                     // Optional: Open Add Task modal when a date is clicked
                     console.log("Calendar date clicked:", info.dateStr);
                     if(addModal) {
                         // Pre-fill date input and show modal
                         const dateInput = addModal.querySelector('#task-date-input');
                         if (dateInput) dateInput.value = info.dateStr; // Set to clicked date
                         addModalControls.show();
                     }
                }
            });

            window.calendar.render(); // Render the calendar
            console.log("FullCalendar rendered successfully.");
             // Hide the sign-in overlay if calendar renders
             if (calendarOverlay) calendarOverlay.style.display = 'none';

        } catch (renderErr) {
            console.error("Error initializing or rendering FullCalendar:", renderErr);
             // Show overlay on error
             if (calendarOverlay) calendarOverlay.style.display = 'flex';
        }
    } // End of tryInitializeCalendar

    async function checkCalendarAccess() {
        console.log("Checking calendar access requirement...");
         if (!calendarOverlay) return; // Nothing to do if overlay doesn't exist

        if (!auth0) {
             console.warn("Auth0 client not ready for calendar access check.");
             calendarOverlay.style.display = 'flex'; // Show overlay if auth isn't ready
             return;
        }

        try {
            const isAuthenticated = await auth0.isAuthenticated();
            if (isAuthenticated) {
                console.log("User authenticated, initializing calendar.");
                calendarOverlay.style.display = 'none'; // Hide overlay
                tryInitializeCalendar(); // Attempt to load calendar
            } else {
                console.log("User not authenticated, showing calendar sign-in overlay.");
                calendarOverlay.style.display = 'flex'; // Show overlay
                // Destroy calendar if it was somehow initialized before
                if (window.calendar) { window.calendar.destroy(); window.calendar = null; }
                if (calendarEl) calendarEl.innerHTML = ''; // Clear calendar area
            }
             // Ensure Feather icons in overlay are rendered
             try { feather.replace({ 'stroke-width': 2, width: 24, height: 24 }); } catch (e) {}

        } catch (authError) {
             console.error("Error checking authentication status for calendar:", authError);
             calendarOverlay.style.display = 'flex'; // Show overlay on error
        }
    } // End of checkCalendarAccess

    // Sign-in button listener within the calendar overlay
     if (calendarSignInButton) {
         // Clone to remove old listeners
        const newSignInButton = calendarSignInButton.cloneNode(true);
        calendarSignInButton.parentNode.replaceChild(newSignInButton, calendarSignInButton);
        newSignInButton.addEventListener('click', async () => {
             if (auth0) {
                 try {
                     // Redirect to Auth0 login, return to current page (which will be index.html for SPA)
                     await auth0.loginWithRedirect({ authorizationParams: { redirect_uri: window.location.origin + '/index.html' } });
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
    renderTaskList(); // Render the initial task list
    checkCalendarAccess(); // Check auth and potentially initialize calendar
    attachTaskItemListeners(); // Attach listeners for task items
     // Note: Modal action listeners are attached above to avoid duplicates

} // End of initializeTasksPageLogic


// ===============================================
// FINANCE PAGE LOGIC
// ===============================================

// Global function for rendering the bill list
let renderBills = () => { console.warn("renderBills called before assignment."); };

function initializeFinancePage() {
    console.log("Initializing Finance Page Logic...");
    let activeBillFilter = 'upcoming'; // Default filter
    let showAllBills = false; // Toggle state for showing all/limited bills
    const MAX_BILLS_TO_SHOW = 3; // Number of upcoming bills to show initially
    let billToDeleteId = null; // State for delete confirmation

    // --- DOM Element References ---
    // Find elements *within the current mainContentElement* after navigation
    const mainBillList = mainContentElement?.querySelector('#main-bill-list');
    const billFilterBar = mainContentElement?.querySelector('#bill-filter-bar');
    const showMoreButton = mainContentElement?.querySelector('#show-more-bills-button');
    // Modals are usually outside mainContentElement, find them globally by ID
    const addBillModal = document.getElementById('add-bill-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');

    // --- Check if essential elements exist ---
    if (!mainBillList) console.warn("Finance page: '#main-bill-list' element not found.");
    // Modals existence checked by setupModal

    // --- Core Render Function ---
    renderBills = () => {
        if (!mainBillList) return; // Don't proceed if list element isn't found
        console.log("Rendering bills with filter:", activeBillFilter);

        // Calculate due days and overdue status dynamically for each bill
        const processedBillState = (Array.isArray(billState) ? billState : []).map(bill => {
            let dueDays = 999;
            let overdue = false;
            if (!bill.paid && bill.dueDate) {
                dueDays = calculateDueDays(bill.dueDate);
                overdue = dueDays < 0;
            } else if (bill.paid) {
                dueDays = Infinity; // Paid bills are infinitely far away
            }
            return { ...bill, dueDays, overdue };
        });

        // --- Filtering ---
        let filteredBills = processedBillState.filter(bill => {
            switch (activeBillFilter) {
                case 'subscriptions': return bill.frequency !== 'one-time';
                case 'paid': return bill.paid;
                case 'upcoming': return !bill.paid; // Includes overdue and future unpaid
                case 'all': // Falls through to default
                default: return true; // Show all bills
            }
        });

        // --- Sorting ---
        filteredBills.sort((a, b) => {
            // Primary sort: Unpaid first
            if (a.paid !== b.paid) return a.paid ? 1 : -1;
            // Secondary sort (if both unpaid): Overdue most urgent
            if (a.overdue !== b.overdue) return b.overdue ? -1 : 1; // Overdue first
            // Tertiary sort (if same paid/overdue status): Closest due date first
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
            : 100; // Default 100% if no bills

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
            billsToDisplay = filteredBills.slice(0, MAX_BILLS_TO_SHOW); // Limit displayed bills
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
                showMoreButton.style.display = 'none'; // Hide if not applicable
            }
        }

        // --- Rendering List ---
        mainBillList.innerHTML = ''; // Clear previous content
        if (billsToDisplay.length === 0) {
            mainBillList.innerHTML = `<li class="placeholder-text" style="padding: 20px; text-align: center; color: var(--c-text-muted);">No bills found for filter '${activeBillFilter}'.</li>`;
        } else {
            billsToDisplay.forEach(bill => {
                const li = document.createElement('li');
                // Determine urgency class for styling
                let urgencyClass = bill.paid ? 'completed' : (bill.overdue ? 'overdue' : (bill.dueDays <= 3 ? 'urgent' : ''));
                // Determine due date text
                let dueDateText = bill.paid ? 'Paid' : (
                    bill.overdue ? `Overdue by ${Math.abs(bill.dueDays)}d` : (
                        bill.dueDays === 0 ? 'Due Today' : (
                            bill.dueDays <= 998 ? `Due in ${bill.dueDays}d` : 'No Due Date' // Handle 999 case
                        )
                    )
                );
                // Format the actual date part
                 const formattedDatePart = bill.dueDate
                     ? `(${new Date(bill.dueDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })})`
                     : '';


                li.className = `bill-item ${urgencyClass}`;
                li.dataset.id = bill.id;
                li.dataset.link = bill.paymentLink || '#'; // Store payment link

                // Construct list item HTML
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
        console.log("Bill list rendering complete.");

        // Re-attach listeners for items within the list *after* rendering
        attachBillItemListeners();
    }; // End of renderBills

    // --- Bill Action Handlers ---
    async function markBillAsPaid(billId) {
        const bill = billState.find(b => b.id === billId);
        if (!bill || bill.paid) return; // Ignore if already paid or not found

        showFlashMessage(`Processing payment for ${bill.name}...`, 'loader');
        try {
            const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
            const updateData = {
                // Mark as paid only if it's a one-time bill
                paid: bill.frequency === 'one-time',
                // Update due date only if recurring and next date is valid
                dueDate: nextDueDate || bill.dueDate // Keep old date if one-time or error
            };
            await billApiService.update(billId, updateData);
            showFlashMessage(`${bill.name} ${bill.frequency === 'one-time' ? 'marked paid' : 'payment logged'}.`, 'check-circle');
            await refreshState('bills'); // Refresh data and re-render
        } catch (error) {
            console.error("Failed to mark bill paid:", error);
            // API service shows error flash
        }
    }

    async function deleteBill(billId) {
        // Find bill name for confirmation message
        const billName = billState.find(b => b.id === billId)?.name || 'this bill';
        showFlashMessage(`Deleting ${billName}...`, 'loader');
        try {
            const success = await billApiService.delete(billId);
            if (success) {
                showFlashMessage('Bill deleted successfully.', 'trash-2');
                await refreshState('bills'); // Refresh data and re-render
            } else {
                 throw new Error("Delete operation did not explicitly confirm success.");
            }
        } catch (error) {
            console.error("Failed to delete bill:", error);
             // API service shows error flash
        }
    }

    // --- Modal Setup ---
    // Use the global setupModal function
    const addModalControls = setupModal(addBillModal, ['#add-bill-button'], ['#bill-modal-cancel-button'], () => {
        // Reset function for Add/Edit Bill modal
        addBillModal.querySelector('#bill-modal-title').textContent = 'Add New Bill';
        const actionButton = addBillModal.querySelector('#bill-modal-action-button');
        actionButton.textContent = 'Add Bill';
        actionButton.dataset.mode = 'add'; // Set mode for handler
        addBillModal.querySelector('#bill-modal-delete-button').style.display = 'none'; // Hide delete button for 'add' mode
        addBillModal.querySelector('#bill-id-input').value = ''; // Clear hidden ID input
        addBillModal.querySelector('#bill-name-input').value = '';
        addBillModal.querySelector('#bill-amount-input').value = ''; // Clear amount
        addBillModal.querySelector('#bill-due-date-input').value = getTodayDateString(); // Default to today
        addBillModal.querySelector('#bill-frequency-select').value = 'monthly'; // Default frequency
        addBillModal.querySelector('#bill-link-input').value = '';
    });

    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-cancel-button']);

    // Function to populate and show the Add/Edit modal in 'edit' mode
    const openEditBillModal = (billId) => {
        const bill = billState.find(b => b.id === billId);
        if (!bill || !addBillModal) return; // Exit if bill or modal not found

        // Populate modal fields with existing bill data
        addBillModal.querySelector('#bill-modal-title').textContent = `Edit Bill: ${bill.name}`;
        const actionButton = addBillModal.querySelector('#bill-modal-action-button');
        actionButton.textContent = 'Save Changes';
        actionButton.dataset.mode = 'edit'; // Set mode for handler
        addBillModal.querySelector('#bill-modal-delete-button').style.display = 'block'; // Show delete button
        addBillModal.querySelector('#bill-id-input').value = bill.id; // Set hidden ID
        addBillModal.querySelector('#bill-name-input').value = bill.name;
        addBillModal.querySelector('#bill-amount-input').value = bill.amount;
        addBillModal.querySelector('#bill-due-date-input').value = bill.dueDate;
        addBillModal.querySelector('#bill-frequency-select').value = bill.frequency;
        addBillModal.querySelector('#bill-link-input').value = bill.paymentLink || '';

        addModalControls.show(); // Show the pre-filled modal
    };

    // Function to show the Delete confirmation modal
    const showDeleteConfirmModal = (id, name) => {
        if (!deleteConfirmModal) return;
        billToDeleteId = id; // Store ID for confirmation action
        const messageEl = deleteConfirmModal.querySelector('#delete-confirm-message');
        if (messageEl) messageEl.textContent = `Are you sure you want to permanently delete bill: "${name}"? This cannot be undone.`;
        deleteModalControls.show();
    };

    // --- Modal Action Event Listeners ---
    // Ensure listeners are attached only once or are properly removed/re-added
    const attachModalActionListeners = () => {
         const billModalActionButton = document.getElementById('bill-modal-action-button');
         const billModalDeleteButton = document.getElementById('bill-modal-delete-button');
         const deleteConfirmButton = document.getElementById('delete-confirm-button');

         // Remove previous listeners by cloning nodes
         if (billModalActionButton) billModalActionButton.replaceWith(billModalActionButton.cloneNode(true));
         if (billModalDeleteButton) billModalDeleteButton.replaceWith(billModalDeleteButton.cloneNode(true));
         if (deleteConfirmButton) deleteConfirmButton.replaceWith(deleteConfirmButton.cloneNode(true));

         // Add new listeners to the cloned nodes
         document.getElementById('bill-modal-action-button')?.addEventListener('click', handleSaveBill);
         document.getElementById('bill-modal-delete-button')?.addEventListener('click', handleDeleteBillTrigger);
         document.getElementById('delete-confirm-button')?.addEventListener('click', handleDeleteBillConfirm);
    };

    // --- Modal Handler Functions ---
    async function handleSaveBill() {
        if (!addBillModal) return;
        const mode = addBillModal.querySelector('#bill-modal-action-button').dataset.mode;
        const billData = {
            id: addBillModal.querySelector('#bill-id-input').value, // Will be empty for 'add'
            name: addBillModal.querySelector('#bill-name-input').value.trim(),
            amount: parseFloat(addBillModal.querySelector('#bill-amount-input').value),
            dueDate: addBillModal.querySelector('#bill-due-date-input').value,
            frequency: addBillModal.querySelector('#bill-frequency-select').value,
            paymentLink: addBillModal.querySelector('#bill-link-input').value.trim() || undefined,
            // You might infer icon/category here or add fields to modal
            icon: 'credit-card' // Default icon
        };

        // Basic validation
        if (!billData.name || isNaN(billData.amount) || billData.amount <= 0 || !billData.dueDate) {
            alert('Bill Name, a valid positive Amount, and Due Date are required.');
            return;
        }

        addModalControls.hide(); // Hide modal immediately
        showFlashMessage(mode === 'add' ? 'Adding bill...' : 'Saving changes...', 'loader');
        try {
            if (mode === 'add') {
                // Don't send empty 'id' field for creation
                const { id, ...createData } = billData;
                await billApiService.create(createData);
                showFlashMessage('Bill added successfully!', 'plus-circle');
            } else {
                // Don't send 'id' in the body for update, it's in the URL
                 const { id, ...updateData } = billData;
                await billApiService.update(billData.id, updateData);
                showFlashMessage('Bill updated successfully!', 'save');
            }
            await refreshState('bills'); // Refresh data and re-render
        } catch (error) {
            console.error(`Failed to ${mode} bill:`, error);
            // API service shows flash error
        }
    }

    function handleDeleteBillTrigger() {
        if (!addBillModal) return;
        const billId = addBillModal.querySelector('#bill-id-input').value;
        const bill = billState.find(b => b.id === billId);
        if (bill) {
            addModalControls.hide(); // Hide edit modal first
            showDeleteConfirmModal(bill.id, bill.name); // Show confirmation modal
        } else {
            console.warn("Could not find bill to delete from edit modal.");
        }
    }

    async function handleDeleteBillConfirm() {
        if (billToDeleteId) {
            deleteModalControls.hide(); // Hide confirmation modal
            await deleteBill(billToDeleteId); // Call the delete action handler
            billToDeleteId = null; // Reset ID after action
        }
    }


    // --- Bill List Item Event Listeners (using delegation) ---
    function attachBillItemListeners() {
        // Remove previous listener if exists
        if (mainBillList?._billItemClickListener) {
            mainBillList.removeEventListener('click', mainBillList._billItemClickListener);
        }
        if (!mainBillList) return; // Don't attach if list doesn't exist

        mainBillList._billItemClickListener = (e) => {
            const editButton = e.target.closest('.edit-button');
            const payButton = e.target.closest('.pay-button');
            const billItem = e.target.closest('.bill-item'); // Get the parent list item

            if (editButton) {
                e.stopPropagation(); // Prevent pay button logic if edit is clicked
                openEditBillModal(editButton.dataset.id);
            } else if (payButton && !payButton.disabled) {
                e.stopPropagation(); // Prevent potential parent handlers
                const billId = billItem?.dataset.id;
                const paymentLink = billItem?.dataset.link;

                // Open payment link if available
                if (paymentLink && paymentLink !== '#') {
                    const billName = billItem?.querySelector('.details p')?.textContent || 'bill';
                    showFlashMessage(`Opening payment link for ${billName}...`, 'link');
                    window.open(paymentLink, '_blank'); // Open in new tab
                }
                // Mark the bill as paid (or log payment for recurring)
                markBillAsPaid(billId);
            }
            // Add click handler for the whole item if needed (e.g., to open details)
            // else if (billItem) { /* ... handle item click ... */ }
        };
        mainBillList.addEventListener('click', mainBillList._billItemClickListener);
    }


    // --- Filter Bar Listener ---
    if (billFilterBar && !billFilterBar._filterClickListener) { // Attach only once per page init
        billFilterBar._filterClickListener = (e) => {
            if (e.target.classList.contains('filter-item')) {
                billFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                activeBillFilter = e.target.dataset.filter;
                showAllBills = false; // Reset 'show all' state on filter change
                renderBills(); // Re-render list
            }
        };
        billFilterBar.addEventListener('click', billFilterBar._filterClickListener);
    }

    // --- Show More/Less Button Listener ---
    if (showMoreButton && !showMoreButton._showMoreClickListener) { // Attach only once
        showMoreButton._showMoreClickListener = () => {
            showAllBills = !showAllBills; // Toggle state
            renderBills(); // Re-render list
        };
        showMoreButton.addEventListener('click', showMoreButton._showMoreClickListener);
    }


    // --- Initial Render & Setup ---
    renderBills(); // Render the initial bill list
    attachBillItemListeners(); // Attach listeners for list items
    attachModalActionListeners(); // Attach listeners for modal actions
} // End of initializeFinancePage


// ===============================================
// FITNESS PAGE LOGIC
// ===============================================

// Global function for rendering the fitness page content
let renderFitnessPage = () => { console.warn("renderFitnessPage called before assignment."); };

function initializeFitnessPage() {
    console.log("Initializing Fitness Page Logic...");
    let selectedWaterVolume = 0; // Local state for water modal input

    // --- DOM Element References ---
    // Find elements *within the current mainContentElement*
    const kpiStepsEl = mainContentElement?.querySelector('#kpi-steps');
    const kpiCaloriesOutEl = mainContentElement?.querySelector('#kpi-calories-out');
    const kpiWorkoutsEl = mainContentElement?.querySelector('#kpi-workouts');
    const kpiWaterEl = mainContentElement?.querySelector('#kpi-water');
    const kpiSleepEl = mainContentElement?.querySelector('#kpi-sleep');
    const suggestionListEl = mainContentElement?.querySelector('#health-suggestion-list');
    const logListEl = mainContentElement?.querySelector('#daily-log-list');
    const logEmptyEl = mainContentElement?.querySelector('#log-history-empty');
    const fitnessChartCanvas = mainContentElement?.querySelector('#fitness-trend-chart'); // Get canvas element
    const chartPlaceholder = mainContentElement?.querySelector('#fitness-chart-placeholder'); // Placeholder div

    // Modals (usually global)
    const activityModal = document.getElementById('log-activity-modal');
    const waterModal = document.getElementById('log-water-modal');

    // --- Check if essential elements exist ---
     if (!logListEl || !logEmptyEl) console.warn("Fitness page: Log list or empty placeholder not found.");
     if (!fitnessChartCanvas) console.warn("Fitness page: Canvas element '#fitness-trend-chart' not found.");
    // Modals checked by setupModal


    // --- Core Render Function ---
    renderFitnessPage = () => {
        console.log("Rendering fitness page...");
        if (!mainContentElement) return; // Exit if main container isn't ready

        // --- Calculate KPIs from global fitnessHistory ---
        const safeHistory = Array.isArray(fitnessHistory) ? fitnessHistory : [];
        const todayLogs = safeHistory.filter(log => log.date === TODAY_DATE);

        const totalStepsToday = todayLogs.filter(log => log.type === 'steps').reduce((sum, log) => sum + (log.value || 0), 0);
        const totalCaloriesOutToday = todayLogs.filter(log => log.type === 'calories_out').reduce((sum, log) => sum + (log.value || 0), 0);
        const totalWaterIntake = todayLogs.filter(log => log.type === 'water_intake').reduce((sum, log) => sum + (log.value || 0), 0);

        // Calculate workouts this week (last 7 days including today)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Go back 6 days to get a 7-day window
        const sevenDaysAgoStr = getTodayDateString(sevenDaysAgo);
        const workoutsThisWeek = safeHistory.filter(log =>
            log.type === 'workout' &&
            (log.date >= sevenDaysAgoStr && log.date <= TODAY_DATE)
        ).length; // Count number of workout logs

        // Get the most recent sleep log
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
        // Mark suggestions as completed based on global completedSuggestions array
        if (suggestionListEl) {
             suggestionListEl.querySelectorAll('.suggestion-item').forEach(item => {
                 const suggestionId = item.dataset.suggestionId;
                 item.classList.toggle('completed', completedSuggestions.includes(suggestionId));
                 // Optionally disable button or change text if completed
                 const button = item.querySelector('.remedy-button'); // Assuming a button exists
                 if (button) {
                     button.disabled = completedSuggestions.includes(suggestionId);
                     // button.textContent = completedSuggestions.includes(suggestionId) ? 'Done' : 'Mark Done';
                 }
             });
        }


        // --- Render Daily Log History ---
        if (logListEl && logEmptyEl) {
            // Sort today's logs by time descending (latest first)
            const sortedTodayLogs = todayLogs.sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));

            logListEl.innerHTML = ''; // Clear previous logs
            if (sortedTodayLogs.length === 0) {
                logListEl.style.display = 'none'; // Hide list
                logEmptyEl.style.display = 'block'; // Show empty message
            } else {
                logListEl.style.display = 'block'; // Show list
                logEmptyEl.style.display = 'none'; // Hide empty message
                sortedTodayLogs.forEach(log => {
                    const li = document.createElement('li');
                    li.className = 'log-item';
                    // Format type for display (e.g., 'water_intake' -> 'Water Intake')
                    let typeText = (log.type || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    // Format units nicely
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
         if (fitnessChartCtx && typeof Chart !== 'undefined') {
             // Prepare data (last 7 days steps & workout minutes)
             const last7DaysLabels = [];
             const last7DaysSteps = [];
             const last7DaysWorkout = [];

             for (let i = 6; i >= 0; i--) {
                 const d = new Date();
                 d.setDate(d.getDate() - i);
                 const dateStr = getTodayDateString(d);
                 last7DaysLabels.push(dateStr); // Use YYYY-MM-DD for consistency

                 const steps = safeHistory
                     .filter(log => log.date === dateStr && log.type === 'steps')
                     .reduce((sum, log) => sum + (log.value || 0), 0);
                 last7DaysSteps.push(steps);

                 const workoutMins = safeHistory
                     .filter(log => log.date === dateStr && log.type === 'workout')
                     .reduce((sum, log) => sum + (log.value || 0), 0); // Assuming workout value is minutes
                 last7DaysWorkout.push(workoutMins);
             }

             const chartData = {
                 // Format labels for display
                 labels: last7DaysLabels.map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', /* month: 'short', day: 'numeric',*/ timeZone: 'UTC' })),
                 datasets: [
                     {
                         label: 'Steps',
                         data: last7DaysSteps,
                         borderColor: 'var(--c-primary)',
                         backgroundColor: 'rgba(0, 199, 166, 0.1)',
                         tension: 0.3, // Smoother line
                         yAxisID: 'ySteps', // Assign to left axis
                         fill: true, // Fill area under line
                         order: 1 // Draw line on top of bars
                     },
                     {
                         label: 'Workout (min)',
                         data: last7DaysWorkout,
                         borderColor: 'var(--c-accent-blue)', // Use a different color
                         backgroundColor: 'rgba(2, 119, 189, 0.5)', // Semi-transparent bars
                         type: 'bar', // Display as bars
                         yAxisID: 'yWorkout', // Assign to right axis
                         order: 2 // Draw bars underneath line
                     }
                 ]
             };

             // Destroy previous chart instance if it exists
             if (fitnessTrendChartInstance) {
                 console.log("[Chart] Destroying previous fitness trend chart.");
                 fitnessTrendChartInstance.destroy();
                 fitnessTrendChartInstance = null;
             }

             console.log("[Chart] Creating new fitness trend chart.");
             try {
                 fitnessTrendChartInstance = new Chart(fitnessChartCtx, {
                     type: 'bar', // Base type (line dataset overrides this)
                     data: chartData,
                     options: {
                         responsive: true,
                         maintainAspectRatio: false,
                         scales: {
                             x: { grid: { display: false } }, // Hide vertical grid lines
                             ySteps: { // Left axis for steps
                                 position: 'left',
                                 title: { display: true, text: 'Steps' },
                                 beginAtZero: true,
                                 grid: { color: '#eaeaea' } // Lighter grid lines
                             },
                             yWorkout: { // Right axis for workout minutes
                                 position: 'right',
                                 title: { display: true, text: 'Workout (min)' },
                                 beginAtZero: true,
                                 // Prevent workout grid lines from overlapping step lines
                                 grid: { drawOnChartArea: false }
                             }
                         },
                         plugins: {
                             legend: { position: 'bottom' }, // Legend at the bottom
                             tooltip: { mode: 'index', intersect: false } // Show tooltip for both datasets on hover
                         },
                         interaction: { // Improve hover interaction
                            mode: 'index',
                            intersect: false,
                         },
                     }
                 });
                  // Hide placeholder if chart renders successfully
                  if (chartPlaceholder) chartPlaceholder.style.display = 'none';
                  if (fitnessChartCanvas) fitnessChartCanvas.style.display = 'block'; // Ensure canvas is visible
             } catch (chartError) {
                  console.error("Error creating Fitness Trend Chart:", chartError);
                  // Show placeholder if chart fails
                  if (chartPlaceholder) chartPlaceholder.style.display = 'flex'; // Or 'block' based on CSS
                  if (fitnessChartCanvas) fitnessChartCanvas.style.display = 'none';
             }


         } else if (fitnessChartCanvas) { // Canvas found, but Chart.js missing
             console.warn("Fitness page: Chart.js library not loaded. Cannot render trend chart.");
              if (chartPlaceholder) chartPlaceholder.style.display = 'flex'; // Show placeholder
              fitnessChartCanvas.style.display = 'none'; // Hide canvas
         } else { // Canvas element itself is missing
             if (chartPlaceholder) chartPlaceholder.style.display = 'flex'; // Show placeholder if it exists
         }


        try { feather.replace(); } catch (e) { console.warn("Feather replace failed in fitness render:", e); }
        console.log("Fitness page rendering complete.");

        // Attach listeners for interactive elements *after* rendering
        attachFitnessListeners();
    }; // End of renderFitnessPage

    // --- Action Handler for Logging Fitness Data ---
    async function logFitnessEntry(type, value, unit) {
        // Get current time in HH:MM format
        const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const newLog = {
            date: TODAY_DATE, // Log for today
            time: nowTime,
            type: type,
            value: Number(value), // Ensure value is a number
            unit: unit
        };

        showFlashMessage(`Logging ${value} ${unit}...`, 'loader');
        try {
            const result = await fitnessApiService.create(newLog);
            if (result?.log) { // Check if API returned the created log
                 showFlashMessage('Activity logged successfully!', 'check-circle');
                 await refreshState('fitness'); // Refresh data and re-render the page
            } else {
                 throw new Error("Log creation response did not contain log data.");
            }
        } catch (error) {
            console.error("Failed to log fitness entry:", error);
            // API service handles error flash
        }
    }

    // --- Modal Setup ---
    // Use global setupModal
    const activityModalControls = setupModal(activityModal, ['#add-manual-entry-button'], ['#activity-modal-cancel-button']);
    const waterModalControls = setupModal(waterModal, ['#log-water-button'], ['#water-modal-cancel-button']);

    // --- Modal Specific Logic ---
    const updateActivityUnit = () => {
        // Update unit label based on selected activity type
         if (!activityModal) return;
        const type = activityModal.querySelector('#activity-type-select')?.value;
        const valueLabel = activityModal.querySelector('#activity-value-label');
        const unitLabel = activityModal.querySelector('#activity-unit-label');
        if (!valueLabel || !unitLabel) return;

        switch(type) {
            case 'steps': unitLabel.value = 'steps'; valueLabel.textContent = 'Steps Count'; break;
            case 'workout': unitLabel.value = 'min'; valueLabel.textContent = 'Duration (minutes)'; break;
            case 'sleep': unitLabel.value = 'hours'; valueLabel.textContent = 'Duration (hours)'; break;
            case 'calories_out': unitLabel.value = 'kcal'; valueLabel.textContent = 'Calories Burned'; break;
             default: unitLabel.value = ''; valueLabel.textContent = 'Value';
        }
    };
    // Initial call to set units when page loads
    updateActivityUnit();


    // --- Modal Action Event Listeners ---
     const attachModalListeners = () => {
        // Activity Log Modal
        document.getElementById('activity-type-select')?.addEventListener('change', updateActivityUnit);

        const activityLogButton = document.getElementById('activity-modal-log-button');
        if (activityLogButton) {
            const newBtn = activityLogButton.cloneNode(true);
            activityLogButton.parentNode.replaceChild(newBtn, activityLogButton);
            newBtn.addEventListener('click', () => {
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
        }

        // Water Log Modal
        document.getElementById('water-quick-select')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.water-option');
            if (btn) {
                document.querySelectorAll('#water-quick-select .water-option').forEach(b => b.classList.remove('active-select'));
                btn.classList.add('active-select');
                selectedWaterVolume = parseInt(btn.dataset.volume);
                const customInput = document.getElementById('water-custom-input');
                if (customInput) customInput.value = ''; // Clear custom input
                document.getElementById('water-modal-log-button').disabled = false;
            }
        });

        document.getElementById('water-custom-input')?.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            const logButton = document.getElementById('water-modal-log-button');
            if (!isNaN(volume) && volume > 0) {
                selectedWaterVolume = volume;
                if (logButton) logButton.disabled = false;
                // Deactivate quick select if custom value is entered
                document.querySelectorAll('#water-quick-select .water-option').forEach(btn => btn.classList.remove('active-select'));
            } else {
                selectedWaterVolume = 0;
                // Disable button only if no quick select is active either
                if (logButton && !document.querySelector('#water-quick-select .water-option.active-select')) {
                    logButton.disabled = true;
                }
            }
        });

        const waterLogButton = document.getElementById('water-modal-log-button');
        if (waterLogButton) {
             const newBtn = waterLogButton.cloneNode(true);
             waterLogButton.parentNode.replaceChild(newBtn, waterLogButton);
            newBtn.addEventListener('click', () => {
                if (selectedWaterVolume > 0) {
                    waterModalControls.hide();
                    logFitnessEntry('water_intake', selectedWaterVolume, 'ml');
                } else {
                    alert("Please select a quick option or enter a custom water volume.");
                }
            });
        }
     }; // End attachModalListeners


    // --- Page-Specific Event Listeners ---
    function attachFitnessListeners() {
        // Suggestion List Clicks (mark as complete locally)
        if (suggestionListEl) {
             // Use delegation on the list itself
             if (!suggestionListEl._suggestionClickListener) { // Attach only once
                 suggestionListEl._suggestionClickListener = (e) => {
                     const item = e.target.closest('.suggestion-item');
                     if (item && !item.classList.contains('completed')) {
                         const id = item.dataset.suggestionId;
                         if (id && !completedSuggestions.includes(id)) {
                             completedSuggestions.push(id); // Update local state
                             showFlashMessage('Suggestion marked complete!', 'check');
                             renderFitnessPage(); // Re-render to show visual change
                         }
                     }
                 };
                 suggestionListEl.addEventListener('click', suggestionListEl._suggestionClickListener);
             }
        }

        // Log History Toggle Button
        const viewLogToggle = mainContentElement?.querySelector('.view-log-toggle');
        if (viewLogToggle && !viewLogToggle.dataset.listenerAttached) { // Prevent duplicate listeners
            viewLogToggle.addEventListener('click', (e) => {
                 if (!logListEl) return;
                const action = e.currentTarget.dataset.action;
                if (action === 'hide') {
                    // Hide the log list
                    logListEl.style.maxHeight = '0';
                    logListEl.style.opacity = '0';
                    logListEl.style.marginTop = '0';
                    logListEl.style.overflow = 'hidden'; // Prevent content overflow during transition
                    e.currentTarget.dataset.action = 'show';
                    e.currentTarget.innerHTML = '<i data-feather="chevron-down"></i> Show Log History';
                } else {
                    // Show the log list
                     logListEl.style.maxHeight = '250px'; // Set max height for scroll
                    logListEl.style.opacity = '1';
                    logListEl.style.marginTop = '12px'; // Restore margin
                     logListEl.style.overflow = 'auto'; // Allow scrolling
                    e.currentTarget.dataset.action = 'hide';
                    e.currentTarget.innerHTML = '<i data-feather="chevron-up"></i> Hide Log History';
                }
                try { feather.replace(); } catch (fe) { } // Update icon
            });
            viewLogToggle.dataset.listenerAttached = 'true'; // Mark listener as attached
        }
    } // End attachFitnessListeners

    // --- Initial Render & Setup ---
    renderFitnessPage(); // Initial render
    attachModalListeners(); // Attach modal action listeners

} // End of initializeFitnessPage


// ===============================================
// MOOD PAGE LOGIC
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
    const moodChartCanvas = mainContentElement?.querySelector('#mood-trend-chart'); // Canvas element
    const moodChartPlaceholder = mainContentElement?.querySelector('#mood-chart-placeholder'); // Placeholder


    // Modal (global)
    const moodModal = document.getElementById('add-mood-modal');
     if (!moodModal) {
        console.warn("Mood page: Add Mood modal element not found.");
    }

    // --- Core Render Function ---
    renderMoodPage = () => {
        console.log("Rendering mood page...");
        if (!mainContentElement) return;

        // --- Calculate KPIs ---
        const safeMoodHistory = Array.isArray(moodHistory) ? moodHistory : [];
        // Get the latest entry (could be placeholder from backend)
        const latestEntry = safeMoodHistory[0] || { mood: 2, stress: 45, isFinal: false };
        let stressScore = latestEntry.stress || 45; // Default if missing
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
        // Disable button if a *final* log for today already exists
        const hasLoggedTodayFinal = safeMoodHistory.some(e => e.date === TODAY_DATE && e.isFinal);
        if (addMoodButton) {
            addMoodButton.disabled = hasLoggedTodayFinal;
            // Update button text and appearance based on logged state
            addMoodButton.innerHTML = hasLoggedTodayFinal
                 ? '<i data-feather="check"></i> Logged Today'
                 : '<i data-feather="plus"></i> Add Mood Entry';
            addMoodButton.style.opacity = hasLoggedTodayFinal ? 0.6 : 1;
            addMoodButton.style.cursor = hasLoggedTodayFinal ? 'default' : 'pointer';
        }

        // --- Render Remedies ---
        // (Remedies in mood.html are currently static examples,
        // this section would render dynamic remedies if implemented)
        // For now, just ensure listeners are attached correctly later.

        // --- Render Mood Trend Chart ---
        const moodChartCtx = moodChartCanvas?.getContext('2d');
        if (moodChartCtx && typeof Chart !== 'undefined') {
            // Prepare data: Get logs from the last 30 days, excluding placeholders
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Go back 29 days for a 30-day window
            const thirtyDaysAgoStr = getTodayDateString(thirtyDaysAgo);

            const last30DaysData = safeMoodHistory
                .filter(log => log.id !== 'temp-mood' && log.date >= thirtyDaysAgoStr && log.date <= TODAY_DATE)
                .sort((a, b) => (a.date || '').localeCompare(b.date || '')); // Sort ascending by date

            const chartData = {
                labels: last30DaysData.map(log => new Date(log.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })),
                datasets: [{
                    label: 'Mood', // Legend hidden, but good practice
                    data: last30DaysData.map(log => log.mood), // Use the numeric mood value (0-4)
                    borderColor: 'var(--c-primary)',
                    backgroundColor: 'rgba(0, 199, 166, 0.1)', // Light fill color
                    tension: 0.3, // Slightly smooth line
                    fill: true, // Fill area under the line
                    pointRadius: 3, // Smaller points
                    pointBackgroundColor: 'var(--c-primary)'
                }]
            };

            // Destroy previous instance if it exists
            if (moodTrendChartInstance) {
                 console.log("[Chart] Destroying previous mood trend chart.");
                 moodTrendChartInstance.destroy();
                 moodTrendChartInstance = null;
            }

            console.log("[Chart] Creating new mood trend chart.");
            try {
                moodTrendChartInstance = new Chart(moodChartCtx, {
                    type: 'line',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                             x: { grid: { display: false } }, // Hide vertical grid lines
                            y: {
                                min: 0, // Mood scale 0 (Awful)
                                max: 4, // Mood scale 4 (Great)
                                ticks: {
                                    stepSize: 1, // Show ticks for each mood level
                                    // Use callback to display mood labels instead of numbers
                                    callback: function(value) {
                                        return Object.values(moodMap).find(m => m.value === value)?.label || '';
                                    }
                                },
                                grid: { color: '#eaeaea' } // Lighter grid lines
                            }
                        },
                        plugins: {
                            legend: { display: false } // Hide the legend ('Mood')
                        }
                    }
                });
                 // Hide placeholder if chart renders
                 if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'none';
                 if (moodChartCanvas) moodChartCanvas.style.display = 'block';

            } catch (chartError) {
                 console.error("Error creating Mood Trend Chart:", chartError);
                 if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
                 if (moodChartCanvas) moodChartCanvas.style.display = 'none';
            }

        } else if (moodChartCanvas) {
            console.warn("Mood page: Chart.js library not loaded.");
             if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
             moodChartCanvas.style.display = 'none';
        } else { // Canvas element missing
             if (moodChartPlaceholder) moodChartPlaceholder.style.display = 'flex';
        }


        try { feather.replace(); } catch (e) { console.warn("Feather replace failed in mood render:", e); }
        console.log("Mood page rendering complete.");

        // Attach listeners for interactive elements *after* rendering
        attachMoodListeners();
    }; // End of renderMoodPage

    // --- Action Handler for Logging Mood ---
    async function logMoodEntry(moodValue, note) {
        // Calculate potential new stress based on mood (simple example)
        let currentStress = (moodHistory[0] || { stress: 45 }).stress; // Get current or default stress
        let newStress = currentStress; // Default to current
        if (moodValue < 2) { // Awful or Sad
            newStress = Math.min(95, currentStress + 10); // Increase stress, cap at 95
        } else if (moodValue > 2) { // Happy or Great
            newStress = Math.max(10, currentStress - 15); // Decrease stress, floor at 10
        }

        const newEntry = {
            date: TODAY_DATE,
            mood: moodValue,
            note: note || null, // Send null if note is empty
            stress: newStress,
            isFinal: true // Mark this as the definitive log for the day
        };

        showFlashMessage('Logging your mood...', 'loader');
        try {
            // Use POST (create) which handles the upsert logic on the backend for 'temp-mood'
            const result = await moodApiService.create(newEntry);
            if (result) { // Check if API call was successful
                 showFlashMessage('Mood logged successfully!', 'check-circle');
                 await refreshState('mood'); // Refresh data and re-render
            } else {
                 throw new Error("Mood log creation response was empty or indicated failure.");
            }
        } catch (error) {
            console.error("Failed to log mood:", error);
            // API service shows error flash
        }
    }


    // --- Modal Setup ---
    // Use global setupModal
    const moodModalControls = setupModal(moodModal, ['#add-mood-entry-button'], ['#mood-modal-cancel-button'], () => {
        // Reset function for Add Mood modal
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
        // Reset visual state of mood selector icons
        moodSelector?.querySelectorAll('span').forEach(s => {
            const isDefault = s.dataset.mood === defaultMood;
            s.style.opacity = isDefault ? '1' : '0.5';
            s.style.transform = isDefault ? 'scale(1.2)' : 'scale(1)';
        });
    });


    // --- Modal Action Event Listeners ---
     const attachModalListeners = () => {
         // Mood Selector Icons
         document.getElementById('mood-selector')?.addEventListener('click', (e) => {
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
                 // Update visual selection state
                 document.querySelectorAll('#mood-selector span').forEach(s => {
                     const isSelected = s === span;
                     s.style.opacity = isSelected ? '1' : '0.5';
                     s.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
                 });
             }
         });

         // Log Entry Button
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
     }; // End attachModalListeners


    // --- Remedy Timer Logic ---
    function markRemedyComplete(button, originalText, type) {
        const remedyItem = button.closest('.suggestion-item');
        if (!remedyItem) return;
        remedyItem.classList.add('completed');
        button.textContent = 'Done!';
        button.disabled = true; // Disable after completion
        if (type === 'timer') {
            showFlashMessage('Meditation complete. Stress hopefully reduced!', 'smile');
            // Future: Could trigger a mood refresh or estimate stress reduction
        } else {
            showFlashMessage('Activity logged as completed.', 'check');
        }
         // Maybe refresh mood state if remedies affect stress calculation?
         // refreshState('mood');
    }

    // --- Page-Specific Event Listeners ---
    function attachMoodListeners() {
        if (!remedyListEl) return;

         // Use delegation for remedy buttons
         if (!remedyListEl._remedyClickListener) {
             remedyListEl._remedyClickListener = (e) => {
                 const button = e.target.closest('.remedy-button');
                 const remedyItem = e.target.closest('.suggestion-item');
                 if (!button || !remedyItem || button.disabled || remedyItem.classList.contains('completed')) {
                     return; // Ignore clicks outside buttons or on completed/disabled ones
                 }

                 const remedyType = remedyItem.dataset.remedy;
                 const originalText = button.textContent;
                 let duration = 0; // Duration in minutes

                 if (remedyType === 'meditate') duration = 5;
                 // Add durations for other timed remedies if needed

                 // Prevent starting a new timer if one is already running
                 if (activeTimer && duration > 0) {
                     alert("Another timed activity (like meditation) is already in progress.");
                     return;
                 }

                 if (duration > 0) {
                     // Start a timed activity (e.g., meditate)
                     showFlashMessage(`Starting ${duration} min ${remedyType}...`, 'clock');
                     button.disabled = true;
                     button.innerHTML = `<i data-feather="loader" class="spin"></i> ${duration}:00`;
                     try{ feather.replace(); } catch(fe) {}

                     let remainingSeconds = duration * 60;
                     activeTimer = setInterval(() => {
                         remainingSeconds--;
                         const minutes = Math.floor(remainingSeconds / 60);
                         const seconds = remainingSeconds % 60;
                         button.innerHTML = `<i data-feather="loader" class="spin"></i> ${minutes}:${seconds.toString().padStart(2, '0')}`;
                         try{ feather.replace(); } catch(fe) {}

                         if (remainingSeconds <= 0) {
                             clearInterval(activeTimer);
                             activeTimer = null;
                             markRemedyComplete(button, originalText, 'timer');
                         }
                     }, 1000);
                 } else {
                     // Log an untimed activity (e.g., break, read)
                     showFlashMessage(`${remedyType === 'break' ? 'Break' : 'Reading'} logged.`, 'check');
                     // Mark as complete immediately
                     markRemedyComplete(button, originalText, 'log');
                 }
             };
             remedyListEl.addEventListener('click', remedyListEl._remedyClickListener);
         }
    } // End attachMoodListeners

    // --- Initial Render & Setup ---
    renderMoodPage(); // Initial render
    attachModalListeners(); // Attach modal listeners
    // Remedy listeners attached within renderMoodPage via attachMoodListeners

} // End of initializeMoodPage


// ===============================================
// VAULT PAGE LOGIC
// ===============================================

// Global function for rendering vault assets
let renderAssets = () => { console.warn("renderAssets called before assignment."); };

function initializeVaultPage() {
    console.log("Initializing Vault Page Logic...");
    let activeFilter = 'All'; // Default filter state
    let searchQuery = ''; // Current search query
    let assetToDeleteId = null; // State for delete confirmation
    let currentModalAsset = null; // State for task scheduler modal

    // --- DOM Element References ---
    const mainVaultGrid = mainContentElement?.querySelector('#main-vault-grid');
    const assetFilterBar = mainContentElement?.querySelector('#asset-filter-bar');
    const assetSearchInput = mainContentElement?.querySelector('#asset-search-input');
    const vaultEmptyMessage = mainContentElement?.querySelector('#vault-empty-message');

    // Modals (global)
    const assetModal = document.getElementById('asset-modal');
    const deleteConfirmModal = document.getElementById('delete-asset-confirm-modal');
    const taskSchedulerModal = document.getElementById('task-scheduler-modal');

     // --- Check if essential elements exist ---
     if (!mainVaultGrid) console.warn("Vault page: '#main-vault-grid' element not found.");
     // Modals checked by setupModal


    // --- Core Render Function ---
    renderAssets = () => {
        if (!mainVaultGrid) return; // Don't render if grid element missing
        console.log(`Rendering assets. Filter: ${activeFilter}, Search: "${searchQuery}"`);

        const safeAssetState = Array.isArray(assetState) ? assetState : [];

        // --- Filtering ---
        const lowerSearchQuery = searchQuery.toLowerCase();
        let filteredAssets = safeAssetState.filter(asset => {
            // Check filter match
            const matchesFilter = activeFilter === 'All' || asset.type === activeFilter;
            // Check search query match (name, type, or URL)
            const matchesSearch = !searchQuery ||
                (asset.name && asset.name.toLowerCase().includes(lowerSearchQuery)) ||
                (asset.type && asset.type.toLowerCase().includes(lowerSearchQuery)) ||
                (asset.url && asset.url.toLowerCase().includes(lowerSearchQuery));
            return matchesFilter && matchesSearch;
        });

        // --- Sorting (Optional, e.g., by name) ---
        filteredAssets.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // --- Rendering Grid Items ---
        mainVaultGrid.innerHTML = ''; // Clear previous items (including Add tile)
        if (filteredAssets.length === 0) {
            // Show empty message if it exists, otherwise log warning
             if (vaultEmptyMessage) {
                 vaultEmptyMessage.textContent = `No links found matching filter "${activeFilter}" ${searchQuery ? `and search "${searchQuery}"` : ''}.`;
                 vaultEmptyMessage.style.display = 'block'; // Show the message
                 // Ensure message spans grid if needed (CSS might handle this)
                 vaultEmptyMessage.style.gridColumn = '1 / -1';
             } else {
                 console.warn("Vault empty message element not found.");
                 mainVaultGrid.innerHTML = `<div style="text-align: center; color: var(--c-text-muted); padding: 20px; grid-column: 1 / -1;">No links found.</div>`; // Fallback inline message
             }
        } else {
            // Hide empty message if assets are found
            if (vaultEmptyMessage) vaultEmptyMessage.style.display = 'none';

            // Render each asset item
            filteredAssets.forEach(asset => {
                const item = document.createElement('div');
                item.className = 'vault-item';
                item.dataset.id = asset.id;
                item.dataset.url = asset.url; // Store URL for click handler
                // Add class if this asset type can trigger the task scheduler
                if (['Dev', 'Video', 'Creative'].includes(asset.type)) {
                    item.classList.add('action-task');
                }

                // Default icon if none provided
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
        // Ensures it's always present regardless of filtering
        const addTile = document.createElement('div');
        addTile.className = 'vault-item add-new';
        addTile.id = 'add-new-vault-tile'; // ID used by modal trigger
        addTile.innerHTML = `<i data-feather="plus-circle"></i><p>Add New Link</p><span>Click to add</span>`;
        mainVaultGrid.appendChild(addTile);

        try { feather.replace(); } catch (e) { console.warn("Feather error during asset render:", e); }
        console.log("Assets rendering complete.");

        // Re-attach listeners for items within the grid *after* rendering
        attachAssetItemListeners();
    }; // End of renderAssets

    // --- Action Handler for Deleting Asset ---
    async function deleteAsset(assetId) {
        const assetName = assetState.find(a => a.id === assetId)?.name || 'this link';
        showFlashMessage(`Deleting ${assetName}...`, 'loader');
        try {
            const success = await assetApiService.delete(assetId);
            if (success) {
                showFlashMessage('Link deleted successfully.', 'trash-2');
                await refreshState('assets'); // Refresh data and re-render
            } else {
                 throw new Error("Delete operation did not explicitly confirm success.");
            }
        } catch (error) {
            console.error("Failed to delete asset:", error);
            // API service shows error flash
        }
    }

    // --- Modal Setup ---
    // Use the global setupModal function
    const assetModalControls = setupModal(assetModal, ['#add-asset-button', '#add-new-vault-tile'], ['#asset-modal-cancel-button'], () => {
        // Reset function for Add/Edit Asset modal
        assetModal.querySelector('#asset-modal-title').textContent = 'Add New Link';
        const actionButton = assetModal.querySelector('#asset-modal-action-button');
        actionButton.textContent = 'Add Link';
        actionButton.dataset.mode = 'add';
        assetModal.querySelector('#asset-modal-delete-button').style.display = 'none';
        assetModal.querySelector('#asset-id-input').value = '';
        assetModal.querySelector('#asset-name-input').value = '';
        assetModal.querySelector('#asset-type-select').value = 'Social'; // Default category
        assetModal.querySelector('#asset-icon-select').value = 'link'; // Default icon
        assetModal.querySelector('#asset-url-input').value = '';
    });

    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-asset-cancel-button']);
    const taskSchedulerControls = setupModal(taskSchedulerModal, [], ['#task-scheduler-cancel-button']);


    // Function to populate and show the Add/Edit modal in 'edit' mode
    const openEditAssetModal = (assetId) => {
        const asset = assetState.find(a => a.id === assetId);
        if (!asset || !assetModal) return;

        assetModal.querySelector('#asset-modal-title').textContent = `Edit Link: ${asset.name}`;
        const actionButton = assetModal.querySelector('#asset-modal-action-button');
        actionButton.textContent = 'Save Changes';
        actionButton.dataset.mode = 'edit';
        assetModal.querySelector('#asset-modal-delete-button').style.display = 'block'; // Show delete
        assetModal.querySelector('#asset-id-input').value = asset.id;
        assetModal.querySelector('#asset-name-input').value = asset.name;
        assetModal.querySelector('#asset-type-select').value = asset.type || 'Social'; // Fallback type
        assetModal.querySelector('#asset-icon-select').value = asset.icon || 'link'; // Fallback icon
        assetModal.querySelector('#asset-url-input').value = asset.url;

        assetModalControls.show();
    };

    // Function to show the Delete confirmation modal
    const showDeleteConfirmModal = (id, name) => {
        if (!deleteConfirmModal) return;
        assetToDeleteId = id;
        const messageEl = deleteConfirmModal.querySelector('#delete-asset-confirm-message');
        if (messageEl) messageEl.textContent = `Are you sure you want to delete the link: "${name}"?`;
        deleteModalControls.show();
    };

    // Function to populate and show the Task Scheduler modal
    const openTaskSchedulerModal = () => {
        if (!currentModalAsset || !taskSchedulerModal) return; // Need asset data and modal

        taskSchedulerModal.querySelector('#task-scheduler-title').textContent = `Schedule Focus: ${currentModalAsset.name}`;
        const textInput = taskSchedulerModal.querySelector('#task-scheduler-text-input');
        textInput.value = ''; // Clear previous text
        // Set placeholder based on asset type
        textInput.placeholder = (currentModalAsset.type === 'Dev') ? 'e.g., Work on feature X' :
                               (currentModalAsset.type === 'Video' || currentModalAsset.type === 'Creative') ? 'e.g., Edit project Y' :
                               'Describe the task...';
        // Set default duration (e.g., 60 minutes)
        taskSchedulerModal.querySelector('#task-scheduler-duration-input').value = '60';

        taskSchedulerControls.show();
    };

    // --- Modal Action Event Listeners ---
     const attachModalActionListeners = () => {
         // --- Asset Add/Edit Modal ---
         const assetActionButton = document.getElementById('asset-modal-action-button');
         const assetDeleteButton = document.getElementById('asset-modal-delete-button');

         // Remove previous listeners
         if (assetActionButton) assetActionButton.replaceWith(assetActionButton.cloneNode(true));
         if (assetDeleteButton) assetDeleteButton.replaceWith(assetDeleteButton.cloneNode(true));

         // Add new listeners
         document.getElementById('asset-modal-action-button')?.addEventListener('click', handleSaveAsset);
         document.getElementById('asset-modal-delete-button')?.addEventListener('click', handleDeleteAssetTrigger);


         // --- Delete Confirmation Modal ---
         const deleteConfirmButton = document.getElementById('delete-asset-confirm-button');
         if (deleteConfirmButton) deleteConfirmButton.replaceWith(deleteConfirmButton.cloneNode(true));
         document.getElementById('delete-asset-confirm-button')?.addEventListener('click', handleDeleteAssetConfirm);

         // --- Task Scheduler Modal ---
         const taskSchedulerAddButton = document.getElementById('task-scheduler-add-button');
         if (taskSchedulerAddButton) taskSchedulerAddButton.replaceWith(taskSchedulerAddButton.cloneNode(true));
         document.getElementById('task-scheduler-add-button')?.addEventListener('click', handleScheduleTask);
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
         // Basic URL validation (optional)
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
            await refreshState('assets');
        } catch (error) { console.error(`Failed to ${mode} asset:`, error); /* API service shows flash */ }
    }

    function handleDeleteAssetTrigger() {
        if (!assetModal) return;
        const assetId = assetModal.querySelector('#asset-id-input').value;
        const asset = assetState.find(a => a.id === assetId);
        if (asset) {
            assetModalControls.hide();
            showDeleteConfirmModal(asset.id, asset.name);
        } else { console.warn("Could not find asset to delete from edit modal."); }
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
        // Call the global function to add the task via API
        await addNewTaskFromVault(`${taskText} (from ${currentModalAsset.name})`, duration); // Add context to task text

        // Optionally open the asset's URL after scheduling
        if (currentModalAsset.url) {
            showFlashMessage(`Launching ${currentModalAsset.name}...`, 'link');
            window.open(currentModalAsset.url, '_blank');
        }
        currentModalAsset = null; // Clear the temporary state
    }


    // --- Vault Grid Item Event Listeners (using delegation) ---
    function attachAssetItemListeners() {
         // Remove previous listener if exists
        if (mainVaultGrid?._assetItemClickListener) {
            mainVaultGrid.removeEventListener('click', mainVaultGrid._assetItemClickListener);
        }
        if (!mainVaultGrid) return; // Don't attach if grid doesn't exist

        mainVaultGrid._assetItemClickListener = (e) => {
            const item = e.target.closest('.vault-item:not(.add-new)'); // Target asset items, exclude 'add new'
            const editButton = e.target.closest('.edit-asset-button');
            const deleteButton = e.target.closest('.delete-asset-button');
            // Check if the 'add new' tile was clicked - handled by setupModal now
            // const addTile = e.target.closest('.add-new');
            // if (addTile) { return; } // Let setupModal handle this trigger

            if (editButton) {
                e.stopPropagation(); // Prevent item click logic
                openEditAssetModal(editButton.dataset.id);
            } else if (deleteButton) {
                e.stopPropagation(); // Prevent item click logic
                const asset = assetState.find(a => a.id === deleteButton.dataset.id);
                if (asset) showDeleteConfirmModal(asset.id, asset.name);
                 else console.warn(`Asset for delete button (ID: ${deleteButton.dataset.id}) not found.`);
            } else if (item) {
                // Clicked on the item itself (not edit/delete buttons)
                const assetId = item.dataset.id;
                const asset = assetState.find(a => a.id === assetId);
                if (!asset) {
                     console.warn(`Asset data for clicked item (ID: ${assetId}) not found.`);
                     return;
                }

                // Check if it should trigger the task scheduler
                if (item.classList.contains('action-task')) {
                    currentModalAsset = asset; // Store data for the modal
                    openTaskSchedulerModal();
                } else {
                    // Default action: Open the URL in a new tab
                    if (asset.url) {
                         try {
                             new URL(asset.url); // Validate URL before opening
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
    if (assetFilterBar && !assetFilterBar._filterClickListener) { // Attach only once
        assetFilterBar._filterClickListener = (e) => {
            if (e.target.classList.contains('filter-item')) {
                assetFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
                activeFilter = e.target.dataset.filter;
                renderAssets(); // Re-render with new filter
            }
        };
        assetFilterBar.addEventListener('click', assetFilterBar._filterClickListener);
    }

    // --- Search Input Listener ---
    if (assetSearchInput && !assetSearchInput._searchInputListener) { // Attach only once
         // Use 'input' event for real-time filtering as user types
        assetSearchInput._searchInputListener = (e) => {
            searchQuery = e.target.value;
            // Optional: Debounce rendering if performance is an issue on large lists
            renderAssets(); // Re-render with new search query
        };
        assetSearchInput.addEventListener('input', assetSearchInput._searchInputListener);
    }


    // --- Initial Render & Setup ---
    renderAssets(); // Initial render
    attachAssetItemListeners(); // Attach listeners for grid items
    attachModalActionListeners(); // Attach listeners for modal actions
} // End of initializeVaultPage


// ===============================================
// INSIGHTS & SETTINGS PAGES
// ===============================================

/**
 * Initializes logic for the Insights page.
 * Currently renders mock charts, replace with real data processing.
 */
function initializeInsightsPage() {
    console.log("Initializing Insights Page");
    if (!mainContentElement) return;

    // --- Render Insights Charts (Example: Task Completion Trend) ---
    const insightsChartCanvas = mainContentElement.querySelector('#insights-trend-chart'); // Use specific ID
    const insightsChartPlaceholder = mainContentElement.querySelector('#insights-chart-placeholder'); // Placeholder


    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.warn("Insights page: Chart.js library not loaded. Cannot render charts.");
        if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'flex'; // Show placeholder
        if (insightsChartCanvas) insightsChartCanvas.style.display = 'none'; // Hide canvas
        return; // Stop if Chart.js is missing
    }


    // --- Task Completion Trend Chart ---
    if (insightsChartCanvas) {
         const insightsChartCtx = insightsChartCanvas.getContext('2d');
         // Example: Calculate weekly task completion rate for the last 4 weeks (Mock Data)
         const weeksLabels = ["Week -3", "Week -2", "Week -1", "This Week"];
         // TODO: Replace with actual calculation based on taskState and dates
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

         // Manage chart instance (needs a global variable like insightsTaskChartInstance)
         // For simplicity, destroying any previous instance if this function runs again
         // if (globalThis.insightsTaskChartInstance) globalThis.insightsTaskChartInstance.destroy();

         try {
             globalThis.insightsTaskChartInstance = new Chart(insightsChartCtx, {
                 type: 'line',
                 data: taskTrendData,
                 options: {
                     responsive: true,
                     maintainAspectRatio: false,
                     scales: { y: { beginAtZero: true, max: 100, title: {display: true, text: 'Completion Rate (%)'} } },
                     plugins: { legend: { display: false } }
                 }
             });
              // Hide placeholder, show canvas
              if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'none';
              insightsChartCanvas.style.display = 'block';
             console.log("Insights task trend chart rendered (mock data).");
         } catch (chartError) {
             console.error("Error creating Insights task trend chart:", chartError);
              if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'flex';
              insightsChartCanvas.style.display = 'none';
         }
    } else {
         console.warn("Insights page: Canvas '#insights-trend-chart' not found.");
          if (insightsChartPlaceholder) insightsChartPlaceholder.style.display = 'flex'; // Ensure placeholder shows
    }


    // --- Add logic for other charts or dynamic content on Insights page ---

    // Example: Render AI Recommendation Feed (Mock)
    const recommendationList = mainContentElement.querySelector('#ai-recommendation-feed'); // Assuming an ID
    if (recommendationList) {
         // TODO: Fetch or generate recommendations based on analysis of global state
         const recommendations = [
             { id: 'rec1', status: 'finance', icon: 'alert-triangle', text: 'Overdue: Netflix Bill. Pay Now.', buttonText: 'Pay', action: 'pay-bill', dataId: 'bill_id_1' },
             { id: 'rec2', status: 'health', icon: 'moon', text: 'Consistent low sleep detected. Try adjusting bedtime.', buttonText: 'Plan Sleep', action: 'plan-sleep' },
             { id: 'rec3', status: 'task', icon: 'alert-circle', text: 'Task "Project Report" is frequently marked late.', buttonText: 'Review Task', action: 'review-task', dataId: 'task_id_1' },
         ]; // Mock data

         recommendationList.innerHTML = ''; // Clear previous
         if (recommendations.length === 0) {
              recommendationList.innerHTML = `<li class="remedy-item" data-status="info"><i data-feather="thumbs-up"></i><p>No specific recommendations right now.</p></li>`;
         } else {
              recommendations.forEach(item => {
                  const li = document.createElement('li');
                  li.className = `remedy-item`; // Add status class dynamically if needed
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
         try { feather.replace(); } catch (e) {}

         // TODO: Add event listeners for recommendation buttons
          // Use event delegation on recommendationList
          recommendationList.addEventListener('click', handleRecommendationClick);

    } else {
         console.warn("Insights page: Recommendation list element not found.");
    }


    console.log("Insights Page Initialized.");
} // End initializeInsightsPage


// --- Event Handler for Insights Recommendations (Example) ---
async function handleRecommendationClick(e) {
    const button = e.target.closest('.remedy-button');
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const itemId = button.dataset.id;
    console.log(`Recommendation action: ${action}, ID: ${itemId}`);
    showFlashMessage(`Handling recommendation: ${action}...`, 'loader');

    // Add logic based on action type
    try {
        if (action === 'pay-bill') {
            // Find bill and try to mark as paid (similar to finance page logic)
             await markBillAsPaid(itemId); // Assumes markBillAsPaid is accessible globally or imported
        } else if (action === 'plan-sleep') {
            // Navigate to fitness page or open a sleep planning modal?
            navigateToPage('fitness.html');
        } else if (action === 'review-task') {
             // Navigate to tasks page or open edit modal for the task
             navigateToPage('tasks.html');
             // Optionally: highlight the task after navigation (more complex)
        } else {
            console.warn("Unknown recommendation action:", action);
            showFlashMessage(`Action "${action}" not implemented yet.`, 'info');
             await new Promise(resolve => setTimeout(resolve, 1500)); // Remove loader after delay
        }
         // Refresh relevant state if action modified data
         if (action === 'pay-bill') await refreshState('bills'); // Refresh bills if paid
         // Add other refreshState calls as needed

    } catch (error) {
         console.error(`Error handling recommendation action ${action}:`, error);
         showFlashMessage(`Failed to handle recommendation. Check console.`, 'alert-triangle');
    } finally {
        // Find and remove loader message if still present
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
 * Includes profile population, logout, and mock data management.
 */
function initializeSettingsPage() {
    console.log("Initializing Settings Page...");
    if (!mainContentElement) return;

    // --- DOM Element References ---
    const profileCard = mainContentElement.querySelector('.settings-card'); // Assuming first card is profile
    const profileNameInput = mainContentElement.querySelector('#profile-name-input');
    const profileEmailInput = mainContentElement.querySelector('#profile-email-input');
    const saveProfileButton = mainContentElement.querySelector('#save-profile-button');
    const deleteDataButton = mainContentElement.querySelector('#delete-data-button');
    const deleteDataConfirmModal = document.getElementById('delete-data-confirm-modal'); // Modal is global

    // --- Logout Button ---
    // Ensure logout button exists and has listener attached
    if (profileCard) {
        let logoutButton = profileCard.querySelector('#logout-button');
        if (!logoutButton) {
            logoutButton = document.createElement('button');
            logoutButton.id = 'logout-button';
            logoutButton.className = 'modal-button delete'; // Style as danger
            logoutButton.innerHTML = '<i data-feather="log-out"></i> Log Out';
            logoutButton.style.width = '100%';
            logoutButton.style.marginTop = '20px'; // Space from other buttons
            // Append after save button if it exists, otherwise just append
             if (saveProfileButton) {
                saveProfileButton.insertAdjacentElement('afterend', logoutButton);
             } else {
                profileCard.appendChild(logoutButton);
             }

            try { feather.replace(); } catch (e) { }
        }
        // Attach listener using cloneNode to prevent duplicates
        const newLogoutButton = logoutButton.cloneNode(true);
        logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
        newLogoutButton.addEventListener('click', logout); // Attach the global logout function
    } else {
        console.warn("Settings page: Profile card not found, cannot add logout button.");
    }


    // --- Populate Profile Info ---
    const populateProfile = async () => {
        // Ensure elements exist before trying to populate
        if (!profileNameInput || !profileEmailInput) {
             console.warn("Settings: Profile input fields not found.");
             return;
        }

        if (!auth0 || !(await auth0.isAuthenticated())) {
            console.warn("Settings: User not authenticated, cannot populate profile.");
            profileNameInput.value = 'Not logged in';
            profileEmailInput.value = '';
            profileEmailInput.disabled = true;
            return;
        }

        console.log("Settings: Populating profile info...");
        try {
            const user = await auth0.getUser(); // Fetch user data
            if (user) {
                profileNameInput.value = user.name || user.nickname || 'Name not set';
                profileEmailInput.value = user.email || 'Email not available';
                profileEmailInput.disabled = true; // Email usually managed by provider

                // Update global profile picture as well (redundant with updateGlobalUIElements, but safe)
                 await updateGlobalUIElements();
            } else {
                 console.warn("Settings: auth0.getUser() returned null or undefined.");
                 profileNameInput.value = 'Could not load profile';
                 profileEmailInput.value = '';
            }
        } catch (err) {
            console.error("Error fetching user profile for settings:", err);
            profileNameInput.value = 'Error loading profile';
            profileEmailInput.value = '';
        }
    };
    populateProfile(); // Call function to populate


    // --- Mock Settings Actions ---
    // Save Profile (Simulated)
    if (saveProfileButton) {
         const newSaveBtn = saveProfileButton.cloneNode(true);
         saveProfileButton.parentNode.replaceChild(newSaveBtn, saveProfileButton);
        newSaveBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent potential form submission
            showFlashMessage('Profile save simulated. No changes persisted.', 'save');
            // In a real app, you'd call an API to update user metadata if allowed
        });
    }

    // Data Management Modals & Listeners
    const deleteModalControls = setupModal(deleteDataConfirmModal, ['#delete-data-button'], ['#delete-data-cancel-button']);

    const deleteDataConfirmButton = document.getElementById('delete-data-confirm-button');
    if (deleteDataConfirmButton) {
         const newConfirmBtn = deleteDataConfirmButton.cloneNode(true);
         deleteDataConfirmButton.parentNode.replaceChild(newConfirmBtn, deleteDataConfirmButton);
        newConfirmBtn.addEventListener('click', () => {
            showFlashMessage('Simulating data deletion... (no actual deletion)', 'trash-2');
            deleteModalControls.hide();
            // In a real app, you would:
            // 1. Call a backend API endpoint to delete all user data.
            // 2. Clear local state (taskState, billState etc.).
            // 3. Possibly log the user out or redirect.
        });
    }

    // TODO: Add listeners for Import/Export buttons (implement actual logic later)
     const importButton = mainContentElement.querySelector('#import-data-button');
     const fileInput = mainContentElement.querySelector('#import-file-input');
     if (importButton && fileInput) {
         importButton.addEventListener('click', () => fileInput.click()); // Trigger file input
         fileInput.addEventListener('change', (e) => {
             const file = e.target.files[0];
             if (file && file.type === 'application/json') {
                 showFlashMessage(`Simulating import of ${file.name}...`, 'upload');
                 // TODO: Read file content and send to backend API for import
             } else if (file) {
                 alert("Please select a valid JSON file (.json).");
             }
             fileInput.value = ''; // Reset input
         });
     }

     const exportButton = mainContentElement.querySelector('#export-data-button');
     if (exportButton) {
         exportButton.addEventListener('click', () => {
             showFlashMessage('Simulating data export...', 'download');
             // TODO: Call backend API to generate and download JSON export
         });
     }


    console.log("Settings Page Initialized.");
} // End initializeSettingsPage


// ===============================================
// 0. MAIN SCRIPT EXECUTION (ENTRY POINT) - SPA VERSION
// ===============================================
(async () => {
    console.log("DOM Loaded. Starting App Initialization...");

    // --- Ensure Flash Message Container Exists ---
    if (!document.getElementById('flash-message-container')) {
        const container = document.createElement('div');
        container.id = 'flash-message-container';
        // Apply necessary styles for positioning
        Object.assign(container.style, {
             position: 'fixed', top: '90px', right: '40px', zIndex: '9999',
             display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
         });
        document.body.appendChild(container);
    }

    // --- Phase 1: Initialize Auth0 Client ---
    console.log("Phase 1: Initializing Auth...");
    await configureClient();
    // If configureClient fails, it shows an error message and auth0 will be null
    if (!auth0) {
        console.error("STOPPING Initialization: Auth0 client failed to configure.");
        return; // Stop execution if auth setup failed critically
    }

    // --- Phase 2: Handle Auth0 Callback ---
    // This runs on every load, checks if the URL contains callback parameters
    console.log("Phase 2: Handling Potential Auth Callback...");
    const callbackProcessed = await handleAuthCallback();
    // If callback handling failed (returned false AND had code), stop execution
    if (callbackProcessed === false && window.location.search.includes("code=")) {
        console.error("Callback handling indicated failure. Halting initialization.");
        // handleAuthCallback already shows alert/redirects on failure
        return;
    }
    // If callback processed successfully (returned true), the URL is cleaned by handleAuthCallback

    // --- Determine Current Page (for logic fork) ---
    // Use the path after potential callback cleaning
    const pathPageName = window.location.pathname.split('/').pop() || 'index.html';

    // --- LOGIC FORK: Login Page vs Protected App ---
    if (pathPageName === 'login.html') {
        // --- On the LOGIN PAGE ---
        console.log("On Login Page. Initializing login logic.");
        initializeLoginPage(); // Set up the login button listener
        try { feather.replace(); } catch (e) { console.warn("Feather error on login page:", e); }

    } else {
        // --- On a PROTECTED APP PAGE (or potentially invalid path) ---
        console.log(`On Protected App Page (Path: /${pathPageName}).`);

        // --- Phase 3: Authentication Guard ---
        // Verify user is authenticated, redirects to login if not
        console.log("Phase 3: Checking Authentication Requirement...");
        const isAuthenticated = await requireAuth();
        // If requireAuth initiated a redirect (returns false), stop execution for this load
        if (!isAuthenticated) {
            console.log("Authentication redirect initiated by requireAuth. Halting script for this page load.");
            return;
        }
        // Proceed only if authenticated

        // --- Phase 4: Core SPA UI Setup (Runs Only Once on initial authenticated load) ---
        console.log("Phase 4: Setting up Global UI (SPA)...");
        // Find the main content area where pages will be injected
        mainContentElement = document.querySelector('.main-content');
        if (!mainContentElement) {
            console.error("CRITICAL ERROR: <main class='main-content'> element not found in index.html. SPA cannot function.");
            document.body.innerHTML = "<h1>Application Error</h1><p>Core application structure missing. Cannot load content.</p>"; // Show fatal error
            return; // Stop execution
        }

        // --- Setup Navigation Link Listeners (using delegation on sidebar) ---
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
             // Remove previous listener if exists (e.g., during hot-reloading dev)
             if (sidebar._navClickListener) sidebar.removeEventListener('click', sidebar._navClickListener);

             sidebar._navClickListener = (e) => {
                 const menuItem = e.target.closest('.menu-item');
                 if (menuItem) {
                     e.preventDefault(); // Prevent default link behavior
                     const page = menuItem.dataset.page;
                     // Navigate only if it's a valid page and not the current one
                     if (page && page !== currentPageName) {
                         navigateToPage(page);
                     }
                 }
             };
             sidebar.addEventListener('click', sidebar._navClickListener);
        } else {
             console.warn("Sidebar element not found, navigation links won't work.");
        }


        // --- Setup Browser Back/Forward Button Listener ---
        window.onpopstate = (event) => {
            // Get the page name from the history state, default to index.html
            const targetPage = event.state?.page || 'index.html';
            console.log("Browser back/forward detected. Navigating to:", targetPage);
            // Navigate without pushing a new history entry (it already exists)
            navigateToPage(targetPage, true); // true = isInitialLoad (from history perspective)
        };

        // --- Setup Clock Update Interval ---
        // Clear previous interval if exists
         if (globalThis._clockInterval) clearInterval(globalThis._clockInterval);
         // Initial update happens in updateGlobalUIElements
         globalThis._clockInterval = setInterval(() => {
             const timeElement = document.getElementById('current-time'); // Re-find element each time
             if (timeElement) {
                 timeElement.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
             }
         }, 30000); // Update every 30 seconds

        // --- Setup Notification Bell Listener ---
        const bellIconWrapper = document.querySelector('.global-controls .control-icon-wrapper');
        if (bellIconWrapper) {
             // Replace node to ensure single listener attachment
            const newBellIconWrapper = bellIconWrapper.cloneNode(true);
            bellIconWrapper.parentNode.replaceChild(newBellIconWrapper, bellIconWrapper);
            newBellIconWrapper.addEventListener('click', toggleNotificationPanel);
        } else {
             console.warn("Notification bell icon wrapper not found.");
        }

        console.log("Global UI setup complete.");

        // --- Phase 5: Initial Data Loading (Runs Only Once) ---
        console.log("Phase 5: Loading Initial Application Data...");
        await syncApplicationState(); // Fetch all data from backend

        // --- Phase 5.5: Initial Global UI Update ---
        // Update elements like profile pic *after* data sync might provide user info
        console.log("Phase 5.5: Performing Initial Global UI Update...");
        await updateGlobalUIElements(); // Update clock, profile pic

        // --- Phase 6: Load Initial Page Content ---
        console.log("Phase 6: Initializing page content based on URL:", pathPageName);
        // Ensure the correct sidebar item is marked active based on the initial URL path
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pathPageName);
        });

        // Initialize the content: If path is index.html, run its init function directly.
        // If path is something else, use navigateToPage to fetch and inject its content.
        if (pathPageName === 'index.html') {
            initializeDashboardPage();
            currentPageName = 'index.html'; // Set current page state
            // Set the initial history state correctly for index.html
            window.history.replaceState({ page: 'index.html' }, '', '/index.html');
        } else {
            // Let navigateToPage handle fetching, injection, initialization, and history state
            await navigateToPage(pathPageName, true); // true = isInitialLoad (don't push history)
        }


        // --- Phase 7: Final Icon Rendering ---
        // Render Feather icons for the initially loaded page content
        console.log("Phase 7: Rendering Feather Icons for initial page...");
        try { feather.replace(); } catch (e) { console.warn("Initial Feather replace failed:", e); }
    } // End of protected app page logic

    console.log("✨ App Initialization Sequence Complete ✨");

})(); // End of main async IIFE