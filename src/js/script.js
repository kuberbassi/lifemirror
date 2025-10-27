// ===============================================
// GLOBAL STATE & CORE HELPERS
// ===============================================
let auth0 = null; // Holds the initialized Auth0 client
var calendar = null; // Holds the FullCalendar instance
let sleepCheckInterval = null;
let IS_SMART_NOTIFICATIONS_MOCK = true; // Kept from original, controls mock notification filtering
let IS_NOTIFICATION_PANEL_OPEN = false;
let activeTimer = null; // Holds interval ID for meditation timer

// --- GLOBAL DATA STATE (Populated by API) ---
let taskState = [];
let billState = [];
let assetState = [];
let fitnessHistory = [];
let moodHistory = [];
let completedSuggestions = []; // For Fitness page UI state

// --- DATE HELPERS ---
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
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

    // Replace the <img> with a <div> showing initials
    const parent = imgElement.parentNode;
    if (!parent) return;

    const initialsDiv = document.createElement('div');
    initialsDiv.className = 'profile-pic-initials'; // You can style this
    // Inline styles for a quick default
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
    console.log("Attempting to configure Auth0 client...");
    try {
        if (typeof window.auth0?.createAuth0Client !== 'function') {
            throw new Error("Auth0 SDK not loaded correctly.");
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
            window.history.replaceState({}, document.title, window.location.pathname);
            console.log("URL cleaned.");
            return true;
        } catch (err) {
            console.error("Error handling Auth0 callback:", err);
            alert(`Login failed during callback: ${err.message}. Redirecting to login.`);
            window.location.assign('/login.html');
            return false;
        }
    }
    return false;
};

/**
 * Checks auth. Redirects to Auth0 login if needed.
 */
const requireAuth = async () => {
    const isLoginPage = window.location.pathname.endsWith('/login.html');
    if (isLoginPage) return true;

    if (!auth0) {
        console.warn("requireAuth: Auth0 client not ready, configuring...");
        await configureClient();
        if (!auth0) {
            console.error("requireAuth: Auth0 client failed to initialize.");
            document.body.innerHTML = "<h1>Authentication Error</h1><p>Could not initialize auth. Refresh or contact support.</p>";
            return false;
        }
    }

    let isAuthenticated = false;
    try {
        isAuthenticated = await auth0.isAuthenticated();
        console.log("requireAuth - Auth Status:", isAuthenticated);
    } catch (err) {
        console.error("Error checking auth status:", err);
    }

    if (!isAuthenticated) {
        console.log("User not authenticated. Redirecting to Auth0 login...");
        try {
            await auth0.loginWithRedirect({
                authorizationParams: {
                    redirect_uri: window.location.href
                }
            });
            return false;
        } catch (loginErr) {
            console.error("Error initiating login redirect:", loginErr);
            alert("Could not start login. Check connection/Auth0 settings.");
            return false;
        }
    }
    console.log("requireAuth: User is authenticated.");
    return true;
};

/**
 * Retrieves the access token for API calls. Handles refresh/redirects.
 */
async function getAccessToken() {
    if (!auth0) {
        console.error("getAccessToken: Auth0 client not initialized.");
        await configureClient();
        if (!auth0) throw new Error("Authentication not ready.");
    }
    try {
        console.log("Attempting silent token retrieval...");
        const token = await auth0.getTokenSilently();
        if (!token) throw new Error("Failed to obtain access token silently.");
        return token;
    } catch (error) {
        console.error("Error getting access token silently:", error.message, error.error || '');
        if (error.error === 'login_required' || error.error === 'consent_required' || error.error === 'interaction_required') {
            console.log("Silent token acquisition failed. Redirecting to login...");
            try {
                await auth0.loginWithRedirect({
                    authorizationParams: { redirect_uri: window.location.href }
                });
            } catch (loginErr) {
                console.error("Error redirecting after silent auth failure:", loginErr);
                alert("Session may have expired. Redirecting to login.");
                window.location.assign('/login.html');
            }
            throw new Error("Login required");
        }
        alert(`Could not retrieve token: ${error.message}. Please try again.`);
        throw error;
    }
}

/**
 * Logs the user out.
 */
const logout = () => {
    if (!auth0) {
        console.error("Auth0 client not initialized for logout.");
        alert("Logout failed: Auth system not ready.");
        return;
    }
    console.log("Initiating logout...");
    try {
        auth0.logout({
            logoutParams: {
                returnTo: window.location.origin + '/login.html'
            }
        });
    } catch (err) {
        console.error("Error initiating logout:", err);
        alert("Logout failed. Try again or clear site data.");
    }
};

/**
 * Attaches login listener for the login.html page.
 */
function initializeLoginPage() {
    const loginButton = document.getElementById('login-button');
    const loadingMessage = document.getElementById('loading-message');

    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            if (!auth0) {
                alert("Authentication client is not ready. Please refresh.");
                return;
            }
            loadingMessage.style.display = 'block';
            loginButton.disabled = true;

            try {
                // Use the SDK's login method, which correctly creates the 'state'
                await auth0.loginWithRedirect({
                    authorizationParams: {
                        // Tell Auth0 to return to index.html after login
                        redirect_uri: window.location.origin + '/index.html'
                    }
                });
            } catch (err) {
                console.error("Error initiating login:", err);
                loadingMessage.style.display = 'none';
                loginButton.disabled = false;
                alert("Error starting login. Check console.");
            }
        });
    }
}

// ===============================================
// API SERVICE LAYER
// ===============================================

/**
 * Creates a generic API service. Includes error handling.
 */
function createApiService(resourceName) {
    const baseUrl = `/api/${resourceName}`;

    const handleResponse = async (response, operation) => {
        if (!response.ok) {
            const status = response.status;
            let errorMsg = `HTTP error ${status} during ${operation} ${resourceName}`;
            try {
                const errorBody = await response.json();
                errorMsg += `: ${errorBody.message || JSON.stringify(errorBody)}`;
            } catch (e) {
                const errorText = await response.text();
                errorMsg += `: ${errorText}`;
            }
            console.error(`${operation} ${resourceName} failed:`, errorMsg);
            if (status === 401 || status === 403) throw new Error('Unauthorized');
            throw new Error(errorMsg);
        }
        const contentType = response.headers.get("content-type");
        if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
            return response.status < 300;
        }
        return await response.json();
    };

    return {
        async fetchAll() {
            try {
                const token = await getAccessToken();
                console.log(`Fetching all ${resourceName}...`);
                const response = await fetch(baseUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await handleResponse(response, 'fetch');
                console.log(`Fetched ${resourceName}:`, Array.isArray(data) ? data.length : 'item');
                return data;
            } catch (error) {
                console.error(`API Error (Fetch ${resourceName}):`, error.message);
                if (error.message !== 'Login required') {
                    showFlashMessage(`Error loading ${resourceName}. ${error.message}`, 'alert-triangle');
                }
                throw error;
            }
        },
        async create(data) {
            try {
                const token = await getAccessToken();
                console.log(`Creating ${resourceName}... Data:`, data);
                const response = await fetch(baseUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await handleResponse(response, 'create');
                console.log(`Created ${resourceName}:`, result);
                return result;
            } catch (error) {
                console.error(`API Error (Create ${resourceName}):`, error.message);
                showFlashMessage(`Error creating ${resourceName}. ${error.message}`, 'alert-triangle');
                throw error;
            }
        },
        async update(id, data) {
            if (!id || id === 'temp-mood') {
                console.warn(`Update ${resourceName} skipped: Invalid ID "${id}"`);
                return null;
            }
            try {
                const token = await getAccessToken();
                console.log(`Updating ${resourceName} ID: ${id}... Data:`, data);
                const response = await fetch(`${baseUrl}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const result = await handleResponse(response, 'update');
                console.log(`Updated ${resourceName}:`, result);
                return result;
            } catch (error) {
                console.error(`API Error (Update ${resourceName}):`, error.message);
                showFlashMessage(`Error updating ${resourceName}. ${error.message}`, 'alert-triangle');
                throw error;
            }
        },
        async delete(id) {
            if (!id || id === 'temp-mood') {
                console.warn(`Delete ${resourceName} skipped: Invalid ID "${id}"`);
                return false;
            }
            try {
                const token = await getAccessToken();
                console.log(`Deleting ${resourceName} ID: ${id}...`);
                const response = await fetch(`${baseUrl}/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const success = await handleResponse(response, 'delete');
                console.log(`Deleted ${resourceName} ID: ${id}. Success: ${success}`);
                return success;
            } catch (error) {
                console.error(`API Error (Delete ${resourceName}):`, error.message);
                showFlashMessage(`Error deleting ${resourceName}. ${error.message}`, 'alert-triangle');
                throw error;
            }
        }
    };
}

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
            // Full handleResponse logic
            const handleResponse = async (response, operation) => {
                if (!response.ok) {
                    const status = response.status;
                    let errorMsg = `HTTP error ${status} during ${operation} dashboard`;
                    try {
                        const errorBody = await response.json();
                        errorMsg += `: ${errorBody.message || JSON.stringify(errorBody)}`;
                    } catch (e) {
                        const errorText = await response.text();
                        errorMsg += `: ${errorText}`;
                    }
                    console.error(`${operation} dashboard failed:`, errorMsg);
                    if (status === 401 || status === 403) throw new Error('Unauthorized');
                    throw new Error(errorMsg);
                }
                const contentType = response.headers.get("content-type");
                if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
                    return response.status < 300;
                }
                return await response.json();
            };
            const data = await handleResponse(response, 'fetch dashboard');
            console.log("Successfully fetched dashboard data.");
            return data;
        } catch (error) {
            console.error('API Error (Fetch Dashboard Data):', error.message);
            if (error.message !== 'Login required') {
                showFlashMessage(`Error loading dashboard data. ${error.message}`, 'alert-triangle');
            }
            throw error;
        }
    }
};


// ===============================================
// GLOBAL DATA SYNC & UTILITY FUNCTIONS
// ===============================================

/**
 * Fetches all data and populates global state. Runs after auth confirmed.
 */
async function syncApplicationState() {
    if (!auth0 || !(await auth0.isAuthenticated())) {
        console.warn("syncApplicationState skipped: User not authenticated.");
        return;
    }
    console.log("Starting application state sync...");
    showFlashMessage('Syncing data...', 'rotate-cw');

    try {
        const data = await dashboardApiService.fetchAllData();
        taskState = (data.tasks || []).map(t => ({ ...t, id: t._id }));
        billState = (data.bills || []).map(b => ({ ...b, id: b._id }));
        assetState = (data.assets || []).map(a => ({ ...a, id: a._id }));
        fitnessHistory = (data.fitnessLogs || []).map(f => ({ ...f, id: f._id }));
        moodHistory = (data.moodLogs || []).map(m => ({ ...m, id: m._id }));

        // Add client-side mood placeholder if needed
        const latestMood = moodHistory.length > 0 ? moodHistory[0] : null;
        if (!latestMood || latestMood.date !== TODAY_DATE) {
            const placeholder = { _id: 'temp-mood', id: 'temp-mood', date: TODAY_DATE, mood: 2, note: 'Daily check-in pending.', stress: 45, isFinal: false };
            moodHistory.unshift(placeholder);
            console.log("Added temporary mood placeholder.");
        }
        console.log('✅ Application state synced.');
    } catch (error) {
        console.error('FATAL: Could not sync application state.', error.message);
    }
}

