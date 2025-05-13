document.addEventListener('DOMContentLoaded', function() {
    // Get event ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // DOM Elements
    const eventNameElement = document.getElementById('event-name');
    const eventDatesElement = document.getElementById('event-dates');
    const navButtons = document.querySelectorAll('.nav-btn');
    const contentArea = document.getElementById('content-area');
    const searchInput = document.getElementById('search-input');
    
    // State variables
    let allParticipants = [];
    let filteredParticipants = [];
    let eventDetails = {};
    let eventDates = [];
    
    // Initialize dashboard
    initDashboard(eventId);
    
    // Setup navigation
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Set active button
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Load corresponding content
            const target = this.dataset.target;
            handleNavigation(target, eventId);
        });
    });
    
    // Add search functionality when search input is present
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyFilters();
        });
    }
    
    // Initialize dashboard
    async function initDashboard(eventId) {
        try {
            // Load event details and participants in parallel
            const [eventResponse, participantsResponse] = await Promise.all([
                fetch(`http://localhost:5000/api/events/${eventId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`http://localhost:5000/api/participants/${eventId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            
            if (!eventResponse.ok || !participantsResponse.ok) {
                throw new Error('Failed to fetch data');
            }
            
            eventDetails = await eventResponse.json();
            const participantsData = await participantsResponse.json();
            
            // Store participants data
            allParticipants = participantsData.data || [];
            filteredParticipants = [...allParticipants];
            
            // Extract event dates
            const startDate = new Date(eventDetails.event.startDate);
            const endDate = new Date(eventDetails.event.endDate);
            eventDates = getDatesBetween(startDate, endDate);
            
            // Update UI
            renderEventInfo();
            
            // Create filter form if it doesn't exist yet
            createFilterFormIfNeeded();
            
            // Setup date filters
            setupDateFilters();
            
            // Initialize export button
            initExportButton();
            
            // Render the dashboard
            renderDashboard();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            contentArea.innerHTML = `
                <div class="error-message">
                    <p>Failed to load dashboard data. Please try again.</p>
                    <button class="btn-retry">Retry</button>
                </div>
            `;
            // Add event listener to retry button
            document.querySelector('.btn-retry').addEventListener('click', function() {
                initDashboard(eventId);
            });
        }
    }
    
    // Function to create filter form if it doesn't exist
    function createFilterFormIfNeeded() {
        if (!document.getElementById('filter-form')) {
            const filterSection = document.createElement('div');
            filterSection.className = 'filter-section';
            filterSection.innerHTML = `
                <form id="filter-form" class="filter-form">
                    <div class="filter-row">
                        <div class="filter-group">
                            <h3>Status</h3>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="status" value="all" checked>
                                    All
                                </label>
                                <label>
                                    <input type="radio" name="status" value="checked-in">
                                    Checked In
                                </label>
                                <label>
                                    <input type="radio" name="status" value="not-checked-in">
                                    Not Checked In
                                </label>
                            </div>
                        </div>
                        
                        <div class="filter-group">
                            <h3>College</h3>
                            <select id="college-filter">
                                <option value="all">All Colleges</option>
                                ${getUniqueColleges().map(college => 
                                    `<option value="${college}">${college}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <h3>Dates</h3>
                            <div id="date-filters" class="date-filters">
                                <!-- Date filters will be added here -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="filter-actions">
                        <button type="submit" class="btn-apply">Apply Filters</button>
                        <button type="button" id="export-btn" class="btn-export">Export Data</button>
                    </div>
                </form>
            `;
            
            // Insert filter section before content area
            contentArea.parentNode.insertBefore(filterSection, contentArea);
            
            // Add event listener for filter form submission
            document.getElementById('filter-form').addEventListener('submit', function(e) {
                e.preventDefault();
                applyFilters();
            });
        }
    }
    
    // Get unique colleges from participants
    function getUniqueColleges() {
        const colleges = new Set();
        allParticipants.forEach(p => colleges.add(p.college));
        return Array.from(colleges);
    }
    
    // Function to render event information
    function renderEventInfo() {
        if (eventNameElement && eventDetails.event) {
            eventNameElement.textContent = eventDetails.event.name;
        }
        
        if (eventDatesElement && eventDetails.event) {
            const startDate = new Date(eventDetails.event.startDate).toLocaleDateString();
            const endDate = new Date(eventDetails.event.endDate).toLocaleDateString();
            eventDatesElement.textContent = `${startDate} - ${endDate}`;
        }
    }
    
    // Initialize export button
    function initExportButton() {
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportData);
        }
    }
    
    // Function to setup date filters
    function setupDateFilters() {
        const dateFilterContainer = document.getElementById('date-filters');
        if (dateFilterContainer) {
            dateFilterContainer.innerHTML = '';
            
            eventDates.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                
                const checkbox = document.createElement('div');
                checkbox.className = 'date-filter-item';
                checkbox.innerHTML = `
                    <input type="checkbox" id="date-${dateStr}" name="dates" value="${dateStr}" checked>
                    <label for="date-${dateStr}">${formattedDate}</label>
                `;
                dateFilterContainer.appendChild(checkbox);
            });
        }
    }
    
    // Function to apply all filters
    function applyFilters() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const statusFilter = document.querySelector('input[name="status"]:checked')?.value || 'all';
        const collegeFilter = document.getElementById('college-filter')?.value || 'all';
        const selectedDates = Array.from(document.querySelectorAll('input[name="dates"]:checked')).map(el => el.value);
        
        filteredParticipants = allParticipants.filter(participant => {
            // Search filter
            const matchesSearch = !searchTerm || 
                participant.name.toLowerCase().includes(searchTerm) ||
                participant.email.toLowerCase().includes(searchTerm) ||
                participant.phone.includes(searchTerm) ||
                participant.college.toLowerCase().includes(searchTerm);
            
            // Status filter
            let matchesStatus = true;
            if (statusFilter === 'checked-in') {
                matchesStatus = participant.checkInStatus === true;
            } else if (statusFilter === 'not-checked-in') {
                matchesStatus = participant.checkInStatus !== true;
            }
            
            // College filter
            let matchesCollege = true;
            if (collegeFilter && collegeFilter !== 'all') {
                matchesCollege = participant.college === collegeFilter;
            }
            
            // Date filter
            let matchesDates = true;
            if (selectedDates.length > 0) {
                matchesDates = selectedDates.some(date => {
                    return participant.dailyActivities?.some(activity => {
                        return activity.date.startsWith(date);
                    });
                });
            }
            
            return matchesSearch && matchesStatus && matchesCollege && matchesDates;
        });
        
        renderDashboard();
    }
    
    // Function to render the dashboard
    function renderDashboard() {
        // Calculate statistics
        const stats = calculateStatistics();
        
        // Create dashboard HTML
        let html = `
            <div class="dashboard-grid">
                <!-- Summary Cards -->
                <div class="summary-cards">
                    <div class="stat-card total">
                        <h3>Total Participants</h3>
                        <p>${stats.totalParticipants}</p>
                        <div class="trend ${stats.trend > 0 ? 'up' : stats.trend < 0 ? 'down' : ''}">
                            ${stats.trend !== 0 ? Math.abs(stats.trend) + '%' : ''}
                        </div>
                    </div>
                    <div class="stat-card checked-in">
                        <h3>Checked In</h3>
                        <p>${stats.totalCheckedIn}</p>
                        <div class="percentage">${stats.checkedInPercentage}%</div>
                    </div>
                    <div class="stat-card lunch">
                        <h3>Lunch Collected</h3>
                        <p>${stats.totalLunch}</p>
                    </div>
                    <div class="stat-card kits">
                        <h3>Kits Collected</h3>
                        <p>${stats.totalKits}</p>
                    </div>
                </div>
                
                <!-- Charts Section -->
                <div class="charts-section">
                    <div class="chart-container">
                        <h3>Daily Check-ins</h3>
                        <canvas id="dailyCheckinsChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>College Distribution</h3>
                        <canvas id="collegeChart"></canvas>
                    </div>
                </div>
                
                <!-- Detailed Statistics -->
                <div class="detailed-stats">
                    <h3>Daily Breakdown</h3>
                    <div class="table-responsive">
                        <table class="stats-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Participants</th>
                                    <th>Checked In</th>
                                    <th>Check-in %</th>
                                    <th>Lunch</th>
                                    <th>Kits</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.dailyStats.map(day => `
                                    <tr>
                                        <td>${day.date}</td>
                                        <td>${day.totalParticipants}</td>
                                        <td>${day.checkedIn}</td>
                                        <td>${day.checkInPercentage}%</td>
                                        <td>${day.lunchCollected}</td>
                                        <td>${day.kitsCollected}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Participants List -->
                <div class="participants-list">
                    <h3>Participants (${filteredParticipants.length})</h3>
                    <div class="list-controls">
                        <div class="sort-options">
                            <label>Sort by:</label>
                            <select id="sort-by">
                                <option value="name">Name</option>
                                <option value="college">College</option>
                                <option value="checkInStatus">Check-in Status</option>
                                <option value="registeredAt">Registration Date</option>
                            </select>
                            <select id="sort-direction">
                                <option value="asc">Ascending</option>
                                <option value="desc">Descending</option>
                            </select>
                        </div>
                        <div class="pagination-info">
                            Showing 1-${Math.min(filteredParticipants.length, 10)} of ${filteredParticipants.length}
                        </div>
                    </div>
                    <div class="participants-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>College</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredParticipants.slice(0, 10).map(participant => `
                                    <tr>
                                        <td>${participant.name}</td>
                                        <td>${participant.college}</td>
                                        <td>${participant.email}</td>
                                        <td>${participant.phone}</td>
                                        <td class="status ${participant.checkInStatus ? 'checked-in' : 'not-checked-in'}">
                                            ${participant.checkInStatus ? 'Checked In' : 'Not Checked In'}
                                        </td>
                                        <td>
                                            <button class="btn-view" data-id="${participant._id}">View</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
        // Initialize charts
        renderCharts(stats);
        
        // Add event listeners to view buttons
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', function() {
                const participantId = this.getAttribute('data-id');
                viewParticipantDetails(participantId);
            });
        });
        
        // Add event listeners to sort controls
        const sortBySelect = document.getElementById('sort-by');
        const sortDirectionSelect = document.getElementById('sort-direction');
        if (sortBySelect && sortDirectionSelect) {
            sortBySelect.addEventListener('change', sortParticipants);
            sortDirectionSelect.addEventListener('change', sortParticipants);
        }
    }
    
    // Function to sort participants
    function sortParticipants() {
        const sortBy = document.getElementById('sort-by').value;
        const sortDirection = document.getElementById('sort-direction').value;
        
        filteredParticipants.sort((a, b) => {
            let valueA, valueB;
            
            switch(sortBy) {
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'college':
                    valueA = a.college.toLowerCase();
                    valueB = b.college.toLowerCase();
                    break;
                case 'checkInStatus':
                    valueA = a.checkInStatus ? 1 : 0;
                    valueB = b.checkInStatus ? 1 : 0;
                    break;
                case 'registeredAt':
                    valueA = new Date(a.registeredAt).getTime();
                    valueB = new Date(b.registeredAt).getTime();
                    break;
                default:
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
            }
            
            if (sortDirection === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });
        
        renderDashboard();
    }
    
    // Function to calculate statistics
    function calculateStatistics() {
        const totalParticipants = filteredParticipants.length;
        const totalCheckedIn = filteredParticipants.filter(p => {
            return p.dailyActivities && p.dailyActivities.some(activity => activity.checkInStatus);
        }).length;
        const checkedInPercentage = totalParticipants > 0 ? Math.round((totalCheckedIn / totalParticipants) * 100) : 0;
        
        // Calculate totals for lunch and kits
        let totalLunch = 0;
        let totalKits = 0;
        
        filteredParticipants.forEach(participant => {
            if (participant.dailyActivities && participant.dailyActivities.length > 0) {
                participant.dailyActivities.forEach(activity => {
                    if (activity.isgotLunch) totalLunch++;
                    if (activity.isgotKit) totalKits++;
                });
            }
        });
        
        // Calculate daily stats
        const dailyStats = eventDates.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            let dayParticipants = 0;
            let dayCheckedIn = 0;
            let dayLunch = 0;
            let dayKits = 0;
            
            filteredParticipants.forEach(participant => {
                if (!participant.dailyActivities) return;
                
                const hasActivity = participant.dailyActivities.some(a => {
                   const activityDate = a.date instanceof Date 
                ? a.date.toISOString().split('T')[0]
                : new Date(a.date).toISOString().split('T')[0];
            return activityDate === dateStr;
                });
                
                if (hasActivity) {
            dayParticipants++;
            const activity = participant.dailyActivities.find(a => {
                const activityDate = a.date instanceof Date 
                    ? a.date.toISOString().split('T')[0]
                    : new Date(a.date).toISOString().split('T')[0];
                return activityDate === dateStr;
            });
            if (activity && activity.checkInStatus) dayCheckedIn++;
            if (activity && activity.isgotLunch) dayLunch++;
            if (activity && activity.isgotKit) dayKits++;
        }
            });
            
            return {
                date: formattedDate,
                totalParticipants: dayParticipants,
                checkedIn: dayCheckedIn,
                checkInPercentage: dayParticipants > 0 ? Math.round((dayCheckedIn / dayParticipants) * 100) : 0,
                lunchCollected: dayLunch,
                kitsCollected: dayKits
            };
        });
        
        // Calculate trend (placeholder - would compare to previous period in real app)
        const trend = 0;
        
        return {
            totalParticipants,
            totalCheckedIn,
            checkedInPercentage,
            totalLunch,
            totalKits,
            dailyStats,
            trend
        };
    }
    
    // Function to render charts
    function renderCharts(stats) {
        try {
            // Daily Check-ins Chart
            const dailyCheckinsChart = document.getElementById('dailyCheckinsChart');
            if (dailyCheckinsChart) {
                const dailyCtx = dailyCheckinsChart.getContext('2d');
                new Chart(dailyCtx, {
                    type: 'bar',
                    data: {
                        labels: stats.dailyStats.map(day => day.date),
                        datasets: [
                            {
                                label: 'Checked In',
                                data: stats.dailyStats.map(day => day.checkedIn),
                                backgroundColor: 'rgba(173, 73, 225, 0.7)'
                            },
                            {
                                label: 'Registered',
                                data: stats.dailyStats.map(day => day.totalParticipants),
                                backgroundColor: 'rgba(122, 28, 172, 0.7)'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }
                            },
                            x: {
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                },
                                ticks: {
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                labels: {
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }
                            }
                        }
                    }
                });
            }
            
            // College Distribution Chart
            const collegeChart = document.getElementById('collegeChart');
            if (collegeChart) {
                const collegeCounts = {};
                filteredParticipants.forEach(participant => {
                    if (participant.college) {
                        collegeCounts[participant.college] = (collegeCounts[participant.college] || 0) + 1;
                    }
                });
                
                const collegeCtx = collegeChart.getContext('2d');
                new Chart(collegeCtx, {
                    type: 'pie',
                    data: {
                        labels: Object.keys(collegeCounts),
                        datasets: [{
                            data: Object.values(collegeCounts),
                            backgroundColor: [
                                'rgba(173, 73, 225, 0.7)',
                                'rgba(122, 28, 172, 0.7)',
                                'rgba(46, 7, 63, 0.7)',
                                'rgba(26, 5, 38, 0.7)',
                                'rgba(201, 122, 245, 0.7)'
                            ],
                            borderColor: 'rgba(245, 245, 245, 0.2)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error rendering charts:', error);
        }
    }
    
    // Function to view participant details
    function viewParticipantDetails(participantId) {
        const participant = allParticipants.find(p => p._id === participantId);
        if (!participant) return;
        
        // Check if modal already exists and remove it
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2>${participant.name}</h2>
                <div class="participant-details">
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${participant.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${participant.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">College:</span>
                        <span class="detail-value">${participant.college}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Registered At:</span>
                        <span class="detail-value">${new Date(participant.registeredAt).toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">QR Secret:</span>
                        <span class="detail-value">${participant.qrSecret}</span>
                    </div>
                </div>
                
                <h3>Daily Activities</h3>
                <table class="activities-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Checked In</th>
                            <th>Lunch</th>
                            <th>Kit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eventDates.map(date => {
                            const dateStr = date.toISOString().split('T')[0];
                            const activity = participant.dailyActivities && participant.dailyActivities.find(a => a.date && a.date.startsWith(dateStr));
                            return `
                                <tr>
                                    <td>${date.toLocaleDateString()}</td>
                                    <td>${activity ? (activity.checkInStatus ? 'Yes' : 'No') : 'No'}</td>
                                    <td>${activity ? (activity.isgotLunch ? 'Yes' : 'No') : 'No'}</td>
                                    <td>${activity ? (activity.isgotKit ? 'Yes' : 'No') : 'No'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                
                <div class="modal-actions">
                    <button class="btn-print">Print</button>
                    <button class="btn-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('.btn-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.btn-print').addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Participant Details - ${participant.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h2 { color: #2E073F; }
                        .participant-details { margin-bottom: 20px; }
                        .detail-row { margin-bottom: 5px; }
                        .detail-label { font-weight: bold; display: inline-block; width: 120px; }
                        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h2>${participant.name}</h2>
                    <div class="participant-details">
                        <div class="detail-row">
                            <span class="detail-label">Email:</span>
                            <span>${participant.email}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone:</span>
                            <span>${participant.phone}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">College:</span>
                            <span>${participant.college}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Registered:</span>
                            <span>${new Date(participant.registeredAt).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <h3>Daily Activities</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Checked In</th>
                                <th>Lunch</th>
                                <th>Kit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eventDates.map(date => {
                                const dateStr = date.toISOString().split('T')[0];
                                const activity = participant.dailyActivities && participant.dailyActivities.find(a => a.date && a.date.startsWith(dateStr));
                                return `
                                    <tr>
                                        <td>${date.toLocaleDateString()}</td>
                                        <td>${activity ? (activity.checkInStatus ? 'Yes' : 'No') : 'No'}</td>
                                        <td>${activity ? (activity.isgotLunch ? 'Yes' : 'No') : 'No'}</td>
                                        <td>${activity ? (activity.isgotKit ? 'Yes' : 'No') : 'No'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `);
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        });
    }
    
    // Function to export data
    function exportData() {
        // Convert data to CSV
        let csv = 'Name,Email,Phone,College,Registered At,Status\n';
        
        filteredParticipants.forEach(participant => {
            csv += `"${participant.name}","${participant.email}","${participant.phone}","${participant.college}",` +
                   `"${new Date(participant.registeredAt).toLocaleString()}","${participant.checkInStatus ? 'Checked In' : 'Not Checked In'}"\n`;
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `${eventDetails.event.name}_participants_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    
    // Helper function to get dates between start and end
    function getDatesBetween(startDate, endDate) {
        const dates = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
    }
    
    // Function to handle navigation
    function handleNavigation(target, eventId) {
        switch(target) {
            case 'dashboard':
                // Already on dashboard
                break;
            case 'registration':
                window.location.href = `/registration.html?eventId=${eventId}`;
                break;
            case 'scanner':
                window.location.href = `/scanner.html?eventId=${eventId}`;
                break;
            case 'import-export':
                window.location.href = `/import-export.html?eventId=${eventId}`;
                break;
            default:
                // Default to dashboard
                break;
        }
    }
});