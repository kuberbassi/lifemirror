// ===============================================
// GLOBAL STATE & CORE HELPERS
// ===============================================

var calendar = null;
let sleepCheckInterval = null;
let IS_SMART_NOTIFICATIONS_MOCK = true;
let IS_NOTIFICATION_PANEL_OPEN = false;

// --- DATE HELPER (Used for initial state setup and calculations) ---
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
const TODAY_DATE = getTodayDateString(); // Dynamic date for today


// --- TASKS STATE (Global for all Task/Dashboard pages) ---
let taskState = [
    { id: 'task1', text: 'Finalize project report', priority: 'high', date: TODAY_DATE, completed: false, type: 'task' },
    { id: 'task2', text: 'Call with team', priority: 'medium', date: TODAY_DATE, completed: false, type: 'task' },
    { id: 'task3', text: 'Pay electricity bill', priority: 'high', date: '2025-10-28', completed: false, type: 'task' },
    { id: 'task4', text: 'Submit CSE Assignment', priority: 'medium', date: '2025-10-27', completed: false, type: 'task' },
    { id: 'task5', text: 'Practice guitar', priority: 'low', date: TODAY_DATE, completed: false, type: 'task' },
    { id: 'task6', text: 'Buy groceries', priority: 'low', date: '2025-10-30', completed: false, type: 'task' },
    // Mock Calendar Events
    { id: 'event1', text: 'Project Sync Meeting', priority: 'medium', date: '2025-10-27', completed: false, type: 'meeting' },
    { id: 'event2', text: 'Deep Work Slot', priority: 'high', date: '2025-10-29', completed: false, type: 'meeting' },
    { id: 'holiday1', text: 'Diwali (Holiday)', priority: 'low', date: '2025-10-24', completed: false, type: 'holiday' },
];

// --- FITNESS STATE (Global for all Fitness/Dashboard pages) ---
let fitnessHistory = [
    { id: 1, date: '2025-10-25', time: '23:00', type: 'sleep', value: 5.5, unit: 'hours' }, // LOW SLEEP for critical alert
    { id: 2, date: TODAY_DATE, time: '10:00', type: 'steps', value: 3500, unit: 'steps' },
    { id: 3, date: TODAY_DATE, time: '14:00', type: 'steps', value: 500, unit: 'steps' },
    { id: 4, date: TODAY_DATE, time: '12:00', type: 'calories_out', value: 300, unit: 'kcal' },
    { id: 5, date: TODAY_DATE, time: '17:00', type: 'workout', value: 60, unit: 'min' }
];
let completedSuggestions = [];

// --- MOOD STATE (Global for all Mood/Dashboard pages) ---
let moodHistory = [
    { date: '2025-10-23', mood: 3, note: 'Had a productive morning.', stress: 30, isFinal: true },
    { date: '2025-10-24', mood: 2, note: 'Normal work day.', stress: 45, isFinal: true },
    { date: '2025-10-25', mood: 1, note: 'Stressed about project deadline.', stress: 70, isFinal: true }, // HIGH STRESS for critical alert
    { date: TODAY_DATE, mood: 2, note: 'Daily check-in placeholder.', stress: 45, isFinal: false },
];
const moodMap = {
    'awful': { label: 'Awful', value: 0, color: 'var(--c-accent-red)' },
    'sad': { label: 'Sad', value: 1, color: 'var(--c-accent-yellow)' },
    'neutral': { label: 'Neutral', value: 2, color: 'var(--c-accent-yellow)' },
    'happy': { label: 'Happy', value: 3, color: 'var(--c-primary)' },
    'great': { label: 'Great', value: 4, color: 'var(--c-primary)' }
};

// --- FINANCE STATE (Global for all Finance/Dashboard pages) ---
let billState = [
    { id: 'bill1', name: 'Netflix Subscription', category: 'Streaming Service', amount: 500, dueDate: '2025-12-27', frequency: 'monthly', icon: 'tv', paid: false, overdue: false, paymentLink: 'https://netflix.com' },
    { id: 'bill2', name: 'Electricity Bill', category: 'Utilities', amount: 2000, dueDate: '2025-10-23', frequency: 'monthly', icon: 'home', paid: false, overdue: true, paymentLink: 'https://paytm.com/electricity' }, // OVERDUE for critical alert
    { id: 'bill3', name: 'Mobile Phone Plan', category: 'Telecommunication', amount: 1000, dueDate: '2025-11-20', frequency: 'monthly', icon: 'smartphone', paid: false, overdue: false, paymentLink: 'https://jio.com' },
    { id: 'bill4', name: 'Gym Membership', category: 'Health & Wellness', amount: 1200, dueDate: '2025-10-23', frequency: 'annually', icon: 'heart', paid: true, overdue: false, paymentLink: 'https://gymwebsite.com' },
];
let IS_GOOGLE_SIGNED_IN = false;
let IS_CLERK_SIGNED_IN = false; // NEW GLOBAL STATE

const MOCK_CLERK_USER = {
    firstName: "Kuber",
    lastName: "Bassi",
    email: "kuber.bassi@clerk-mock.dev",
    profilePicUrl: "https://i.pravatar.cc/40?u=kuber"
};

// --- GENERAL HELPER FUNCTIONS ---
function updateUserProfileUI() {
    const profilePic = document.querySelector('.profile-pic');
    const profileNameInput = document.getElementById('profile-name-input');
    const profileEmailInput = document.getElementById('profile-email-input');

    if (profilePic) {
        profilePic.src = MOCK_CLERK_USER.profilePicUrl;
        profilePic.alt = `Profile: ${MOCK_CLERK_USER.firstName}`;
    }

    // Only update settings page if elements exist
    if (profileNameInput) {
        profileNameInput.value = `${MOCK_CLERK_USER.firstName} ${MOCK_CLERK_USER.lastName}`;
    }
    if (profileEmailInput) {
        profileEmailInput.value = MOCK_CLERK_USER.email;
    }
}

// Helper to calculate days difference (for finance)
function calculateDueDays(dueDateString) {
    if (!dueDateString) return 999;
    const today = new Date(getTodayDateString());
    const due = new Date(dueDateString + 'T00:00:00');

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

// Helper to calculate the next recurring date (Automation Core)
function calculateNextDueDate(currentDueDate, frequency) {
    if (frequency === 'one-time') return null;

    const date = new Date(currentDueDate + 'T00:00:00');

    if (frequency === 'monthly') {
        date.setMonth(date.getMonth() + 1);
    } else if (frequency === 'quarterly') {
        date.setMonth(date.getMonth() + 3);
    } else if (frequency === 'annually') {
        date.setFullYear(date.getFullYear() + 1);
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Mock helper to expose calculateNextDueDate to other functions (not strictly necessary but maintains pattern)
function getBillAutomationHelpers() {
    return {
        calculateNextDueDate: calculateNextDueDate
    };
}

/**
 * Shows a custom flash notification in the app.
 */
function showFlashMessage(message, iconName = 'check-circle') {
    const container = document.getElementById('flash-message-container');
    if (!container) return;

    const flash = document.createElement('div');
    flash.className = 'flash-message';
    flash.innerHTML = `<i data-feather="${iconName}"></i> <span>${message}</span>`;
    container.appendChild(flash);
    feather.replace();

    setTimeout(() => {
        if (container.contains(flash)) {
            container.removeChild(flash);
        }
    }, 5000);
}

// Notification Panel Logic (CRITICAL: Needs to be able to access global mockNotifications)
function toggleNotificationPanel() {
    const panel = document.getElementById('global-notification-panel');
    if (!panel) return;

    const bellIcon = document.querySelector('.control-icon-wrapper i[data-feather="bell"]');
    const bellWrapper = bellIcon ? bellIcon.closest('.control-icon-wrapper') : null;

    const isCurrentlyOpen = panel.classList.contains('active');
    IS_NOTIFICATION_PANEL_OPEN = !isCurrentlyOpen;

    if (IS_NOTIFICATION_PANEL_OPEN) {
        renderNotificationPanel(panel);
        panel.classList.add('active');
        if (bellWrapper) {
            bellWrapper.classList.add('active-notification');
        }
    } else {
        panel.classList.remove('active');
        if (bellWrapper) {
            bellWrapper.classList.remove('active-notification');
        }
    }
}

function renderNotificationPanel(panel) {
    // Re-calculate mockNotifications based on latest state before rendering
    const overdueBill = billState.find(b => b.overdue && !b.paid)?.name || 'Netflix Bill';
    const highStress = moodHistory.length > 0 && moodHistory[moodHistory.length - 1].stress >= 70;
    const lowSleep = fitnessHistory.find(log => log.type === 'sleep' && log.value < 6);

    const activeNotifications = [
        { id: 1, type: 'critical', message: `Overdue: ${overdueBill}. Pay Now!`, link: 'finance.html', icon: 'alert-triangle', active: !!billState.find(b => b.overdue && !b.paid) },
        { id: 2, type: 'critical', message: `High Stress Index (${moodHistory[moodHistory.length - 1].stress}%). Log a break.`, link: 'mood.html', icon: 'zap', active: highStress },
        { id: 3, type: 'low', message: 'Project Report due tomorrow.', link: 'tasks.html', icon: 'check-square', active: true },
        { id: 4, type: 'low', message: `Low Sleep detected (${lowSleep?.value || 5.5}h).`, link: 'fitness.html', icon: 'moon', active: !!lowSleep },
    ].filter(n => n.active);


    const notificationsToDisplay = IS_SMART_NOTIFICATIONS_MOCK
        ? activeNotifications.filter(n => n.type === 'critical')
        : activeNotifications;

    let content = '<h4>Notifications</h4>';

    if (notificationsToDisplay.length === 0) {
        content += `<div class="notification-item-empty">You're all caught up!</div>`;
    } else {
        notificationsToDisplay.forEach(n => {
            content += `
                <div class="notification-item ${n.type}" data-link="${n.link}">
                    <i data-feather="${n.icon}"></i>
                    <p>${n.message}</p>
                </div>
            `;
        });
    }

    panel.innerHTML = content;
    feather.replace();

    panel.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const link = item.dataset.link;
            if (link) {
                window.location.href = link;
            }
        });
    });
}

/**
 * Mocks the addition of a task to the global state (used by Vault page)
 */
function addNewTaskFromVault(text, duration) {
    if (typeof showFlashMessage === 'function') {
        showFlashMessage(`Task: "${text}" added to your schedule for ${duration} min!`, 'check-square');
    }
    const newTask = {
        id: 'task' + (taskState.length + 1 + Math.random()),
        text: text.trim(),
        priority: 'medium', // Default priority from Vault
        date: getTodayDateString(),
        completed: false,
        type: 'task'
    };
    taskState.push(newTask);
    if (document.getElementById('dashboard-grid')) {
        renderDashboardMetrics();
    }
}


function startSleepNotificationCheck(fitnessHistory) {
    if (sleepCheckInterval) {
        clearInterval(sleepCheckInterval);
    }

    const MORNING_START_HOUR = 6;
    const MORNING_END_HOUR = 10;
    const CHECK_INTERVAL_MS = 3600000;

    function checkSleepLog() {
        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour >= MORNING_START_HOUR && currentHour < MORNING_END_HOUR) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayDate = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

            const hasLoggedSleep = fitnessHistory.some(log => log.date === yesterdayDate && log.type === 'sleep');

            if (!hasLoggedSleep) {
                showFlashMessage("⏰ It's morning! Did you log your sleep for last night?", 'moon');
            }
        } else if (currentHour >= MORNING_END_HOUR) {
            clearInterval(sleepCheckInterval);
            sleepCheckInterval = null;
        }
    }

    checkSleepLog();
    sleepCheckInterval = setInterval(checkSleepLog, CHECK_INTERVAL_MS);
}


// ===============================================
// DASHBOARD CORE LOGIC
// ===============================================

/**
 * Runs the dynamic calculations and updates the Dashboard UI.
 * This is the central source of truth for the dashboard page.
 */