/**
 * Re-fetches and re-renders one part of the state.
 */
async function refreshState(stateName) {
    if (!auth0 || !(await auth0.isAuthenticated())) {
        console.warn(`Refresh ${stateName} skipped: User not authenticated.`);
        return;
    }
    console.log(`Refreshing state for: ${stateName}...`);
    showFlashMessage(`Refreshing ${stateName}...`, 'rotate-cw');

    try {
        let service, stateVar;
        switch (stateName) {
            case 'tasks': service = taskApiService; stateVar = 'taskState'; break;
            case 'bills': service = billApiService; stateVar = 'billState'; break;
            case 'assets': service = assetApiService; stateVar = 'assetState'; break;
            case 'fitness': service = fitnessApiService; stateVar = 'fitnessHistory'; break;
            case 'mood': service = moodApiService; stateVar = 'moodHistory'; break;
            default: throw new Error(`Invalid state name: ${stateName}`);
        }

        const data = await service.fetchAll();
        window[stateVar] = data.map(d => ({ ...d, id: d._id }));

        if (stateName === 'mood') {
            const latestMood = moodHistory.length > 0 ? moodHistory[0] : null;
            if (!latestMood || latestMood.date !== TODAY_DATE) {
                const placeholder = { _id: 'temp-mood', id: 'temp-mood', date: TODAY_DATE, mood: 2, note: 'Daily check-in pending.', stress: 45, isFinal: false };
                moodHistory.unshift(placeholder);
                console.log("Re-added mood placeholder after refresh.");
            }
        }

        // Trigger UI Re-render based on current page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (stateName === 'tasks' && currentPage === 'tasks.html' && typeof renderTaskList === 'function') renderTaskList();
        if (stateName === 'bills' && currentPage === 'finance.html' && typeof renderBills === 'function') renderBills();
        if (stateName === 'assets' && currentPage === 'vault.html' && typeof renderAssets === 'function') renderAssets();
        if (stateName === 'fitness' && currentPage === 'fitness.html' && typeof renderFitnessPage === 'function') renderFitnessPage();
        if (stateName === 'mood' && currentPage === 'mood.html' && typeof renderMoodPage === 'function') renderMoodPage();

        if (document.getElementById('dashboard-grid') && typeof renderDashboardMetrics === 'function') {
            console.log(`Refreshing dashboard metrics after ${stateName} update.`);
            renderDashboardMetrics();
        }

        console.log(`✅ Refreshed state for: ${stateName}`);

    } catch (error) {
        console.error(`Error refreshing ${stateName} state:`, error.message);
    }
}

/**
 * Shows a custom flash notification.
 */
function showFlashMessage(message, iconName = 'check-circle') {
    const container = document.getElementById('flash-message-container');
    if (!container) return;

    const flash = document.createElement('div');
    flash.className = 'flash-message';
    flash.innerHTML = `<i data-feather="${iconName}"></i> <span>${message}</span>`;
    container.appendChild(flash);
    try { feather.replace(); } catch (e) { }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (container.contains(flash)) {
            container.removeChild(flash);
        }
    }, 5000);
}


// --- Date & Automation Helpers ---
function calculateDueDays(dueDateString) {
    if (!dueDateString) return 999; // Treat missing dates as far in the future
    try {
        // Ensure consistent parsing by assuming UTC date part
        const today = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');
        const due = new Date(dueDateString + 'T00:00:00Z');

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (e) {
        console.error("Error calculating due days for:", dueDateString, e);
        return 999; // Return a safe default on error
    }
}

function calculateNextDueDate(currentDueDate, frequency) {
    if (frequency === 'one-time') return null; // One-time bills don't recur

    try {
        const date = new Date(currentDueDate + 'T00:00:00Z'); // Parse as UTC date part

        if (frequency === 'monthly') {
            date.setUTCMonth(date.getUTCMonth() + 1);
        } else if (frequency === 'quarterly') {
            date.setUTCMonth(date.getUTCMonth() + 3);
        } else if (frequency === 'annually') {
            date.setUTCFullYear(date.getUTCFullYear() + 1);
        }

        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error calculating next due date:", currentDueDate, frequency, e);
        return currentDueDate; // Return original on error to prevent data loss
    }
}


// --- Notification Panel & Sleep Check (Mocks/Placeholders) ---
function toggleNotificationPanel() {
    const panel = document.getElementById('global-notification-panel');
    if (!panel) return;

    // Find the bell icon itself to position the panel
    const bellIcon = document.querySelector('.global-controls .control-icon-wrapper');
    if (bellIcon) {
        const rect = bellIcon.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 12}px`; // 12px below the bell
        panel.style.right = `${window.innerWidth - rect.right - 10}px`; // Align right edge
    }

    IS_NOTIFICATION_PANEL_OPEN = !IS_NOTIFICATION_PANEL_OPEN;
    panel.style.display = IS_NOTIFICATION_PANEL_OPEN ? 'flex' : 'none';

    if (IS_NOTIFICATION_PANEL_OPEN) {
        renderNotificationPanel(panel); // Render content when opening
    }
}

function renderNotificationPanel(panel) {
    if (!panel) return;

    // This data would eventually come from a 'notifications' state
    const notifications = [
        { id: 1, type: 'critical', text: 'Bill "Netflix" is overdue!' },
        { id: 2, type: 'low', text: 'Task "Buy groceries" due today.' },
        { id: 3, type: 'low', text: '5,000 steps reached!' },
    ];

    panel.innerHTML = '<h4>Notifications</h4>'; // Clear/add title

    if (notifications.length === 0) {
        panel.innerHTML += '<div class="notification-item-empty">No new notifications.</div>';
        return;
    }

    notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `notification-item ${n.type}`;
        item.innerHTML = `
            <i data-feather="${n.type === 'critical' ? 'alert-triangle' : 'info'}"></i>
            <p>${n.text}</p>
        `;
        panel.appendChild(item);
    });
    try { feather.replace(); } catch (e) { }
}
function startSleepNotificationCheck() { console.log("Start Sleep Check (Mock)"); /* ... (implementation needed) ... */ }

// Function used by Vault page to add tasks
async function addNewTaskFromVault(text, duration) {
    showFlashMessage(`Adding task: "${text}" (${duration} min)...`, 'loader');
    try {
        const newTaskData = {
            text: text.trim(),
            priority: 'medium', // Default priority from Vault
            date: getTodayDateString(),
            type: 'task' // Explicitly set type
        };
        await taskApiService.create(newTaskData);
        showFlashMessage(`Task added to schedule!`, 'check-square');
        await refreshState('tasks'); // Refresh tasks state globally
    } catch (error) {
        console.error("Failed to add task from Vault:", error);
        // Flash message shown by API service on error
    }
}

/**
 * Starts a countdown timer on a remedy button.
 */
function startTimer(button, durationMinutes, initialText) {
    if (activeTimer) return alert("Timer already running!");

    let totalSeconds = durationMinutes * 60;
    button.disabled = true;

    activeTimer = setInterval(() => {
        totalSeconds--;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        button.textContent = `Active: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (totalSeconds <= 0) {
            // Pass 'originalText' so markRemedyComplete knows what was completed
            markRemedyComplete(button, originalText, 'timer');
        }
    }, 1000);
}

/**
 * Marks a remedy as complete and logs the activity.
 */
async function markRemedyComplete(button, originalText, type) {
    if (activeTimer && type === 'timer') {
        clearInterval(activeTimer);
        activeTimer = null;
    }

    button.textContent = 'Completed';
    button.disabled = true;
    button.closest('.suggestion-item')?.classList.add('completed');

    let logType, logValue, logUnit, successMsg, remedyText;

    // Get the text from the <p> tag, not the button
    remedyText = button.closest('.suggestion-item')?.querySelector('p')?.textContent || '';

    if (type === 'timer') {
        // This was the meditation timer
        logType = 'workout'; // Log meditation as a 'workout'
        logValue = parseInt(remedyText.match(/\d+/)[0] || 5); // Get duration from text like "Meditate 5 mins."
        logUnit = 'min';
        successMsg = 'Meditation logged!';
    } else {
        // This was a 'log' type (break or read)
        logValue = 15; // Default 15 min
        logUnit = 'min';

        if (remedyText.toLowerCase().includes('break')) {
            logType = 'workout'; // Log as 'workout'
            successMsg = 'Break logged!';
        } else if (remedyText.toLowerCase().includes('read')) {
            logType = 'workout'; // Log as 'workout'
            successMsg = 'Reading logged!';
        }
    }

    // Use the existing fitness logger
    if (logType) {
        // We log 'break' and 'reading' as generic workouts
        await logFitnessEntry(logType, logValue, logUnit);
        showFlashMessage(successMsg, 'check-circle');

        // Refresh mood and fitness to show new data
        await refreshState('mood');
        await refreshState('fitness');
    }
}


// ===============================================
// DASHBOARD CORE LOGIC
// ===============================================
let renderDashboardMetrics = () => { console.warn("renderDashboardMetrics called before assignment."); }; // Placeholder
let updateLifeScore = () => { console.warn("updateLifeScore called before assignment."); }; // Placeholder

