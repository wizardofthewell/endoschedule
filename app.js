// Security: HTML sanitization to prevent XSS
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Security: Validate input - only allow safe characters
function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    // Remove any HTML tags and limit to safe characters
    return str.replace(/<[^>]*>/g, '').substring(0, 50);
}

// Default configuration
const defaultConfig = {
    employees: [
        { name: 'Employee 1', initialSlot: 0 },
        { name: 'Employee 2', initialSlot: 1 },
        { name: 'Employee 3', initialSlot: 2 }
    ],
    timeslots: [
        '9:00 AM - 5:00 PM',
        '9:30 AM - 5:30 PM',
        '7:30 AM - 3:30 PM'
    ],
    startWeek: 1
};

// Load config from localStorage or use defaults
function loadConfig() {
    const saved = localStorage.getItem('endoScheduleConfig');
    if (saved) {
        const config = JSON.parse(saved);
        // Migrate old format (array of strings) to new format (array of objects)
        if (config.employees && config.employees.length > 0 && typeof config.employees[0] === 'string') {
            config.employees = config.employees.map((name, index) => ({
                name: name,
                initialSlot: index % (config.timeslots?.length || 1)
            }));
            saveConfig(config);
        }
        return config;
    }
    return JSON.parse(JSON.stringify(defaultConfig));
}

// Save config to localStorage
function saveConfig(config) {
    localStorage.setItem('endoScheduleConfig', JSON.stringify(config));
}

// Get current config
let config = loadConfig();

// DOM Elements
const yearSelect = document.getElementById('yearSelect');
const weekFilter = document.getElementById('weekFilter');
const configBtn = document.getElementById('configBtn');
const configModal = document.getElementById('configModal');
const closeModal = document.querySelector('.close');
const employeeList = document.getElementById('employeeList');
const timeslotList = document.getElementById('timeslotList');
const newEmployeeInput = document.getElementById('newEmployee');
const addEmployeeBtn = document.getElementById('addEmployee');
const newTimeslotInput = document.getElementById('newTimeslot');
const addTimeslotBtn = document.getElementById('addTimeslot');
const startWeekInput = document.getElementById('startWeek');
const saveConfigBtn = document.getElementById('saveConfig');
const scheduleContainer = document.getElementById('scheduleContainer');
const currentWeekBanner = document.getElementById('currentWeekBanner');

// Initialize year selector
function initYearSelector() {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
}

// Get week number from date
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get date range for a week number in a year
function getWeekDates(year, weekNum) {
    const jan1 = new Date(year, 0, 1);
    const daysToFirstMonday = (8 - jan1.getDay()) % 7;
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    
    // If Jan 1 is Mon-Thu, week 1 starts that week
    if (jan1.getDay() >= 1 && jan1.getDay() <= 4) {
        firstMonday.setDate(jan1.getDate() - (jan1.getDay() - 1));
    }
    
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return {
        start: weekStart,
        end: weekEnd
    };
}

// Format date
function formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Generate schedule for a year
function generateSchedule(year) {
    const schedule = [];
    const numEmployees = config.employees.length;
    const numTimeslots = config.timeslots.length;
    
    if (numEmployees === 0 || numTimeslots === 0) {
        return schedule;
    }
    
    // Generate 52 weeks
    for (let week = 1; week <= 52; week++) {
        const weekSchedule = {
            week: week,
            dates: getWeekDates(year, week),
            assignments: []
        };
        
        // Calculate rotation offset based on week number and start week
        const rotationWeek = week - config.startWeek;
        
        // Assign each employee to a timeslot
        for (let i = 0; i < numEmployees; i++) {
            const employee = config.employees[i];
            // Start from their initial slot and rotate from there
            const initialSlot = employee.initialSlot || 0;
            const timeslotIndex = ((initialSlot + rotationWeek) % numTimeslots + numTimeslots) % numTimeslots;
            
            weekSchedule.assignments.push({
                employee: employee.name,
                timeslot: config.timeslots[timeslotIndex]
            });
        }
        
        schedule.push(weekSchedule);
    }
    
    return schedule;
}