function renderDashboardMetrics() {

    // --- 1. CALCULATE METRICS FROM GLOBAL STATE ---

    const TODAY_DATE = getTodayDateString();

    // A. Tasks/Schedule Metrics
    let totalPendingTasks = taskState.filter(t => t.type === 'task' && !t.completed).length;
    let totalCompletedTasks = taskState.filter(t => t.type === 'task' && t.completed).length;
    const totalTasks = totalPendingTasks + totalCompletedTasks;
    const taskCompletionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 100;
    let scheduleItemsToday = taskState.filter(item => item.date === TODAY_DATE);

    // B. Finance Metrics
    const EARLY_PAYMENT_WINDOW = 7;
    let overdueBill = billState.find(b => b.overdue && !b.paid);
    let totalBillsDue = billState.filter(b => !b.paid && calculateDueDays(b.dueDate) >= 0).length;
    let totalDueAmount = billState.filter(b => !b.paid && calculateDueDays(b.dueDate) >= 0 && calculateDueDays(b.dueDate) <= EARLY_PAYMENT_WINDOW)
        .reduce((sum, bill) => sum + bill.amount, 0);
    const completedBills = billState.filter(b => b.paid).length;
    const totalFinanceItems = billState.length;
    const financialHealth = totalFinanceItems > 0 ? Math.round((completedBills / totalFinanceItems) * 100) : 100;
    let activeSubscriptionTotal = billState.filter(b => b.frequency !== 'one-time' && !b.paid)
        .reduce((sum, bill) => sum + bill.amount, 0);


    // C. Fitness Metrics
    let totalStepsToday = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'steps')
        .reduce((sum, log) => sum + log.value, 0);
    let totalCaloriesOutToday = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'calories_out')
        .reduce((sum, log) => sum + log.value, 0);
    let totalWaterIntake = fitnessHistory.filter(log => log.date === TODAY_DATE && log.type === 'water_intake')
        .reduce((sum, log) => sum + log.value, 0);

    const sleepLog = fitnessHistory.filter(log => log.type === 'sleep')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        || { value: 0 };

    const sleepLastNight = sleepLog.value;
    const isLowSleep = sleepLastNight < 6 && sleepLastNight > 0;

    // D. Mood/Stress Metrics
    const latestEntry = moodHistory
        .sort((a, b) => b.date.localeCompare(a.date))[0]
        || { mood: 2, stress: 45, note: 'No recent log data.', isFinal: false };
    const moodLabel = moodMap[Object.keys(moodMap).find(key => moodMap[key].value === latestEntry.mood)]?.label || 'Neutral';
    const stressIndex = latestEntry.stress;
    const isHighStress = stressIndex >= 70;
    const moodNote = latestEntry.note ? latestEntry.note : (latestEntry.isFinal ? 'No note logged.' : 'Daily check-in pending.');

    // E. Vault/Social Hub Metrics
    const assetStateMock = (window.assetState && window.assetState.length > 0) ? window.assetState : [
        { type: 'Social' }, { type: 'Video' }, { type: 'Messaging' }, { type: 'Dev' }, { type: 'Dev' }
    ];
    const totalVaultLinks = assetStateMock.length;
    const uniqueCategories = [...new Set(assetStateMock.map(a => a.type))].length;


    // F. Life Score Component Calculations (Component Scores: 0-100)
    const componentScores = {
        tasks: taskCompletionRate,
        finance: financialHealth,
        mood: 100 - stressIndex,
        fitness: Math.min(100, (sleepLastNight / 8) * 50 + (totalStepsToday / 10000) * 50)
    };

    // G. Life Score (Calculation)
    const lifeScoreWeights = { tasks: 0.25, finance: 0.20, fitness: 0.20, mood: 0.20, digital: 0.15 };
    let currentScore = 0;
    currentScore += Math.round(componentScores.tasks * lifeScoreWeights.tasks);
    currentScore += Math.round(componentScores.finance * lifeScoreWeights.finance);
    currentScore += Math.round(componentScores.fitness * lifeScoreWeights.fitness);
    currentScore += Math.round(componentScores.mood * lifeScoreWeights.mood);
    currentScore += Math.round(100 * lifeScoreWeights.digital);
    currentScore = Math.min(100, Math.max(0, currentScore));


    // --- 2. UPDATE UI CARDS (KPIs) ---

    // Life Score Card
    const lifeScoreElement = document.getElementById('life-score-number');
    if (lifeScoreElement) lifeScoreElement.textContent = currentScore;

    // NEW: Update Life Score Component Weights with Calculated Score
    if (document.getElementById('score-tasks')) {
        document.getElementById('score-tasks').textContent = `Tasks (${Math.round(componentScores.tasks)}%)`;
    }
    if (document.getElementById('score-finance')) {
        document.getElementById('score-finance').textContent = `Financial Health (${Math.round(componentScores.finance)}%)`;
    }
    if (document.getElementById('score-fitness')) {
        document.getElementById('score-fitness').textContent = `Fitness (${Math.round(componentScores.fitness)}%)`;
    }
    if (document.getElementById('score-mood')) {
        document.getElementById('score-mood').textContent = `Mood/Stress (${Math.round(componentScores.mood)}%)`;
    }

    // 1. MOOD KPI CARD (UPDATED RENDERING)
    const moodValueElement = document.getElementById('kpi-mood-value');
    const stressElement = document.getElementById('kpi-stress-index');
    const moodNoteElement = document.getElementById('kpi-mood-note');

    if (moodValueElement) moodValueElement.textContent = moodLabel;
    if (stressElement) stressElement.textContent = `Stress Index: ${stressIndex}%`;
    if (moodNoteElement) moodNoteElement.textContent = moodNote;

    // 2. FITNESS KPI CARD (UPDATED)
    const stepsValueElement = document.getElementById('kpi-steps-value');
    const caloriesValueLabel = document.getElementById('kpi-calories-value-label');
    const sleepValueLabel = document.getElementById('kpi-sleep-value-label');
    const waterValueLabel = document.getElementById('kpi-water-value-label');

    // FIX: Inject the clean span structure to fix duplication bug
    if (stepsValueElement) {
        stepsValueElement.innerHTML = `
            <span class="kpi-steps-label">Steps: </span>
            <span id="steps-number-val">${totalStepsToday.toLocaleString()}</span>
        `;
    }

    if (caloriesValueLabel) caloriesValueLabel.textContent = `Calories Burned: ${totalCaloriesOutToday.toLocaleString()}`;
    if (sleepValueLabel) sleepValueLabel.textContent = `Last Sleep: ${sleepLastNight > 0 ? sleepLastNight : '--'} hr`;
    if (waterValueLabel) waterValueLabel.textContent = `Water Intake: ${totalWaterIntake.toLocaleString()} ml`;

    // 3. FINANCE KPI CARD (UPDATED RENDERING)
    const financeValueElement = document.getElementById('kpi-finance-value');
    const financeHealthElement = document.getElementById('kpi-finance-health-percent');
    const financeSubsElement = document.getElementById('kpi-finance-subs-monthly');

    if (financeValueElement) {
        const dueLabelHtml = `<span class="kpi-label" id="finance-due-label">Due</span>`;
        financeValueElement.innerHTML = `₹${totalDueAmount.toLocaleString()} ${dueLabelHtml}`;
    }
    if (financeHealthElement) financeHealthElement.textContent = `Health: ${financialHealth}%`;
    if (financeSubsElement) financeSubsElement.textContent = `Subscriptions: ₹${activeSubscriptionTotal.toLocaleString()} / mo`;

    // 4. VAULT/SOCIAL HUB KPI CARD
    const vaultLinksElement = document.getElementById('kpi-vault-links');
    const vaultCategoriesElement = document.getElementById('kpi-vault-categories');
    if (vaultLinksElement) vaultLinksElement.textContent = `${totalVaultLinks} Links`;
    if (vaultCategoriesElement) vaultCategoriesElement.textContent = `${uniqueCategories} Categories`;


    // --- 5. RENDER CHART.JS RADAR CHART (FINAL FIX) ---
    const radarChartEl = document.getElementById('life-score-radar-chart');
    if (radarChartEl && typeof Chart !== 'undefined') { // Ensure Chart.js is loaded
        // Prepare data for Chart.js
        const chartData = {
            labels: ['Tasks (25%)', 'Financial (20%)', 'Fitness (20%)', 'Mood/Stress (20%)'],
            datasets: [{
                label: 'Score',
                data: [
                    componentScores.tasks,
                    componentScores.finance,
                    componentScores.fitness,
                    componentScores.mood
                ],
                backgroundColor: 'rgba(0, 199, 166, 0.4)', // var(--c-primary) with alpha
                borderColor: 'var(--c-primary)',
                borderWidth: 1.5,
                pointRadius: 4,
                pointBackgroundColor: 'var(--c-primary)'
            }]
        };

        // Destroy previous chart instance if it exists to prevent duplication error
        if (window.lifeScoreChartInstance) {
            window.lifeScoreChartInstance.destroy();
        }

        // Render the new chart instance
        window.lifeScoreChartInstance = new Chart(radarChartEl, {
            type: 'radar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(5, 3, 22, 0.1)' },
                        grid: { color: 'rgba(5, 3, 22, 0.1)' },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: {
                            stepSize: 25,
                            backdropColor: 'rgba(255, 255, 255, 0.8)'
                        },
                        pointLabels: {
                            // CRITICAL FIX: Ensure padding is large enough to prevent cutoff
                            padding: 20,
                            font: { size: 12, family: 'Inter, sans-serif' },
                            color: 'var(--c-text-dark)'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                }
            }
        });
    }


    // --- 3. UPDATE SCHEDULE LIST (Today's Schedule Card) ---
    // ... (This section remains unchanged from previous steps) ...
    const scheduleList = document.getElementById('task-list-container');
    if (scheduleList) {
        scheduleItemsToday.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1, 'meeting': 2, 'holiday': 0 };
            const priorityB = priorityOrder[b.priority] || 0;
            const priorityA = priorityOrder[a.priority] || 0;
            return (a.completed - b.completed) || (priorityB - priorityA);
        });

        const existingCheckboxes = scheduleList.querySelectorAll('input[type="checkbox"]');
        // This function is defined inside initializeDashboardPage, cannot use here directly without refactoring
        // existingCheckboxes.forEach(cb => cb.removeEventListener('change', updateLifeScore)); 

        scheduleList.innerHTML = '';

        if (scheduleItemsToday.length === 0) {
            scheduleList.innerHTML = `<li class="task-item-empty">Nothing scheduled for today.</li>`;
        }

        scheduleItemsToday.forEach(item => {
            const isTask = item.type === 'task' || item.type === undefined;
            const li = document.createElement('li');
            li.className = `task-item ${item.completed ? 'completed' : ''}`;

            const inputOrIcon = isTask
                ? `<input type="checkbox" id="dash-${item.id}" ${item.completed ? 'checked' : ''}>`
                : `<i data-feather="${item.type === 'meeting' ? 'users' : 'gift'}" style="width: 20px; height: 20px; color: var(--c-text-muted);"></i>`;

            const labelText = isTask ? item.text : `${item.text} (${item.type})`;

            li.innerHTML = `
                ${inputOrIcon}
                <label for="dash-${item.id}" style="margin-left: ${isTask ? '12px' : '10px'};">${labelText}</label>
             `;
            scheduleList.appendChild(li);
        });

        // The checkbox listener needs the updateLifeScore function from initializeDashboardPage's scope,
        // so this listener setup usually requires the logic to be moved or simplified.
        // For now, the implementation relies on the function being defined/passed in initialization.
        scheduleList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const taskId = e.target.id.replace('dash-', '');
                const task = taskState.find(t => t.id === taskId);

                if (task) {
                    task.completed = isChecked;
                    const scoreChange = isChecked ? 3 : -3;
                    // The function call below relies on the outer scope of initializeDashboardPage
                    // updateLifeScore(scoreChange); 

                    renderDashboardMetrics();
                }
            });
        });
    }


    // --- 4. UPDATE AI REMEDIES LIST & Tasks (Actions for Today Card) ---
    const remedyList = document.getElementById('dashboard-actions-list');
    if (remedyList) {
        let actionItems = [];

        // A. Critical AI Remediation Alerts (Top Priority)
        if (overdueBill) {
            actionItems.push({
                id: `remedy-bill-${overdueBill.id}`,
                status: 'finance',
                icon: 'alert-triangle',
                text: `Overdue: ${overdueBill.name}. Pay Now.`,
                buttonText: 'Pay',
                action: 'pay',
                dataId: overdueBill.id,
                priorityScore: 10
            });
        }
        if (isLowSleep) {
            actionItems.push({
                id: 'remedy-low-sleep',
                status: 'health',
                icon: 'moon',
                text: `Low Sleep detected (${sleepLastNight}h). Schedule a 30-min break.`,
                buttonText: 'Schedule',
                action: 'schedule',
                priorityScore: 9
            });
        }
        if (isHighStress && !isLowSleep && !overdueBill) {
            actionItems.push({
                id: 'remedy-high-stress',
                status: 'health',
                icon: 'zap',
                text: `High Stress Index (${stressIndex}%). Consider a 5-min meditation.`,
                buttonText: 'Start',
                action: 'meditate',
                priorityScore: 8
            });
        }


        // B. All Pending Tasks Due Today (Lower Priority)
        const pendingTasksToday = scheduleItemsToday.filter(
            item => item.type === 'task' && !item.completed
        );

        pendingTasksToday.forEach(task => {
            actionItems.push({
                id: `task-action-${task.id}`,
                status: 'task',
                icon: 'check-square',
                text: `Task: ${task.text} (${task.priority}).`,
                buttonText: 'Complete',
                action: 'complete-task',
                dataId: task.id,
                priorityScore: task.priority === 'high' ? 7 : (task.priority === 'medium' ? 6 : 5)
            });
        });

        actionItems.sort((a, b) => b.priorityScore - a.priorityScore);


        let finalHTML = '';
        if (actionItems.length === 0) {
            finalHTML = `<li class="remedy-item" data-status="info"><i data-feather="thumbs-up"></i><p>You're all set! No critical actions or tasks due today.</p></li>`;
        } else {
            actionItems.forEach(item => {
                const isCompleted = item.action === 'pay' && billState.find(b => b.id === item.dataId && b.paid);

                finalHTML += `
                    <li class="remedy-item ${isCompleted ? 'completed' : ''}" 
                        data-status="${item.status}" data-action-type="${item.action}" data-id="${item.dataId}">
                        <i data-feather="${item.icon}"></i>
                        <p>${item.text}</p>
                        <button class="remedy-button" data-action="${item.action}" data-id="${item.dataId}" 
                            ${isCompleted ? 'disabled' : ''}>
                            ${isCompleted ? 'Paid' : item.buttonText}
                        </button>
                    </li>
                `;
            });
        }

        remedyList.innerHTML = finalHTML;
    }

    feather.replace();
}


/**
 * Runs all logic for the Dashboard (index.html)
 */
