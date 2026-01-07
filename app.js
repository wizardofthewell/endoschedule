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
    
    // Create workbook data
    const wsData = [['Week', 'Date Range', ...config.employees.map(e => e.name)]];
    
    filteredSchedule.forEach(weekData => {
        const dateRange = `${formatDate(weekData.dates.start)} - ${formatDate(weekData.dates.end)}`;
        const row = [
            `Week ${weekData.week}`,
            dateRange,
            ...weekData.assignments.map(a => a.timeslot)
        ];
        wsData.push(row);
    });
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_array ? XLSX.utils.aoa_to_sheet(wsData) : XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
        { wch: 10 },  // Week
        { wch: 20 },  // Date Range
        ...config.employees.map(() => ({ wch: 20 }))  // Employee columns
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    
    // Generate filename
    const filename = filterWeek 
        ? `StClares_Endo_Schedule_${year}_Week${filterWeek}.xlsx`
        : `StClares_Endo_Schedule_${year}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, filename);
});

// Export to PDF
exportPdfBtn.addEventListener('click', () => {
    const year = parseInt(yearSelect.value);
    const schedule = generateSchedule(year);
    const filterWeek = weekFilter.value;
    
    const filteredSchedule = filterWeek 
        ? schedule.filter(w => w.week === parseInt(filterWeek))
        : schedule;
    
    // Create a new window for PDF
    const printWindow = window.open('', '_blank');
    
    // Build table HTML
    let tableRows = '';
    filteredSchedule.forEach(weekData => {
        const dateRange = `${formatDate(weekData.dates.start)} - ${formatDate(weekData.dates.end)}`;
        tableRows += `
            <tr>
                <td><strong>Week ${weekData.week}</strong></td>
                <td>${dateRange}</td>
                ${weekData.assignments.map(a => `<td>${sanitizeHTML(a.employee)}: ${sanitizeHTML(a.timeslot)}</td>`).join('')}
            </tr>
        `;
    });
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>St. Clare's Endo Schedule - ${year}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    max-width: 100%;
                }
                h1 {
                    color: #667eea;
                    text-align: center;
                    margin-bottom: 5px;
                }
                h2 {
                    color: #666;
                    text-align: center;
                    font-weight: normal;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }
                th {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                tr:hover {
                    background-color: #f0f0f0;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 0.9rem;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>🏥 St. Clare's Endo Schedule</h1>
            <h2>${filterWeek ? `Week ${filterWeek} - ` : ''}${year}</h2>
            <table>
                <thead>
                    <tr>
                        <th>Week</th>
                        <th>Date Range</th>
                        ${config.employees.map(e => `<th>${sanitizeHTML(e.name)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <div class="footer">
                <p>Generated on ${new Date().toLocaleDateString()}</p>
                <p>Made with ❤️ for Mudder</p>
            </div>
            <div class="no-print" style="text-align: center; margin-top: 20px;">
                <button onclick="window.print()" style="padding: 10px 30px; font-size: 1rem; cursor: pointer; background: #667eea; color: white; border: none; border-radius: 5px;">
                    🖨️ Print / Save as PDF
                </button>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
});

// Print current view
printBtn.addEventListener('click', () => {
    window.print();
});