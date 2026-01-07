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
        { time: '7:30 AM - 3:30 PM', note: '' },
        { time: '9:00 AM - 5:00 PM', note: '' },
        { time: '9:30 AM - 5:30 PM', note: '' }
    ],
    startWeek: 1,
    onCallOrder: [0, 1, 2],  // Order of employee indices for on-call rotation
    onCallStartIndex: 0      // Who is on-call during week 1 (index into onCallOrder)
};

// Helper to get timeslot display text
function getTimeslotText(slot) {
    if (!slot) return '';
    if (typeof slot === 'string') return slot;
    if (typeof slot === 'object' && slot.time) return slot.time;
    return String(slot);
}

// Helper to get timeslot note
function getTimeslotNote(slot) {
    if (!slot || typeof slot === 'string') return '';
    return slot.note || '';
}

// Load config from localStorage or use defaults
function loadConfig() {
    const saved = localStorage.getItem('endoScheduleConfig');
    if (saved) {
        let config = JSON.parse(saved);
        let needsSave = false;
        
        // Migrate old format (array of strings) to new format (array of objects)
        if (config.employees && config.employees.length > 0 && typeof config.employees[0] === 'string') {
            config.employees = config.employees.map((name, index) => ({
                name: name,
                initialSlot: index % (config.timeslots?.length || 1)
            }));
            needsSave = true;
        }
        
        // Migrate timeslots from strings to objects with notes
        if (config.timeslots && config.timeslots.length > 0 && typeof config.timeslots[0] === 'string') {
            config.timeslots = config.timeslots.map(time => ({
                time: time,
                note: ''
            }));
            needsSave = true;
        }
        
        // Ensure all timeslots are objects (in case of partial migration)
        if (config.timeslots) {
            config.timeslots = config.timeslots.map(slot => {
                if (typeof slot === 'string') {
                    needsSave = true;
                    return { time: slot, note: '' };
                }
                return slot;
            });
        }
        
        // Migrate: add on-call settings if missing
        if (!config.onCallOrder) {
            config.onCallOrder = config.employees.map((_, i) => i);
            config.onCallStartIndex = 0;
            needsSave = true;
        }
        
        if (needsSave) {
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
const closeModal = document.querySelector('#configModal .close');
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

// Tutorial modal elements
const tutorialBtn = document.getElementById('tutorialBtn');
const tutorialModal = document.getElementById('tutorialModal');
const closeTutorial = document.getElementById('closeTutorial');
const closeTutorialBtn = document.getElementById('closeTutorialBtn');

// Setup wizard elements
const setupWizardModal = document.getElementById('setupWizardModal');
let wizardTimeslots = [];
let wizardEmployees = [];

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
            assignments: [],
            onCall: null
        };
        
        // Calculate rotation offset based on week number and start week
        const rotationWeek = week - config.startWeek;
        
        // Assign each employee to a timeslot
        for (let i = 0; i < numEmployees; i++) {
            const employee = config.employees[i];
            // Start from their initial slot and rotate from there
            const initialSlot = employee.initialSlot || 0;
            const timeslotIndex = ((initialSlot + rotationWeek) % numTimeslots + numTimeslots) % numTimeslots;
            const slot = config.timeslots[timeslotIndex];
            
            weekSchedule.assignments.push({
                employee: employee.name,
                timeslot: getTimeslotText(slot),
                note: getTimeslotNote(slot)
            });
        }
        
        // Calculate on-call person for this week
        if (config.onCallOrder && config.onCallOrder.length > 0) {
            const onCallRotation = ((rotationWeek % config.onCallOrder.length) + config.onCallOrder.length) % config.onCallOrder.length;
            const onCallIndex = (config.onCallStartIndex + onCallRotation) % config.onCallOrder.length;
            const employeeIndex = config.onCallOrder[onCallIndex];
            if (employeeIndex < numEmployees) {
                weekSchedule.onCall = config.employees[employeeIndex].name;
            }
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
            const onCallInfo = currentWeekData.onCall ? ` | 📞 On-Call: <strong>${sanitizeHTML(currentWeekData.onCall)}</strong>` : '';
            currentWeekBanner.innerHTML = `📅 Current Week (${currentWeek}): ${currentAssignments}${onCallInfo}`;
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
        
        const assignments = weekData.assignments.map(a => {
            const noteIcon = a.note ? `<span class="slot-note" title="${sanitizeHTML(a.note)}">📝</span>` : '';
            return `
                <div class="schedule-row ${a.note ? 'has-note' : ''}">
                    <span class="employee-name">${sanitizeHTML(a.employee)}</span>
                    <span class="time-slot">${sanitizeHTML(a.timeslot)}${noteIcon}</span>
                    ${a.note ? `<span class="note-text">${sanitizeHTML(a.note)}</span>` : ''}
                </div>
            `;
        }).join('');
        
        const onCallBadge = weekData.onCall ? `<div class="on-call-badge">📞 On-Call: ${sanitizeHTML(weekData.onCall)}</div>` : '';
        
        return `
            <div class="week-card ${isCurrentWeek ? 'current-week' : ''}" id="week-${weekData.week}">
                <div class="week-header">
                    <span class="week-number">Week ${weekData.week}</span>
                    <span class="week-dates">${dateRange}</span>
                </div>
                ${onCallBadge}
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
    // Render timeslots with notes (sanitized)
    timeslotList.innerHTML = config.timeslots.map((slot, index) => {
        const timeText = getTimeslotText(slot);
        const noteText = getTimeslotNote(slot);
        return `
            <div class="config-item timeslot-config">
                <div class="timeslot-info">
                    <span class="timeslot-time">${sanitizeHTML(timeText)}</span>
                    <div class="timeslot-note-row">
                        <input type="text" class="timeslot-note-input" id="slot-note-${index}" 
                               value="${sanitizeHTML(noteText)}" placeholder="Add note (e.g., Weekend on-call)" 
                               maxlength="50" onchange="updateTimeslotNote(${index}, this.value)">
                    </div>
                </div>
                <button class="btn btn-danger" onclick="removeTimeslot(${index})">Remove</button>
            </div>
        `;
    }).join('');
    
    // Render employees with initial slot dropdown (sanitized)
    employeeList.innerHTML = config.employees.map((emp, index) => {
        const slotOptions = config.timeslots.length > 0 
            ? config.timeslots.map((slot, slotIndex) => 
                `<option value="${slotIndex}" ${emp.initialSlot === slotIndex ? 'selected' : ''}>${sanitizeHTML(getTimeslotText(slot))}</option>`
              ).join('')
            : '<option value="0">Add time slots first</option>';
        
        return `
            <div class="config-item employee-config" id="employee-row-${index}">
                <div class="employee-name-section">
                    <span class="employee-name-config" id="emp-name-${index}">${sanitizeHTML(emp.name)}</span>
                    <input type="text" class="employee-name-input" id="emp-input-${index}" value="${sanitizeHTML(emp.name)}" maxlength="50" style="display:none;">
                    <button class="btn btn-edit" id="emp-edit-btn-${index}" onclick="editEmployeeName(${index})" title="Edit name">✏️</button>
                    <button class="btn btn-save" id="emp-save-btn-${index}" onclick="saveEmployeeName(${index})" style="display:none;" title="Save">✓</button>
                    <button class="btn btn-cancel" id="emp-cancel-btn-${index}" onclick="cancelEditEmployee(${index})" style="display:none;" title="Cancel">✕</button>
                </div>
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
    
    // Render on-call configuration
    renderOnCallConfig();
}

// Render on-call configuration
function renderOnCallConfig() {
    const onCallStartSelect = document.getElementById('onCallStart');
    const onCallOrderList = document.getElementById('onCallOrderList');
    
    // Populate on-call start dropdown
    if (config.employees.length > 0) {
        onCallStartSelect.innerHTML = config.employees.map((emp, index) => 
            `<option value="${index}" ${config.onCallStartIndex === index ? 'selected' : ''}>${sanitizeHTML(emp.name)}</option>`
        ).join('');
        
        // Ensure onCallOrder is valid
        if (!config.onCallOrder || config.onCallOrder.length !== config.employees.length) {
            config.onCallOrder = config.employees.map((_, i) => i);
        }
        
        // Render draggable on-call order list
        onCallOrderList.innerHTML = config.onCallOrder.map((empIndex, order) => {
            const emp = config.employees[empIndex];
            if (!emp) return '';
            return `
                <div class="on-call-order-item" draggable="true" data-index="${order}">
                    <span class="drag-handle">☰</span>
                    <span class="order-number">${order + 1}</span>
                    <span class="employee-name">${sanitizeHTML(emp.name)}</span>
                </div>
            `;
        }).join('');
        
        // Add drag and drop handlers
        setupOnCallDragDrop();
    } else {
        onCallStartSelect.innerHTML = '<option value="">Add employees first</option>';
        onCallOrderList.innerHTML = '<p class="help-text">Add employees to configure on-call rotation.</p>';
    }
}

// Setup drag and drop for on-call order
function setupOnCallDragDrop() {
    const list = document.getElementById('onCallOrderList');
    const items = list.querySelectorAll('.on-call-order-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', item.dataset.index);
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = parseInt(item.dataset.index);
            
            if (fromIndex !== toIndex) {
                // Reorder the array
                const [moved] = config.onCallOrder.splice(fromIndex, 1);
                config.onCallOrder.splice(toIndex, 0, moved);
                renderOnCallConfig();
            }
        });
    });
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