function initializeDashboardPage() {

    const lifeScoreElement = document.getElementById('life-score-number');
    const notificationPanel = document.getElementById('notification-panel');

    // Function to update the Life Score dynamically (made local to this function)
    function updateLifeScore(points) {
        if (!lifeScoreElement) return;
        let currentScore = parseInt(lifeScoreElement.textContent) || 82;
        currentScore = Math.max(0, Math.min(100, currentScore + points));
        lifeScoreElement.textContent = currentScore;
        lifeScoreElement.classList.add('pop');
        setTimeout(() => lifeScoreElement.classList.remove('pop'), 300);
    }

    // Check global state for notifications banner (Dashboard only)
    if (notificationPanel) {
        const overdueBill = billState.some(b => b.overdue && !b.paid);
        const highStress = moodHistory.length > 0 && moodHistory[moodHistory.length - 1].stress >= 70;

        if (overdueBill || highStress) {
            notificationPanel.style.display = 'flex';
            notificationPanel.style.alignItems = 'center';
            const messageParts = [];
            if (overdueBill) messageParts.push('Overdue Bill');
            if (highStress) messageParts.push('High Stress');
            document.getElementById('notification-message').textContent = `You have ${messageParts.join(' & ')} critical alert(s).`;
        } else {
            notificationPanel.style.display = 'none';
        }
    }

    // Handle Mock Remedy Button Clicks on the Dashboard (e.g., Pay, Schedule, Meditate)
    const remedyList = document.getElementById('dashboard-actions-list');

    function attachRemedyListeners() {
        // IMPORTANT: Need to re-select and re-attach listeners every time the list is re-rendered
        const remedyButtons = remedyList.querySelectorAll('.remedy-button');

        // Remove old listeners by cloning and replacing the element
        remedyButtons.forEach(button => {
            button.replaceWith(button.cloneNode(true));
        });

        // Re-select the cloned buttons
        const liveRemedyButtons = remedyList.querySelectorAll('.remedy-button');

        liveRemedyButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const itemId = e.currentTarget.dataset.id;
                const remedyItem = e.currentTarget.closest('.remedy-item');

                // If button is already disabled (e.g., set to 'Paid' in the HTML), do nothing
                if (e.currentTarget.disabled) return;

                if (action === 'pay') {
                    const overdueBill = billState.find(b => b.id === itemId);
                    if (overdueBill) {
                        // ... (unchanged logic for updating billState and adding next bill) ...
                        overdueBill.paid = true;
                        overdueBill.overdue = false;

                        if (overdueBill.frequency !== 'one-time') {
                            const nextDueDate = calculateNextDueDate(overdueBill.dueDate, overdueBill.frequency);
                            billState.push({
                                ...overdueBill,
                                id: 'bill' + Date.now(),
                                dueDate: nextDueDate,
                                paid: false,
                                overdue: false
                            });
                        }
                        showFlashMessage(`Bill paid (Mock). Life Score +3.`, 'check-circle');
                        updateLifeScore(3);
                    }
                    e.currentTarget.textContent = 'Paid'; // Set button text immediately
                } else if (action === 'schedule') {
                    // ... (unchanged health logic) ...
                    showFlashMessage(`30-min break scheduled. Stress Index reduced.`, 'coffee');
                    updateLifeScore(2);
                    e.currentTarget.textContent = 'Scheduled';
                } else if (action === 'meditate') {
                    // ... (unchanged health logic) ...
                    showFlashMessage(`5-min meditation started (Mock). Stress reduced.`, 'zap');
                    updateLifeScore(2);
                    e.currentTarget.textContent = 'Done'; // "Done" is fine for single-use remedy
                } else if (action === 'complete-task') {
                    const task = taskState.find(t => t.id === itemId);
                    if (task) {
                        task.completed = true;
                        showFlashMessage(`Task completed: ${task.text}!`, 'check-circle');
                        updateLifeScore(3);
                    }
                    e.currentTarget.textContent = 'Done'; // Set button text immediately
                }

                // CRITICAL FIX: Mute the item visually using CSS class and disable the button.
                e.currentTarget.disabled = true;
                if (remedyItem) remedyItem.classList.add('completed');

                // Re-render the whole dashboard to reflect changes
                renderDashboardMetrics();
                attachRemedyListeners();
            });
        });
    }

    // Initial render and setup
    renderDashboardMetrics();
    attachRemedyListeners();
    feather.replace();
}


// ===============================================
// PAGE-SPECIFIC INITIALIZATION FUNCTIONS
// ===============================================

/**
 * Runs all logic for the Tasks Page (tasks.html)
 */
function initializeTasksPageLogic() {

    // --- 1. STATE MANAGEMENT (Uses Global taskState) ---
    let activeTaskFilter = 'date';
    const mainTaskList = document.getElementById('main-task-list');

    // --- 2. CORE RENDER FUNCTION ---
    function renderTaskList() {
        if (!mainTaskList) return;

        // 1. FILTERING STEP
        let displayTasks = taskState.filter(task => {
            if (task.type !== 'task' && task.type !== undefined) return false;

            if (activeTaskFilter === 'completed') {
                return task.completed;
            }
            return true;
        });

        // 2. SORTING LOGIC (Date -> Priority)
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

            if (dateA !== dateB) {
                return dateA - dateB;
            }

            return priorityB - priorityA;
        });
        // -------------------------------------------------------

        mainTaskList.innerHTML = '';
        if (displayTasks.length === 0) {
            const message = activeTaskFilter === 'completed' ?
                'No completed tasks yet. Keep going!' :
                'No active tasks. Add one!';
            mainTaskList.innerHTML = `<li class="task-item-empty">${message}</li>`;
        }

        displayTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;

            let formattedDate = '';
            if (task.date) {
                try {
                    const dateObj = new Date(task.date + 'T00:00:00');
                    formattedDate = dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric' });
                } catch (e) { console.error('Invalid date', task.date); }
            }

            li.innerHTML = `
                <input type="checkbox" id="${task.id}" ${task.completed ? 'checked' : ''}>
                <label for="${task.id}">${task.text}</label>
                <span class="task-date">${formattedDate}</span>
                <span class="task-tag ${task.priority}">${task.priority}</span>
                
                <div class="task-actions">
                    <button class="edit-task-button" data-id="${task.id}" title="Edit Task">
                        <i data-feather="edit-2" style="width: 14px;"></i>
                    </button>
                    <button class="delete-task-button" data-id="${task.id}" title="Delete Task">
                        <i data-feather="trash-2" style="width: 14px;"></i>
                    </button>
                </div>
            `;
            mainTaskList.appendChild(li);
        });

        mainTaskList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.closest('.task-item').dataset.id;
                toggleTaskCompleted(taskId);
            });
        });

        mainTaskList.querySelectorAll('.edit-task-button').forEach(button => {
            button.addEventListener('click', (e) => {
                openEditModal(e.currentTarget.dataset.id);
            });
        });
        mainTaskList.querySelectorAll('.delete-task-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const task = taskState.find(t => t.id === e.currentTarget.dataset.id);
                if (task) {
                    showDeleteConfirmModal(task.id, task.text);
                }
            });
        });

        if (calendar) {
            calendar.refetchEvents();
        }

        feather.replace();
    }

    function toggleTaskCompleted(taskId) {
        const task = taskState.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;

            if (task.completed && typeof showFlashMessage === 'function') {
                showFlashMessage(`Task completed: ${task.text}! Well done.`, 'check-circle');
            }
        }
        renderTaskList();
        if (document.getElementById('dashboard-grid')) {
            renderDashboardMetrics();
        }
    }

    function deleteTask(taskId) {
        taskState = taskState.filter(t => t.id !== taskId);
        renderTaskList();
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(`Task deleted successfully.`, 'trash-2');
        }
        if (document.getElementById('dashboard-grid')) {
            renderDashboardMetrics();
        }
    }

    // --- 3. "ADD TASK" MODAL LOGIC ---
    const addModal = document.getElementById('add-task-modal');
    const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalAddButton = document.getElementById('modal-add-button');
    const taskTextInput = document.getElementById('task-text-input');
    const taskPrioritySelect = document.getElementById('task-priority-select');
    const taskDateInput = document.getElementById('task-date-input');

    if (taskDateInput) {
        taskDateInput.value = getTodayDateString();
    }

    function showAddModal() {
        if (taskDateInput) {
            taskDateInput.value = getTodayDateString();
        }
        if (addModal) addModal.style.display = 'flex';
    }
    function hideAddModal() {
        if (addModal) addModal.style.display = 'none';
        if (taskTextInput) taskTextInput.value = '';
        if (taskPrioritySelect) taskPrioritySelect.value = 'medium';
    }

    const mainAddTaskButton = document.getElementById('add-task-button-main');
    if (mainAddTaskButton) mainAddTaskButton.addEventListener('click', showAddModal);

    if (modalCancelButton) modalCancelButton.addEventListener('click', hideAddModal);
    if (addModal) addModal.addEventListener('click', (e) => {
        if (e.target === addModal) hideAddModal();
    });

    if (modalAddButton) {
        modalAddButton.addEventListener('click', () => {
            const taskText = taskTextInput.value;
            if (!taskText || taskText.trim() === "") {
                alert('Please enter a task description.');
                return;
            }

            const newTask = {
                id: 'task' + (taskState.length + 1 + Math.random()),
                text: taskText.trim(),
                priority: taskPrioritySelect.value,
                date: taskDateInput.value || getTodayDateString(),
                completed: false,
                type: 'task'
            };

            taskState.push(newTask);
            renderTaskList();
            hideAddModal();
            if (typeof showFlashMessage === 'function') {
                showFlashMessage(`Task added: ${newTask.text}`, 'plus-circle');
            }
            if (document.getElementById('dashboard-grid')) {
                renderDashboardMetrics();
            }
        });
    }

    // --- X. TASK FILTER BAR LOGIC ---
    const taskFilterBar = document.getElementById('task-filter-bar');
    if (taskFilterBar) {
        taskFilterBar.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                taskFilterBar.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');
                activeTaskFilter = e.currentTarget.dataset.filter;
                renderTaskList();
            });
        });
    }

    // --- Y. EDIT TASK MODAL LOGIC ---
    const editModal = document.getElementById('edit-task-modal');
    const editModalCancelButton = document.getElementById('edit-modal-cancel-button');
    const editModalSaveButton = document.getElementById('edit-modal-save-button');
    const editModalDeleteButton = document.getElementById('edit-modal-delete-button');

    const editTaskIdInput = document.getElementById('edit-task-id-input');
    const editTaskTextInput = document.getElementById('edit-task-text-input');
    const editTaskPrioritySelect = document.getElementById('edit-task-priority-select');
    const editTaskDateInput = document.getElementById('edit-task-date-input');

    function openEditModal(taskId) {
        const task = taskState.find(t => t.id === taskId);
        if (!task || editModal.style.display === 'flex') return;

        editTaskIdInput.value = task.id;
        editTaskTextInput.value = task.text;
        editTaskPrioritySelect.value = task.priority;
        editTaskDateInput.value = task.date;

        document.getElementById('edit-modal-title').textContent = `Edit: ${task.text}`;

        editModal.style.display = 'flex';
    }

    function hideEditModal() {
        if (editModal) editModal.style.display = 'none';
    }

    if (editModalCancelButton) editModalCancelButton.addEventListener('click', hideEditModal);
    if (editModal) editModal.addEventListener('click', (e) => {
        if (e.target === editModal) hideEditModal();
    });

    if (editModalSaveButton) {
        editModalSaveButton.addEventListener('click', () => {
            const taskId = editTaskIdInput.value;
            const task = taskState.find(t => t.id === taskId);

            if (task) {
                task.text = editTaskTextInput.value;
                task.priority = editTaskPrioritySelect.value;
                task.date = editTaskDateInput.value;

                renderTaskList();
                hideEditModal();
                if (typeof showFlashMessage === 'function') {
                    showFlashMessage(`Task updated: ${task.text}`, 'save');
                }
                if (document.getElementById('dashboard-grid')) {
                    renderDashboardMetrics();
                }
            }
        });
    }

    if (editModalDeleteButton) {
        editModalDeleteButton.addEventListener('click', () => {
            const taskId = editTaskIdInput.value;
            deleteTask(taskId);
            hideEditModal();
        });
    }

    // --- Z. DELETE CONFIRMATION MODAL LOGIC ---
    const deleteTaskConfirmModal = document.getElementById('delete-task-confirm-modal');
    const deleteTaskConfirmButton = document.getElementById('delete-task-confirm-button');
    const deleteTaskCancelButton = document.getElementById('delete-task-cancel-button');
    const deleteTaskConfirmMessage = document.getElementById('delete-task-confirm-message');

    function showDeleteConfirmModal(id, name) {
        taskToDeleteId = id;
        if (deleteTaskConfirmMessage) deleteTaskConfirmMessage.textContent = `Are you sure you want to delete the task: "${name}"? This action cannot be undone.`;
        if (deleteTaskConfirmModal) deleteTaskConfirmModal.style.display = 'flex';
    }

    function hideDeleteConfirmModal() {
        if (deleteTaskConfirmModal) deleteTaskConfirmModal.style.display = 'none';
        taskToDeleteId = null;
    }

    if (deleteTaskConfirmButton) {
        deleteTaskConfirmButton.addEventListener('click', () => {
            if (taskToDeleteId) {
                deleteTask(taskToDeleteId);
                hideDeleteConfirmModal();
            }
        });
    }

    if (deleteTaskCancelButton) {
        deleteTaskCancelButton.addEventListener('click', hideDeleteConfirmModal);
    }

    if (deleteTaskConfirmModal) deleteTaskConfirmModal.addEventListener('click', (e) => {
        if (e.target === deleteTaskConfirmModal) hideDeleteConfirmModal();
    });


    // --- 4. "DAY TASKS" MODAL LOGIC ---
    const dayTasksModal = document.getElementById('day-tasks-modal');
    const dayTasksTitle = document.getElementById('day-tasks-title');
    const dayTasksList = document.getElementById('day-tasks-list');
    const dayTasksCloseButton = document.getElementById('day-tasks-close-button');

    function showDayTasks(date) {
        const tasksForDay = taskState.filter(item => item.date === date);
        const dateObj = new Date(date + 'T00:00:00');
        if (dayTasksTitle) {
            dayTasksTitle.textContent = `Schedule for ${dateObj.toLocaleString('en-US', { month: 'long', day: 'numeric' })}`;
        }

        if (dayTasksList) {
            tasksForDay.sort((a, b) => {
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1, 'meeting': 2, 'holiday': 0 };
                return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            });

            dayTasksList.innerHTML = '';
            if (tasksForDay.length === 0) {
                dayTasksList.innerHTML = '<li class="task-item-empty">No schedule items for this day.</li>';
            }

            tasksForDay.forEach(item => {
                const isTask = item.type === 'task' || item.type === undefined;
                const status = isTask ? (item.completed ? 'completed' : 'pending') : item.type;

                const li = document.createElement('li');
                li.className = `task-item ${status}`;

                let icon = 'check-square';
                let tagText = item.priority;
                let colorClass = item.priority;

                if (item.type === 'meeting') {
                    icon = 'users'; tagText = 'Meeting'; colorClass = 'medium';
                } else if (item.type === 'holiday') {
                    icon = 'gift'; tagText = 'Holiday'; colorClass = 'low';
                }

                li.innerHTML = `
                    <i data-feather="${icon}" style="width: 18px; height: 18px; margin-right: 8px;"></i>
                    <label style="text-decoration: ${isTask && item.completed ? 'line-through' : 'none'}; opacity: ${isTask && item.completed ? '0.6' : '1'};">
                        ${item.text}
                    </label>
                    <span class="task-tag ${colorClass}">${tagText}</span>
                `;
                dayTasksList.appendChild(li);
            });
            feather.replace();
        }

        if (dayTasksModal) dayTasksModal.style.display = 'flex';
    }

    function hideDayTasks() {
        if (dayTasksModal) dayTasksModal.style.display = 'none';
    }

    if (dayTasksCloseButton) dayTasksCloseButton.addEventListener('click', hideDayTasks);
    if (dayTasksModal) dayTasksModal.addEventListener('click', (e) => {
        if (e.target === dayTasksModal) hideDayTasks();
    });


    // --- 5. INITIAL RENDER ---
    renderTaskList();

    // --- 6. CLERK/CALENDAR INITIALIZATION ---
    const signInButton = document.getElementById('clerk-signin-button'); // RENAMED ID
    const overlay = document.getElementById('google-signin-overlay');

    if (signInButton) {
        signInButton.addEventListener('click', () => {
            IS_CLERK_SIGNED_IN = true; // CHANGED STATE
            if (overlay) overlay.style.display = 'none';

            // Simulating API call/redirect completion
            setTimeout(() => {
                if (typeof showFlashMessage === 'function') {
                    showFlashMessage("Clerk Sign-In Successful! Calendar Sync Activated.", 'check-circle');
                }
                tryInitializeCalendar();
            }, 500);
        });
    }

    // CHECKING NEW STATE
    if (IS_CLERK_SIGNED_IN) {
        if (overlay) overlay.style.display = 'none';
        tryInitializeCalendar();
    } else {
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) calendarEl.innerHTML = '';
    }
}