function initializeDashboardPage() {
    console.log("Initializing Dashboard Page...");
    const lifeScoreElement = document.getElementById('life-score-number');
    let lifeScoreChartInstance = null; // Store chart instance

    // --- Local helper to update score with animation ---
    updateLifeScore = (points) => {
        if (!lifeScoreElement) return;
        let currentScore = parseInt(lifeScoreElement.textContent) || 0;
        currentScore = Math.max(0, Math.min(100, currentScore + points));
        lifeScoreElement.textContent = currentScore;
        lifeScoreElement.classList.add('pop');
        setTimeout(() => lifeScoreElement.classList.remove('pop'), 300);
    }

    // --- Main Rendering Logic ---
    renderDashboardMetrics = () => {
        console.log("Rendering Dashboard Metrics...");
        // --- 1. CALCULATE METRICS ---
        // (Calculations remain largely the same, using global state arrays)
        const totalPendingTasks = taskState.filter(t => t.type === 'task' && !t.completed).length;
        const totalCompletedTasks = taskState.filter(t => t.type === 'task' && t.completed).length;
        const totalTasks = totalPendingTasks + totalCompletedTasks;
        const taskCompletionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 100;

        const scheduleItemsToday = taskState.filter(item => item.date === TODAY_DATE);

        const overdueBills = billState.filter(b => !b.paid && calculateDueDays(b.dueDate) < 0);
        const totalDueAmountThisWeek = billState.filter(b => !b.paid && calculateDueDays(b.dueDate) >= 0 && calculateDueDays(b.dueDate) <= 7)
            .reduce((sum, bill) => sum + bill.amount, 0);
        const completedBills = billState.filter(b => b.paid).length;
        const totalFinanceItems = billState.length;
        const financialHealth = totalFinanceItems > 0 ? Math.round((completedBills / totalFinanceItems) * 100) : 100;
        const activeSubscriptionTotal = billState.filter(b => b.frequency !== 'one-time' && !b.paid)
            .reduce((sum, bill) => sum + bill.amount, 0);

        const totalStepsToday = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'steps').reduce((sum, log) => sum + log.value, 0);
        const totalCaloriesOutToday = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'calories_out').reduce((sum, log) => sum + log.value, 0);
        const totalWaterIntake = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'water_intake').reduce((sum, log) => sum + log.value, 0);
        const sleepLog = fitnessHistory.filter(log => log.type === 'sleep').sort((a, b) => b.date.localeCompare(a.date))[0] || { value: 0 };
        const sleepLastNight = sleepLog.value;

        // Use moodHistory[0] as backend sorts descending, includes placeholder if needed
        const latestMoodEntry = moodHistory[0] || { mood: 2, stress: 45, note: 'No recent log.', isFinal: false };
        const moodLabel = Object.values(moodMap).find(m => m.value === latestMoodEntry.mood)?.label || 'Neutral';
        const stressIndex = latestMoodEntry.stress;
        const moodNote = latestMoodEntry.note || (latestMoodEntry.isFinal ? 'No note.' : 'Daily check-in pending.');

        const totalVaultLinks = assetState.length;
        const uniqueCategories = [...new Set(assetState.map(a => a.type))].length;

        const componentScores = {
            tasks: taskCompletionRate,
            finance: financialHealth,
            mood: Math.max(0, 100 - stressIndex),
            fitness: Math.min(100, Math.round((sleepLastNight / 8) * 50 + (totalStepsToday / 10000) * 50))
        };
        const digitalScore = Math.min(100, Math.round((totalVaultLinks / 10) * 50 + (uniqueCategories / 5) * 50)); // Simple vault score

        const lifeScoreWeights = { tasks: 0.25, finance: 0.20, fitness: 0.20, mood: 0.20, digital: 0.15 };
        let currentScore = 0;
        currentScore += componentScores.tasks * lifeScoreWeights.tasks;
        currentScore += componentScores.finance * lifeScoreWeights.finance;
        currentScore += componentScores.fitness * lifeScoreWeights.fitness;
        currentScore += componentScores.mood * lifeScoreWeights.mood;
        currentScore += digitalScore * lifeScoreWeights.digital;
        currentScore = Math.min(100, Math.max(0, Math.round(currentScore)));

        // --- 2. UPDATE UI ---
        // Life Score Card
        if (lifeScoreElement) lifeScoreElement.textContent = currentScore;
        if (document.getElementById('score-tasks')) document.getElementById('score-tasks').textContent = `Tasks (${Math.round(componentScores.tasks)}%)`;
        if (document.getElementById('score-finance')) document.getElementById('score-finance').textContent = `Financial Health (${Math.round(componentScores.finance)}%)`;
        if (document.getElementById('score-fitness')) document.getElementById('score-fitness').textContent = `Fitness (${Math.round(componentScores.fitness)}%)`;
        if (document.getElementById('score-mood')) document.getElementById('score-mood').textContent = `Mood/Stress (${Math.round(componentScores.mood)}%)`;
        if (document.getElementById('score-digital')) document.getElementById('score-digital').textContent = `Digital Org (${Math.round(digitalScore)}%)`; // Use calculated digital score

        // KPI Cards
        if (document.getElementById('kpi-mood-value')) document.getElementById('kpi-mood-value').textContent = moodLabel;
        if (document.getElementById('kpi-stress-index')) document.getElementById('kpi-stress-index').textContent = `Stress Index: ${stressIndex}%`;
        if (document.getElementById('kpi-mood-note')) document.getElementById('kpi-mood-note').textContent = moodNote;

        const stepsValueEl = document.getElementById('kpi-steps-value');
        if (stepsValueEl) {
            stepsValueEl.innerHTML = `<span class="kpi-steps-label">Steps: </span><span id="steps-number-val">${totalStepsToday.toLocaleString()}</span>`;
        }
        if (document.getElementById('kpi-calories-value-label')) document.getElementById('kpi-calories-value-label').textContent = `Calories Burned: ${totalCaloriesOutToday.toLocaleString()}`;
        if (document.getElementById('kpi-sleep-value-label')) document.getElementById('kpi-sleep-value-label').textContent = `Last Sleep: ${sleepLastNight > 0 ? sleepLastNight : '--'} hr`;
        if (document.getElementById('kpi-water-value-label')) document.getElementById('kpi-water-value-label').textContent = `Water Intake: ${totalWaterIntake.toLocaleString()} ml`;

        const financeValueEl = document.getElementById('kpi-finance-value');
        if (financeValueEl) financeValueEl.innerHTML = `₹${totalDueAmountThisWeek.toLocaleString()} <span class="kpi-label" id="finance-due-label">Due</span>`;
        if (document.getElementById('kpi-finance-health-percent')) document.getElementById('kpi-finance-health-percent').textContent = `Health: ${financialHealth}%`;
        if (document.getElementById('kpi-finance-subs-monthly')) document.getElementById('kpi-finance-subs-monthly').textContent = `Subscriptions: ₹${activeSubscriptionTotal.toLocaleString()} / mo`;

        if (document.getElementById('kpi-vault-links')) document.getElementById('kpi-vault-links').textContent = `${totalVaultLinks} Links`;
        if (document.getElementById('kpi-vault-categories')) document.getElementById('kpi-vault-categories').textContent = `${uniqueCategories} Categories`;

        // Radar Chart
        const radarCtx = document.getElementById('life-score-radar-chart')?.getContext('2d');
        if (radarCtx && typeof Chart !== 'undefined') {
            const chartData = {
                labels: ['Tasks', 'Financial', 'Fitness', 'Mood/Stress', 'Digital Org'],
                datasets: [{
                    label: 'Score',
                    data: [
                        componentScores.tasks, componentScores.finance,
                        componentScores.fitness, componentScores.mood, digitalScore
                    ],
                    backgroundColor: 'rgba(0, 199, 166, 0.4)',
                    borderColor: 'var(--c-primary)',
                    borderWidth: 1.5, pointRadius: 4, pointBackgroundColor: 'var(--c-primary)'
                }]
            };
            if (lifeScoreChartInstance) lifeScoreChartInstance.destroy();
            lifeScoreChartInstance = new Chart(radarCtx, {
                type: 'radar', data: chartData,
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { r: { suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 25 }, pointLabels: { padding: 15 } } },
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Today's Schedule List
        const scheduleList = document.getElementById('task-list-container');
        if (scheduleList) {
            scheduleItemsToday.sort((a, b) => (a.completed - b.completed) || (b.priority?.localeCompare(a.priority || 'low'))); // Sort by completion, then priority
            scheduleList.innerHTML = '';
            if (scheduleItemsToday.length === 0) {
                scheduleList.innerHTML = `<li class="task-item-empty">Nothing scheduled today.</li>`;
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

        // Actions for Today List
        const remedyList = document.getElementById('dashboard-actions-list');
        if (remedyList) {
            let actionItems = [];
            // Add critical actions (overdue bills, high stress, low sleep)
            overdueBills.forEach(bill => actionItems.push({ id: `remedy-bill-${bill.id}`, status: 'finance', icon: 'alert-triangle', text: `Overdue: ${bill.name}. Pay Now.`, buttonText: 'Pay', action: 'pay', dataId: bill.id, priorityScore: 10 }));
            if (stressIndex >= 70) actionItems.push({ id: 'remedy-high-stress', status: 'health', icon: 'zap', text: `High Stress (${stressIndex}%). Consider break/meditation.`, buttonText: 'Log Break', action: 'log-break', priorityScore: 9 });
            if (sleepLastNight < 6 && sleepLastNight > 0) actionItems.push({ id: 'remedy-low-sleep', status: 'health', icon: 'moon', text: `Low Sleep (${sleepLastNight}h). Plan for more tonight.`, buttonText: 'Acknowledge', action: 'ack-sleep', priorityScore: 8 });

            // Add pending tasks for today
            scheduleItemsToday.filter(t => t.type === 'task' && !t.completed).forEach(task => actionItems.push({ id: `task-action-${task.id}`, status: 'task', icon: 'check-square', text: `Task: ${task.text} (${task.priority}).`, buttonText: 'Complete', action: 'complete-task', dataId: task.id, priorityScore: task.priority === 'high' ? 7 : (task.priority === 'medium' ? 6 : 5) }));

            actionItems.sort((a, b) => b.priorityScore - a.priorityScore);

            remedyList.innerHTML = '';
            if (actionItems.length === 0) {
                remedyList.innerHTML = `<li class="remedy-item" data-status="info"><i data-feather="thumbs-up"></i><p>All clear! No critical actions or tasks for today.</p></li>`;
            } else {
                actionItems.forEach(item => {
                    const isCompleted = (item.action === 'pay' && billState.find(b => b.id === item.dataId)?.paid); // Check if bill is actually paid
                    const li = document.createElement('li');
                    li.className = `remedy-item ${isCompleted ? 'completed' : ''}`;
                    li.dataset.status = item.status;
                    li.dataset.actionType = item.action;
                    li.dataset.id = item.dataId;
                    li.innerHTML = `
                        <i data-feather="${item.icon}"></i>
                        <p>${item.text}</p>
                        <button class="remedy-button" data-action="${item.action}" data-id="${item.dataId}" ${isCompleted ? 'disabled' : ''}>
                            ${isCompleted ? 'Paid' : item.buttonText}
                        </button>
                    `;
                    remedyList.appendChild(li);
                });
            }
        }

        try { feather.replace(); } catch (e) { }
        console.log("Dashboard rendering complete.");
    }; // End of renderDashboardMetrics

    // --- Event Listeners ---
    function attachDashboardListeners() {
        console.log("Attaching dashboard listeners...");
        // Schedule Checkbox Listener (using event delegation)
        document.getElementById('task-list-container')?.addEventListener('change', async (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                const checkbox = e.target;
                const taskId = checkbox.dataset.taskId;
                const isChecked = checkbox.checked;
                const task = taskState.find(t => t.id === taskId);

                if (task) {
                    checkbox.disabled = true; // Prevent rapid clicking
                    try {
                        await taskApiService.update(taskId, { completed: isChecked });
                        showFlashMessage(`Task ${isChecked ? 'completed' : 'marked incomplete'}.`, 'check-circle');
                        await refreshState('tasks'); // Refresh and re-render
                    } catch (error) {
                        console.error("Failed to update task completion:", error);
                        checkbox.checked = !isChecked; // Revert checkbox on error
                    } finally {
                        checkbox.disabled = false;
                    }
                }
            }
        });

        // Remedy Button Listener (using event delegation)
        document.getElementById('dashboard-actions-list')?.addEventListener('click', async (e) => {
            const button = e.target.closest('.remedy-button');
            if (!button || button.disabled) return;

            const action = button.dataset.action;
            const itemId = button.dataset.id;
            const remedyItem = button.closest('.remedy-item');

            button.disabled = true; // Disable button immediately
            button.innerHTML = '<i data-feather="loader" class="spin"></i>'; // Show loading spinner
            try { feather.replace(); } catch (e) { }

            try {
                if (action === 'pay') {
                    const bill = billState.find(b => b.id === itemId);
                    if (bill) {
                        const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
                        const updateData = {
                            paid: bill.frequency === 'one-time' ? true : false,
                            dueDate: nextDueDate
                        };
                        await billApiService.update(itemId, updateData);
                        showFlashMessage(`${bill.name} marked paid.`, 'check-circle');
                        await refreshState('bills');
                    }
                } else if (action === 'log-break') {
                    // Placeholder: Log a 'break' fitness entry or similar
                    showFlashMessage('Break logged. Stress index updated.', 'coffee');
                    // Placeholder: Update mood state if needed
                    renderDashboardMetrics(); // Re-render immediately for visual feedback
                } else if (action === 'ack-sleep') {
                    showFlashMessage('Low sleep acknowledged.', 'moon');
                    remedyItem?.classList.add('completed'); // Visually mark as done
                    button.textContent = 'Acknowledged'; // Update button text
                    // No API call needed for simple acknowledgement
                } else if (action === 'complete-task') {
                    await taskApiService.update(itemId, { completed: true });
                    showFlashMessage('Task completed!', 'check-circle');
                    await refreshState('tasks');
                }
            } catch (error) {
                console.error(`Failed action '${action}' for item ${itemId}:`, error);
                // Re-enable button on error, restore text
                button.textContent = remedyItem.querySelector('p').textContent.includes('Pay') ? 'Pay' : (remedyItem.querySelector('p').textContent.includes('Break') ? 'Log Break' : 'Complete');
                button.disabled = false;
            } finally {
                // Ensure spinner stops even if refresh is slow or fails
                if (!remedyItem.classList.contains('completed')) {
                    // Restore button text if action didn't complete visually
                    button.textContent = remedyItem.querySelector('p').textContent.includes('Pay') ? 'Pay' : (remedyItem.querySelector('p').textContent.includes('Break') ? 'Log Break' : 'Complete');
                }
            }
        });
    } // End of attachDashboardListeners

    // --- Initial Setup ---
    renderDashboardMetrics(); // Initial render based on potentially empty state
    attachDashboardListeners(); // Attach listeners

    // If data is already loaded (e.g., navigating back), re-render immediately
    if (taskState.length > 0 || billState.length > 0) {
        console.log("Data already present, performing initial dashboard render.");
        renderDashboardMetrics();
    }
}


// ===============================================
// TASKS PAGE LOGIC
// ===============================================
let renderTaskList = () => { console.warn("renderTaskList called before assignment."); }; // Placeholder

function initializeTasksPageLogic() {
    console.log("Initializing Tasks Page Logic...");
    let activeTaskFilter = 'date'; // Default filter
    let taskToDeleteId = null; // For delete confirmation

    const mainTaskList = document.getElementById('main-task-list');
    const taskFilterBar = document.getElementById('task-filter-bar');
    const addModal = document.getElementById('add-task-modal');
    const editModal = document.getElementById('edit-task-modal');
    const deleteConfirmModal = document.getElementById('delete-task-confirm-modal');

    // --- Core Render Function ---
    renderTaskList = () => {
        if (!mainTaskList) return;
        console.log("Rendering task list with filter:", activeTaskFilter);

        let displayTasks = taskState.filter(task => {
            if (task.type && task.type !== 'task') return false; // Exclude non-tasks
            if (activeTaskFilter === 'completed') return task.completed;
            if (activeTaskFilter === 'pending') return !task.completed; // Add a 'pending' filter if needed
            return true; // 'date' or 'priority' shows all tasks initially
        });

        // Sorting
        displayTasks.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            const priorityA = priorityOrder[a.priority] || 0;
            const priorityB = priorityOrder[b.priority] || 0;

            if (activeTaskFilter !== 'completed' && a.completed !== b.completed) {
                return a.completed ? 1 : -1; // Incomplete tasks first
            }
            if (activeTaskFilter === 'priority') {
                return priorityB - priorityA; // Highest priority first
            }
            // Default sort: Date ascending, then priority descending
            const dateA = a.date ? new Date(a.date).getTime() : Infinity;
            const dateB = b.date ? new Date(b.date).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;
            return priorityB - priorityA;
        });

        mainTaskList.innerHTML = '';
        if (displayTasks.length === 0) {
            mainTaskList.innerHTML = `<li class="task-item-empty">No tasks found matching filter '${activeTaskFilter}'.</li>`;
        } else {
            displayTasks.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;
                let formattedDate = task.date ? new Date(task.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';

                li.innerHTML = `
                    <input type="checkbox" id="task-${task.id}" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <label for="task-${task.id}">${task.text}</label>
                    <span class="task-date">${formattedDate}</span>
                    <span class="task-tag ${task.priority}">${task.priority}</span>
                    <div class="task-actions">
                        <button class="edit-task-button" data-id="${task.id}" title="Edit Task"><i data-feather="edit-2" style="width: 14px;"></i></button>
                        <button class="delete-task-button" data-id="${task.id}" title="Delete Task"><i data-feather="trash-2" style="width: 14px;"></i></button>
                    </div>
                 `;
                mainTaskList.appendChild(li);
            });
        }
        try { feather.replace(); } catch (e) { }
        console.log("Task list rendering complete.");

        // Re-attach listeners after rendering
        attachTaskListeners();

        // Refresh calendar if it exists
        if (window.calendar) {
            console.log("Refetching calendar events after task list render.");
            window.calendar.refetchEvents();
        }
    }; // End of renderTaskList

    // --- Task Action Handlers (using API) ---
    async function toggleTaskCompleted(taskId, isChecked) {
        const task = taskState.find(t => t.id === taskId);
        if (!task) return;

        showFlashMessage('Updating task...', 'loader');
        try {
            await taskApiService.update(taskId, { completed: isChecked });
            showFlashMessage(`Task ${isChecked ? 'completed' : 'marked incomplete'}.`, 'check-circle');
            await refreshState('tasks'); // Refresh data and re-render
        } catch (error) {
            console.error("Failed to toggle task completion:", error);
            // Revert UI change on error? (Handled by refreshState)
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
        }
    }

    // --- Modal Logic ---
    const setupModal = (modalElement, openTriggers, closeTriggers, resetFn) => {
        const show = () => {
            if (resetFn) resetFn();
            modalElement.style.display = 'flex';
        };
        const hide = () => {
            modalElement.style.display = 'none';
        };
        openTriggers.forEach(selector => document.querySelector(selector)?.addEventListener('click', show));
        closeTriggers.forEach(selector => document.querySelector(selector)?.addEventListener('click', hide));
        modalElement?.addEventListener('click', (e) => { if (e.target === modalElement) hide(); });
        return { show, hide };
    };

    // Add Task Modal
    const addModalControls = setupModal(addModal, ['#add-task-button-main'], ['#modal-cancel-button'], () => {
        document.getElementById('task-text-input').value = '';
        document.getElementById('task-priority-select').value = 'medium';
        document.getElementById('task-date-input').value = getTodayDateString();
    });
    document.getElementById('modal-add-button')?.addEventListener('click', async () => {
        const text = document.getElementById('task-text-input').value.trim();
        if (!text) return alert('Task description cannot be empty.');
        const newTask = {
            text: text,
            priority: document.getElementById('task-priority-select').value,
            date: document.getElementById('task-date-input').value || getTodayDateString(),
            type: 'task' // Ensure type is set
        };
        addModalControls.hide();
        showFlashMessage('Adding task...', 'loader');
        try {
            await taskApiService.create(newTask);
            showFlashMessage('Task added successfully!', 'plus-circle');
            await refreshState('tasks');
        } catch (error) { console.error("Failed to add task:", error); }
    });

    // Edit Task Modal
    const editModalControls = setupModal(editModal, [], ['#edit-modal-cancel-button']);
    const openEditModal = (taskId) => {
        const task = taskState.find(t => t.id === taskId);
        if (!task) return;
        document.getElementById('edit-task-id-input').value = task.id;
        document.getElementById('edit-task-text-input').value = task.text;
        document.getElementById('edit-task-priority-select').value = task.priority;
        document.getElementById('edit-task-date-input').value = task.date;
        document.getElementById('edit-modal-title').textContent = `Edit: ${task.text}`;
        editModalControls.show();
    };
    document.getElementById('edit-modal-save-button')?.addEventListener('click', async () => {
        const id = document.getElementById('edit-task-id-input').value;
        const updatedTask = {
            text: document.getElementById('edit-task-text-input').value.trim(),
            priority: document.getElementById('edit-task-priority-select').value,
            date: document.getElementById('edit-task-date-input').value
        };
        if (!updatedTask.text) return alert('Task description cannot be empty.');

        editModalControls.hide();
        showFlashMessage('Saving changes...', 'loader');
        try {
            await taskApiService.update(id, updatedTask);
            showFlashMessage('Task updated successfully!', 'save');
            await refreshState('tasks');
        } catch (error) { console.error("Failed to update task:", error); }
    });
    document.getElementById('edit-modal-delete-button')?.addEventListener('click', () => {
        const taskId = document.getElementById('edit-task-id-input').value;
        const task = taskState.find(t => t.id === taskId);
        if (task) {
            editModalControls.hide();
            showDeleteConfirmModal(task.id, task.text);
        }
    });

    // Delete Confirmation Modal
    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-task-cancel-button']);
    const showDeleteConfirmModal = (id, name) => {
        taskToDeleteId = id;
        document.getElementById('delete-task-confirm-message').textContent = `Delete task: "${name}"?`;
        deleteModalControls.show();
    };
    document.getElementById('delete-task-confirm-button')?.addEventListener('click', async () => {
        if (taskToDeleteId) {
            deleteModalControls.hide();
            await deleteTask(taskToDeleteId); // Call API delete function
            taskToDeleteId = null;
        }
    });

    // --- Event Listeners ---
    function attachTaskListeners() {
        console.log("Attaching task list listeners...");
        mainTaskList?.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                toggleTaskCompleted(e.target.dataset.taskId, e.target.checked);
            }
        });
        mainTaskList?.addEventListener('click', (e) => {
            const editButton = e.target.closest('.edit-task-button');
            const deleteButton = e.target.closest('.delete-task-button');
            if (editButton) openEditModal(editButton.dataset.id);
            if (deleteButton) {
                const task = taskState.find(t => t.id === deleteButton.dataset.id);
                if (task) showDeleteConfirmModal(task.id, task.text);
            }
        });
    }

    taskFilterBar?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-item')) {
            taskFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            activeTaskFilter = e.target.dataset.filter;
            renderTaskList();
        }
    });

    // --- Calendar Initialization (Adapted for Auth0) ---
    const calendarOverlay = document.getElementById('auth-signin-overlay');
    const calendarSignInButton = document.getElementById('auth-open-signin');

    function tryInitializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (calendarEl && typeof FullCalendar !== 'undefined' && !window.calendar) {
            console.log("Initializing FullCalendar...");
            window.calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
                events: function (fetchInfo, successCallback, failureCallback) {
                    const events = taskState
                        .filter(t => t.date) // Only include items with dates
                        .map(task => ({
                            id: task.id,
                            title: task.text,
                            start: task.date, // Assumes YYYY-MM-DD
                            allDay: true, // Treat all as all-day events for simplicity
                            classNames: [task.type || 'task', task.priority || 'medium'], // Use type and priority for styling
                            // Add more properties if needed (e.g., color based on priority)
                            // color: task.priority === 'high' ? 'red' : (task.priority === 'medium' ? 'orange' : 'grey')
                        }));
                    console.log(`Providing ${events.length} events to FullCalendar.`);
                    successCallback(events);
                },
                // Add eventClick or dateClick handlers if needed
                // eventClick: function(info) { openEditModal(info.event.id); },
                // dateClick: function(info) { /* Open add modal pre-filled? */ }
            });
            try {
                window.calendar.render();
                console.log("FullCalendar rendered.");
            } catch (renderErr) { console.error("Error rendering FullCalendar:", renderErr); }
        } else if (window.calendar) {
            console.log("FullCalendar already initialized. Refetching events.");
            window.calendar.refetchEvents();
        } else { console.warn("Calendar element or FullCalendar library not found."); }
    }

    async function checkCalendarAccess() {
        console.log("Checking calendar access...");
        if (!auth0) { console.warn("Auth0 client not ready for calendar check."); if (calendarOverlay) calendarOverlay.style.display = 'flex'; return; }
        const isAuthenticated = await auth0.isAuthenticated();
        if (isAuthenticated) {
            if (calendarOverlay) calendarOverlay.style.display = 'none';
            tryInitializeCalendar();
        } else {
            if (calendarOverlay) calendarOverlay.style.display = 'flex';
            if (window.calendar) { window.calendar.destroy(); window.calendar = null; }
            const calendarEl = document.getElementById('calendar');
            if (calendarEl) calendarEl.innerHTML = ''; // Clear content if not authenticated
        }
        try { feather.replace(); } catch (e) { }
    }

    calendarSignInButton?.addEventListener('click', async () => {
        if (auth0) await auth0.loginWithRedirect({ authorizationParams: { redirect_uri: window.location.href } });
    });

    // --- Initial Render & Setup ---
    renderTaskList(); // Render initial list based on global state
    checkCalendarAccess(); // Check auth state for calendar visibility
}