// Edit employee name - show input field
window.editEmployeeName = function(index) {
    document.getElementById(`emp-name-${index}`).style.display = 'none';
    document.getElementById(`emp-edit-btn-${index}`).style.display = 'none';
    document.getElementById(`emp-input-${index}`).style.display = 'inline-block';
    document.getElementById(`emp-save-btn-${index}`).style.display = 'inline-block';
    document.getElementById(`emp-cancel-btn-${index}`).style.display = 'inline-block';
    document.getElementById(`emp-input-${index}`).focus();
    document.getElementById(`emp-input-${index}`).select();
};

// Save edited employee name
window.saveEmployeeName = function(index) {
    const input = document.getElementById(`emp-input-${index}`);
    const newName = sanitizeInput(input.value.trim());
    
    if (!newName) {
        alert('Employee name cannot be empty.');
        return;
    }
    
    // Check for duplicate names (excluding current employee)
    const isDuplicate = config.employees.some((e, i) => i !== index && e.name === newName);
    if (isDuplicate) {
        alert('An employee with this name already exists.');
        return;
    }
    
    config.employees[index].name = newName;
    renderConfigLists();
};

// Cancel editing employee name
window.cancelEditEmployee = function(index) {
    document.getElementById(`emp-input-${index}`).value = config.employees[index].name;
    document.getElementById(`emp-name-${index}`).style.display = 'inline';
    document.getElementById(`emp-edit-btn-${index}`).style.display = 'inline-block';
    document.getElementById(`emp-input-${index}`).style.display = 'none';
    document.getElementById(`emp-save-btn-${index}`).style.display = 'none';
    document.getElementById(`emp-cancel-btn-${index}`).style.display = 'none';
};

