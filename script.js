// ===============================================
// GLOBAL VARIABLES & HELPERS
// ===============================================
var calendar = null; // To hold the calendar instance
let sleepCheckInterval = null; // Global to control the hourly sleep notification check

/**
 * Gets today's date in YYYY-MM-DD format
 * @returns {string}
 */
const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startSleepNotificationCheck(fitnessHistory, showFlashMessage) {
    if (sleepCheckInterval) {
        clearInterval(sleepCheckInterval);
    }
    
    const MORNING_START_HOUR = 6;
    const MORNING_END_HOUR = 10;
    const CHECK_INTERVAL_MS = 3600000; // 1 hour

    function checkSleepLog() {
        const now = new Date();
        const currentHour = now.getHours();
        
        // 1. Check if we are in the morning notification window (6 AM to 10 AM)
        if (currentHour >= MORNING_START_HOUR && currentHour < MORNING_END_HOUR) {
            
            // Determine yesterday's date (where last night's log should be)
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayDate = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;
            
            // Check for log *date* matching yesterday's date
            const hasLoggedSleep = fitnessHistory.some(log => log.date === yesterdayDate && log.type === 'sleep');

            if (!hasLoggedSleep) {
                showFlashMessage("⏰ It's morning! Did you log your sleep for last night?", 'moon');
            }
        } else if (currentHour >= MORNING_END_HOUR) {
             // 2. If we passed the notification window (10 AM), stop the hourly check for the day
             clearInterval(sleepCheckInterval);
             sleepCheckInterval = null;
        }
    }

    checkSleepLog();
    sleepCheckInterval = setInterval(checkSleepLog, CHECK_INTERVAL_MS);
}


// ===============================================
// PAGE-SPECIFIC INITIALIZATION FUNCTIONS
// ===============================================

/**
 * Runs all logic for the Dashboard (index.html)
 */
function initializeDashboardPage() {
    const lifeScoreElement = document.getElementById('life-score-number');
    let currentScore = 82; 
    
    function updateLifeScore(points) {
        if (!lifeScoreElement) return; 
        currentScore = Math.max(0, Math.min(100, currentScore + points));
        lifeScoreElement.textContent = currentScore;
        lifeScoreElement.classList.add('pop');
        setTimeout(() => lifeScoreElement.classList.remove('pop'), 300);
    }

    const taskCheckboxes = document.querySelectorAll('#task-list-container input[type="checkbox"]');
    taskCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => { 
            const points = parseInt(checkbox.dataset.points) || 0;
            if (checkbox.checked) {
                updateLifeScore(points);
                checkbox.closest('.task-item').classList.add('completed');
            } else {
                updateLifeScore(-points);
                checkbox.closest('.task-item').classList.remove('completed');
            }
        });
         if (checkbox.checked) {
             checkbox.closest('.task-item').classList.add('completed');
         }
    });
    
    const remedyButtons = document.querySelectorAll('.ai-remedies .remedy-button');
    remedyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const remedyItem = button.closest('.remedy-item');
            button.textContent = 'Done';
            button.disabled = true;
            if (remedyItem) remedyItem.classList.add('completed');
        });
    });
}

/**
 * Runs all logic for the Tasks Page (tasks.html)
 */