// ===============================================
// FINANCE PAGE LOGIC
// ===============================================
let renderBills = () => { console.warn("renderBills called before assignment."); }; // Placeholder

function initializeFinancePage() {
    console.log("Initializing Finance Page Logic...");
    let activeBillFilter = 'upcoming'; // Default filter
    let showAllBills = false; // For toggling view
    const MAX_BILLS_TO_SHOW = 3; // Limit initial view
    let billToDeleteId = null; // For delete confirmation

    const mainBillList = document.getElementById('main-bill-list');
    const billFilterBar = document.getElementById('bill-filter-bar');
    const showMoreButton = document.getElementById('show-more-bills-button');
    const addBillModal = document.getElementById('add-bill-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');

    // --- Core Render Function ---
    renderBills = () => {
        if (!mainBillList) return;
        console.log("Rendering bills with filter:", activeBillFilter);

        // Calculate due days and overdue status dynamically
        billState.forEach(bill => {
            if (!bill.paid && bill.dueDate) {
                bill.dueDays = calculateDueDays(bill.dueDate);
                bill.overdue = bill.dueDays < 0;
            } else {
                bill.dueDays = bill.paid ? Infinity : 999; // Treat paid/no date as non-urgent
                bill.overdue = false;
            }
        });

        // --- Filtering ---
        let filteredBills = billState.filter(bill => {
            if (activeBillFilter === 'subscriptions') return bill.frequency !== 'one-time';
            if (activeBillFilter === 'paid') return bill.paid;
            if (activeBillFilter === 'upcoming') return !bill.paid; // Includes overdue in 'upcoming' context
            return true; // 'all'
        });

        // --- Sorting ---
        filteredBills.sort((a, b) => {
            if (a.paid !== b.paid) return a.paid ? 1 : -1; // Unpaid first
            if (a.overdue !== b.overdue) return b.overdue ? 1 : -1; // Overdue most urgent
            return a.dueDays - b.dueDays; // Closest due date first
        });

        // --- KPI Calculation ---
        const totalDueThisWeek = billState.filter(b => !b.paid && b.dueDays >= 0 && b.dueDays <= 7).reduce((sum, b) => sum + b.amount, 0);
        const activeSubscriptionTotal = billState.filter(b => b.frequency !== 'one-time' && !b.paid).reduce((sum, b) => sum + b.amount, 0);
        const financialHealth = billState.length > 0 ? Math.round(billState.filter(b => b.paid).length / billState.length * 100) : 100;
        if (document.getElementById('kpi-due')) document.getElementById('kpi-due').textContent = `₹${totalDueThisWeek.toLocaleString('en-IN')}`;
        if (document.getElementById('kpi-subs')) document.getElementById('kpi-subs').textContent = `₹${activeSubscriptionTotal.toLocaleString('en-IN')} / mo`;
        if (document.getElementById('kpi-health')) document.getElementById('kpi-health').textContent = `${financialHealth}%`;

        // --- Show More/Less Logic ---
        let billsToDisplay = filteredBills;
        const hiddenCount = filteredBills.length > MAX_BILLS_TO_SHOW && activeBillFilter === 'upcoming' && !showAllBills
            ? filteredBills.length - MAX_BILLS_TO_SHOW : 0;
        if (hiddenCount > 0) billsToDisplay = filteredBills.slice(0, MAX_BILLS_TO_SHOW);

        if (showMoreButton) {
            if (activeBillFilter === 'upcoming' && filteredBills.length > MAX_BILLS_TO_SHOW) {
                showMoreButton.style.display = 'flex';
                showMoreButton.querySelector('#show-more-text').textContent = showAllBills ? 'Show Less' : `Show All Bills (${hiddenCount} more)`;
                showMoreButton.querySelector('i').setAttribute('data-feather', showAllBills ? 'chevron-up' : 'chevron-down');
            } else {
                showMoreButton.style.display = 'none';
            }
        }

        // --- Rendering List ---
        mainBillList.innerHTML = '';
        if (billsToDisplay.length === 0) {
            mainBillList.innerHTML = `<li class="placeholder-text">No bills found for filter '${activeBillFilter}'.</li>`;
        } else {
            billsToDisplay.forEach(bill => {
                const li = document.createElement('li');
                let urgencyClass = bill.paid ? 'completed' : (bill.overdue ? 'overdue' : (bill.dueDays <= 3 ? 'urgent' : ''));
                let dueDateText = bill.paid ? 'Paid' : (bill.overdue ? `Overdue by ${Math.abs(bill.dueDays)}d` : (bill.dueDays === 0 ? 'Due Today' : `Due in ${bill.dueDays}d`));
                const isPayable = !bill.paid && (bill.overdue || bill.dueDays <= 3); // Payable if overdue or due within 3 days

                li.className = `bill-item ${urgencyClass}`;
                li.dataset.id = bill.id;
                li.dataset.link = bill.paymentLink || '#';

                li.innerHTML = `
                    <i data-feather="${bill.icon || 'credit-card'}" class="icon"></i>
                    <div class="details">
                        <p>${bill.name}</p>
                        <span class="due-date">${dueDateText} (${new Date(bill.dueDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })})</span>
                    </div>
                    <span class="bill-amount">₹${bill.amount.toLocaleString('en-IN')}</span>
                    <div class="bill-actions">
                        <button class="edit-button" data-id="${bill.id}" title="Edit Bill"><i data-feather="edit-2"></i></button>
                        <button class="pay-button" data-action="${bill.paid ? 'paid' : 'pay'}" ${bill.paid || !isPayable ? 'disabled' : ''}>
                            ${bill.paid ? 'Paid' : (isPayable ? 'Pay Now' : 'Locked')}
                        </button>
                    </div>
                 `;
                mainBillList.appendChild(li);
            });
        }
        try { feather.replace(); } catch (e) { }
        console.log("Bill list rendering complete.");

        attachBillListeners(); // Re-attach listeners after render
    }; // End of renderBills

    // --- Bill Action Handlers (using API) ---
    async function markBillAsPaid(billId) {
        const bill = billState.find(b => b.id === billId);
        if (!bill || bill.paid) return;

        showFlashMessage('Processing payment...', 'loader');
        try {
            const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
            // If one-time, mark paid. If recurring, mark unpaid and set next date.
            const updateData = {
                paid: bill.frequency === 'one-time',
                dueDate: nextDueDate || bill.dueDate // Keep old date if one-time/error
            };
            await billApiService.update(billId, updateData);
            showFlashMessage(`${bill.name} marked paid.`, 'check-circle');
            await refreshState('bills');
        } catch (error) { console.error("Failed to mark bill paid:", error); }
    }

    async function deleteBill(billId) {
        showFlashMessage('Deleting bill...', 'loader');
        try {
            await billApiService.delete(billId);
            showFlashMessage('Bill deleted.', 'trash-2');
            await refreshState('bills');
        } catch (error) { console.error("Failed to delete bill:", error); }
    }

    // --- Modal Logic ---
    const setupModal = (modalElement, openTriggers, closeTriggers, resetFn) => { /* ... same as in tasks logic ... */ }; // Reuse setupModal

    const addModalControls = setupModal(addBillModal, ['#add-bill-button'], ['#bill-modal-cancel-button'], () => {
        document.getElementById('bill-modal-title').textContent = 'Add New Bill';
        document.getElementById('bill-modal-action-button').textContent = 'Add Bill';
        document.getElementById('bill-modal-action-button').dataset.mode = 'add';
        document.getElementById('bill-modal-delete-button').style.display = 'none';
        document.getElementById('bill-id-input').value = '';
        document.getElementById('bill-name-input').value = '';
        document.getElementById('bill-amount-input').value = '';
        document.getElementById('bill-due-date-input').value = getTodayDateString();
        document.getElementById('bill-frequency-select').value = 'monthly';
        document.getElementById('bill-link-input').value = '';
    });
    const openEditBillModal = (billId) => {
        const bill = billState.find(b => b.id === billId);
        if (!bill) return;
        document.getElementById('bill-modal-title').textContent = `Edit: ${bill.name}`;
        document.getElementById('bill-modal-action-button').textContent = 'Save Changes';
        document.getElementById('bill-modal-action-button').dataset.mode = 'edit';
        document.getElementById('bill-modal-delete-button').style.display = 'block';
        document.getElementById('bill-id-input').value = bill.id;
        document.getElementById('bill-name-input').value = bill.name;
        document.getElementById('bill-amount-input').value = bill.amount;
        document.getElementById('bill-due-date-input').value = bill.dueDate;
        document.getElementById('bill-frequency-select').value = bill.frequency;
        document.getElementById('bill-link-input').value = bill.paymentLink || '';
        addModalControls.show(); // Reuses the same modal
    };
    document.getElementById('bill-modal-action-button')?.addEventListener('click', async () => {
        const mode = document.getElementById('bill-modal-action-button').dataset.mode;
        const billData = {
            id: document.getElementById('bill-id-input').value,
            name: document.getElementById('bill-name-input').value.trim(),
            amount: parseFloat(document.getElementById('bill-amount-input').value),
            dueDate: document.getElementById('bill-due-date-input').value,
            frequency: document.getElementById('bill-frequency-select').value,
            paymentLink: document.getElementById('bill-link-input').value.trim() || undefined,
            // You might infer category/icon here based on name, or add fields to the modal
            // icon: 'credit-card', category: 'General'
        };
        if (!billData.name || isNaN(billData.amount) || !billData.dueDate) return alert('Name, Amount, and Due Date are required.');

        addModalControls.hide();
        showFlashMessage(mode === 'add' ? 'Adding bill...' : 'Saving changes...', 'loader');
        try {
            if (mode === 'add') await billApiService.create(billData);
            else await billApiService.update(billData.id, billData);
            showFlashMessage(mode === 'add' ? 'Bill added!' : 'Bill updated!', 'check-circle');
            await refreshState('bills');
        } catch (error) { console.error(`Failed to ${mode} bill:`, error); }
    });
    document.getElementById('bill-modal-delete-button')?.addEventListener('click', () => {
        const billId = document.getElementById('bill-id-input').value;
        const bill = billState.find(b => b.id === billId);
        if (bill) {
            addModalControls.hide();
            showDeleteConfirmModal(bill.id, bill.name);
        }
    });

    // Delete Confirmation Modal
    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-cancel-button']);
    const showDeleteConfirmModal = (id, name) => {
        billToDeleteId = id;
        document.getElementById('delete-confirm-message').textContent = `Delete bill: "${name}"?`;
        deleteModalControls.show();
    };
    document.getElementById('delete-confirm-button')?.addEventListener('click', async () => {
        if (billToDeleteId) {
            deleteModalControls.hide();
            await deleteBill(billToDeleteId);
            billToDeleteId = null;
        }
    });

    // --- Event Listeners ---
    function attachBillListeners() {
        console.log("Attaching bill list listeners...");
        mainBillList?.addEventListener('click', (e) => {
            const editButton = e.target.closest('.edit-button');
            const payButton = e.target.closest('.pay-button');
            const billItem = e.target.closest('.bill-item');
            if (editButton) openEditBillModal(editButton.dataset.id);
            if (payButton && !payButton.disabled) {
                const link = billItem?.dataset.link;
                if (link && link !== '#') window.open(link, '_blank');
                markBillAsPaid(billItem?.dataset.id);
            }
        });
    }

    billFilterBar?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-item')) {
            billFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            activeBillFilter = e.target.dataset.filter;
            showAllBills = false; // Reset view on filter change
            renderBills();
        }
    });
    showMoreButton?.addEventListener('click', () => {
        showAllBills = !showAllBills;
        renderBills();
    });

    // --- Initial Render ---
    renderBills(); // Render based on global state
}