// Update initial slot assignment
window.updateInitialSlot = function(employeeIndex, slotIndex) {
    config.employees[employeeIndex].initialSlot = parseInt(slotIndex);
};

// Update timeslot note
window.updateTimeslotNote = function(index, note) {
    if (config.timeslots[index]) {
        if (typeof config.timeslots[index] === 'string') {
            config.timeslots[index] = { time: config.timeslots[index], note: sanitizeInput(note) };
        } else {
            config.timeslots[index].note = sanitizeInput(note);
        }
    }
};

// Add timeslot
function addTimeslot() {
    const time = sanitizeInput(newTimeslotInput.value.trim());
    if (time && !config.timeslots.some(s => getTimeslotText(s) === time)) {
        config.timeslots.push({ time: time, note: '' });
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
    
    // Save on-call start
    const onCallStartSelect = document.getElementById('onCallStart');
    config.onCallStartIndex = parseInt(onCallStartSelect.value) || 0;
    
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
    if (e.target === tutorialModal) {
        tutorialModal.style.display = 'none';
    }
});

// Tutorial modal event listeners
tutorialBtn.addEventListener('click', () => {
    tutorialModal.style.display = 'block';
});

closeTutorial.addEventListener('click', () => {
    tutorialModal.style.display = 'none';
});

