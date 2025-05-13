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
    const scanModeSelect = document.getElementById('scan-mode');
    const eventDaySelect = document.getElementById('event-day');
    const scannerBox = document.getElementById('scanner-box');
    const videoElement = document.getElementById('qr-video');
    const canvasElement = document.getElementById('qr-canvas');
    const canvasContext = canvasElement.getContext('2d');
    const manualCodeInput = document.getElementById('manual-code');
    const manualSubmitBtn = document.getElementById('manual-submit');
    const resultSection = document.getElementById('result-section');
    const resultCard = document.getElementById('result-card');
    const resultTitle = document.getElementById('result-title');
    const resultStatus = document.getElementById('result-status');
    const participantName = document.getElementById('participant-name');
    const participantCollege = document.getElementById('participant-college');
    const participantEmail = document.getElementById('participant-email');
    const participantPhone = document.getElementById('participant-phone');
    const confirmActionBtn = document.getElementById('confirm-action');
    const cancelActionBtn = document.getElementById('cancel-action');
    const notification = document.getElementById('notification');

    // State variables
    let currentScanMode = 'checkin';
    let currentEventDay = '';
    let eventDetails = {};
    let eventDays = [];
    let scannedParticipant = null;
    let scannerActive = false;
    let stream = null;
    let currentColor = ''; // Track current color for validation

    // Initialize scanner
    initScanner();

    // Event listeners
    scanModeSelect.addEventListener('change', function() {
        currentScanMode = this.value;
        resetScanner();
    });

    eventDaySelect.addEventListener('change', function() {
        currentEventDay = this.value;
    });

    manualSubmitBtn.addEventListener('click', handleManualEntry);
    manualCodeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleManualEntry();
    });

    confirmActionBtn.addEventListener('click', confirmAction);
    cancelActionBtn.addEventListener('click', resetScanner);

    // Initialize scanner
    async function initScanner() {
        try {
            // Load event details
            const response = await fetch(`http://localhost:5000/api/events/${eventId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch event details');
            }
            
            eventDetails = await response.json();
            eventNameElement.textContent = eventDetails.event.name;
            
            // Get current color from server
            await getCurrentColorFromServer();
            
            // Setup event days
            setupEventDays();
            
            // Start camera
            startCamera();
        } catch (error) {
            console.error('Scanner initialization error:', error);
            showNotification('Failed to initialize scanner', 'error');
        }
    }

    // Get current color from server
    async function getCurrentColorFromServer() {
        try {
            const response = await fetch(`http://localhost:5000/api/participants/${eventId}/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dummy: true }) // Send dummy request to get color
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.color) {
                    currentColor = result.color;
                }
            }
        } catch (error) {
            console.error('Failed to get current color:', error);
            // Fallback to client-side color if server fails
            currentColor = ['red', 'green', 'blue'][Math.floor(Date.now() / 30000) % 3];
        }
    }

    // Setup event days dropdown
    function setupEventDays() {
        const startDate = new Date(eventDetails.event.startDate);
        const endDate = new Date(eventDetails.event.endDate);
        
        // Clear existing options
        eventDaySelect.innerHTML = '';
        
        // Generate options for each event day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const option = document.createElement('option');
            option.value = dateStr;
            option.textContent = d.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
            
            // Set today as default if within event dates
            const today = new Date();
            if (d.toDateString() === today.toDateString()) {
                option.selected = true;
                currentEventDay = dateStr;
            }
            
            eventDaySelect.appendChild(option);
        }
        
        // If no day is selected (event in future), select first day
        if (!currentEventDay && eventDaySelect.options.length > 0) {
            eventDaySelect.options[0].selected = true;
            currentEventDay = eventDaySelect.options[0].value;
        }
    }

    // Start camera for QR scanning
    async function startCamera() {
        try {
            scannerActive = true;
            
            // Get camera stream
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            videoElement.srcObject = stream;
            videoElement.play();
            
            // Start scanning loop
            requestAnimationFrame(scanQRCode);
        } catch (error) {
            console.error('Camera error:', error);
            showNotification('Camera access denied or not available', 'error');
            scannerBox.style.display = 'none';
        }
    }

    // QR code scanning loop
    function scanQRCode() {
        if (!scannerActive) return;
        
        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            canvasElement.height = videoElement.videoHeight;
            canvasElement.width = videoElement.videoWidth;
            canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            const imageData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });
            
            if (code) {
                handleScannedCode(code.data);
            }
        }
        
        requestAnimationFrame(scanQRCode);
    }

    // Handle scanned QR code
    async function handleScannedCode(code) {
        try {
            // Pause scanning
            scannerActive = false;
            
            // Parse QR code data (assuming format: "secret|color")
            const [secret, color] = code.split('|');
            
            if (!secret || !color) {
                throw new Error('Invalid QR code format');
            }
            
            // Verify the code based on scan mode
            let endpoint = '';
            let body = { secret, color };
            
            if (currentScanMode === 'checkin') {
                endpoint = 'scan';
            } else if (currentScanMode === 'lunch') {
                endpoint = 'lunch-verify';
                body.date = currentEventDay;
            } else if (currentScanMode === 'kit') {
                endpoint = 'kit-verify';
                body.date = currentEventDay;
            }
            
            const response = await fetch(`http://localhost:5000/api/participants/${eventId}/${endpoint}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Verification failed');
            }
            
            // Store participant data
            scannedParticipant = result.participant;
            
            // Update UI with participant info
            showParticipantInfo(result);
            
        } catch (error) {
            console.error('Scan error:', error);
            showNotification(error.message, 'error');
            resetScanner();
        }
    }

    // Handle manual code entry
    async function handleManualEntry() {
        const code = manualCodeInput.value.trim();
        
        if (!code) {
            showNotification('Please enter a code', 'warning');
            return;
        }
        
        try {
            // For manual entry, use the current color we got from the server
            await handleScannedCode(`${code}|${currentColor}`);
            
            // Clear input
            manualCodeInput.value = '';
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // Show participant info in result card
    function showParticipantInfo(result) {
        // Update result card based on scan mode
        if (currentScanMode === 'checkin') {
            resultTitle.textContent = 'Check-In Verification';
            resultStatus.textContent = 'Pending Check-In';
        } else if (currentScanMode === 'lunch') {
            resultTitle.textContent = 'Lunch Collection';
            resultStatus.textContent = 'Eligible';
        } else if (currentScanMode === 'kit') {
            resultTitle.textContent = 'Kit Collection';
            resultStatus.textContent = 'Eligible';
        }
        
        // Update participant info
        participantName.textContent = scannedParticipant.name;
        participantCollege.textContent = scannedParticipant.college;
        participantEmail.textContent = scannedParticipant.email;
        participantPhone.textContent = scannedParticipant.phone;
        
        // Show result section
        scannerBox.style.display = 'none';
        resultSection.style.display = 'block';
    }

    // Confirm the action (check-in, lunch, or kit)
    async function confirmAction() {
        try {
            let endpoint = '';
            let body = {};
            
            if (currentScanMode === 'checkin') {
                endpoint = `checkin/${scannedParticipant._id}`;
                body = { date: currentEventDay };
            } else if (currentScanMode === 'lunch') {
                endpoint = `lunch/${scannedParticipant._id}`;
                body = { date: currentEventDay };
            } else if (currentScanMode === 'kit') {
                endpoint = `kit/${scannedParticipant._id}`;
                body = { date: currentEventDay };
            }
            
            const response = await fetch(`http://localhost:5000/api/participants/${eventId}/${endpoint}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Confirmation failed');
            }
            
            // Show success message
            let action = '';
            if (currentScanMode === 'checkin') action = 'checked in';
            else if (currentScanMode === 'lunch') action = 'lunch collected';
            else if (currentScanMode === 'kit') action = 'kit collected';
            
            showNotification(`Successfully ${action} for ${scannedParticipant.name}`, 'success');
            
            // Reset scanner
            resetScanner();
            
        } catch (error) {
            console.error('Confirmation error:', error);
            showNotification(error.message, 'error');
            resetScanner();
        }
    }

    // Reset scanner to initial state
    function resetScanner() {
        // Clear participant data
        scannedParticipant = null;
        
        // Reset UI
        resultSection.style.display = 'none';
        scannerBox.style.display = 'block';
        
        // Resume scanning
        scannerActive = true;
        requestAnimationFrame(scanQRCode);
    }

    // Show notification
    function showNotification(message, type) {
        notification.textContent = message;
        notification.className = 'notification';
        notification.classList.add(type);
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Clean up when page is closed
    window.addEventListener('beforeunload', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });
});