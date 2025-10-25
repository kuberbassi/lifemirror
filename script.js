// Wait for the entire page to load before running scripts
document.addEventListener('DOMContentLoaded', () => {

    // ===============================================
    // 1. FUNCTIONAL NAVIGATION
    // ===============================================
    const menuItems = document.querySelectorAll('.menu-item');
    
    // Get the name of the current file (e.g., "index.html")
    const currentPage = window.location.pathname.split('/').pop();

    menuItems.forEach(item => {
        const page = item.dataset.page;

        // Set the 'active' class
        if (page === currentPage) {
            item.classList.add('active');
        }

        // Add click event to navigate
        item.addEventListener('click', () => {
            if (page) {
                window.location.href = page; // Navigate to the new page
            } else {
                console.log('Clicked: ' + item.title); // For non-page buttons
            }
        });
    });

    // ===============================================
    // 2. LIVE CLOCK
    // ===============================================
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
    
    
    // ===============================================
    // 3. ACTIVATE FEATHER ICONS
    // ===============================================
    feather.replace();


    // ===============================================
    // 4. PROTOTYPE FUNCTIONALITY (FOR DASHBOARD)
    // ===============================================

    // --- Remedy Button Clicks ---
    const remedyButtons = document.querySelectorAll('.remedy-button');
    remedyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const remedyItem = button.closest('.remedy-item');
            button.textContent = 'Done!';
            button.disabled = true;
            if (remedyItem) remedyItem.style.opacity = '0.5';
        });
    });


    // --- Life Score Simulation ---
    const lifeScoreElement = document.getElementById('life-score-number');
    let currentScore = 82; 
    
    function updateLifeScore(points) {
        if (!lifeScoreElement) return; // Only run on dashboard
        currentScore = currentScore + points;
        lifeScoreElement.textContent = currentScore;
        lifeScoreElement.classList.add('pop');
        setTimeout(() => {
            lifeScoreElement.classList.remove('pop');
        }, 300);
    }

    // --- Task Checkbox Logic ---
    const taskCheckboxes = document.querySelectorAll('.task-list input[type="checkbox"]');
    taskCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('click', () => {
            // Check if it's the dashboard task list (which has data-points)
            const points = parseInt(checkbox.dataset.points);
            if (points) {
                if (checkbox.checked) {
                    updateLifeScore(points);
                } else {
                    updateLifeScore(-points);
                }
            }
        });
    });

}); // End of main script