function initializeTasksPageLogic() {
    
    // --- 1. STATE MANAGEMENT ---
    let taskState = [
        { id: 'task1', text: 'Finalize project report', priority: 'high', date: '2025-10-26', completed: true },
        { id: 'task2', text: 'Call with team', priority: 'medium', date: '2025-10-26', completed: false },
        { id: 'task3', text: 'Pay electricity bill', priority: 'high', date: '2025-10-28', completed: false },
        { id: 'task4', text: 'Submit CSE Assignment', priority: 'medium', date: '2025-10-27', completed: false },
        { id: 'task5', text: 'Practice guitar', priority: 'low', date: '2025-10-26', completed: false },
        { id: 'task6', text: 'Buy groceries', priority: 'low', date: '2025-10-30', completed: false },
    ];
    
    const mainTaskList = document.getElementById('main-task-list');

    // --- 2. CORE RENDER FUNCTION ---
    function renderTaskList() {
        if (!mainTaskList) return;
        
        taskState.sort((a, b) => {
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;
            return 0;
        });

        mainTaskList.innerHTML = ''; // Clear the list
        if (taskState.length === 0) {
            mainTaskList.innerHTML = '<li class="task-item-empty">No tasks. Add one!</li>';
        }
        
        taskState.forEach(task => {
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
            `;
            mainTaskList.appendChild(li);
        });
        
        mainTaskList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = e.target.closest('.task-item').dataset.id;
                toggleTaskCompleted(taskId);
            });
        });
        
        if (calendar) {
            calendar.refetchEvents();
        }

        feather.replace(); // Re-run feather icons
    }

    function toggleTaskCompleted(taskId) {
        const task = taskState.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
        }
        renderTaskList();
    }

    // --- 3. "ADD TASK" MODAL LOGIC ---
    const addModal = document.getElementById('add-task-modal');
    const addTaskButton = document.querySelector('.add-task-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalAddButton = document.getElementById('modal-add-button');
    const taskTextInput = document.getElementById('task-text-input');
    const taskPrioritySelect = document.getElementById('task-priority-select');
    const taskDateInput = document.getElementById('task-date-input');
    
    if(taskDateInput) {
        taskDateInput.value = getTodayDateString(); 
    }

    function showAddModal() { 
        if(taskDateInput) {
            taskDateInput.value = getTodayDateString(); 
        }
        if (addModal) addModal.style.display = 'flex'; 
    }
    function hideAddModal() {
        if (addModal) addModal.style.display = 'none';
        if(taskTextInput) taskTextInput.value = '';
        if(taskPrioritySelect) taskPrioritySelect.value = 'medium';
    }

    if (addTaskButton) addTaskButton.addEventListener('click', showAddModal);
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
                completed: false
            };
            
            taskState.push(newTask);
            renderTaskList(); 
            hideAddModal();
        });
    }
    
    // --- 4. "DAY TASKS" MODAL LOGIC ---
    const dayTasksModal = document.getElementById('day-tasks-modal');
    const dayTasksTitle = document.getElementById('day-tasks-title');
    const dayTasksList = document.getElementById('day-tasks-list');
    const dayTasksCloseButton = document.getElementById('day-tasks-close-button');

    function showDayTasks(date) {
        const tasksForDay = taskState.filter(task => task.date === date);
        const dateObj = new Date(date + 'T00:00:00');
        if(dayTasksTitle) {
            dayTasksTitle.textContent = `Tasks for ${dateObj.toLocaleString('en-US', { month: 'long', day: 'numeric' })}`;
        }

        if(dayTasksList) {
            dayTasksList.innerHTML = '';
            if (tasksForDay.length === 0) {
                dayTasksList.innerHTML = '<li class="task-item-empty">No tasks scheduled for this day.</li>';
            }
            
            tasksForDay.forEach(task => {
                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''}`;
                li.innerHTML = `
                    <label style="text-decoration: ${task.completed ? 'line-through' : 'none'}; opacity: ${task.completed ? '0.6' : '1'};">
                        ${task.text}
                    </label>
                    <span class="task-tag ${task.priority}">${task.priority}</span>
                `;
                dayTasksList.appendChild(li);
            });
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
    
    // --- 6. SEPARATE CALENDAR INITIALIZATION ---
    tryInitializeCalendar();
    
    
    function tryInitializeCalendar() {
        if (typeof FullCalendar === 'undefined') {
            setTimeout(tryInitializeCalendar, 100); 
            return;
        }
        
        const calendarEl = document.getElementById('calendar');
        if (calendarEl) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                height: '100%',
                headerToolbar: {
                    left: 'prev',
                    center: 'title',
                    right: 'next today'
                },
                events: function(fetchInfo, successCallback, failureCallback) {
                    const calendarEvents = taskState
                        .filter(task => !task.completed) 
                        .map(task => ({
                            title: task.text,
                            start: task.date,
                            className: task.priority 
                        }));
                    successCallback(calendarEvents);
                }
            });
            
            calendar.render();
            calendar.refetchEvents();
        }
    } 
}