// ===============================================
// FITNESS PAGE LOGIC
// ===============================================
let renderFitnessPage = () => { console.warn("renderFitnessPage called before assignment."); }; // Placeholder

function initializeFitnessPage() {
    console.log("Initializing Fitness Page Logic...");
    let selectedWaterVolume = 0; // Local state for water modal

    // --- Core Render Function ---
    renderFitnessPage = () => {
        console.log("Rendering fitness page...");
        // Calculate KPIs from fitnessHistory (same logic as dashboard)
        const totalStepsToday = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'steps').reduce((sum, log) => sum + log.value, 0);
        const totalCaloriesOutToday = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'calories_out').reduce((sum, log) => sum + log.value, 0);
        const workoutsThisWeek = fitnessHistory.filter(log => log.type === 'workout' && new Date(log.date) >= new Date(new Date().setDate(new Date().getDate() - 7))).length;
        const totalWaterIntake = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'water_intake').reduce((sum, log) => sum + log.value, 0);
        const sleepLog = fitnessHistory.filter(log => log.type === 'sleep').sort((a, b) => b.date.localeCompare(a.date))[0] || { value: 0 };
        const sleepLastNight = sleepLog.value;

        // Update KPIs
        if (document.getElementById('kpi-steps')) document.getElementById('kpi-steps').textContent = totalStepsToday.toLocaleString();
        if (document.getElementById('kpi-calories-out')) document.getElementById('kpi-calories-out').textContent = totalCaloriesOutToday.toLocaleString();
        if (document.getElementById('kpi-workouts')) document.getElementById('kpi-workouts').textContent = workoutsThisWeek;
        if (document.getElementById('kpi-water')) document.getElementById('kpi-water').textContent = `${totalWaterIntake.toLocaleString()} ml`;
        if (document.getElementById('kpi-sleep')) document.getElementById('kpi-sleep').textContent = `${sleepLastNight} hr`;

        // Render Suggestions (Marking completed ones)
        document.querySelectorAll('#health-suggestion-list .suggestion-item').forEach(item => {
            item.classList.toggle('completed', completedSuggestions.includes(item.dataset.suggestionId));
        });

        // Render Daily Log History
        const logList = document.getElementById('daily-log-list');
        const logEmpty = document.getElementById('log-history-empty');
        if (logList && logEmpty) {
            const todayLogs = fitnessHistory.filter(log => log.date === TODAY_DATE).sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));
            logList.innerHTML = '';
            if (todayLogs.length === 0) {
                logList.style.display = 'none'; logEmpty.style.display = 'block';
            } else {
                logList.style.display = 'block'; logEmpty.style.display = 'none';
                todayLogs.forEach(log => {
                    const li = document.createElement('li');
                    li.className = 'log-item';
                    let typeText = log.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    let valueUnit = log.unit === 'calories_out' ? 'kcal' : (log.unit === 'water_intake' ? 'ml' : log.unit);
                    li.innerHTML = `
                        <span class="time">${log.time || '--:--'}</span>
                        <span>${typeText}</span>
                        <span class="value">${log.value.toLocaleString()} ${valueUnit}</span>
                    `;
                    logList.appendChild(li);
                });
            }
        }
        try { feather.replace(); } catch (e) { }
        console.log("Fitness page rendering complete.");

        attachFitnessListeners(); // Re-attach listeners
    }; // End of renderFitnessPage

    // --- Action Handlers (using API) ---
    async function logFitnessEntry(type, value, unit) {
        const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const newLog = {
            date: TODAY_DATE,
            time: nowTime,
            type: type,
            value: value,
            unit: unit
        };
        showFlashMessage(`Logging ${value} ${unit}...`, 'loader');
        try {
            await fitnessApiService.create(newLog);
            showFlashMessage('Activity logged successfully!', 'check-circle');
            await refreshState('fitness');
        } catch (error) { console.error("Failed to log fitness entry:", error); }
    }

    // --- Modal Logic ---
    const setupModal = (modalElement, openTriggers, closeTriggers, resetFn) => { /* ... same as before ... */ };

    // Activity Modal
    const activityModal = document.getElementById('log-activity-modal');
    const activityModalControls = setupModal(activityModal, ['#add-manual-entry-button'], ['#activity-modal-cancel-button'], () => {
        document.getElementById('activity-type-select').value = 'steps';
        updateActivityUnit(); // Reset units and placeholder
        document.getElementById('activity-value-input').value = '';
    });
    const updateActivityUnit = () => { /* ... same implementation as before ... */ };
    document.getElementById('activity-type-select')?.addEventListener('change', updateActivityUnit);
    document.getElementById('activity-modal-log-button')?.addEventListener('click', () => {
        const type = document.getElementById('activity-type-select').value;
        const value = parseFloat(document.getElementById('activity-value-input').value);
        let unit = type; // Default unit matches type
        if (type === 'workout') unit = 'min';
        else if (type === 'sleep') unit = 'hours';
        else if (type === 'calories_out') unit = 'kcal';
        else if (type === 'water_intake') unit = 'ml'; // Add water intake unit

        if (isNaN(value) || value <= 0) return alert('Please enter a valid positive value.');

        activityModalControls.hide();
        logFitnessEntry(type, value, unit);
    });

    // Water Modal
    const waterModal = document.getElementById('log-water-modal');
    const waterModalControls = setupModal(waterModal, ['#log-water-button'], ['#water-modal-cancel-button'], () => {
        selectedWaterVolume = 0;
        document.getElementById('water-custom-input').value = '';
        document.getElementById('water-modal-log-button').disabled = true;
        document.querySelectorAll('#water-quick-select .water-option').forEach(btn => btn.classList.remove('active-select'));
    });
    document.getElementById('water-quick-select')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.water-option');
        if (btn) {
            document.querySelectorAll('#water-quick-select .water-option').forEach(b => b.classList.remove('active-select'));
            btn.classList.add('active-select');
            selectedWaterVolume = parseInt(btn.dataset.volume);
            document.getElementById('water-custom-input').value = '';
            document.getElementById('water-modal-log-button').disabled = false;
        }
    });
    document.getElementById('water-custom-input')?.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        const logButton = document.getElementById('water-modal-log-button');
        if (!isNaN(volume) && volume > 0) {
            selectedWaterVolume = volume;
            logButton.disabled = false;
            document.querySelectorAll('#water-quick-select .water-option').forEach(btn => btn.classList.remove('active-select'));
        } else {
            selectedWaterVolume = 0;
            // Disable button only if no quick select is active either
            if (!document.querySelector('#water-quick-select .water-option.active-select')) {
                logButton.disabled = true;
            }
        }
    });
    document.getElementById('water-modal-log-button')?.addEventListener('click', () => {
        if (selectedWaterVolume > 0) {
            waterModalControls.hide();
            logFitnessEntry('water_intake', selectedWaterVolume, 'ml');
        }
    });

    // --- Event Listeners ---
    function attachFitnessListeners() {
        console.log("Attaching fitness listeners...");
        // Suggestion List Clicks (mark as complete locally)
        document.querySelectorAll('#health-suggestion-list .suggestion-item').forEach(item => {
            // Use cloneNode/replaceWith to ensure listeners are fresh
            const newItem = item.cloneNode(true);
            item.replaceWith(newItem);
            newItem.addEventListener('click', () => {
                const id = newItem.dataset.suggestionId;
                if (!completedSuggestions.includes(id)) {
                    completedSuggestions.push(id);
                    showFlashMessage('Suggestion marked complete!', 'check');
                    renderFitnessPage(); // Re-render to show visual change
                }
            });
        });

        // Log History Toggle
        const viewLogToggle = document.querySelector('.view-log-toggle');
        if (viewLogToggle && !viewLogToggle.dataset.listenerAttached) { // Prevent duplicate listeners
            viewLogToggle.addEventListener('click', (e) => {
                const list = document.getElementById('daily-log-list');
                const action = e.currentTarget.dataset.action;
                if (action === 'hide') {
                    list.style.maxHeight = '0'; list.style.opacity = '0'; list.style.marginTop = '0';
                    e.currentTarget.dataset.action = 'show';
                    e.currentTarget.innerHTML = '<i data-feather="chevron-down"></i> Show Log';
                } else {
                    list.style.maxHeight = '250px'; list.style.opacity = '1'; list.style.marginTop = '12px';
                    e.currentTarget.dataset.action = 'hide';
                    e.currentTarget.innerHTML = '<i data-feather="chevron-up"></i> Hide Log';
                }
                try { feather.replace(); } catch (e) { }
            });
            viewLogToggle.dataset.listenerAttached = 'true';
        }
    }

    // --- Initial Render ---
    renderFitnessPage();
}