/**
 * Runs all logic for the Fitness Page (fitness.html)
 */
function initializeFitnessPage() {

    // --- 1. GLOBAL HELPERS ---
    const TODAY_DATE = getTodayDateString();

    // --- 2. STATE MANAGEMENT (Uses Global fitnessHistory and completedSuggestions) ---
    let selectedWaterVolume = 0;

    const kpiSteps = document.getElementById('kpi-steps');
    const kpiCaloriesOut = document.getElementById('kpi-calories-out');
    const kpiWorkouts = document.getElementById('kpi-workouts');
    const kpiWater = document.getElementById('kpi-water');
    const kpiSleep = document.getElementById('kpi-sleep');
    const suggestionList = document.getElementById('health-suggestion-list');

    // Modals & Inputs
    const logActivityModal = document.getElementById('log-activity-modal');
    const logWaterModal = document.getElementById('log-water-modal');
    const logWaterButton = document.getElementById('log-water-button');
    const waterModalCancelButton = document.getElementById('water-modal-cancel-button');
    const waterModalLogButton = document.getElementById('water-modal-log-button');
    const waterQuickSelect = document.getElementById('water-quick-select');
    const waterCustomInput = document.getElementById('water-custom-input');

    const addManualEntryButton = document.getElementById('add-manual-entry-button');
    const activityModalCancelButton = document.getElementById('activity-modal-cancel-button');
    const activityModalLogButton = document.getElementById('activity-modal-log-button');
    const activityTypeSelect = document.getElementById('activity-type-select');
    const activityValueInput = document.getElementById('activity-value-input');
    const activityValueLabel = document.getElementById('activity-value-label');
    const activityUnitLabel = document.getElementById('activity-unit-label');

    // Log History Elements
    const dailyLogList = document.getElementById('daily-log-list');
    const logHistoryEmpty = document.getElementById('log-history-empty');
    const viewLogToggle = document.querySelector('.view-log-toggle');


    // --- 3. CORE RENDER FUNCTION ---
    function renderFitnessPage() {

        // --- A. Calculate KPIs ---
        let totalStepsToday = 0;
        let totalCaloriesBurnedToday = 0;
        let workoutsThisWeek = 0;
        let totalWaterIntake = 0;

        const sleepLog = fitnessHistory.filter(log => log.type === 'sleep')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || { value: 0 };

        const sleepLastNight = sleepLog.value;


        fitnessHistory.forEach(log => {
            if (log.date === TODAY_DATE) {
                if (log.type === 'steps') {
                    totalStepsToday += log.value || 0;
                } else if (log.type === 'calories_out') {
                    totalCaloriesBurnedToday += log.value || 0;
                } else if (log.type === 'water_intake') {
                    totalWaterIntake += log.value || 0;
                }
            }
            if (log.type === 'workout' && log.date >= '2025-10-20') {
                workoutsThisWeek++;
            }
        });

        // --- B. Update UI Elements ---
        if (kpiSteps) kpiSteps.textContent = totalStepsToday.toLocaleString();
        if (kpiCaloriesOut) kpiCaloriesOut.textContent = totalCaloriesBurnedToday.toLocaleString();
        if (kpiWorkouts) kpiWorkouts.textContent = workoutsThisWeek;
        if (kpiWater) kpiWater.textContent = `${totalWaterIntake.toLocaleString()} ml`;
        if (kpiSleep) kpiSleep.textContent = `${sleepLastNight} hr`;

        // --- C. Water Log Button Status ---
        if (logWaterButton) {
            logWaterButton.disabled = false;
            logWaterButton.style.opacity = 1;
            logWaterButton.textContent = 'Log Water Intake';
        }

        // --- D. Render Suggestions ---
        if (suggestionList) {
            suggestionList.querySelectorAll('.suggestion-item').forEach(item => {
                const id = item.dataset.suggestionId;
                if (completedSuggestions.includes(id)) {
                    item.classList.add('completed');
                } else {
                    item.classList.remove('completed');
                }
                item.replaceWith(item.cloneNode(true));
            });

            const liveSuggestions = document.getElementById('health-suggestion-list').querySelectorAll('.suggestion-item');

            liveSuggestions.forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = item.dataset.suggestionId;
                    if (!completedSuggestions.includes(id)) {
                        completedSuggestions.push(id);
                        item.classList.add('completed');
                        renderFitnessPage();
                    }
                });
            });
        }

        // --- E. Render Daily Log History (Latest on Top) ---
        if (dailyLogList) {
            const todayLogs = fitnessHistory
                .filter(log => log.date === TODAY_DATE)
                .sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));

            dailyLogList.innerHTML = '';

            if (todayLogs.length === 0) {
                dailyLogList.style.display = 'none';
                if (logHistoryEmpty) logHistoryEmpty.style.display = 'block';
            } else {
                dailyLogList.style.display = 'block';
                if (logHistoryEmpty) logHistoryEmpty.style.display = 'none';

                todayLogs.forEach(log => {
                    const li = document.createElement('li');
                    li.className = 'log-item';

                    let typeText = log.type.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    let valueUnit = log.unit;

                    if (log.type === 'water_intake') {
                        typeText = 'Water Intake';
                        valueUnit = 'ml';
                    }

                    li.innerHTML = `
                         <span class="time">${log.time || '--:--'}</span>
                         <span>${typeText}</span>
                         <span class="value">${log.value.toLocaleString()} ${valueUnit}</span>
                     `;
                    dailyLogList.appendChild(li);
                });
            }
        }

        feather.replace();
    }

    // --- 4. MODAL & LOGIC HANDLERS ---

    // Manual Entry Modal Handlers
    function updateActivityUnit() {
        if (!activityTypeSelect || !activityValueInput || !activityUnitLabel || !activityValueLabel) return;

        const type = activityTypeSelect.value;
        let unitText = 'steps';
        let placeholder = 'e.g., 5000';
        let label = 'Value';

        if (type === 'workout') {
            unitText = 'minutes';
            placeholder = 'e.g., 30';
            label = 'Duration';
        } else if (type === 'sleep') {
            unitText = 'hours';
            placeholder = 'e.g., 8';
            label = 'Duration';
        } else if (type === 'calories_out') {
            unitText = 'kcals burned';
            placeholder = 'e.g., 350';
            label = 'Value';
        } else {
            unitText = type;
        }

        activityUnitLabel.value = unitText;
        activityValueInput.placeholder = placeholder;
        activityValueLabel.textContent = label;
        activityValueInput.value = '';
    }
    function showActivityModal() {
        if (logActivityModal) logActivityModal.style.display = 'flex';
        activityValueInput.value = '';
        activityTypeSelect.value = 'steps';
        updateActivityUnit();
    }
    function hideActivityModal() {
        if (logActivityModal) logActivityModal.style.display = 'none';
    }

    // Water Log Modal Handlers
    function showWaterModal() {
        if (logWaterModal) logWaterModal.style.display = 'flex';
        selectedWaterVolume = 0;
        waterCustomInput.value = '';
        waterModalLogButton.disabled = true;
        waterQuickSelect.querySelectorAll('.water-option').forEach(btn => btn.classList.remove('active-select'));
    }

    function hideWaterModal() {
        if (logWaterModal) logWaterModal.style.display = 'none';
    }

    // Main Log Function (Called by Water Modal Log button)
    function logWaterIntake(volume) {
        if (volume <= 0) return;

        const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        const newLog = {
            id: Date.now(),
            date: TODAY_DATE,
            time: nowTime,
            type: 'water_intake',
            value: volume,
            unit: 'ml'
        };

        fitnessHistory.push(newLog);

        hideWaterModal();
        showFlashMessage(`Logged ${volume} ml of water! Staying hydrated.`);
        renderFitnessPage();
        if (document.getElementById('dashboard-grid')) {
            renderDashboardMetrics();
        }
    }


    // --- 5. EVENT LISTENERS ---

    // Water Modal Listeners
    if (logWaterButton) logWaterButton.addEventListener('click', showWaterModal);
    if (waterModalCancelButton) waterModalCancelButton.addEventListener('click', hideWaterModal);
    if (logWaterModal) logWaterModal.addEventListener('click', (e) => {
        if (e.target === logWaterModal) hideWaterModal();
    });

    // Quick Select Listener
    if (waterQuickSelect) {
        waterQuickSelect.addEventListener('click', (e) => {
            const btn = e.target.closest('.water-option');
            if (btn) {
                waterQuickSelect.querySelectorAll('.water-option').forEach(b => b.classList.remove('active-select'));
                btn.classList.add('active-select');
                selectedWaterVolume = parseInt(btn.dataset.volume);
                waterCustomInput.value = '';
                waterModalLogButton.disabled = false;
            }
        });
    }

    // Custom Input Listener
    if (waterCustomInput) {
        waterCustomInput.addEventListener('input', () => {
            const volume = parseInt(waterCustomInput.value);
            if (volume > 0) {
                selectedWaterVolume = volume;
                waterModalLogButton.disabled = false;
                waterQuickSelect.querySelectorAll('.water-option').forEach(btn => btn.classList.remove('active-select'));
            } else {
                selectedWaterVolume = 0;
                const isQuickSelectActive = waterQuickSelect.querySelector('.water-option.active-select');
                if (!isQuickSelectActive) {
                    waterModalLogButton.disabled = true;
                }
            }
        });
    }

    // Final Water Log Action
    if (waterModalLogButton) {
        waterModalLogButton.addEventListener('click', () => {
            if (selectedWaterVolume > 0) {
                logWaterIntake(selectedWaterVolume);
            }
        });
    }


    // Manual Entry Listeners
    if (addManualEntryButton) addManualEntryButton.addEventListener('click', showActivityModal);
    if (activityModalCancelButton) activityModalCancelButton.addEventListener('click', hideActivityModal);
    if (activityTypeSelect) activityTypeSelect.addEventListener('change', updateActivityUnit);
    if (logActivityModal) logActivityModal.addEventListener('click', (e) => {
        if (e.target === logActivityModal) hideActivityModal();
    });


    // Log Data Submission
    if (activityModalLogButton) {
        activityModalLogButton.addEventListener('click', () => {
            const type = activityTypeSelect.value;
            const value = parseInt(activityValueInput.value);
            const unit = activityUnitLabel.value;
            const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

            if (isNaN(value) || value <= 0) {
                showFlashMessage(`Please enter a valid positive number for ${unit}.`, 'alert-triangle');
                return;
            }

            // --- DATA INTEGRITY CHECK (Only restrict sleep to one log per 24 hours) ---
            if (type === 'sleep') {
                const twentyFourHoursAgo = Date.now() - 86400000;
                // Look for the most recent log regardless of date, and check its age
                const lastSleepLog = fitnessHistory.filter(log => log.type === 'sleep')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                if (lastSleepLog && new Date(lastSleepLog.date).getTime() > twentyFourHoursAgo) {
                    showFlashMessage("Error: Only one sleep entry allowed per 24 hours.", 'alert-triangle');
                    return;
                }
            }

            const newLog = {
                id: Date.now(),
                date: TODAY_DATE,
                time: nowTime,
                type: type,
                value: value,
                unit: unit
            };

            fitnessHistory.push(newLog);

            hideActivityModal();
            showFlashMessage(`Logged ${value.toLocaleString()} ${unit} for ${type}.`);
            renderFitnessPage();
            if (document.getElementById('dashboard-grid')) {
                renderDashboardMetrics();
            }
        });
    }

    // Log History Toggle Listener
    if (viewLogToggle) {
        viewLogToggle.addEventListener('click', (e) => {
            const list = dailyLogList;
            const action = e.currentTarget.dataset.action;

            if (action === 'hide') {
                list.style.maxHeight = '0';
                list.style.paddingTop = '0';
                list.style.overflow = 'hidden';
                e.currentTarget.dataset.action = 'show';
                e.currentTarget.innerHTML = '<i data-feather="chevron-down"></i> Show Log';
            } else {
                list.style.maxHeight = '250px';
                list.style.paddingTop = '12px';
                list.style.overflow = 'auto';
                e.currentTarget.dataset.action = 'hide';
                e.currentTarget.innerHTML = '<i data-feather="chevron-up"></i> Hide Log';
            }
            feather.replace();
        });
    }

    // --- 6. SLEEP NOTIFICATION TIMER ---
    startSleepNotificationCheck(fitnessHistory);


    // --- 7. INITIAL RENDER ---
    renderFitnessPage();
}

/**
 * Runs all logic for the Mood Page (mood.html)
 */