closeTutorialBtn.addEventListener('click', () => {
    tutorialModal.style.display = 'none';
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
    if (confirm('Clear ALL stored data? This cannot be undone. The setup wizard will appear again.')) {
        localStorage.removeItem('endoScheduleConfig');
        localStorage.removeItem('endoScheduleSetupComplete');
        localStorage.removeItem('endoScheduleTutorialSeen');
        config = JSON.parse(JSON.stringify(defaultConfig));
        renderConfigLists();
        configModal.style.display = 'none';
        
        // Show setup wizard again
        wizardTimeslots = ['7:30 AM - 3:30 PM', '9:00 AM - 5:00 PM', '9:30 AM - 5:30 PM'];
        wizardEmployees = [];
        renderWizardTimeslots();
        renderWizardEmployees();
        document.getElementById('wizardStep1').classList.add('active');
        document.getElementById('wizardStep2').classList.remove('active');
        document.getElementById('wizardStep3').classList.remove('active');
        document.getElementById('wizardStep4').classList.remove('active');
        setupWizardModal.style.display = 'block';
    }
});

// Initialize
initYearSelector();
renderSchedule();

// Show setup wizard on first visit (only if no employees configured)
const hasExistingConfig = config.employees && config.employees.length > 0 && 
    config.employees.some(e => e.name !== 'Employee 1' && e.name !== 'Employee 2' && e.name !== 'Employee 3');

if (!localStorage.getItem('endoScheduleSetupComplete') && !hasExistingConfig) {
    // Start with 3 default time slots
    wizardTimeslots = ['7:30 AM - 3:30 PM', '9:00 AM - 5:00 PM', '9:30 AM - 5:30 PM'];
    wizardEmployees = [];
    renderWizardTimeslots();
    renderWizardEmployees();
    setupWizardModal.style.display = 'block';
} else {
    // Mark setup as complete if user already has config
    if (!localStorage.getItem('endoScheduleSetupComplete')) {
        localStorage.setItem('endoScheduleSetupComplete', 'true');
    }
    if (!localStorage.getItem('endoScheduleTutorialSeen')) {
        tutorialModal.style.display = 'block';
        localStorage.setItem('endoScheduleTutorialSeen', 'true');
    }
}

// Setup Wizard Functions
function renderWizardTimeslots() {
    const list = document.getElementById('wizardTimeslotList');
    if (wizardTimeslots.length === 0) {
        list.innerHTML = '<p style="color: #999; text-align: center; padding: 10px;">No time slots added yet</p>';
    } else {
        list.innerHTML = wizardTimeslots.map((slot, index) => `
            <div class="wizard-item">
                <span>${sanitizeHTML(slot)}</span>
                <button class="btn btn-danger" onclick="removeWizardTimeslot(${index})">Remove</button>
            </div>
        `).join('');
    }
}