// ===============================================
// MOOD PAGE LOGIC
// ===============================================
let renderMoodPage = () => { console.warn("renderMoodPage called before assignment."); }; // Placeholder

function initializeMoodPage() {
    console.log("Initializing Mood Page Logic...");
    let activeTimer = null; // Holds interval ID for meditation timer

    // --- Core Render Function ---
    renderMoodPage = () => {
        console.log("Rendering mood page...");
        // Get latest mood entry (includes placeholder if needed)
        const latestEntry = moodHistory[0] || { mood: 2, stress: 45, isFinal: false };
        let stressScore = latestEntry.stress;
        let stressLevel = stressScore > 75 ? 'High' : (stressScore > 40 ? 'Moderate' : 'Low');
        let color = stressScore > 75 ? 'var(--c-accent-red)' : (stressScore > 40 ? 'var(--c-accent-yellow)' : 'var(--c-primary)');

        // Update KPIs
        if (document.getElementById('stress-index-value')) {
            document.getElementById('stress-index-value').textContent = `${stressScore}%`;
            document.getElementById('stress-index-value').style.color = color;
        }
        if (document.getElementById('stress-index-label')) document.getElementById('stress-index-label').textContent = stressLevel;

        // Update "Add Mood Entry" button state based on whether today's final log exists
        const hasLoggedTodayFinal = moodHistory.some(e => e.date === TODAY_DATE && e.isFinal);
        const addMoodButton = document.getElementById('add-mood-entry-button');
        if (addMoodButton) {
            addMoodButton.disabled = hasLoggedTodayFinal;
            addMoodButton.textContent = hasLoggedTodayFinal ? 'Logged for Today' : 'Add Mood Entry';
            addMoodButton.style.opacity = hasLoggedTodayFinal ? 0.6 : 1;
        }

        // Render Remedies (Attach listeners separately)
        // ... (No complex rendering needed for remedies, just attach listeners) ...

        try { feather.replace(); } catch (e) { }
        console.log("Mood page rendering complete.");
    }; // End of renderMoodPage

    // --- Action Handlers (using API) ---
    async function logMoodEntry(moodValue, note) {
        let currentStress = (moodHistory[0] || { stress: 45 }).stress;
        // Simple stress adjustment based on mood
        let newStress = moodValue < 2 ? Math.min(95, currentStress + 10) : Math.max(10, currentStress - 5);

        const newEntry = {
            date: TODAY_DATE,
            mood: moodValue,
            note: note,
            stress: newStress,
            isFinal: true // Mark as the final log for the day
        };

        showFlashMessage('Logging mood...', 'loader');
        try {
            // Use POST which handles upsert logic on the backend
            await moodApiService.create(newEntry);
            showFlashMessage('Mood logged successfully!', 'check-circle');
            await refreshState('mood');
        } catch (error) { console.error("Failed to log mood:", error); }
    }

    // --- Modal Logic ---
    const setupModal = (modalElement, openTriggers, closeTriggers, resetFn) => { /* ... same as before ... */ };
    const moodModal = document.getElementById('add-mood-modal');
    const moodModalControls = setupModal(moodModal, ['#add-mood-entry-button'], ['#mood-modal-cancel-button'], () => {
        document.getElementById('current-mood-value').value = 'neutral';
        document.getElementById('selected-mood-label').textContent = 'Neutral';
        document.getElementById('selected-mood-label').style.color = moodMap['neutral'].color;
        document.getElementById('mood-notes-input').value = '';
        document.querySelectorAll('#mood-selector span').forEach(s => {
            s.style.opacity = s.dataset.mood === 'neutral' ? '1' : '0.5';
            s.style.transform = s.dataset.mood === 'neutral' ? 'scale(1.2)' : 'scale(1)';
        });
    });

    document.getElementById('mood-selector')?.addEventListener('click', (e) => {
        const span = e.target.closest('span[data-mood]');
        if (span) {
            const moodKey = span.dataset.mood;
            const moodData = moodMap[moodKey];
            document.getElementById('current-mood-value').value = moodKey;
            document.getElementById('selected-mood-label').textContent = moodData.label;
            document.getElementById('selected-mood-label').style.color = moodData.color;
            document.querySelectorAll('#mood-selector span').forEach(s => {
                s.style.opacity = s === span ? '1' : '0.5';
                s.style.transform = s === span ? 'scale(1.2)' : 'scale(1)';
            });
        }
    });
    document.getElementById('mood-modal-add-button')?.addEventListener('click', () => {
        const moodKey = document.getElementById('current-mood-value').value;
        const note = document.getElementById('mood-notes-input').value.trim();
        const moodValue = moodMap[moodKey]?.value;
        if (moodValue === undefined) return;

        moodModalControls.hide();
        logMoodEntry(moodValue, note);
    });

    // --- Timer Logic for Remedies ---
    function startTimer(button, durationMinutes, initialText) { /* ... same as source script ... */ }
    function markRemedyComplete(button, originalText, type) { /* ... same as source script, maybe adapt stress reduction logic if needed ... */ }

    // --- Event Listeners ---
    function attachMoodListeners() {
        console.log("Attaching mood listeners...");
        document.querySelectorAll('#remedy-list .remedy-button').forEach(button => {
            // Use cloneNode/replaceWith to ensure listeners are fresh
            const newButton = button.cloneNode(true);
            button.replaceWith(newButton);
            const remedyItem = newButton.closest('.suggestion-item');
            if (remedyItem.classList.contains('completed')) return; // Skip completed items

            newButton.addEventListener('click', (e) => {
                // (This replaces lines 1547-1562 in script.js)

                const remedyType = remedyItem.dataset.remedy;
                const originalText = newButton.textContent;
                let duration = 0;

                if (remedyType === 'meditate') {
                    // Extract duration from the <p> tag's text, e.g., "Meditate 5 mins."
                    const remedyText = remedyItem.querySelector('p')?.textContent || '';
                    duration = parseInt(remedyText.match(/\d+/)[0] || 5);
                }

                if (duration > 0) {
                    // This is a timed event (meditation)
                    startTimer(newButton, duration, originalText);
                } else {
                    // This is an instant log event (break, read)
                    markRemedyComplete(newButton, originalText, 'log');
                }
            });
        });
    }

    // --- Initial Render & Setup ---
    renderMoodPage();
    attachMoodListeners();
}