function initializeMoodPage() {

    // --- 1. STATE MANAGEMENT (Uses Global moodHistory) ---
    const TODAY_DATE = getTodayDateString();
    const COOLDOWN_DURATION = 3600000; // 1 hour in milliseconds

    // NEW STATE: Daily log counter and last used timestamps
    let remedyLog = {
        date: TODAY_DATE,
        breakCount: 0,
        readCount: 0,
        lastBreakTime: 0,
        lastReadTime: 0
    };

    const stressIndexValue = document.getElementById('stress-index-value');
    const stressIndexLabel = document.getElementById('stress-index-label');
    const remedyList = document.getElementById('remedy-list');

    const addMoodModal = document.getElementById('add-mood-modal');
    const addMoodEntryButton = document.getElementById('add-mood-entry-button');
    const moodModalCancelButton = document.getElementById('mood-modal-cancel-button');
    const moodModalAddButton = document.getElementById('mood-modal-add-button');
    const moodSelector = document.getElementById('mood-selector');
    const currentMoodValueInput = document.getElementById('current-mood-value');
    const selectedMoodLabel = document.getElementById('selected-mood-label');
    const moodNotesInput = document.getElementById('mood-notes-input');

    const LOG_TIME_HOUR = 20; // 8 PM
    const LOG_TIME_MINUTE = 30; // 8:30 PM
    let activeTimer = null; // To hold the interval/timeout ID for the running timer

    // --- NEW: Timer Logic ---
    function startTimer(button, durationMinutes, initialText) {
        if (activeTimer) {
            alert("A focus timer is already running!");
            return;
        }

        const durationMs = durationMinutes * 60 * 1000;
        let endTime = Date.now() + durationMs;
        let timerInterval;

        button.disabled = true;
        button.textContent = '05:00';
        button.style.backgroundColor = '#ccc'; // Grey out

        const updateTimer = () => {
            const timeRemaining = endTime - Date.now();
            const totalSeconds = Math.max(0, Math.floor(timeRemaining / 1000));

            const seconds = totalSeconds % 60;
            const minutes = Math.max(0, Math.floor(totalSeconds / 60));

            const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            button.textContent = displayTime;

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                activeTimer = null; // Clear the active timer
                markRemedyComplete(button, initialText, 'timer');
            }
        };

        timerInterval = setInterval(updateTimer, 1000);
        activeTimer = timerInterval; // Store the interval ID
        updateTimer(); // Initial call
    }

    // NEW: Function to mark remedy complete
    function markRemedyComplete(button, originalText, type) {
        const item = button.closest('.suggestion-item');
        const remedyType = item.dataset.remedy;

        // 1. Update State (Counter & Cooldown Timestamp)
        if (type === 'log' || type === 'timer') {
            if (remedyType === 'break') {
                remedyLog.breakCount++;
                remedyLog.lastBreakTime = Date.now();
            } else if (remedyType === 'read') {
                remedyLog.readCount++;
                remedyLog.lastReadTime = Date.now();
            }
            remedyLog.date = getTodayDateString();
        }

        // 2. Update UI
        item.classList.add('completed');
        button.textContent = (type === 'log') ? `Logged (${(remedyType === 'break' ? remedyLog.breakCount : remedyLog.readCount)})` : 'Completed';
        button.style.backgroundColor = 'var(--c-primary)';
        button.disabled = true;

        // 3. Simulate stress reduction
        const lastEntry = moodHistory[moodHistory.length - 1];
        if (lastEntry.stress > 10) {
            lastEntry.stress = Math.max(10, lastEntry.stress - 15); // Reduce stress
            renderMoodPage();
        }
    }


    // --- 2. CORE RENDER FUNCTION ---
    function renderMoodPage() {

        const now = new Date();
        const hasLoggedToday = moodHistory.some(entry => entry.date === getTodayDateString() && entry.isFinal);
        const isPastLogTime = now.getHours() > LOG_TIME_HOUR ||
            (now.getHours() === LOG_TIME_HOUR && now.getMinutes() >= LOG_TIME_MINUTE);

        // --- A. Handle Daily Reset of Counters (Ruggedness) ---
        if (remedyLog.date !== getTodayDateString()) {
            remedyLog = { date: getTodayDateString(), breakCount: 0, readCount: 0, lastBreakTime: 0, lastReadTime: 0 };
        }

        // --- B. Calculate & Display Stress Index ---
        const lastEntry = moodHistory[moodHistory.length - 1];
        let stressScore = lastEntry.stress;

        let stressLevel = 'Low';
        let color = 'var(--c-primary)';

        if (stressScore > 75) {
            stressLevel = 'High';
            color = 'var(--c-accent-red)';
        } else if (stressScore > 40) {
            stressLevel = 'Moderate';
            color = 'var(--c-accent-yellow)';
        }

        if (stressIndexValue) {
            stressIndexValue.textContent = `${stressScore}%`;
            stressIndexValue.style.color = color;
        }
        if (stressIndexLabel) {
            stressIndexLabel.textContent = stressLevel;
        }

        // --- C. Enforcement of Daily Logging Rule ---
        if (addMoodEntryButton) {
            if (hasLoggedToday) {
                addMoodEntryButton.textContent = 'Logged for Today';
                addMoodEntryButton.disabled = true;
                addMoodEntryButton.style.backgroundColor = 'var(--c-text-muted)';
            } else if (!isPastLogTime) {
                addMoodEntryButton.textContent = `Log after ${LOG_TIME_HOUR}:${LOG_TIME_MINUTE}`;
                addMoodEntryButton.disabled = true;
                addMoodEntryButton.style.backgroundColor = 'var(--c-text-muted)';
            } else {
                addMoodEntryButton.textContent = 'Add Mood Entry';
                addMoodEntryButton.disabled = false;
                addMoodEntryButton.style.backgroundColor = 'var(--c-primary)';
            }
        }

        // --- D. Update Remedies List (Actionable items) ---
        if (remedyList) {
            remedyList.querySelectorAll('.remedy-button').forEach(button => {
                // Clone and replace to safely remove old listeners
                button.replaceWith(button.cloneNode(true));
            });

            remedyList.querySelectorAll('.suggestion-item').forEach(item => {
                const button = item.querySelector('.remedy-button');
                const remedyType = item.dataset.remedy;
                const originalText = button.textContent;

                // Clean up the display text
                const pTag = item.querySelector('p');
                if (pTag) {
                    pTag.innerHTML = pTag.innerHTML.replace(/\*\*/g, ''); // Remove ** from text
                }

                if (!button || item.classList.contains('completed')) return;

                const duration = (remedyType === 'meditate') ? 5 : (remedyType === 'read' ? 15 : 0);

                // Cooldown Logic Check
                let cooldownTime = (remedyType === 'break') ? remedyLog.lastBreakTime : remedyLog.lastReadTime;
                const timeElapsed = Date.now() - cooldownTime;
                const isOnCooldown = (cooldownTime > 0) && (timeElapsed < COOLDOWN_DURATION);

                // Update button text with current log count/cooldown status
                if (isOnCooldown) {
                    const remainingMs = COOLDOWN_DURATION - timeElapsed;
                    const remainingMinutes = Math.ceil(remainingMs / 60000);
                    button.textContent = `Ready in ${remainingMinutes} min`;
                    button.disabled = true;
                    button.style.backgroundColor = '#ccc';
                } else {
                    // Not on cooldown - show the standard count/action
                    button.disabled = false;
                    button.style.backgroundColor = 'var(--c-primary)';

                    if (remedyType === 'break') {
                        button.textContent = `Log Break (${remedyLog.breakCount})`;
                    } else if (remedyType === 'read') {
                        button.textContent = `Log Reading (${remedyLog.readCount})`;
                    } else if (remedyType === 'meditate') {
                        button.textContent = 'Start';
                    }
                }

                // Re-attach the listeners
                button.addEventListener('click', (e) => {
                    // Check for running timer (only essential for starting a new timer)
                    if (activeTimer && duration > 0) {
                        alert("A focus timer is already running!");
                        return;
                    }

                    if (duration > 0) { // Timer actions (Meditate, Read)
                        startTimer(e.currentTarget, duration, originalText);
                    } else { // Instant actions (Log Break)
                        markRemedyComplete(e.currentTarget, originalText, 'log');
                    }
                });
            });
        }

        feather.replace();
        if (document.getElementById('dashboard-grid')) {
            renderDashboardMetrics();
        }
    }

    // --- 3. MOOD LOGGING MODAL LOGIC (Unchanged) ---
    function showMoodModal() {
        if (addMoodEntryButton.disabled) return;

        if (addMoodModal) addMoodModal.style.display = 'flex';
        resetMoodModal();
    }

    function hideMoodModal() {
        if (addMoodModal) addMoodModal.style.display = 'none';
    }

    function resetMoodModal() {
        const TODAY_DATE = getTodayDateString();
        // Set default values
        currentMoodValueInput.value = 'neutral';
        selectedMoodLabel.textContent = 'Neutral';
        selectedMoodLabel.style.color = moodMap['neutral'].color;
        moodNotesInput.value = '';

        // Clear all highlight classes
        moodSelector.querySelectorAll('span').forEach(span => {
            span.style.transform = 'scale(1)';
            span.style.opacity = '0.5';
        });
        // Highlight default
        const neutralSpan = moodSelector.querySelector('span[data-mood="neutral"]');
        if (neutralSpan) {
            neutralSpan.style.opacity = '1';
            neutralSpan.style.transform = 'scale(1.2)';
        }
    }

    // Mood Selector Click Handler
    if (moodSelector) {
        moodSelector.querySelectorAll('span').forEach(span => {
            span.addEventListener('click', (e) => {
                const moodKey = e.currentTarget.dataset.mood;
                const moodData = moodMap[moodKey];

                // Update visual selection
                moodSelector.querySelectorAll('span').forEach(s => {
                    s.style.opacity = '0.5';
                    s.style.transform = 'scale(1)';
                });
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.2)';

                // Update input values
                currentMoodValueInput.value = moodKey;
                selectedMoodLabel.textContent = moodData.label;
                selectedMoodLabel.style.color = moodData.color;
            });
        });
    }

    // Final Log Entry Action
    if (moodModalAddButton) {
        moodModalAddButton.addEventListener('click', () => {
            const moodKey = currentMoodValueInput.value;
            const moodData = moodMap[moodKey];
            const note = moodNotesInput.value.trim();

            // Duplication Check
            if (moodHistory.some(entry => entry.date === getTodayDateString() && entry.isFinal)) {
                alert("Mood already logged for today.");
                hideMoodModal();
                return;
            }

            // Simple logic to calculate new stress
            let lastStress = moodHistory[moodHistory.length - 1].stress;
            let newStress = moodData.value < 2 ?
                Math.min(95, lastStress + 10) : // Increase if mood is poor
                Math.max(10, lastStress - 5);  // Decrease if mood is good

            const newEntry = {
                date: getTodayDateString(),
                mood: moodData.value,
                note: note,
                stress: newStress,
                isFinal: true // Mark this entry as the final one for the day
            };

            // Update the mood history
            if (moodHistory[moodHistory.length - 1].date === getTodayDateString() && !moodHistory[moodHistory.length - 1].isFinal) {
                moodHistory[moodHistory.length - 1] = newEntry;
            } else {
                moodHistory.push(newEntry);
            }

            alert(`Mood Logged! Mood: ${moodData.label}. Stress updated to ${newStress}%.`);

            renderMoodPage(); // Re-render to update the Stress Index KPI and lock the button
            hideMoodModal();
        });
    }

    // Button Listeners
    if (addMoodEntryButton) addMoodEntryButton.addEventListener('click', showMoodModal);
    if (moodModalCancelButton) moodModalCancelButton.addEventListener('click', hideMoodModal);
    if (addMoodModal) addMoodModal.addEventListener('click', (e) => {
        if (e.target === addMoodModal) hideMoodModal();
    });

    // --- 4. INITIAL RENDER & Timer Check ---
    renderMoodPage();

    function checkTimeAndRender() {
        if (activeTimer) return;

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // 1. Check if button should be unlocked/locked
        if (!moodHistory.some(entry => entry.date === getTodayDateString() && entry.isFinal)) {
            if (hour > LOG_TIME_HOUR || (hour === LOG_TIME_HOUR && minute >= LOG_TIME_MINUTE) || hour < 1) {
                renderMoodPage();
            }
        }
        // 2. Check if a cooldown period ended and needs a re-render
        if (remedyLog.lastBreakTime > 0 || remedyLog.lastReadTime > 0) {
            const breakElapsed = Date.now() - remedyLog.lastBreakTime;
            const readElapsed = Date.now() - remedyLog.lastReadTime;

            if (breakElapsed >= COOLDOWN_DURATION || readElapsed >= COOLDOWN_DURATION) {
                renderMoodPage();
            }
        }

        // 3. Reset daily status check at midnight
        if (hour < 1) {
            renderMoodPage();
        }
    }

    setInterval(checkTimeAndRender, 60000);
}

/**
 * Runs all logic for the Social Hub (vault.html) - REVISED FOR TASK SCHEDULER & DELETE FIX
 */