/**
 * Runs all logic for the Fitness Page (fitness.html)
 */
function initializeFitnessPage() {
    
    // --- 1. GLOBAL HELPERS ---
    /**
     * Shows a custom flash notification in the app.
     * @param {string} message 
     * @param {string} iconName 
     */
    function showFlashMessage(message, iconName = 'check-circle') {
        const container = document.getElementById('flash-message-container');
        if (!container) return;

        const flash = document.createElement('div');
        flash.className = 'flash-message';
        flash.innerHTML = `<i data-feather="${iconName}"></i> <span>${message}</span>`;
        container.appendChild(flash);
        feather.replace(); // Ensure the icon renders

        // Automatically remove the message after the animation finishes (5 seconds)
        setTimeout(() => {
            if (container.contains(flash)) {
                container.removeChild(flash);
            }
        }, 5000);
    }
    
    // --- 2. STATE MANAGEMENT ---
    const TODAY_DATE = getTodayDateString();
    
    let selectedWaterVolume = 0; // State for the water modal

    let fitnessHistory = [
        // Daily logs (date, steps, calories_out, type, value, unit, time)
        // Last night's sleep log is marked for yesterday (2025-10-25)
        { id: 1, date: '2025-10-25', time: '23:00', type: 'sleep', value: 8, unit: 'hours' }, 
        { id: 2, date: TODAY_DATE, time: '10:00', type: 'steps', value: 3500, unit: 'steps' }, 
        { id: 3, date: TODAY_DATE, time: '14:00', type: 'steps', value: 500, unit: 'steps' },
        { id: 4, date: TODAY_DATE, time: '12:00', type: 'calories_out', value: 300, unit: 'kcal' }, 
        { id: 5, date: TODAY_DATE, time: '17:00', type: 'workout', value: 60, unit: 'min' } 
    ];
    
    let completedSuggestions = []; 

    const kpiSteps = document.getElementById('kpi-steps');
    const kpiCaloriesOut = document.getElementById('kpi-calories-out');
    const kpiWorkouts = document.getElementById('kpi-workouts');
    const kpiWater = document.getElementById('kpi-water'); // KPI ELEMENT for Water
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
        
        // Find the most recent sleep log for the 'Sleep (Last Night)' KPI
        const sleepLog = fitnessHistory.filter(log => log.type === 'sleep')
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || {value: 0}; 
        
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
            // Logic for Workouts This Week (counting entries since a fixed date, simplified here for mock data)
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
                .filter(log => log.date === TODAY_DATE) // Filter to ONLY today
                // MODIFIED: Sort newest to oldest
                .sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));

            dailyLogList.innerHTML = ''; 
            
            if (todayLogs.length === 0) {
                 dailyLogList.style.display = 'none';
                 if(logHistoryEmpty) logHistoryEmpty.style.display = 'block';
            } else {
                 dailyLogList.style.display = 'block';
                 if(logHistoryEmpty) logHistoryEmpty.style.display = 'none';
                 
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
        let label = 'Count';

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
    startSleepNotificationCheck(fitnessHistory, showFlashMessage);


    // --- 7. INITIAL RENDER ---
    renderFitnessPage();
}

/**
 * Runs all logic for the Mood Page (mood.html)
 */