// ===============================================
// VAULT PAGE LOGIC
// ===============================================
let renderAssets = () => { console.warn("renderAssets called before assignment."); }; // Placeholder

function initializeVaultPage() {
    console.log("Initializing Vault Page Logic...");
    let activeFilter = 'All';
    let searchQuery = '';
    let assetToDeleteId = null;
    let currentModalAsset = null; // For task scheduler

    const mainVaultGrid = document.getElementById('main-vault-grid');
    const assetFilterBar = document.getElementById('asset-filter-bar');
    const assetSearchInput = document.getElementById('asset-search-input');
    const assetModal = document.getElementById('asset-modal');
    const deleteConfirmModal = document.getElementById('delete-asset-confirm-modal');
    const taskSchedulerModal = document.getElementById('task-scheduler-modal');

    // --- Core Render Function ---
    renderAssets = () => {
        if (!mainVaultGrid) return;
        console.log(`Rendering assets. Filter: ${activeFilter}, Search: "${searchQuery}"`);

        let filteredAssets = assetState.filter(asset => {
            const matchesFilter = activeFilter === 'All' || asset.type === activeFilter;
            const matchesSearch = !searchQuery ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.url.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        });

        mainVaultGrid.innerHTML = ''; // Clear grid
        if (filteredAssets.length === 0) {
            mainVaultGrid.innerHTML = `<div id="vault-empty-message" style="text-align: center; color: var(--c-text-muted); padding: 20px; grid-column: 1 / -1;">No links found matching criteria.</div>`;
        } else {
            filteredAssets.forEach(asset => {
                const item = document.createElement('div');
                item.className = 'vault-item';
                item.dataset.id = asset.id;
                item.dataset.url = asset.url;
                // Add class if it can trigger task scheduler
                if (asset.type === 'Dev' || asset.type === 'Video' || asset.type === 'Creative') item.classList.add('action-task');

                item.innerHTML = `
                    <div class="context-menu">
                        <button class="edit-asset-button" data-id="${asset.id}" title="Edit"><i data-feather="edit-2" style="width: 16px;"></i></button>
                        <button class="delete-asset-button" data-id="${asset.id}" title="Delete"><i data-feather="x" style="width: 16px;"></i></button>
                    </div>
                    <i data-feather="${asset.icon || 'link'}"></i>
                    <p>${asset.name}</p>
                    <span>${asset.type}</span>
                 `;
                mainVaultGrid.appendChild(item);
            });
        }
        // Add the "Add New" tile dynamically
        const addTile = document.createElement('div');
        addTile.className = 'vault-item add-new';
        addTile.id = 'add-new-vault-tile';
        addTile.innerHTML = `<i data-feather="plus-circle"></i><p>Add Link</p><span></span>`;
        mainVaultGrid.appendChild(addTile);

        try { feather.replace(); } catch (e) { }
        console.log("Assets rendering complete.");
        attachAssetListeners(); // Re-attach listeners
    }; // End of renderAssets

    // --- Action Handlers (using API) ---
    async function deleteAsset(assetId) {
        showFlashMessage('Deleting link...', 'loader');
        try {
            await assetApiService.delete(assetId);
            showFlashMessage('Link deleted.', 'trash-2');
            await refreshState('assets');
        } catch (error) { console.error("Failed to delete asset:", error); }
    }

    // --- Modal Logic ---
    const setupModal = (modalElement, openTriggers, closeTriggers, resetFn) => { /* ... same as before ... */ };

    // Asset Add/Edit Modal
    const assetModalControls = setupModal(assetModal, ['#add-asset-button', '#add-new-vault-tile'], ['#asset-modal-cancel-button'], () => {
        document.getElementById('asset-modal-title').textContent = 'Add New Link';
        document.getElementById('asset-modal-action-button').textContent = 'Add Link';
        document.getElementById('asset-modal-action-button').dataset.mode = 'add';
        document.getElementById('asset-modal-delete-button').style.display = 'none';
        document.getElementById('asset-id-input').value = '';
        document.getElementById('asset-name-input').value = '';
        document.getElementById('asset-type-select').value = 'Social'; // Default
        document.getElementById('asset-icon-select').value = 'link'; // Default
        document.getElementById('asset-url-input').value = '';
    });
    const openEditAssetModal = (assetId) => {
        const asset = assetState.find(a => a.id === assetId);
        if (!asset) return;
        document.getElementById('asset-modal-title').textContent = `Edit: ${asset.name}`;
        document.getElementById('asset-modal-action-button').textContent = 'Save Changes';
        document.getElementById('asset-modal-action-button').dataset.mode = 'edit';
        document.getElementById('asset-modal-delete-button').style.display = 'block';
        document.getElementById('asset-id-input').value = asset.id;
        document.getElementById('asset-name-input').value = asset.name;
        document.getElementById('asset-type-select').value = asset.type;
        document.getElementById('asset-icon-select').value = asset.icon || 'link';
        document.getElementById('asset-url-input').value = asset.url;
        assetModalControls.show();
    };
    document.getElementById('asset-modal-action-button')?.addEventListener('click', async () => {
        const mode = document.getElementById('asset-modal-action-button').dataset.mode;
        const assetData = {
            id: document.getElementById('asset-id-input').value,
            name: document.getElementById('asset-name-input').value.trim(),
            type: document.getElementById('asset-type-select').value,
            icon: document.getElementById('asset-icon-select').value,
            url: document.getElementById('asset-url-input').value.trim()
        };
        if (!assetData.name || !assetData.url) return alert('Name and URL are required.');

        assetModalControls.hide();
        showFlashMessage(mode === 'add' ? 'Adding link...' : 'Saving changes...', 'loader');
        try {
            if (mode === 'add') await assetApiService.create(assetData);
            else await assetApiService.update(assetData.id, assetData);
            showFlashMessage(mode === 'add' ? 'Link added!' : 'Link updated!', 'check-circle');
            await refreshState('assets');
        } catch (error) { console.error(`Failed to ${mode} asset:`, error); }
    });
    document.getElementById('asset-modal-delete-button')?.addEventListener('click', () => {
        const assetId = document.getElementById('asset-id-input').value;
        const asset = assetState.find(a => a.id === assetId);
        if (asset) {
            assetModalControls.hide();
            showDeleteConfirmModal(asset.id, asset.name);
        }
    });

    // Delete Confirmation Modal
    const deleteModalControls = setupModal(deleteConfirmModal, [], ['#delete-asset-cancel-button']);
    const showDeleteConfirmModal = (id, name) => {
        assetToDeleteId = id;
        document.getElementById('delete-asset-confirm-message').textContent = `Delete link: "${name}"?`;
        deleteModalControls.show();
    };
    document.getElementById('delete-asset-confirm-button')?.addEventListener('click', async () => {
        if (assetToDeleteId) {
            deleteModalControls.hide();
            await deleteAsset(assetToDeleteId);
            assetToDeleteId = null;
        }
    });

    // Task Scheduler Modal
    const taskSchedulerControls = setupModal(taskSchedulerModal, [], ['#task-scheduler-cancel-button']);
    const openTaskSchedulerModal = () => {
        if (!currentModalAsset) return;
        document.getElementById('task-scheduler-title').textContent = `Schedule Focus: ${currentModalAsset.name}`;
        document.getElementById('task-scheduler-text-input').value = '';
        document.getElementById('task-scheduler-text-input').placeholder = currentModalAsset.type === 'Dev' ? 'e.g., Work on feature X' : 'e.g., Edit video project';
        document.getElementById('task-scheduler-duration-input').value = '60';
        taskSchedulerControls.show();
    };
    document.getElementById('task-scheduler-add-button')?.addEventListener('click', async () => {
        const taskText = document.getElementById('task-scheduler-text-input').value.trim();
        const duration = parseInt(document.getElementById('task-scheduler-duration-input').value);
        if (!taskText || isNaN(duration) || duration <= 0) return alert('Valid task description and duration needed.');

        taskSchedulerControls.hide();
        // Call the globally defined function to add task via API
        await addNewTaskFromVault(taskText, duration);
        // Optionally open the URL after adding task
        if (currentModalAsset?.url) window.open(currentModalAsset.url, '_blank');
        currentModalAsset = null;
    });

    // --- Event Listeners ---
    function attachAssetListeners() {
        console.log("Attaching asset listeners...");
        mainVaultGrid?.addEventListener('click', (e) => {
            const item = e.target.closest('.vault-item:not(.add-new)');
            const editButton = e.target.closest('.edit-asset-button');
            const deleteButton = e.target.closest('.delete-asset-button');
            const addTile = e.target.closest('.add-new');

            if (addTile) return assetModalControls.show(); // Handled by setupModal trigger
            if (editButton) return openEditAssetModal(editButton.dataset.id);
            if (deleteButton) {
                const asset = assetState.find(a => a.id === deleteButton.dataset.id);
                if (asset) return showDeleteConfirmModal(asset.id, asset.name);
            }
            // If clicked on item itself (not buttons)
            if (item) {
                const assetId = item.dataset.id;
                const asset = assetState.find(a => a.id === assetId);
                if (!asset) return;

                if (item.classList.contains('action-task')) {
                    currentModalAsset = asset;
                    openTaskSchedulerModal();
                } else {
                    if (asset.url) window.open(asset.url, '_blank');
                    showFlashMessage(`Launching ${asset.name}...`, 'link');
                }
            }
        });
    }

    assetFilterBar?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-item')) {
            assetFilterBar.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.dataset.filter;
            renderAssets();
        }
    });
    assetSearchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderAssets();
    });

    // --- Initial Render ---
    renderAssets();
}