function renderWizardEmployees() {
    const list = document.getElementById('wizardEmployeeList');
    const maxEmployees = wizardTimeslots.length;
    const atLimit = wizardEmployees.length >= maxEmployees;
    
    // Update the add button state
    const addBtn = document.getElementById('wizardAddEmployee');
    const addInput = document.getElementById('wizardNewEmployee');
    if (addBtn && addInput) {
        if (atLimit) {
            addBtn.disabled = true;
            addBtn.title = `Maximum ${maxEmployees} employees (one per time slot)`;
            addInput.disabled = true;
            addInput.placeholder = `Max ${maxEmployees} employees reached`;
        } else {
            addBtn.disabled = false;
            addBtn.title = '';
            addInput.disabled = false;
            addInput.placeholder = 'Employee name';
        }
    }
    
    if (wizardEmployees.length === 0) {
        list.innerHTML = `<p style="color: #999; text-align: center; padding: 10px;">No employees added yet (add up to ${maxEmployees})</p>`;
    } else {
        list.innerHTML = wizardEmployees.map((emp, index) => `
            <div class="wizard-item">
                <span>${sanitizeHTML(emp)}</span>
                <button class="btn btn-danger" onclick="removeWizardEmployee(${index})">Remove</button>
            </div>
        `).join('');
        
        if (atLimit) {
            list.innerHTML += `<p style="color: #11998e; text-align: center; padding: 8px; font-weight: 500;">✓ ${maxEmployees} employees added (matches time slots)</p>`;
        } else {
            list.innerHTML += `<p style="color: #666; text-align: center; padding: 5px; font-size: 0.9rem;">${wizardEmployees.length} of ${maxEmployees} employees added</p>`;
        }
    }
}

function renderWizardAssignments() {
    const list = document.getElementById('wizardAssignmentList');
    if (wizardEmployees.length === 0 || wizardTimeslots.length === 0) {
        list.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Add employees and time slots first</p>';
        return;
    }
    
    list.innerHTML = wizardEmployees.map((emp, index) => {
        const defaultSlot = index % wizardTimeslots.length;
        const options = wizardTimeslots.map((slot, slotIndex) => 
            `<option value="${slotIndex}" ${slotIndex === defaultSlot ? 'selected' : ''}>${sanitizeHTML(slot)}</option>`
        ).join('');
        
        return `
            <div class="wizard-assignment-row">
                <span class="employee-name">${sanitizeHTML(emp)}</span>
                <select id="wizardAssign-${index}">
                    ${options}
                </select>
            </div>
        `;
    }).join('');
}

window.removeWizardTimeslot = function(index) {
    wizardTimeslots.splice(index, 1);
    renderWizardTimeslots();
};

window.removeWizardEmployee = function(index) {
    wizardEmployees.splice(index, 1);
    renderWizardEmployees();
};

// Wizard navigation
document.getElementById('wizardAddTimeslot').addEventListener('click', () => {
    const input = document.getElementById('wizardNewTimeslot');
    const slot = sanitizeInput(input.value.trim());
    if (slot && !wizardTimeslots.includes(slot)) {
        wizardTimeslots.push(slot);
        input.value = '';
        renderWizardTimeslots();
    }
});

document.getElementById('wizardNewTimeslot').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('wizardAddTimeslot').click();
    }
});

document.getElementById('wizardAddEmployee').addEventListener('click', () => {
    const input = document.getElementById('wizardNewEmployee');
    const name = sanitizeInput(input.value.trim());
    
    // Check limit
    if (wizardEmployees.length >= wizardTimeslots.length) {
        alert(`Maximum ${wizardTimeslots.length} employees allowed (one per time slot). Remove a time slot or employee if needed.`);
        return;
    }
    
    if (name && !wizardEmployees.includes(name)) {
        wizardEmployees.push(name);
        input.value = '';
        renderWizardEmployees();
    }
});

document.getElementById('wizardNewEmployee').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('wizardAddEmployee').click();
    }
});

document.getElementById('wizardNext1').addEventListener('click', () => {
    if (wizardTimeslots.length === 0) {
        alert('Please add at least one time slot before continuing.');
        return;
    }
    // Re-render employees to update the limit
    renderWizardEmployees();
    document.getElementById('wizardStep1').classList.remove('active');
    document.getElementById('wizardStep2').classList.add('active');
});

document.getElementById('wizardBack2').addEventListener('click', () => {
    document.getElementById('wizardStep2').classList.remove('active');
    document.getElementById('wizardStep1').classList.add('active');
});