function initializeMoodPage() {
    
    // --- 1. STATE MANAGEMENT ---
    const TODAY_DATE = getTodayDateString();
    const COOLDOWN_DURATION = 3600000; // 1 hour in milliseconds
    
    let moodHistory = [
        // Mock data structure: value is 0 (worst) to 4 (best)
        { date: '2025-10-23', mood: 3, note: 'Had a productive morning.', stress: 30, isFinal: true },
        { date: '2025-10-24', mood: 2, note: 'Normal work day.', stress: 45, isFinal: true },
        { date: '2025-10-25', mood: 1, note: 'Stressed about project deadline.', stress: 70, isFinal: true },
        // Today's entry (will be overwritten by user log or updated by remedies)
        { date: TODAY_DATE, mood: 2, note: 'Daily check-in placeholder.', stress: 45, isFinal: false }, 
    ];
    
    // NEW STATE: Daily log counter and last used timestamps
    let remedyLog = {
        date: TODAY_DATE,
        breakCount: 0,
        readCount: 0,
        lastBreakTime: 0, // NEW: Timestamp of last break
        lastReadTime: 0   // NEW: Timestamp of last read
    };

    // Mood values mapped to labels and score impact
    const moodMap = {
        'awful': { label: 'Awful', value: 0, color: 'var(--c-accent-red)' },
        'sad': { label: 'Sad', value: 1, color: 'var(--c-accent-yellow)' },
        'neutral': { label: 'Neutral', value: 2, color: 'var(--c-accent-yellow)' },
        'happy': { label: 'Happy', value: 3, color: 'var(--c-primary)' },
        'great': { label: 'Great', value: 4, color: 'var(--c-primary)' }
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
        if(remedyList) {
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
                 if(pTag) {
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
        if(neutralSpan) {
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
        if (activeTimer) return; // Don't interfere if a remedy timer is running
        
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // 1. Check if button should be unlocked/locked
        if (!moodHistory.some(entry => entry.date === getTodayDateString() && entry.isFinal)) {
            if (hour > LOG_TIME_HOUR || (hour === LOG_TIME_HOUR && minute >= LOG_TIME_MINUTE) || hour < 1) {
                renderMoodPage(); // Render to update button state (unlock/re-enable)
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
             renderMoodPage(); // Re-render at midnight to reset daily status
        }
    }
    
    // Start the timer to check and enforce the 8:30 PM logic and cooldown status
    setInterval(checkTimeAndRender, 60000); // Check every minute (60,000 ms)
}

/**
 * Runs all logic for the Finance Page (finance.html)
 */
function initializeFinancePage() {
    
    // --- Global State Variables ---
    let activeBillFilter = 'upcoming'; // Default filter
    let showAllBills = false; // Controls show more/less feature
    const MAX_BILLS_TO_SHOW = 3; // Max bills to show in 'upcoming' view
    const EARLY_PAYMENT_WINDOW = 3; // Days before due date to unlock Pay Now button

    // Helper to calculate days difference
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


    // --- 1. MOCK DATA STATE (Source of Truth) ---
    const TODAY_DATE = getTodayDateString();
    
    let billState = [
        // Adjusted due dates for better visualization
        { id: 'bill1', name: 'Netflix Subscription', category: 'Streaming Service', amount: 500, dueDate: '2025-12-27', frequency: 'monthly', icon: 'tv', paid: false, overdue: false, paymentLink: 'https://netflix.com' },
        { id: 'bill2', name: 'Electricity Bill', category: 'Utilities', amount: 2000, dueDate: '2025-10-29', frequency: 'monthly', icon: 'home', paid: false, overdue: false, paymentLink: 'https://paytm.com/electricity' }, // Due in 3 days (Urgent)
        { id: 'bill3', name: 'Mobile Phone Plan', category: 'Telecommunication', amount: 1000, dueDate: '2025-11-20', frequency: 'monthly', icon: 'smartphone', paid: false, overdue: false, paymentLink: 'https://jio.com' },
        { id: 'bill4', name: 'Gym Membership', category: 'Health & Wellness', amount: 1200, dueDate: '2025-10-23', frequency: 'annually', icon: 'heart', paid: false, overdue: true, paymentLink: 'https://gymwebsite.com' }, // Overdue
        { id: 'bill5', name: 'Student Loan', category: 'Debt & Finance', amount: 5000, dueDate: '2025-11-25', frequency: 'monthly', icon: 'dollar-sign', paid: true, overdue: false, paymentLink: 'https://bankwebsite.com' }, 
        { id: 'bill6', name: 'Cloud Storage', category: 'Subscription', amount: 200, dueDate: '2025-10-29', frequency: 'monthly', icon: 'cloud', paid: false, overdue: false, paymentLink: 'https://cloud.com' }, // Due in 3 days (urgent)
        { id: 'bill7', name: 'Amazon Prime', category: 'Streaming Service', amount: 999, dueDate: '2025-12-15', frequency: 'annually', icon: 'package', paid: false, overdue: false, paymentLink: 'https://amazon.com' }, 
    ];

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
        if(deleteConfirmModal) deleteConfirmModal.style.display = 'none';
        if(addBillModal) addBillModal.style.display = 'none'; 
    }
    
    // --- 4. MODAL LISTENERS AND EDIT/DELETE LOGIC ---

    function openAddBillModal() {
        if(addBillModal) addBillModal.style.display = 'flex';
        billModalTitle.textContent = "Add New Bill or Subscription";
        billModalActionButton.textContent = "Add Bill";
        billModalActionButton.dataset.mode = "add";
        billIdInput.value = "";
        if(billModalDeleteButton) billModalDeleteButton.style.display = 'none'; 
        resetModalInputs();
    }

    function openEditBillModal(billId) {
        const bill = billState.find(b => b.id === billId);
        if (!bill) return;

        if(addBillModal) addBillModal.style.display = 'flex';
        billModalTitle.textContent = `Edit: ${bill.name}`;
        billModalActionButton.textContent = "Save Changes";
        billModalActionButton.dataset.mode = "edit";
        
        if(billModalDeleteButton) billModalDeleteButton.style.display = 'block'; 
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
            if(addBillModal) addBillModal.style.display = 'none';
        });
    }
    
    // Dedicated Delete Modal Handler (Opens the styled modal)
    if (billModalDeleteButton) {
        billModalDeleteButton.addEventListener('click', () => {
            const billName = billNameInput.value;
            billToDeleteId = billIdInput.value; 
            
            if(deleteConfirmMessage) deleteConfirmMessage.textContent = `Are you sure you want to delete the bill: "${billName}"? This action cannot be undone.`;
            if(addBillModal) addBillModal.style.display = 'none'; 
            if(deleteConfirmModal) deleteConfirmModal.style.display = 'flex'; 
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
            if(deleteConfirmModal) deleteConfirmModal.style.display = 'none';
            openEditBillModal(billIdInput.value);
        });
    }


    // Modal Display Listeners (Add/Cancel)
    if (addBillButton) addBillButton.addEventListener('click', openAddBillModal);
    if (billModalCancelButton) billModalCancelButton.addEventListener('click', () => {
        if(addBillModal) addBillModal.style.display = 'none';
    });
    if (addBillModal) addBillModal.addEventListener('click', (e) => {
        if (e.target === addBillModal) {
            if(addBillModal) addBillModal.style.display = 'none';
        }
    });

    // --- 5. INITIAL RENDER ---
    renderBills();
}



/**
 * Runs all logic for the Insights Page (insights.html)
 */
function initializeInsightsPage() {
    const insightsRemedyButtons = document.querySelectorAll('.remedy-list .remedy-button');
     insightsRemedyButtons.forEach(button => {
         button.addEventListener('click', () => {
             const remedyItem = button.closest('.remedy-item');
             button.textContent = 'Viewed';
             button.disabled = true;
             if (remedyItem) remedyItem.classList.add('completed');
         });
     });
}

/**
 * Runs all logic for the Settings Page (settings.html)
 */
function initializeSettingsPage() {
    const toggles = document.querySelectorAll('.toggle-switch');
      toggles.forEach(toggle => {
          toggle.addEventListener('change', () => {
               const label = toggle.previousElementSibling.textContent;
               console.log(`Setting "${label}" toggled to: ${toggle.checked}`);
          });
      });
}


// ===============================================
// 0. MAIN SCRIPT EXECUTION
// Runs after the page structure (HTML) is loaded
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


    // --- 4. Page-Specific Logic Router ---
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