// ===============================================
// INSIGHTS & SETTINGS PAGES
// ===============================================

function initializeInsightsPage() {
    console.log("Initializing Insights Page (Static Content)");
    // Currently no dynamic data or interaction needed based on provided HTML
    // Could potentially render charts or summaries based on global state here in the future
}

function initializeSettingsPage() {
    console.log("Initializing Settings Page...");

    // --- Logout Button ---
    const profileCard = document.querySelector('.settings-card'); // Find the first settings card
    if (profileCard) {
        let logoutButton = document.getElementById('logout-button');
        if (!logoutButton) {
            logoutButton = document.createElement('button');
            logoutButton.id = 'logout-button';
            logoutButton.className = 'modal-button delete'; // Style as danger/logout
            logoutButton.innerHTML = '<i data-feather="log-out"></i> Log Out';
            logoutButton.style.width = '100%';
            logoutButton.style.marginTop = '20px'; // Space from "Save" button
            profileCard.appendChild(logoutButton); // Append to the profile card
            try { feather.replace(); } catch (e) { }
        }
        logoutButton.removeEventListener('click', logout); // Prevent duplicates
        logoutButton.addEventListener('click', logout); // Attach logout function
    }

    // --- Populate Profile Info (Fetch from Auth0 user) ---
    const populateProfile = async () => {
        if (!auth0 || !(await auth0.isAuthenticated())) {
            console.warn("Settings: User not authenticated.");
            if (document.getElementById('profile-name-input')) document.getElementById('profile-name-input').value = 'Not logged in';
            if (document.getElementById('profile-email-input')) document.getElementById('profile-email-input').value = '';
            return;
        }
        console.log("Settings: Populating profile...");
        try {
            const user = await auth0.getUser();
            if (user) {
                if (document.getElementById('profile-name-input')) document.getElementById('profile-name-input').value = user.name || user.nickname || '';
                if (document.getElementById('profile-email-input')) {
                    document.getElementById('profile-email-input').value = user.email || '';
                    document.getElementById('profile-email-input').disabled = true; // Email managed by Auth0
                }
                // Update profile picture globally as well
                const profilePic = document.querySelector('.profile-pic');
                if (profilePic && user.picture) {
                    profilePic.src = user.picture;
                    // Add error handler
                    profilePic.onerror = () => generateInitials(user.name, profilePic);
                } else if (profilePic && user.name) {
                    generateInitials(user.name, profilePic);
                }
            }
        } catch (err) { console.error("Error fetching user profile:", err); }
    };
    populateProfile();

    // --- Mock Settings (Toggles, Data Management) ---
    document.getElementById('save-profile-button')?.addEventListener('click', (e) => {
        e.preventDefault(); showFlashMessage('Profile save simulated.', 'save');
    });
    // Add listeners for import/export/delete (mock logic)
    const deleteDataButton = document.getElementById('delete-data-button');
    const deleteDataConfirmModal = document.getElementById('delete-data-confirm-modal');
    if (deleteDataButton && deleteDataConfirmModal) {
        const deleteModalControls = setupModal(deleteDataConfirmModal, ['#delete-data-button'], ['#delete-data-cancel-button']);
        document.getElementById('delete-data-confirm-button')?.addEventListener('click', () => {
            showFlashMessage('Simulating data deletion...', 'trash-2');
            deleteModalControls.hide();
        });
    }
    // ... (Add mock import/export listeners if needed) ...

    console.log("Settings Page Initialized.");
}


// ===============================================
// 0. MAIN SCRIPT EXECUTION (ENTRY POINT)
// ===============================================
(async () => {
    console.log("DOM Loaded. Starting App Initialization...");

    // Ensure flash message container exists (safe to run on all pages)
    if (!document.getElementById('flash-message-container')) {
        const container = document.createElement('div');
        container.id = 'flash-message-container';
        Object.assign(container.style, { position: 'fixed', top: '90px', right: '40px', zIndex: '9999', display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' });
        document.body.appendChild(container);
    }

    // --- Phase 1: Auth Setup (Run on ALL pages) ---
    console.log("Phase 1: Initializing Auth...");
    await configureClient();
    if (!auth0) { console.error("STOPPING: Auth0 client failed."); return; }

    // --- Phase 2: Handle Callback (Run on ALL pages) ---
    // This is critical. The callback might be on index.html.
    console.log("Phase 2: Handling Auth Callback...");
    const callbackProcessed = await handleAuthCallback();

    // Check for a failed callback (which returns false)
    if (callbackProcessed === false && window.location.search.includes("code=")) {
        // This happens if handleRedirectCallback() fails (e.g., bad state)
        console.error("Callback handling failed. Halting.");
        // We show an error *on the page* instead of just halting.
        document.body.innerHTML = `<h1>Authentication Error</h1><p>Login callback failed. This can be due to an 'invalid state' error. Please try signing in again from the login page.</p><a href="/login.html">Go to Login</a>`;
        return;
    }

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // --- LOGIC FORK: Are we on the login page or a protected app page? ---
    if (currentPage === 'login.html') {

        // --- We are on the LOGIN PAGE ---
        console.log("Initializing Login Page logic...");
        initializeLoginPage(); // Run *only* the login page function
        try { feather.replace(); } catch (e) { } // Run icons for login page

    } else {

        // --- We are on a PROTECTED PAGE (e.g., index.html, tasks.html) ---

        // --- Phase 3: Auth Guard ---
        console.log("Phase 3: Checking Auth Requirement...");
        const isAuthenticated = await requireAuth();
        if (!isAuthenticated) {
            // requireAuth() handles the redirect, so we just halt.
            console.log("Auth redirect initiated. Halting script for this page load.");
            return;
        }

        // --- Phase 4: Core UI Setup ---
        console.log("Phase 4: Setting up Global UI...");
        // Nav Highlighting & Listeners
        document.querySelectorAll('.menu-item').forEach(item => {
            const page = item.dataset.page;
            item.classList.toggle('active', page === currentPage);
            item.addEventListener('click', (e) => {
                e.preventDefault();
                if (page && page !== currentPage) window.location.href = '/' + page;
            });
        });
        // Clock
        const timeElement = document.getElementById('current-time');
        const updateClock = () => { if (timeElement) timeElement.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
        updateClock();
        setInterval(updateClock, 30000); // Update every 30s
        // Profile Pic
        const profilePic = document.querySelector('.profile-pic');
        try {
            const user = await auth0.getUser();
            if (profilePic && user?.picture) {
                profilePic.src = user.picture;
                // Add an error handler in case the src link fails (like the 429 error)
                profilePic.onerror = () => generateInitials(user.name, profilePic);
            } else if (profilePic && user?.name) {
                // Fallback if they have no picture at all
                generateInitials(user.name, profilePic);
            }
        } catch (e) { console.warn("Couldn't fetch user for profile pic.", e); }
        console.log("Global UI setup complete.");

        // Notification Bell
        const bellIcon = document.querySelector('.global-controls .control-icon-wrapper');
        bellIcon?.addEventListener('click', toggleNotificationPanel);

        // --- Phase 5: Data Loading ---
        console.log("Phase 5: Loading App Data...");
        try {
            await syncApplicationState();
        } catch (error) { console.error('Error during initial data sync:', error.message); }

        // --- Phase 6: Page-Specific Init ---
        console.log("Phase 6: Initializing page logic for:", currentPage);
        try {
            switch (currentPage) {
                case 'index.html': initializeDashboardPage(); break;
                case 'tasks.html': initializeTasksPageLogic(); break;
                case 'finance.html': initializeFinancePage(); break;
                case 'fitness.html': initializeFitnessPage(); break;
                case 'mood.html': initializeMoodPage(); break;
                case 'vault.html': initializeVaultPage(); break;
                case 'insights.html': initializeInsightsPage(); break;
                case 'settings.html': initializeSettingsPage(); break;
                // 'login.html' is handled above
                default: console.warn("No init function for page:", currentPage);
            }
        } catch (pageInitError) {
            console.error(`Error initializing ${currentPage}:`, pageInitError);
            showFlashMessage(`Error setting up ${currentPage}.`, 'alert-triangle');
        }

        // --- Phase 7: Final Icon Render ---
        console.log("Phase 7: Rendering Feather Icons...");
        try { feather.replace(); } catch (e) { console.error("Feather replace failed:", e); }
    }

    console.log("✨ App Initialization Complete ✨");
})();