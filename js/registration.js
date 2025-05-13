document.addEventListener('DOMContentLoaded', function() {
    // Get event ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const token = localStorage.getItem('token');
    
    // DOM Elements
    const registrationForm = document.getElementById('registration-form');
    const successMessage = document.getElementById('success-message');
    const registerAnotherBtn = document.getElementById('register-another');
    const eventTitleElement = document.getElementById('event-title');
    const submitBtn = document.getElementById('submit-btn');
    const errorMessage = document.getElementById('error-message');
    const infoMessage = document.getElementById('info-message');
    
    // Check if eventId is present
    if (!eventId) {
        showError('No event ID provided. Please check the URL and try again.');
        return;
    }
    
    // Check if token is present
    if (!token) {
        showError('You are not logged in. Please log in to register participants.');
        return;
    }
    
    // Fetch event details
    fetchEventDetails(eventId);
    
    // Form submission handler
    registrationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Show loading state on button
        setButtonLoading(true);
        
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            college: document.getElementById('college').value.trim()
        };
        
        // Basic form validation
        if (!formData.name || !formData.email || !formData.phone || !formData.college) {
            showError('All fields are required');
            setButtonLoading(false);
            return;
        }
        
        // Email validation
        if (!isValidEmail(formData.email)) {
            showError('Please enter a valid email address');
            setButtonLoading(false);
            return;
        }
        
        // Phone validation (simple length check)
        if (formData.phone.length < 10) {
            showError('Please enter a valid phone number');
            setButtonLoading(false);
            return;
        }
        
        registerParticipant(eventId, formData);
    });
    
    // Register another participant button
    registerAnotherBtn.addEventListener('click', function() {
        successMessage.classList.add('hidden');
        registrationForm.classList.remove('hidden');
        registrationForm.reset();
    });
    
    // Function to fetch event details
    async function fetchEventDetails(eventId) {
        try {
            showInfo('Loading event details...');
            
            const response = await fetch(`http://localhost:5000/api/events/${eventId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch event details');
            }
            
            const event = await response.json();
            console.log(event)
            console.log(event.event.name)
            eventTitleElement.textContent = `Event: ${event.event.name}`;
            hideAllMessages();
        } catch (error) {
            console.error('Error fetching event details:', error);
            showError('Failed to load event details. Please try again.');
        }
    }
    
    // Function to register participant
    async function registerParticipant(eventId, participantData) {
        try {
            const response = await fetch(`http://localhost:5000/api/participants/${eventId}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(participantData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Registration failed');
            }
            
            // Show success message and hide the form
            registrationForm.classList.add('hidden');
            successMessage.classList.remove('hidden');
            hideAllMessages();
            
            // Reset loading state
            setButtonLoading(false);
            
            console.log('Registration successful:', result);
        } catch (error) {
            console.error('Registration error:', error);
            showError(`Registration failed: ${error.message}`);
            setButtonLoading(false);
        }
    }
    
    // Utility Functions
    
    // Email validation
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Set button loading state
    function setButtonLoading(isLoading) {
        if (isLoading) {
            submitBtn.innerHTML = '<span class="loading-spinner"></span> Registering...';
            submitBtn.disabled = true;
        } else {
            submitBtn.innerHTML = 'Register';
            submitBtn.disabled = false;
        }
    }
    
    // Show error message
    function showError(message) {
        hideAllMessages();
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    // Show info message
    function showInfo(message) {
        hideAllMessages();
        infoMessage.textContent = message;
        infoMessage.style.display = 'block';
    }
    
    // Hide all message types
    function hideAllMessages() {
        errorMessage.style.display = 'none';
        infoMessage.style.display = 'none';
    }
});