// Render schedule
function renderSchedule() {
    const year = parseInt(yearSelect.value);
    const schedule = generateSchedule(year);
    const filterWeek = weekFilter.value;
    
    // Get current week
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();
    
    // Update current week banner
    if (currentYear === year) {
        const currentWeekData = schedule.find(w => w.week === currentWeek);
        if (currentWeekData) {
            const currentAssignments = currentWeekData.assignments
                .map(a => `<strong>${sanitizeHTML(a.employee)}</strong>: ${sanitizeHTML(a.timeslot)}`)
                .join(' | ');
            currentWeekBanner.innerHTML = `📅 Current Week (${currentWeek}): ${currentAssignments}`;
            currentWeekBanner.style.display = 'block';
        }
    } else {
        currentWeekBanner.style.display = 'none';
    }
    
    // Filter schedule if needed
    const filteredSchedule = filterWeek 
        ? schedule.filter(w => w.week === parseInt(filterWeek))
        : schedule;
    
    // Render cards
    scheduleContainer.innerHTML = filteredSchedule.map(weekData => {
        const isCurrentWeek = currentYear === year && weekData.week === currentWeek;
        const dateRange = `${formatDate(weekData.dates.start)} - ${formatDate(weekData.dates.end)}`;
        
        const assignments = weekData.assignments.map(a => `
            <div class="schedule-row">
                <span class="employee-name">${sanitizeHTML(a.employee)}</span>
                <span class="time-slot">${sanitizeHTML(a.timeslot)}</span>
            </div>
        `).join('');
        
        return `
            <div class="week-card ${isCurrentWeek ? 'current-week' : ''}" id="week-${weekData.week}">
                <div class="week-header">
                    <span class="week-number">Week ${weekData.week}</span>
                    <span class="week-dates">${dateRange}</span>
                </div>
                ${assignments}
            </div>
        `;
    }).join('');
    
    // Update week filter options
    updateWeekFilter(schedule);
    
    // Scroll to current week if viewing current year and no filter
    if (currentYear === year && !filterWeek) {
        setTimeout(() => {
            const currentWeekCard = document.getElementById(`week-${currentWeek}`);
            if (currentWeekCard) {
                currentWeekCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
}

// Update week filter dropdown
function updateWeekFilter(schedule) {
    const currentValue = weekFilter.value;
    weekFilter.innerHTML = '<option value="">All Weeks</option>';
    
    schedule.forEach(weekData => {
        const dateRange = `${formatDate(weekData.dates.start)} - ${formatDate(weekData.dates.end)}`;
        const option = document.createElement('option');
        option.value = weekData.week;
        option.textContent = `Week ${weekData.week} (${dateRange})`;
        weekFilter.appendChild(option);
    });
    
    weekFilter.value = currentValue;
}

// Render config lists
function renderConfigLists() {
    // Render timeslots first (sanitized)
    timeslotList.innerHTML = config.timeslots.map((slot, index) => `
        <div class="config-item">
            <span>${sanitizeHTML(slot)}</span>
            <button class="btn btn-danger" onclick="removeTimeslot(${index})">Remove</button>
        </div>
    `).join('');
    
    // Render employees with initial slot dropdown (sanitized)
    employeeList.innerHTML = config.employees.map((emp, index) => {
        const slotOptions = config.timeslots.length > 0 
            ? config.timeslots.map((slot, slotIndex) => 
                `<option value="${slotIndex}" ${emp.initialSlot === slotIndex ? 'selected' : ''}>${sanitizeHTML(slot)}</option>`
              ).join('')
            : '<option value="0">Add time slots first</option>';
        
        return `
            <div class="config-item employee-config">
                <span class="employee-name-config">${sanitizeHTML(emp.name)}</span>
                <div class="employee-controls">
                    <label class="slot-label">Week 1 Shift:</label>
                    <select class="initial-slot-select" onchange="updateInitialSlot(${index}, this.value)" ${config.timeslots.length === 0 ? 'disabled' : ''}>
                        ${slotOptions}
                    </select>
                    <button class="btn btn-danger" onclick="removeEmployee(${index})">Remove</button>
                </div>
            </div>
        `;
    }).join('');
    
    if (config.employees.length === 0) {
        employeeList.innerHTML = '<p class="help-text">No employees added yet. Add employees to assign their starting shifts.</p>';
    }
    
    if (config.timeslots.length === 0) {
        timeslotList.innerHTML = '<p class="help-text">No time slots added yet. Add time slots first!</p>';
    }
    
    // Set start week
    startWeekInput.value = config.startWeek;
}

// Add employee
function addEmployee() {
    const name = sanitizeInput(newEmployeeInput.value.trim());
    if (name && !config.employees.some(e => e.name === name)) {
        // Default to next available slot, or 0 if none available
        const usedSlots = config.employees.map(e => e.initialSlot);
        let initialSlot = 0;
        for (let i = 0; i < config.timeslots.length; i++) {
            if (!usedSlots.includes(i)) {
                initialSlot = i;
                break;
            }
        }
        config.employees.push({ name: name, initialSlot: initialSlot });
        newEmployeeInput.value = '';
        renderConfigLists();
    }
}

// Remove employee
window.removeEmployee = function(index) {
    config.employees.splice(index, 1);
    renderConfigLists();
};

// Update initial slot assignment
window.updateInitialSlot = function(employeeIndex, slotIndex) {
    config.employees[employeeIndex].initialSlot = parseInt(slotIndex);
};

// Add timeslot
function addTimeslot() {
    const slot = sanitizeInput(newTimeslotInput.value.trim());
    if (slot && !config.timeslots.includes(slot)) {
        config.timeslots.push(slot);
        newTimeslotInput.value = '';
        renderConfigLists();
    }
}

// Remove timeslot
window.removeTimeslot = function(index) {
    config.timeslots.splice(index, 1);
    renderConfigLists();
};

// Save configuration
function handleSaveConfig() {
    config.startWeek = parseInt(startWeekInput.value) || 1;
    saveConfig(config);
    configModal.style.display = 'none';
    renderSchedule();
}

// Event Listeners
yearSelect.addEventListener('change', renderSchedule);
weekFilter.addEventListener('change', renderSchedule);

configBtn.addEventListener('click', () => {
    renderConfigLists();
    configModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    configModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === configModal) {
        configModal.style.display = 'none';
    }
});

addEmployeeBtn.addEventListener('click', addEmployee);
newEmployeeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addEmployee();
});

addTimeslotBtn.addEventListener('click', addTimeslot);
newTimeslotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTimeslot();
});

saveConfigBtn.addEventListener('click', handleSaveConfig);

// Reset to defaults
document.getElementById('resetConfig').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults? This will clear your custom employees and time slots.')) {
        config = JSON.parse(JSON.stringify(defaultConfig));
        saveConfig(config);
        renderConfigLists();
    }
});

// Clear all data
document.getElementById('clearData').addEventListener('click', () => {
    if (confirm('Clear ALL stored data? This cannot be undone.')) {
        localStorage.removeItem('endoScheduleConfig');
        config = JSON.parse(JSON.stringify(defaultConfig));
        renderConfigLists();
        configModal.style.display = 'none';
        renderSchedule();
    }
});

// Initialize
initYearSelector();
renderSchedule();