function initializeVaultPage() {

    // --- 1. STATE MANAGEMENT (Source of Truth) ---
    let assetState = [
        { id: 'v1', name: 'Instagram Profile', type: 'Social', icon: 'instagram', url: 'https://instagram.com/kuberbassi' },
        { id: 'v2', name: 'YouTube Channel', type: 'Video', icon: 'youtube', url: 'https://youtube.com/channel/yourchannel' },
        { id: 'v3', name: 'WhatsApp Web', type: 'Messaging', icon: 'message-square', url: 'https://web.whatsapp.com/' },
        { id: 'v4', name: 'Facebook Feed', type: 'Social', icon: 'facebook', url: 'https://facebook.com/me' },
        { id: 'v5', name: 'GitHub Repos', type: 'Dev', icon: 'github', url: 'https://github.com/kuberbassi' },
    ];
    let activeFilter = 'All';
    let searchQuery = '';
    let assetToDeleteId = null;
    let currentModalAsset = null; // Used by both CRUD and Scheduler

    // --- 2. DOM ELEMENTS ---
    const mainVaultGrid = document.getElementById('main-vault-grid');
    const vaultEmptyMessage = document.getElementById('vault-empty-message');
    const assetSearchInput = document.getElementById('asset-search-input');
    const assetFilterBar = document.getElementById('asset-filter-bar');
    const addAssetButton = document.getElementById('add-asset-button');

    // CRUD Modal Elements
    const assetModal = document.getElementById('asset-modal');
    const assetModalTitle = document.getElementById('asset-modal-title');
    const assetModalActionButton = document.getElementById('asset-modal-action-button');
    const assetModalDeleteButton = document.getElementById('asset-modal-delete-button'); // TARGET OF THE FIX
    const assetIdInput = document.getElementById('asset-id-input');
    const assetNameInput = document.getElementById('asset-name-input');
    const assetTypeSelect = document.getElementById('asset-type-select');
    const assetIconSelect = document.getElementById('asset-icon-select');
    const assetUrlInput = document.getElementById('asset-url-input');
    const securityStatus = document.getElementById('security-status');
    const assetModalCancelButton = document.getElementById('asset-modal-cancel-button');

    // Task Scheduler Modal Elements
    const taskSchedulerModal = document.getElementById('task-scheduler-modal');
    const taskSchedulerTitle = document.getElementById('task-scheduler-title');
    const taskSchedulerText = document.getElementById('task-scheduler-text-input');
    const taskSchedulerDuration = document.getElementById('task-scheduler-duration-input');
    const taskSchedulerCancel = document.getElementById('task-scheduler-cancel-button');
    const taskSchedulerAdd = document.getElementById('task-scheduler-add-button');

    // Delete Confirm Modal
    const deleteConfirmModal = document.getElementById('delete-asset-confirm-modal');
    const deleteConfirmButton = document.getElementById('delete-asset-confirm-button');
    const deleteCancelButton = document.getElementById('delete-asset-cancel-button');
    const deleteConfirmMessage = document.getElementById('delete-asset-confirm-message');


    // --- 3. CORE RENDER FUNCTION ---
    function renderAssets() {
        let filteredAssets = assetState;

        if (activeFilter !== 'All') {
            filteredAssets = filteredAssets.filter(asset => asset.type === activeFilter);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredAssets = filteredAssets.filter(asset =>
                asset.name.toLowerCase().includes(query) ||
                asset.url.toLowerCase().includes(query) ||
                asset.type.toLowerCase().includes(query)
            );
        }

        if (!mainVaultGrid) return;
        mainVaultGrid.innerHTML = '';

        if (filteredAssets.length === 0) {
            vaultEmptyMessage.style.display = 'block';
        } else {
            vaultEmptyMessage.style.display = 'none';
        }

        filteredAssets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'vault-item';
            item.dataset.id = asset.id;
            item.dataset.url = asset.url;
            if (asset.type === 'Dev' || asset.type === 'Video') {
                item.classList.add('action-task');
            }

            item.innerHTML = `
                <div class="context-menu">
                    <button class="edit-asset-button" data-id="${asset.id}" title="Edit"><i data-feather="edit-2" style="width: 16px;"></i></button>
                    <button class="delete-asset-button" data-id="${asset.id}" title="Delete"><i data-feather="x" style="width: 16px;"></i></button>
                </div>
                <i data-feather="${asset.icon}"></i>
                <p>${asset.name}</p>
                <span>${asset.type}</span>
            `;
            mainVaultGrid.appendChild(item);
        });

        const addTile = document.createElement('div');
        addTile.className = 'vault-item add-new';
        addTile.id = 'add-new-vault-tile';
        addTile.innerHTML = `<i data-feather="plus-circle"></i><p>Add Link</p><span></span>`;
        mainVaultGrid.appendChild(addTile);

        attachAssetActionListeners();
        feather.replace();
    }

    // --- 4. ACTION LISTENERS ATTACHMENT (CRITICAL CHANGE) ---
    function attachAssetActionListeners() {
        mainVaultGrid.querySelectorAll('.vault-item:not(.add-new)').forEach(item => {
            item.replaceWith(item.cloneNode(true));
        });

        const liveItems = mainVaultGrid.querySelectorAll('.vault-item:not(.add-new)');

        mainVaultGrid.querySelectorAll('.edit-asset-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                openAssetModal(e.currentTarget.dataset.id);
            });
        });

        mainVaultGrid.querySelectorAll('.delete-asset-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const asset = assetState.find(a => a.id === e.currentTarget.dataset.id);
                if (asset) {
                    showDeleteConfirmModal(asset.id, asset.name);
                }
            });
        });

        liveItems.forEach(item => {
            item.addEventListener('click', handleVaultItemClick);
        });

        const addTile = document.getElementById('add-new-vault-tile');
        if (addTile) addTile.addEventListener('click', () => openAssetModal(null));
    }

    /**
     * Handles the click on a vault item, launching the link or opening the task scheduler.
     */
    function handleVaultItemClick(e) {
        if (e.target.closest('.context-menu')) return;

        const item = e.currentTarget;
        const url = item.dataset.url;
        const assetId = item.dataset.id;
        const asset = assetState.find(a => a.id === assetId);

        if (!asset || !url) return;

        if (asset.type === 'Dev' || asset.type === 'Video') {
            currentModalAsset = asset;
            openTaskSchedulerModal();
        } else {
            window.open(url, '_blank');
            if (typeof showFlashMessage === 'function') {
                showFlashMessage(`Launching ${asset.name}...`, 'link');
            }
        }
    }


    // --- 5. MODAL CONTROL (Includes new Task Scheduler) ---

    // CRUD Modal functions
    function openAssetModal(assetId) {
        if (!assetModal) return;

        assetModal.style.display = 'flex';
        assetModalDeleteButton.style.display = 'none';
        assetIdInput.value = '';
        assetNameInput.value = '';
        assetTypeSelect.value = 'Social';
        assetIconSelect.value = 'instagram';
        assetUrlInput.value = '';

        if (securityStatus) securityStatus.style.display = 'none';

        if (assetId) {
            const asset = assetState.find(a => a.id === assetId);
            if (!asset) return;

            assetModalTitle.textContent = `Edit Link: ${asset.name}`;
            assetModalActionButton.textContent = 'Save Changes';
            assetModalActionButton.dataset.mode = 'edit';
            assetModalDeleteButton.style.display = 'block';

            assetIdInput.value = asset.id;
            assetNameInput.value = asset.name;
            assetTypeSelect.value = asset.type;
            assetIconSelect.value = asset.icon || 'link';
            assetUrlInput.value = asset.url || '';

        } else {
            assetModalTitle.textContent = 'Add New Social Link';
            assetModalActionButton.textContent = 'Add Link';
            assetModalActionButton.dataset.mode = 'add';
        }
        feather.replace();
    }

    function hideAssetModal() {
        if (assetModal) assetModal.style.display = 'none';
        assetIdInput.value = '';
    }

    function showDeleteConfirmModal(id, name) {
        assetToDeleteId = id;
        deleteConfirmMessage.textContent = `Are you sure you want to delete the link: "${name}"? This action cannot be undone.`;
        deleteConfirmModal.style.display = 'flex';
        hideAssetModal();
    }

    // NEW: Task Scheduler Modal Functions
    function openTaskSchedulerModal() {
        if (!taskSchedulerModal || !currentModalAsset) return;

        taskSchedulerTitle.textContent = `Schedule Focus: ${currentModalAsset.name}`;
        taskSchedulerText.placeholder = currentModalAsset.type === 'Dev' ?
            "e.g., Code for LifeMirror Feature X" : "e.g., Produce new guitar riff";
        taskSchedulerText.value = '';
        taskSchedulerDuration.value = '60'; // Default to 60 minutes

        taskSchedulerModal.style.display = 'flex';
    }

    function hideTaskSchedulerModal() {
        if (taskSchedulerModal) taskSchedulerModal.style.display = 'none';
        currentModalAsset = null;
    }


    // --- 6. CRUD OPERATIONS ---

    // Save/Update Link (assetModalActionButton listener)
    if (assetModalActionButton) {
        assetModalActionButton.addEventListener('click', () => {
            const mode = assetModalActionButton.dataset.mode;
            const name = assetNameInput.value.trim();
            const type = assetTypeSelect.value;
            const icon = assetIconSelect.value;
            const url = assetUrlInput.value.trim();
            const id = assetIdInput.value;

            if (!name || !url) {
                alert('Platform Name and URL are required.');
                return;
            }

            if (mode === 'add') {
                const newAsset = {
                    id: 'v' + Date.now(),
                    name,
                    type,
                    icon,
                    url
                };
                assetState.push(newAsset);
            } else if (mode === 'edit') {
                const index = assetState.findIndex(a => a.id === id);
                if (index !== -1) {
                    assetState[index] = { ...assetState[index], name, type, icon, url };
                }
            }

            renderAssets();
            hideAssetModal();
            if (typeof showFlashMessage === 'function') {
                showFlashMessage(`Link saved: ${name}`, 'link');
            }
        });
    }

    // Delete Asset
    function deleteAsset(id) {
        assetState = assetState.filter(asset => asset.id !== id);
        renderAssets();
        deleteConfirmModal.style.display = 'none';
        if (typeof showFlashMessage === 'function') {
            showFlashMessage('Link deleted.', 'trash-2');
        }
    }

    // NEW: Task Scheduler Action Listener
    if (taskSchedulerAdd) {
        taskSchedulerAdd.addEventListener('click', () => {
            const taskText = taskSchedulerText.value.trim();
            const duration = parseInt(taskSchedulerDuration.value);

            if (!taskText || isNaN(duration) || duration <= 0) {
                alert('Please enter a task description and a valid duration (in minutes).');
                return;
            }

            // 1. Log the task to the Tasks page (Simulated integration)
            addNewTaskFromVault(taskText, duration);

            // 2. Open the URL now that the task is logged
            window.open(currentModalAsset.url, '_blank');

            // 3. Close the modal
            hideTaskSchedulerModal();
        });
    }


    // --- 7. EVENT LISTENERS SETUP ---

    // CRUD Listeners
    if (addAssetButton) addAssetButton.addEventListener('click', () => openAssetModal(null));
    if (assetModalCancelButton) assetModalCancelButton.addEventListener('click', hideAssetModal);

    // FIX: Listener for the "Delete Link" button inside the Edit Modal
    if (assetModalDeleteButton) {
        assetModalDeleteButton.addEventListener('click', () => {
            const name = assetNameInput.value;
            const id = assetIdInput.value;
            if (id) {
                showDeleteConfirmModal(id, name);
            }
        });
    }

    // Confirmation Modal Listeners
    if (deleteConfirmButton) {
        deleteConfirmButton.addEventListener('click', () => {
            if (assetToDeleteId) {
                deleteAsset(assetToDeleteId);
                assetToDeleteId = null;
            }
        });
    }

    // FIX: Cancel listener to simply close the delete modal
    if (deleteCancelButton) deleteCancelButton.addEventListener('click', () => {
        deleteConfirmModal.style.display = 'none';
    });

    // NEW: Task Scheduler Modal Listeners
    if (taskSchedulerCancel) taskSchedulerCancel.addEventListener('click', hideTaskSchedulerModal);
    if (taskSchedulerModal) taskSchedulerModal.addEventListener('click', (e) => {
        if (e.target === taskSchedulerModal) hideTaskSchedulerModal();
    });


    // Filter and Search Listeners
    if (assetFilterBar) {
        assetFilterBar.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                assetFilterBar.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');
                activeFilter = e.currentTarget.dataset.filter;
                renderAssets();
            });
        });
    }

    if (assetSearchInput) {
        assetSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderAssets();
        });
    }

    // --- 8. INITIALIZATION ---
    renderAssets();
}

/**
 * Runs all logic for the Finance Page (finance.html)
 */
