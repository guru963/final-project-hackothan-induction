document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const eventsContainer = document.getElementById('eventsContainer');
    const noEvents = document.getElementById('noEvents');
    const addEventBtn = document.getElementById('addEventBtn');
    const addEventModal = document.getElementById('addEventModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const eventForm = document.getElementById('eventForm');
    
    // Get user data from localStorage (assuming you stored it after login)
     const token = localStorage.getItem('token');
     console.log(token)
    const userData = localStorage.getItem('user');
    console.log(userData)
    
    if (!token || !userData) {
        window.location.href = '/login.html';
        return;
    }
    
    let user;
    try {
        user = JSON.parse(userData);
        if (!user?.id) {
            throw new Error('Invalid user data');
        }
        
        // Set username in header
        document.getElementById('username').textContent = user.name;
    } catch (error) {
        console.error('Error parsing user data:', error);
        window.location.href = '/login.html';
        return;
    }
    
    // Initialize the app
    init();
    
    function init() {
        fetchUserEvents();
        setupEventListeners();
    }
    function setupEventListeners() {
        // Add event button click
        addEventBtn.addEventListener('click', openAddEventModal);
        
        // Close modal button click
        closeModalBtn.addEventListener('click', closeAddEventModal);
        
        // Form submission
        eventForm.addEventListener('submit', handleFormSubmit);
        
        // Close modal when clicking outside
        addEventModal.addEventListener('click', function(e) {
            if (e.target === addEventModal) {
                closeAddEventModal();
            }
        });
    }
    
    function openAddEventModal() {
        addEventModal.classList.add('active');
    }
    
    function closeAddEventModal() {
        addEventModal.classList.remove('active');
        eventForm.reset();
    }
    
    async function fetchUserEvents() {
        try {
            const response = await fetch('http://localhost:5000/api/events', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.message !== "Events fetched successfully") {
                throw new Error(data.message || 'Failed to fetch events');
            }
            
            renderEvents(data.events);
        } catch (error) {
            console.error('Error fetching events:', error);
            showError('Failed to load events. Please try again.');
            renderEvents([]); // Show empty state
        }
    }
    
   function renderEvents(events) {
    if (!events || events.length === 0) {
        noEvents.style.display = 'flex';
        eventsContainer.innerHTML = '';
        eventsContainer.appendChild(noEvents);
        return;
    }
    
    noEvents.style.display = 'none';
    eventsContainer.innerHTML = '';
    
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.innerHTML = `
            <h3>${event.name}</h3>
            <p>${event.description || 'No description provided'}</p>
            <div class="event-dates">
                <span>${formatDate(event.startDate)}</span>
                <span>${formatDate(event.endDate)}</span>
            </div>
        `;
        
        // Updated click handler to go to registration page
        eventCard.addEventListener('click', () => {
            window.location.href = `/dashboard.html?eventId=${event._id}`;
        });
        
        eventsContainer.appendChild(eventCard);
    });
}
    
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const eventName = document.getElementById('eventName').value;
        const eventDescription = document.getElementById('eventDescription').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!eventName || !startDate || !endDate) {
            showError('Please fill in all required fields');
            return;
        }
        
        if (new Date(startDate) >= new Date(endDate)) {
            showError('End date must be after start date');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:5000/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: eventName,
                    description: eventDescription,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString()
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create event');
            }
            
            const data = await response.json();
            
            if (data.message !== "Event created successfully") {
                throw new Error(data.message || 'Event creation failed');
            }
            
            // Refresh the events list
            fetchUserEvents();
            closeAddEventModal();
            showSuccess('Event created successfully!');
        } catch (error) {
            console.error('Error creating event:', error);
            showError(error.message || 'Failed to create event. Please try again.');
        }
    }
    
    function showError(message) {
        // You could replace this with a more sophisticated notification system
        alert(`Error: ${message}`);
    }
    
    function showSuccess(message) {
        // You could replace this with a more sophisticated notification system
        alert(`Success: ${message}`);
    }
});