document.getElementById('wizardNext2').addEventListener('click', () => {
    if (wizardEmployees.length === 0) {
        alert('Please add at least one employee before continuing.');
        return;
    }
    if (wizardEmployees.length !== wizardTimeslots.length) {
        if (!confirm(`You have ${wizardEmployees.length} employees but ${wizardTimeslots.length} time slots. It's recommended to have the same number. Continue anyway?`)) {
            return;
        }
    }
    renderWizardAssignments();
    document.getElementById('wizardStep2').classList.remove('active');
    document.getElementById('wizardStep3').classList.add('active');
});

document.getElementById('wizardBack3').addEventListener('click', () => {
    document.getElementById('wizardStep3').classList.remove('active');
    document.getElementById('wizardStep2').classList.add('active');
});
document.getElementById('wizardNext3').addEventListener('click', () => {
    renderWizardOnCall();
    document.getElementById('wizardStep3').classList.remove('active');
    document.getElementById('wizardStep4').classList.add('active');
});

document.getElementById('wizardBack4').addEventListener('click', () => {
    document.getElementById('wizardStep4').classList.remove('active');
    document.getElementById('wizardStep3').classList.add('active');
});

function renderWizardOnCall() {
    const select = document.getElementById('wizardOnCallStart');
    select.innerHTML = wizardEmployees.map((name, index) => 
        `<option value="${index}">${sanitizeHTML(name)}</option>`
    ).join('');
}

document.getElementById('wizardFinish').addEventListener('click', () => {
    // Build config from wizard data
    const employees = wizardEmployees.map((name, index) => {
        const select = document.getElementById(`wizardAssign-${index}`);
        return {
            name: name,
            initialSlot: parseInt(select.value)
        };
    });
    
    const onCallStartIndex = parseInt(document.getElementById('wizardOnCallStart').value) || 0;
    
    // Convert timeslots to objects with empty notes
    const timeslots = wizardTimeslots.map(time => ({ time: time, note: '' }));
    
    config = {
        employees: employees,
        timeslots: timeslots,
        startWeek: 1,
        onCallOrder: employees.map((_, i) => i),
        onCallStartIndex: onCallStartIndex
    };
    
    saveConfig(config);
    localStorage.setItem('endoScheduleSetupComplete', 'true');
    localStorage.setItem('endoScheduleTutorialSeen', 'true');
    
    setupWizardModal.style.display = 'none';
    renderSchedule();
    
    // Show success message
    alert('🎉 Setup complete! Your schedule has been generated. You can add notes to time slots in ⚙️ Configure.');
});

// Export buttons
const exportExcelBtn = document.getElementById('exportExcel');
const exportPdfBtn = document.getElementById('exportPdf');
const printBtn = document.getElementById('printBtn');