function initializeFinancePage() {

    // --- Global State Variables ---
    let activeBillFilter = 'upcoming';
    let showAllBills = false;
    const MAX_BILLS_TO_SHOW = 3;
    const EARLY_PAYMENT_WINDOW = 3;

    // Helper to calculate the next recurring date (Automation Core)
    function calculateNextDueDate(currentDueDate, frequency) {
        if (frequency === 'one-time') return null;

        const date = new Date(currentDueDate + 'T00:00:00');

        if (frequency === 'monthly') {
            date.setMonth(date.getMonth() + 1);
        } else if (frequency === 'quarterly') {
            date.setMonth(date.getMonth() + 3);
        } else if (frequency === 'annually') {
            date.setFullYear(date.getFullYear() + 1);
        }

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper to auto-categorize and assign icons
    function getBillDetails(name) {
        const lowerName = name.toLowerCase();
        let category = 'Other Bill';
        let icon = 'credit-card';

        if (lowerName.includes('netflix') || lowerName.includes('spotify') || lowerName.includes('prime') || lowerName.includes('hulu') || lowerName.includes('streaming')) {
            category = 'Streaming Service'; icon = 'tv';
        } else if (lowerName.includes('electricity') || lowerName.includes('water') || lowerName.includes('utility') || lowerName.includes('gas')) {
            category = 'Utilities'; icon = 'home';
        } else if (lowerName.includes('phone') || lowerName.includes('internet') || lowerName.includes('telecommunication')) {
            category = 'Telecommunication'; icon = 'smartphone';
        } else if (lowerName.includes('gym') || lowerName.includes('health') || lowerName.includes('wellness') || lowerName.includes('fitness')) {
            category = 'Health & Wellness'; icon = 'heart';
        } else if (lowerName.includes('loan') || lowerName.includes('debt') || lowerName.includes('bank') || lowerName.includes('mortgage')) {
            category = 'Debt & Finance'; icon = 'dollar-sign';
        } else if (lowerName.includes('rent') || lowerName.includes('housing')) {
            category = 'Housing'; icon = 'key';
        } else if (lowerName.includes('cloud') || lowerName.includes('storage') || lowerName.includes('sub')) {
            category = 'Subscription'; icon = 'package';
        }

        return { category, icon };
    }


    const mainBillList = document.getElementById('main-bill-list');
    const kpiDue = document.getElementById('kpi-due');
    const kpiSubs = document.getElementById('kpi-subs');
    const kpiHealth = document.getElementById('kpi-health');
    const showMoreButton = document.getElementById('show-more-bills-button');
    const showMoreText = document.getElementById('show-more-text');
    const billFilterBar = document.getElementById('bill-filter-bar');

    // Modal elements
    const addBillModal = document.getElementById('add-bill-modal');
    const addBillButton = document.getElementById('add-bill-button');
    const billModalCancelButton = document.getElementById('bill-modal-cancel-button');
    const billModalActionButton = document.getElementById('bill-modal-action-button');
    const billModalDeleteButton = document.getElementById('bill-modal-delete-button');
    const billModalTitle = document.getElementById('bill-modal-title');
    const billIdInput = document.getElementById('bill-id-input');
    const billNameInput = document.getElementById('bill-name-input');
    const billAmountInput = document.getElementById('bill-amount-input');
    const billDueDateInput = document.getElementById('bill-due-date-input');
    const billFrequencySelect = document.getElementById('bill-frequency-select');
    const billLinkInput = document.getElementById('bill-link-input');

    // Delete Confirmation Modal elements
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const deleteConfirmButton = document.getElementById('delete-confirm-button');
    const deleteCancelButton = document.getElementById('delete-cancel-button');
    const deleteConfirmMessage = document.getElementById('delete-confirm-message');
    let billToDeleteId = null;

    // --- 2. CORE RENDER FUNCTION ---
    function renderBills() {
        if (!mainBillList) return;

        // Populate dueDays and overdue status
        billState.forEach(bill => {
            if (!bill.paid && bill.dueDate) {
                const dueDays = calculateDueDays(bill.dueDate);
                bill.dueDays = dueDays;
                bill.overdue = dueDays < 0;
            } else if (bill.paid) {
                bill.dueDays = 999;
            }
        });

        // --- A. Calculate KPIs & Update State ---
        let totalDueThisWeek = 0;
        let activeSubscriptionTotal = 0;
        const totalBills = billState.length;
        const completedBills = billState.filter(b => b.paid).length;

        let overdueCount = 0;
        let urgentCount = 0;

        billState.forEach(bill => {
            if (!bill.paid && bill.dueDays >= 0 && bill.dueDays <= 7) {
                totalDueThisWeek += bill.amount;
            }
            if (bill.frequency !== 'one-time' && !bill.paid) {
                activeSubscriptionTotal += bill.amount;
            }
            if (bill.overdue && !bill.paid) {
                overdueCount++;
            } else if (bill.dueDays >= 0 && bill.dueDays <= EARLY_PAYMENT_WINDOW && !bill.paid) {
                urgentCount++;
            }
        });

        const financialHealth = totalBills > 0 ? Math.round((completedBills / totalBills) * 100) : 100;

        if (kpiDue) kpiDue.textContent = `₹${totalDueThisWeek.toLocaleString()}`;
        if (kpiSubs) kpiSubs.textContent = `₹${activeSubscriptionTotal.toLocaleString()} / mo`;
        if (kpiHealth) kpiHealth.textContent = `${financialHealth}%`;

        // --- B. Filtering and Sorting ---
        let filteredBills = [...billState];

        if (activeBillFilter === 'subscriptions') {
            filteredBills = filteredBills.filter(bill => bill.frequency !== 'one-time');
        } else if (activeBillFilter === 'paid') {
            filteredBills = filteredBills.filter(bill => bill.paid);
        } else if (activeBillFilter === 'upcoming') {
            filteredBills = filteredBills.filter(bill => !bill.paid);
        }

        // FINAL SORTING: By Urgency (dueDays)
        filteredBills.sort((a, b) => {
            if (a.paid && !b.paid) return 1;
            if (!a.paid && b.paid) return -1;

            if (a.overdue && !b.overdue) return -1;
            if (!a.overdue && b.overdue) return 1;

            return a.dueDays - b.dueDays; // Sort by closest due date (days)
        });

        // --- C. Show More/Show Less Logic ---
        let billsToDisplay = filteredBills;
        const upcomingFilterIsActive = activeBillFilter === 'upcoming';

        if (upcomingFilterIsActive && !showAllBills && filteredBills.length > MAX_BILLS_TO_SHOW) {
            billsToDisplay = filteredBills.slice(0, MAX_BILLS_TO_SHOW);
        }

        const hiddenCount = filteredBills.length - billsToDisplay.length;
        if (showMoreButton) {
            if (upcomingFilterIsActive && hiddenCount > 0) {
                showMoreButton.style.display = 'flex';
                showMoreText.textContent = showAllBills ? 'Show Less' : `Show All Bills (${hiddenCount} more)`;
                const iconElement = showMoreButton.querySelector('i');
                if (iconElement) {
                    iconElement.setAttribute('data-feather', showAllBills ? 'chevron-up' : 'chevron-down');
                }
            } else {
                showMoreButton.style.display = 'none';
            }
        }

        // --- D. Rendering ---
        mainBillList.innerHTML = '';

        // FIX: Remove old status element before inserting new one to prevent duplication
        const existingSummary = mainBillList.parentElement.querySelector('.summary-status');
        if (existingSummary) {
            existingSummary.remove();
        }

        // Add dynamic header summary 
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-status';
        if (overdueCount > 0) {
            summaryDiv.innerHTML = `<span style="color: var(--c-accent-red); font-weight: 600;">⚠️ ${overdueCount} bill${overdueCount > 1 ? 's' : ''} overdue.</span>`;
        } else if (urgentCount > 0) {
            summaryDiv.innerHTML = `<span style="color: var(--c-accent-yellow); font-weight: 600;">🔔 ${urgentCount} bill${urgentCount > 1 ? 's' : ''} due this week.</span>`;
        } else if (upcomingFilterIsActive && billsToDisplay.length > 0) {
            summaryDiv.innerHTML = `<span style="color: var(--c-primary); font-weight: 600;">Upcoming Bills are on track.</span>`;
        } else {
            summaryDiv.innerHTML = `<span style="color: var(--c-text-muted); font-weight: 500;">No immediate bills due.</span>`;
        }
        mainBillList.parentElement.querySelector('h3').after(summaryDiv); // Insert after the h3


        billsToDisplay.forEach(bill => {
            const li = document.createElement('li');

            // Determine urgency class for highlight
            let urgencyClass = '';
            let isPayable = false;

            // LOGIC FIX: Determine payability and urgency
            if (bill.overdue && !bill.paid) {
                urgencyClass = 'overdue';
                isPayable = true; // Overdue bills MUST be payable
            } else if (bill.dueDays <= EARLY_PAYMENT_WINDOW && bill.dueDays >= 0 && !bill.paid) {
                urgencyClass = 'urgent'; // Highlight urgent payments (yellow/orange)
                isPayable = true;
            } else if (bill.paid) {
                urgencyClass = 'completed';
                isPayable = false;
            } else if (bill.dueDays > 0) {
                isPayable = false; // Locked if not urgent or overdue
            }

            // Dynamic Date Text
            let dueDateText;
            if (bill.paid) {
                dueDateText = 'Paid';
            } else if (bill.overdue) {
                dueDateText = 'Overdue';
            } else if (bill.dueDays === 0) {
                dueDateText = 'Due Today';
            } else if (bill.dueDays > 0) {
                dueDateText = `Due in ${bill.dueDays} days`;
            } else {
                dueDateText = 'Upcoming';
            }

            li.className = `bill-item ${urgencyClass}`;
            li.dataset.id = bill.id;
            li.dataset.link = bill.paymentLink || '#';

            li.innerHTML = `
                <i data-feather="${bill.icon}" class="icon" style="color: var(--c-text-dark);"></i>
                <div class="details">
                    <p>${bill.name}</p>
                    <span>${bill.category} (${bill.frequency})</span>
                </div>
                <span class="due-date">${dueDateText}</span>
                <span class="bill-amount">₹${bill.amount.toLocaleString()}</span>
                <div class="bill-actions">
                    <button class="edit-button" data-id="${bill.id}" title="Edit Bill">
                        <i data-feather="edit-2"></i>
                    </button>
                    <button class="pay-button" data-action="${bill.paid ? 'paid' : 'pay'}" ${bill.paid || !isPayable ? 'disabled' : ''}>
                        ${bill.paid ? 'Paid' : (isPayable ? 'Pay Now' : 'Locked')}
                    </button>
                </div>
            `;
            mainBillList.appendChild(li);
        });

        addBillActionListeners();
        feather.replace();
        if (document.getElementById('dashboard-grid')) {
            renderDashboardMetrics();
        }
    }

    // --- 3. HELPER FUNCTIONS ---
    function addBillActionListeners() {
        // Pay Button Listener (Mark Paid)
        mainBillList.querySelectorAll('.pay-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const billItem = e.target.closest('.bill-item');
                const billId = billItem.dataset.id;
                const paymentLink = billItem.dataset.link;

                if (button.dataset.action === 'pay') {
                    if (paymentLink && paymentLink !== '#') {
                        window.open(paymentLink, '_blank');
                    } else {
                        alert(`Simulating payment for ${billItem.querySelector('p').textContent}. Bill marked as paid.`);
                    }
                    markBillAsPaid(billId);
                }
            });
        });

        // Edit Button Listener
        mainBillList.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const billId = e.currentTarget.dataset.id;
                openEditBillModal(billId);
            });
        });

        // FILTER BAR Listener
        billFilterBar.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                billFilterBar.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');
                activeBillFilter = e.currentTarget.dataset.filter;
                showAllBills = false; // Reset view on filter change
                renderBills();
            });
        });

        // SHOW MORE/LESS Listener
        if (showMoreButton) {
            showMoreButton.addEventListener('click', () => {
                showAllBills = !showAllBills;
                renderBills();
            });
        }
    }

    // Core Automation: Mark as paid and set next date
    function markBillAsPaid(billId) {
        const bill = billState.find(b => b.id === billId);
        if (bill) {
            bill.paid = true;
            bill.overdue = false;

            // Automation: Set next due date if recurring
            if (bill.frequency !== 'one-time') {
                const nextDueDate = calculateNextDueDate(bill.dueDate, bill.frequency);
                const nextBill = {
                    ...bill,
                    id: 'bill' + Date.now(),
                    dueDate: nextDueDate,
                    paid: false,
                    overdue: false,
                };
                billState.push(nextBill);
            }
        }
        renderBills();
    }

    // Deletion Logic (Uses new custom modal)
    function deleteBill(billId) {
        billState = billState.filter(bill => bill.id !== billId);
        renderBills();
        if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';
        if (addBillModal) addBillModal.style.display = 'none';
    }

    // --- 4. MODAL LISTENERS AND EDIT/DELETE LOGIC ---

    function openAddBillModal() {
        if (addBillModal) addBillModal.style.display = 'flex';
        billModalTitle.textContent = "Add New Bill or Subscription";
        billModalActionButton.textContent = "Add Bill";
        billModalActionButton.dataset.mode = "add";
        billIdInput.value = "";
        if (billModalDeleteButton) billModalDeleteButton.style.display = 'none';
        resetModalInputs();
    }

    function openEditBillModal(billId) {
        const bill = billState.find(b => b.id === billId);
        if (!bill) return;

        if (addBillModal) addBillModal.style.display = 'flex';
        billModalTitle.textContent = `Edit: ${bill.name}`;
        billModalActionButton.textContent = "Save Changes";
        billModalActionButton.dataset.mode = "edit";

        if (billModalDeleteButton) billModalDeleteButton.style.display = 'block';
        billToDeleteId = billId;

        // Populate inputs
        billIdInput.value = bill.id;
        billNameInput.value = bill.name;
        billAmountInput.value = bill.amount;
        billDueDateInput.value = bill.dueDate;
        billFrequencySelect.value = bill.frequency;
        billLinkInput.value = bill.paymentLink || "";
    }

    function resetModalInputs() {
        billNameInput.value = '';
        billAmountInput.value = 500;
        billDueDateInput.value = TODAY_DATE;
        billFrequencySelect.value = 'monthly';
        billLinkInput.value = '';
    }

    // Main Modal Action Handler (Add or Edit)
    if (billModalActionButton) {
        billModalActionButton.addEventListener('click', () => {
            const mode = billModalActionButton.dataset.mode;
            const name = billNameInput.value.trim();
            const amount = parseInt(billAmountInput.value);
            const dueDate = billDueDateInput.value;
            const frequency = billFrequencySelect.value;
            const link = billLinkInput.value.trim();
            const id = billIdInput.value;

            if (!name || isNaN(amount) || amount <= 0 || !dueDate) {
                alert('Please enter a valid bill name, amount, and due date.');
                return;
            }

            const { category, icon } = getBillDetails(name);

            if (mode === "add") {
                const newBill = {
                    id: 'bill' + Date.now(),
                    name: name,
                    category: category,
                    amount: amount,
                    dueDate: dueDate,
                    frequency: frequency,
                    icon: icon,
                    paid: false,
                    overdue: calculateDueDays(dueDate) < 0,
                    paymentLink: link
                };
                billState.push(newBill);
            } else if (mode === "edit") {
                const index = billState.findIndex(b => b.id === id);
                if (index !== -1) {
                    billState[index] = {
                        ...billState[index],
                        name: name,
                        amount: amount,
                        dueDate: dueDate,
                        frequency: frequency,
                        paymentLink: link,
                        category: category,
                        icon: icon,
                        overdue: calculateDueDays(dueDate) < 0,
                    };
                }
            }

            renderBills();
            if (addBillModal) addBillModal.style.display = 'none';
        });
    }

    // Dedicated Delete Modal Handler (Opens the styled modal)
    if (billModalDeleteButton) {
        billModalDeleteButton.addEventListener('click', () => {
            const billName = billNameInput.value;
            billToDeleteId = billIdInput.value;

            if (deleteConfirmMessage) deleteConfirmMessage.textContent = `Are you sure you want to delete the bill: "${billName}"? This action cannot be undone.`;
            if (addBillModal) addBillModal.style.display = 'none';
            if (deleteConfirmModal) deleteConfirmModal.style.display = 'flex';
        });
    }

    // Final Delete Confirmation Listener
    if (deleteConfirmButton) {
        deleteConfirmButton.addEventListener('click', () => {
            if (billToDeleteId) {
                deleteBill(billToDeleteId);
                billToDeleteId = null;
            }
        });
    }

    // Cancel Delete Listener (Returns to Edit Modal)
    if (deleteCancelButton) {
        deleteCancelButton.addEventListener('click', () => {
            if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';
            openEditBillModal(billIdInput.value);
        });
    }


    // Modal Display Listeners (Add/Cancel)
    if (addBillButton) addBillButton.addEventListener('click', openAddBillModal);
    if (billModalCancelButton) billModalCancelButton.addEventListener('click', () => {
        if (addBillModal) addBillModal.style.display = 'none';
    });
    if (addBillModal) addBillModal.addEventListener('click', (e) => {
        if (e.target === addBillModal) {
            if (addBillModal) addBillModal.style.display = 'none';
        }
    });

    // --- 5. INITIAL RENDER ---
    renderBills();
}



