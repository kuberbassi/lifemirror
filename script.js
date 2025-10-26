// ===============================================
// GLOBAL VARIABLES & HELPERS
// ===============================================
var calendar = null; // To hold the calendar instance

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
                },
                dateClick: function(info) {
                    showDayTasks(info.dateStr); 
                }
            });
            
            calendar.render();
            calendar.refetchEvents();
        }
    } 
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
        
        // Add dynamic header summary (replacing placeholder text)
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