// Export to Excel
exportExcelBtn.addEventListener('click', () => {
    const year = parseInt(yearSelect.value);
    const schedule = generateSchedule(year);
    const filterWeek = weekFilter.value;
    
    const filteredSchedule = filterWeek 
        ? schedule.filter(w => w.week === parseInt(filterWeek))
        : schedule;
    
    // Create workbook data with on-call column
    const wsData = [['Week', 'Date Range', 'On-Call', ...config.employees.map(e => e.name)]];
    
    filteredSchedule.forEach(weekData => {
        const dateRange = `${formatDate(weekData.dates.start)} - ${formatDate(weekData.dates.end)}`;
        const row = [
            `Week ${weekData.week}`,
            dateRange,
            weekData.onCall || '',
            ...weekData.assignments.map(a => a.note ? `${a.timeslot} (${a.note})` : a.timeslot)
        ];
        wsData.push(row);
    });
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_array ? XLSX.utils.aoa_to_sheet(wsData) : XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 10 },  // Week
        { wch: 18 },  // Date Range
        { wch: 15 },  // On-Call
        ...config.employees.map(() => ({ wch: 25 }))  // Employee columns (wider for notes)
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    
    // Generate filename
    const filename = filterWeek 
        ? `StClares_Endo_Schedule_${year}_Week${filterWeek}.xlsx`
        : `StClares_Endo_Schedule_${year}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);
});

// Helper: Group schedule by month (returns array of [monthIndex, monthName, weeks] in order)
function groupScheduleByMonth(schedule, year) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const months = new Map();
    
    schedule.forEach(weekData => {
        const monthIndex = weekData.dates.start.getMonth();
        if (!months.has(monthIndex)) {
            months.set(monthIndex, []);
        }
        months.get(monthIndex).push(weekData);
    });
    
    // Sort by month index and sort weeks within each month
    const sortedMonths = [];
    for (let i = 0; i < 12; i++) {
        if (months.has(i)) {
            const weeks = months.get(i);
            // Sort weeks by week number
            weeks.sort((a, b) => a.week - b.week);
            sortedMonths.push({ monthIndex: i, monthName: monthNames[i], weeks });
        }
    }
    
    return sortedMonths;
}

// Export to PDF / Print view - Compact Monthly Format
function openPrintView(autoPrint = false) {
    const year = parseInt(yearSelect.value);
    const schedule = generateSchedule(year);
    const filterWeek = weekFilter.value;
    
    const filteredSchedule = filterWeek 
        ? schedule.filter(w => w.week === parseInt(filterWeek))
        : schedule;
    
    // Create a new window for PDF
    const printWindow = window.open('', '_blank');
    
    // Group by month for compact view
    const monthlySchedule = groupScheduleByMonth(filteredSchedule, year);
    
    // Build compact monthly tables with pagination every 3 months
    let monthTables = '';
    let monthCount = 0;
    
    monthlySchedule.forEach(({ monthName, weeks }) => {
        // Create compact header row with week numbers
        const weekHeaders = weeks.map(w => `<th>Wk ${w.week}<br><small>${formatDate(w.dates.start)}</small></th>`).join('');
        
        // Create row for each employee showing their shift with space for edits
        const employeeRows = config.employees.map(emp => {
            const cells = weeks.map(weekData => {
                const assignment = weekData.assignments.find(a => a.employee === emp.name);
                // Extract just the start time for compactness
                const timeSlot = assignment ? assignment.timeslot.split(' - ')[0] : '';
                return `<td>${timeSlot}</td>`;
            }).join('');
            return `<tr><td class="emp-name">${sanitizeHTML(emp.name)}</td>${cells}</tr>`;
        }).join('');
        
        // On-call row
        const onCallCells = weeks.map(weekData => 
            `<td class="on-call-cell">${weekData.onCall ? sanitizeHTML(weekData.onCall.split(' ')[0]) : ''}</td>`
        ).join('');
        const onCallRow = `<tr class="on-call-row"><td class="emp-name">📞 On-Call</td>${onCallCells}</tr>`;
        
        // Edits row - blank space for handwritten changes
        const editCells = weeks.map(() => `<td class="edit-cell"></td>`).join('');
        const editRow = `<tr class="edit-row"><td class="emp-name">✏️ Changes</td>${editCells}</tr>`;
        
        monthTables += `
            <div class="month-section">
                <h3>${monthName} ${year}</h3>
                <table>
                    <thead>
                        <tr>
                            <th class="emp-col">Employee</th>
                            ${weekHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        ${employeeRows}
                        ${onCallRow}
                        ${editRow}
                    </tbody>
                </table>
            </div>
        `;
        
        monthCount++;
        
        // Add notes section and page break every 3 months
        if (monthCount % 3 === 0 && monthCount < monthlySchedule.length) {
            monthTables += `
                <div class="quarter-notes">
                    <h4>📝 Notes / Changes:</h4>
                    <div class="notes-lines"></div>
                </div>
                <div class="page-break"></div>
            `;
        }
    });
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>St. Clare's Endo Schedule - ${year}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: Arial, sans-serif;
                    padding: 10px;
                    font-size: 9pt;
                    max-width: 100%;
                }
                h1 {
                    color: #333;
                    text-align: center;
                    margin: 5px 0;
                    font-size: 14pt;
                }
                h2 {
                    color: #666;
                    text-align: center;
                    font-weight: normal;
                    margin: 0 0 10px 0;
                    font-size: 10pt;
                }
                .month-section {
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .month-section h3 {
                    background: #667eea;
                    color: white;
                    padding: 5px 10px;
                    margin: 0 0 5px 0;
                    font-size: 11pt;
                    border-radius: 3px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8pt;
                }
                th, td {
                    border: 1px solid #999;
                    padding: 4px 6px;
                    text-align: center;
                }
                th {
                    background: #f0f0f0;
                    font-weight: bold;
                    font-size: 7pt;
                }
                th small {
                    display: block;
                    font-weight: normal;
                    color: #666;
                }
                .emp-col {
                    text-align: left;
                    width: 80px;
                    min-width: 80px;
                }
                .emp-name {
                    text-align: left;
                    font-weight: 600;
                    white-space: nowrap;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .on-call-row {
                    background: #fff3cd !important;
                    border-top: 2px solid #667eea;
                }
                .on-call-cell {
                    font-weight: bold;
                    color: #d63384;
                }
                .edit-row {
                    background: #f0f8ff !important;
                }
                .edit-cell {
                    min-height: 20px;
                    height: 20px;
                }
                .quarter-notes {
                    margin: 15px 0;
                    border: 1px solid #ddd;
                    padding: 10px;
                    min-height: 80px;
                    page-break-inside: avoid;
                }
                .quarter-notes h4 {
                    margin: 0 0 8px 0;
                    font-size: 9pt;
                    color: #666;
                }
                .notes-lines {
                    height: 50px;
                    background: repeating-linear-gradient(
                        transparent,
                        transparent 15px,
                        #ddd 15px,
                        #ddd 16px
                    );
                }
                .page-break {
                    page-break-after: always;
                    height: 0;
                    margin: 0;
                }
                .legend {
                    margin-top: 10px;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    font-size: 8pt;
                }
                .legend h4 {
                    margin: 0 0 5px 0;
                    font-size: 9pt;
                }
                .legend-item {
                    display: inline-block;
                    margin-right: 15px;
                }
                .notes-section {
                    margin-top: 15px;
                    border: 1px solid #ddd;
                    padding: 10px;
                    min-height: 60px;
                }
                .notes-section h4 {
                    margin: 0 0 5px 0;
                    font-size: 9pt;
                    color: #666;
                }
                .footer {
                    text-align: center;
                    margin-top: 10px;
                    color: #999;
                    font-size: 7pt;
                }
                @media print {
                    body { padding: 5px; }
                    .no-print { display: none !important; }
                    .month-section { page-break-inside: avoid; }
                    .page-break { page-break-after: always; }
                }
                @page {
                    size: letter;
                    margin: 0.5in;
                }
            </style>
        </head>
        <body>
            <h1>🏥 St. Clare's Endo Schedule</h1>
            <h2>${filterWeek ? `Week ${filterWeek} - ` : ''}${year}</h2>
            
            ${monthTables}
            
            <div class="legend">
                <h4>Time Slots:</h4>
                ${config.timeslots.map(slot => {
                    const timeText = getTimeslotText(slot);
                    const note = getTimeslotNote(slot);
                    return `<span class="legend-item">• ${sanitizeHTML(timeText)}${note ? ` <em style="color:#856404">(${sanitizeHTML(note)})</em>` : ''}</span>`;
                }).join('')}
            </div>
            
            <div class="notes-section">
                <h4>📝 Notes / Changes:</h4>
            </div>
            
            <div class="footer">
                <p>Generated ${new Date().toLocaleDateString()} | Times shown are START times only</p>
            </div>
            
            <div class="no-print" style="text-align: center; margin-top: 20px;">
                <button onclick="window.print()" style="padding: 10px 30px; font-size: 1rem; cursor: pointer; background: #667eea; color: white; border: none; border-radius: 5px;">
                    🖨️ Print / Save as PDF
                </button>
            </div>
            ${autoPrint ? '<script>window.onload = function() { window.print(); }</script>' : ''}
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// Export to PDF
exportPdfBtn.addEventListener('click', () => {
    openPrintView(false);
});

// Print button - opens print view and auto-prints
printBtn.addEventListener('click', () => {
    openPrintView(true);
});