// Add this mock function globally, or just define it at the top of initializeInsightsPage
// so it can be used below. Since real-world finance is complex, we mock the payment process.
function mockPayBill(billName) {
    if (typeof showFlashMessage === 'function') {
        showFlashMessage(`Simulating payment for ${billName}. Financial health updated.`, 'credit-card');
    }
    // In a production environment, this would call the actual markBillAsPaid() logic
    // and trigger a re-render of the Finance page dashboard KPIs.
}

/**
 * Runs all logic for the Insights Page (insights.html) - REVISED FOR ACTIONABLE REMEDIES
 */
function initializeInsightsPage() {

    // Simple mock function to simulate paying a bill
    function mockPayBill(billName) {
        if (typeof showFlashMessage === 'function') {
            showFlashMessage(`Simulating payment for ${billName}. Financial health updated.`, 'credit-card');
        }
    }

    const insightsRemedyButtons = document.querySelectorAll('.remedy-list .remedy-button');

    insightsRemedyButtons.forEach(button => {
        // Remove old listeners by cloning and replacing the element
        const newButton = button.cloneNode(true);
        button.replaceWith(newButton);

        const remedyItem = newButton.closest('.remedy-item');
        const action = newButton.textContent.trim();
        const status = remedyItem.dataset.status;
        const buttonText = newButton.textContent;

        // Skip if already completed (not strictly needed here but good practice)
        if (remedyItem.classList.contains('completed')) return;


        newButton.addEventListener('click', (e) => {
            e.preventDefault();

            // Check the action type and status
            if (status === 'finance' && buttonText === 'Pay') {
                const billName = remedyItem.querySelector('p').textContent.split(':')[1].split('.')[0].trim();
                mockPayBill(billName);
                newButton.textContent = 'Paid';
                remedyItem.classList.add('completed');

            } else if (status === 'health' && buttonText === 'Plan') {
                // Low Sleep Action
                showFlashMessage("Plan acknowledged. You committed to adjusting your bedtime.", 'moon');
                newButton.textContent = 'Planned';
                remedyItem.classList.add('completed');

            } else if (status === 'task' && buttonText === 'Review') {
                // Late Task Action
                showFlashMessage("Review initiated. Check your tasks for deadline restructuring.", 'alert-circle');
                newButton.textContent = 'Reviewed';
                remedyItem.classList.add('completed');
            }

            newButton.disabled = true;
        });
    });
}

/**
 * Runs all logic for the Settings Page (settings.html) - REVISED FOR FULL CONTROL & AI PROCESSOR DEMO
 */
function initializeSettingsPage() {

    // --- MOCK STATE VARIABLES for Toggles and Data Status ---
    let HAS_MOCK_DATA = true; // True if the user has data, False if the profile is clean/empty.
    let IS_DARK_MODE_MOCK = false;
    let IS_FOCUS_MODE_MOCK = false;
    // IS_SMART_NOTIFICATIONS_MOCK is now global and used here

    // --- 1. Core AI Processor Mock Function ---
    function simulateAIProcessing(input) {
        const output = [];
        const lowerInput = input.toLowerCase();

        // 1. Mood/Stress Logging
        if (lowerInput.includes('stressed') || lowerInput.includes('bad mood')) {
            output.push('Mood Logged: Sad (Stress Index: +10%)');
        } else if (lowerInput.includes('great day') || lowerInput.includes('productive')) {
            output.push('Mood Logged: Happy (Stress Index: -5%)');
        }

        // 2. Task/Schedule Logging
        if (lowerInput.includes('need to finish the project report') || lowerInput.includes('deadline')) {
            output.push('Task Added: "Finalize project report" (Priority: High, Due: Today)');
        }

        // 3. Finance/Activity Logging (Sleep, Water, Payment)
        if (lowerInput.includes('only slept 5 hours')) {
            output.push('Sleep Logged: 5 hours (Flagged: Low Sleep Trend)');
        } else if (lowerInput.includes('paid netflix') || lowerInput.includes('paid electricity')) {
            output.push('Finance Action: Bill marked Paid. Next due date updated.');
        }

        // 4. Creative/Dev Activity Logging (Music/Code)
        if (lowerInput.includes('practice guitar for an hour') || lowerInput.includes('worked on riff')) {
            output.push('Activity Logged: Workout (Type: Guitar, Value: 60 min)');
        }

        if (output.length === 0) {
            output.push('No actionable data detected. Just listening... 👂');
        }
        return output;
    }

    // --- 2. UI Elements & State Update Functions ---
    const toggles = document.querySelectorAll('.toggle-switch');
    const saveProfileButton = document.getElementById('save-profile-button');
    const exportDataButton = document.getElementById('export-data-button');
    const deleteDataButton = document.getElementById('delete-data-button');
    const importDataButton = document.getElementById('import-data-button');
    const importFileInput = document.getElementById('import-file-input');
    const deleteConfirmModal = document.getElementById('delete-data-confirm-modal');
    const deleteDataConfirmButton = document.getElementById('delete-data-confirm-button');
    const deleteDataCancelButton = document.getElementById('delete-data-cancel-button');
    const importControlDiv = document.querySelector('.import-control');


    function updateImportState() {
        if (!importDataButton) return;

        // Apply visual and semantic changes based on mock data status
        if (HAS_MOCK_DATA) {
            // Data exists: Show overwrite warning
            importDataButton.textContent = "Overwrite Data";
            importDataButton.classList.add('warning');
            importDataButton.classList.remove('secondary');
            importControlDiv.title = "Warning: Importing will merge/overwrite existing data. Use 'Delete All' first for a clean start.";
        } else {
            // No data: Allow clean import
            importDataButton.textContent = "Select File";
            importDataButton.classList.remove('warning');
            importDataButton.classList.add('secondary');
            importControlDiv.title = "Ready for a clean data import.";
        }
        feather.replace();
    }

    // --- 3. EVENT LISTENERS ---

    // A. GENERAL TOGGLES - Made Functional
    toggles.forEach(toggle => {
        // Set initial state based on mock global variable
        if (toggle.id === 'toggle-smart-notify') {
            toggle.checked = IS_SMART_NOTIFICATIONS_MOCK;
        }

        toggle.addEventListener('change', (e) => {
            const label = toggle.previousElementSibling.textContent;
            const settingId = e.target.id;
            const isChecked = e.target.checked;

            // Mock State Control & Integration
            if (settingId === 'toggle-dark-mode') {
                IS_DARK_MODE_MOCK = isChecked;
            } else if (settingId === 'toggle-focus') {
                IS_FOCUS_MODE_MOCK = isChecked;
            } else if (settingId === 'toggle-smart-notify') {
                // CRITICAL: Update global state for Dashboard integration
                IS_SMART_NOTIFICATIONS_MOCK = isChecked;
                showFlashMessage(`Smart Notifications are now ${isChecked ? 'Enabled' : 'Disabled'}.`, 'bell');

                // Note: To see the effect on the Dashboard, the user must navigate to it.
            }

            // Feedback
            showFlashMessage(`Setting: "${label}" toggled to: ${isChecked ? 'ON' : 'OFF'}`, 'settings');
        });
    });

    // B. PROFILE ACTIONS
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', () => {
            const newName = document.getElementById('profile-name-input').value;
            showFlashMessage(`Profile updated! Welcome back, ${newName}.`, 'user');
        });
    }

    // C. DATA ACTIONS (Import/Export/Delete)

    // Link button to hidden file input
    if (importDataButton) {
        importDataButton.addEventListener('click', () => {
            importFileInput.click();
        });
    }

    // Handle file selection and mock logic
    if (importFileInput) {
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (HAS_MOCK_DATA) {
                // Scenario 1: Data exists -> Simulate Advanced Overwrite/Merge
                showFlashMessage(`Initiating Advanced Import (${file.name}): Checking for duplicates and merging new records...`, 'alert-circle');
                setTimeout(() => {
                    HAS_MOCK_DATA = true; // Still have data
                    updateImportState();
                    showFlashMessage(`Import Complete: 12 new records imported, 3 duplicates overwritten.`, 'check-circle');
                }, 1500);

            } else {
                // Scenario 2: No data -> Clean Import
                showFlashMessage(`Clean Import (${file.name}) initiated. Loading data...`, 'upload');
                setTimeout(() => {
                    HAS_MOCK_DATA = true; // Now has data
                    updateImportState();
                    showFlashMessage(`Clean Import Successful! 35 total records loaded.`, 'check-circle');
                }, 1500);
            }
            e.target.value = null;
        });
    }


    if (exportDataButton) {
        exportDataButton.addEventListener('click', () => {
            showFlashMessage("Export successful! Your LifeMirror data has been saved to your downloads.", 'download');
        });
    }

    // Delete Flow
    if (deleteDataButton) {
        deleteDataButton.addEventListener('click', () => {
            if (deleteConfirmModal) deleteConfirmModal.style.display = 'flex';
        });
    }

    if (deleteDataCancelButton) {
        deleteDataCancelButton.addEventListener('click', () => {
            if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';
        });
    }

    if (deleteDataConfirmButton) {
        deleteDataConfirmButton.addEventListener('click', () => {
            if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';
            // CRITICAL: Perform the mock data wipe
            HAS_MOCK_DATA = false;
            updateImportState();
            showFlashMessage("Data permanently destroyed. System is clean for new import.", 'trash-2');
        });
    }


    // D. AI PROCESSOR INJECTION
    const placeholderCard = document.getElementById('ai-processor-container');

    if (placeholderCard) {
        placeholderCard.innerHTML = `
            <div style="text-align: left; margin-top: 10px;">
                <label for="ai-input" style="font: var(--font-caption); font-weight: 600; color: var(--c-text-dark);">Chat your Day (Simulated AI)</label>
                <input type="text" id="ai-input" placeholder="e.g., I only slept 5 hours and feel stressed about the deadline." 
                       style="width: 100%; padding: 10px; border-radius: 8px; border: var(--c-border); background: var(--c-bg-card); margin-top: 5px; box-sizing: border-box; font: var(--font-body);">
                <button id="ai-process-button" class="modal-button" style="width: 100%; margin-top: 10px;">Process & Automate</button>
            </div>
            <div id="ai-output" style="text-align: left; padding: 15px; background: #e6f9f7; border-radius: 8px; margin-top: 15px; border-left: 3px solid var(--c-primary); min-height: 50px;">
                <p style="margin: 0; color: var(--c-text-muted);">AI Actions will appear here...</p>
            </div>
        `;

        document.getElementById('ai-process-button').addEventListener('click', () => {
            const input = document.getElementById('ai-input').value;
            const outputDiv = document.getElementById('ai-output');

            if (!input.trim()) {
                outputDiv.innerHTML = `<p style="margin: 0; color: var(--c-accent-red);">Please enter text to simulate processing.</p>`;
                return;
            }

            const results = simulateAIProcessing(input);
            outputDiv.innerHTML = `<h4 style="margin: 0 0 8px 0; font-weight: 700; color: var(--c-primary);">AI Actions:</h4><ul style="margin: 0; padding-left: 20px; list-style-type: none;">
                ${results.map(res => `<li style="font: var(--font-caption); margin-bottom: 4px;">• ${res}</li>`).join('')}
            </ul>`;

            showFlashMessage("AI Processing Complete: Data updated across system.", 'cpu');
        });
    }

    // --- 5. INITIAL RENDER ---
    updateImportState();
    feather.replace();
}


// ===============================================
// 0. MAIN SCRIPT EXECUTION
// ===============================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Global Navigation ---
    const menuItems = document.querySelectorAll('.menu-item');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    menuItems.forEach(item => {
        const page = item.dataset.page;
        if (page === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
        item.addEventListener('click', (event) => {
            event.preventDefault();
            if (page && page !== currentPage) {
                window.location.href = page;
            }
        });
    });

    // --- 2. Global Live Clock ---
    const timeElement = document.getElementById('current-time');
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        if (hours < 10) hours = '0' + hours;
        if (minutes < 10) minutes = '0' + minutes;
        if (timeElement) {
            timeElement.textContent = `${hours}:${minutes}`;
        }
    }
    updateClock();
    setInterval(updateClock, 10000);


    // --- 3. Global Feather Icons ---
    try {
        feather.replace();
    } catch (e) {
        console.error("Feather icons failed to load or replace:", e);
    }

    // --- 4. Global Notification Panel Listener ---
    const bellWrapper = document.querySelector('.global-controls .control-icon-wrapper');

    if (bellWrapper) {
        bellWrapper.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleNotificationPanel();
        });
    }

    // Hide panel if user clicks anywhere else on the page
    document.addEventListener('click', () => {
        const panel = document.getElementById('global-notification-panel');
        if (panel && IS_NOTIFICATION_PANEL_OPEN && panel.classList.contains('active')) {
            toggleNotificationPanel();
        }
    });

    // --- 3. Global Profile Update (NEW) ---
    updateUserProfileUI();

    // --- 5. Page-Specific Logic Router ---
    switch (currentPage) {
        case 'index.html':
            initializeDashboardPage();
            break;
        case 'tasks.html':
            initializeTasksPageLogic();
            break;
        case 'finance.html':
            initializeFinancePage();
            break;
        case 'fitness.html':
            initializeFitnessPage();
            break;
        case 'mood.html':
            initializeMoodPage();
            break;
        case 'vault.html':
            initializeVaultPage();
            break;
        case 'insights.html':
            initializeInsightsPage();
            break;
        case 'settings.html':
            initializeSettingsPage();
            break;
        default:
            console.log("No specific init function for this page:", currentPage);
    }

}); // End of main DOMContentLoaded