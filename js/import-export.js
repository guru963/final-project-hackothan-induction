document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const importTabBtn = document.querySelector('[data-tab="import"]');
  const exportTabBtn = document.querySelector('[data-tab="export"]');
  const importPane = document.getElementById('import');
  const exportPane = document.getElementById('export');
  const fileInput = document.getElementById('file-input');
  const dropArea = document.getElementById('drop-area');
  const fileName = document.getElementById('file-name');
  const csvPreviewTable = document.getElementById('csv-preview-table');
  const importEventSelect = document.getElementById('import-event');
  const exportEventSelect = document.getElementById('export-event');
  const startImportBtn = document.getElementById('start-import');
  const clearImportBtn = document.getElementById('clear-import');
  const downloadTemplateBtn = document.getElementById('download-template');
  const startExportBtn = document.getElementById('start-export');
  const includeAllCheckbox = document.getElementById('include-all');
  const includeCheckedInCheckbox = document.getElementById('include-checked-in');
  const includeLunchCheckbox = document.getElementById('include-lunch');
  const includeKitCheckbox = document.getElementById('include-kit');
  const totalParticipantsEl = document.getElementById('total-participants');
  const checkedInEl = document.getElementById('checked-in');
  const lunchCountEl = document.getElementById('lunch-count');
  const kitCountEl = document.getElementById('kit-count');
  const importModal = document.getElementById('import-modal');
  const confirmImportBtn = document.getElementById('confirm-import');
  const cancelImportBtn = document.getElementById('cancel-import');
  const importCountEl = document.getElementById('import-count');
  const notification = document.getElementById('notification');
  const notificationClose = document.querySelector('.notification-close');
  const notificationMessage = document.querySelector('.notification-message');
  const notificationIcon = document.querySelector('.notification-icon');
const token = localStorage.getItem('token');
  console.log(token)
  // Global variables
  let selectedFile = null;
  let events = [];
  let csvData = [];
  let currentEventId = null;

  // Initialize the page
  init();
  
  // Tab switching
  importTabBtn.addEventListener('click', () => switchTab('import'));
  exportTabBtn.addEventListener('click', () => switchTab('export'));

  // File upload handling
  fileInput.addEventListener('change', handleFileSelect);
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  dropArea.addEventListener('drop', handleDrop, false);

  // Import buttons
  startImportBtn.addEventListener('click', showImportConfirmation);
  clearImportBtn.addEventListener('click', clearImport);
  downloadTemplateBtn.addEventListener('click', downloadTemplate);
  confirmImportBtn.addEventListener('click', processImport);
  cancelImportBtn.addEventListener('click', () => importModal.style.display = 'none');

  // Export checkboxes
  includeAllCheckbox.addEventListener('change', handleExportFilterChange);
  includeCheckedInCheckbox.addEventListener('change', handleExportFilterChange);
  includeLunchCheckbox.addEventListener('change', handleExportFilterChange);
  includeKitCheckbox.addEventListener('change', handleExportFilterChange);

  // Export button
  startExportBtn.addEventListener('click', exportParticipants);

  // Event select changes
  importEventSelect.addEventListener('change', () => {
    currentEventId = importEventSelect.value;
    startImportBtn.disabled = !(currentEventId && selectedFile);
  });
  
  exportEventSelect.addEventListener('change', async () => {
    currentEventId = exportEventSelect.value;
    startExportBtn.disabled = !currentEventId;
    if (currentEventId) {
      await updateExportStats();
    }
  });

  // Notification close
  notificationClose.addEventListener('click', () => {
    notification.classList.remove('show');
  });

  // Functions
  function init() {
    // Load events
    loadEvents();
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === importModal) {
        importModal.style.display = 'none';
      }
    });
  }

  function switchTab(tabName) {
    importPane.classList.remove('active');
    exportPane.classList.remove('active');
    importTabBtn.classList.remove('active');
    exportTabBtn.classList.remove('active');
    
    if (tabName === 'import') {
      importPane.classList.add('active');
      importTabBtn.classList.add('active');
    } else {
      exportPane.classList.add('active');
      exportTabBtn.classList.add('active');
    }
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    dropArea.classList.add('highlight');
  }

  function unhighlight() {
    dropArea.classList.remove('highlight');
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0 && files[0].type === 'text/csv') {
      fileInput.files = files;
      handleFileSelect({ target: fileInput });
    }
  }

  async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    selectedFile = file;
    fileName.textContent = file.name;
    
    try {
      csvData = await parseCSV(file);
      displayCSVPreview(csvData);
      startImportBtn.disabled = !(currentEventId && selectedFile);
    } catch (error) {
      showNotification('Error parsing CSV file', 'error');
      console.error('Error parsing CSV:', error);
    }
  }

  function parseCSV(file) {
    return new Promise((resolve, reject) => {
      const results = [];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const content = e.target.result;
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const row = {};
          
          for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j] ? values[j].trim() : '';
          }
          
          results.push(row);
        }
        
        resolve(results);
      };
      
      reader.onerror = function() {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  function displayCSVPreview(data) {
    if (!data || data.length === 0) {
      csvPreviewTable.innerHTML = '<p class="no-preview">No valid data to display</p>';
      return;
    }
    
    const headers = Object.keys(data[0]);
    let html = '<table><thead><tr>';
    
    // Create header row
    headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Create data rows (limit to 5 for preview)
    const previewRows = data.slice(0, 5);
    previewRows.forEach(row => {
      html += '<tr>';
      headers.forEach(header => {
        html += `<td>${row[header] || ''}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    if (data.length > 5) {
      html += `<p class="preview-note">Showing 5 of ${data.length} rows</p>`;
    }
    
    csvPreviewTable.innerHTML = html;
  }

  function clearImport() {
    fileInput.value = '';
    selectedFile = null;
    csvData = [];
    fileName.textContent = 'No file selected';
    csvPreviewTable.innerHTML = '<p class="no-preview">CSV preview will appear here</p>';
    startImportBtn.disabled = true;
  }

  function downloadTemplate() {
    // Create a simple CSV template
    const headers = ['Name', 'Email', 'Phone', 'College'];
    const template = [headers.join(',')].join('\n');
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participants_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showImportConfirmation() {
    if (!csvData.length) {
      showNotification('No valid data to import', 'error');
      return;
    }
    
    importCountEl.textContent = csvData.length;
    importModal.style.display = 'block';
  }

  async function processImport() {
    importModal.style.display = 'none';
    
    if (!selectedFile || !currentEventId) {
      showNotification('Please select a file and event', 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      startImportBtn.disabled = true;
      startImportBtn.textContent = 'Importing...';
      
      const response = await fetch(`http://localhost:5000/api/participants/${currentEventId}/import`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
    // Note: DO NOT set 'Content-Type' here manually if you're using FormData
  },
  body: formData
});

      const result = await response.json();
      console.log(response)
      
      if (response.ok) {
        showNotification(`Successfully imported ${result.stats.added} participants`, 'success');
        
        // Display results
        const resultsDiv = document.getElementById('import-results');
        resultsDiv.innerHTML = `
          <div class="result-summary">
            <div class="result-stat">
              <span class="stat-label">Processed:</span>
              <span class="stat-value">${result.stats.processed}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Added:</span>
              <span class="stat-value">${result.stats.added}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Duplicates:</span>
              <span class="stat-value">${result.stats.duplicates}</span>
            </div>
            <div class="result-stat">
              <span class="stat-label">Errors:</span>
              <span class="stat-value">${result.stats.errors}</span>
            </div>
          </div>
          ${result.errors ? `<button class="btn small" id="view-errors">View Errors</button>
          <div class="error-details" id="error-details" style="display:none">
            <h4>Error Details</h4>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                ${result.errors.map(error => `
                  <tr>
                    <td>${JSON.stringify(error.row)}</td>
                    <td>${error.reason}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : ''}
        `;
        
        // Add event listener for view errors button if it exists
        const viewErrorsBtn = document.getElementById('view-errors');
        if (viewErrorsBtn) {
          viewErrorsBtn.addEventListener('click', () => {
            const errorDetails = document.getElementById('error-details');
            errorDetails.style.display = errorDetails.style.display === 'none' ? 'block' : 'none';
          });
        }
        
        // Clear the form after successful import
        clearImport();
      } else {
        showNotification(result.message || 'Import failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to import participants', 'error');
      console.error('Import error:', error);
    } finally {
      startImportBtn.disabled = false;
      startImportBtn.textContent = 'Import Participants';
    }
  }

 async function loadEvents() {
    try {
        const response = await fetch('http://localhost:5000/api/events', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch events');
        }
        
        const responseData = await response.json();
        
        console.log(responseData.events)
        
        events = responseData.events; // Assuming backend returns { data: [...] }
        populateEventSelects();
    } catch (error) {
        console.error('Error loading events:', error);
        showNotification('Error loading events: ' + error.message, 'error');
    }
}
  function populateEventSelects() {
    // Clear existing options
    importEventSelect.innerHTML = '<option value="">-- Select Event --</option>';
    exportEventSelect.innerHTML = '<option value="">-- Select Event --</option>';
    
    // Add events to both selects
    events.forEach(event => {
      const option = document.createElement('option');
      option.value = event._id;
      option.textContent = event.name;
      
      importEventSelect.appendChild(option.cloneNode(true));
      exportEventSelect.appendChild(option);
    });
  }

  function handleExportFilterChange() {
    // Ensure only one checkbox is selected at a time
    if (this.checked && this !== includeAllCheckbox) {
      includeAllCheckbox.checked = false;
    } else if (this.checked && this === includeAllCheckbox) {
      includeCheckedInCheckbox.checked = false;
      includeLunchCheckbox.checked = false;
      includeKitCheckbox.checked = false;
    }
    
    // Update stats based on filters
    updateExportStats();
  }

  async function updateExportStats() {
    if (!currentEventId) return;
    
    try {
      // Build filters object based on checkboxes
      const filters = {
        all: includeAllCheckbox.checked,
        checkedIn: includeCheckedInCheckbox.checked,
        lunch: includeLunchCheckbox.checked,
        kit: includeKitCheckbox.checked
      };
      
      // Convert filters to query string
      const queryString = new URLSearchParams({
        filters: JSON.stringify(filters)
      }).toString();
      
const response = await fetch(`http://localhost:5000/api/participants/${currentEventId}/stats/daily`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
      console.log(response)
      if (response.ok) {
        const stats = await response.json();
        
        totalParticipantsEl.textContent = stats.total;
        checkedInEl.textContent = stats.checkedIn;
        lunchCountEl.textContent = stats.lunch;
        kitCountEl.textContent = stats.kit;
      } else {
        throw new Error('Failed to load stats');
      }
    } catch (error) {
      showNotification('Error loading participant stats', 'error');
      console.error('Error loading stats:', error);
    }
  }

  async function exportParticipants() {
    if (!currentEventId) {
      showNotification('Please select an event', 'error');
      return;
    }
    
    try {
      startExportBtn.disabled = true;
      startExportBtn.textContent = 'Exporting...';
      
      // Build filters object based on checkboxes
      const filters = {
        all: includeAllCheckbox.checked,
        checkedIn: includeCheckedInCheckbox.checked,
        lunch: includeLunchCheckbox.checked,
        kit: includeKitCheckbox.checked
      };
      
      // Convert filters to query string
      const queryString = new URLSearchParams({
        filters: JSON.stringify(filters)
      }).toString();
      
   // Example for exportParticipants
const response = await fetch(`http://localhost:5000/api/participants/${currentEventId}/export?${queryString}`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Get filename from content-disposition header or generate one
        let filename = `participants_export_${new Date().toISOString().split('T')[0]}.csv`;
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) filename = filenameMatch[1];
        }
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Export completed successfully', 'success');
        addToExportHistory(filename);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }
    } catch (error) {
      showNotification(error.message || 'Failed to export participants', 'error');
      console.error('Export error:', error);
    } finally {
      startExportBtn.disabled = false;
      startExportBtn.textContent = 'Export to CSV';
    }
  }

  function addToExportHistory(filename) {
    const historyList = document.getElementById('export-history');
    const noHistory = historyList.querySelector('.no-history');
    
    if (noHistory) {
      noHistory.remove();
    }
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
      <i class="fas fa-file-csv"></i>
      <div class="history-details">
        <span class="history-filename">${filename}</span>
        <span class="history-date">${timeString}</span>
      </div>
      <a href="#" class="history-download" download="${filename}">
        <i class="fas fa-download"></i>
      </a>
    `;
    
    historyList.insertBefore(historyItem, historyList.firstChild);
    
    // Limit history to 5 items
    if (historyList.children.length > 5) {
      historyList.removeChild(historyList.lastChild);
    }
  }

  function showNotification(message, type) {
    notificationMessage.textContent = message;
    notification.className = `notification ${type} show`;
    
    // Set icon based on type
    notificationIcon.className = 'notification-icon';
    if (type === 'success') {
      notificationIcon.classList.add('fas', 'fa-check-circle');
    } else if (type === 'error') {
      notificationIcon.classList.add('fas', 'fa-exclamation-circle');
    } else {
      notificationIcon.classList.add('fas', 'fa-info-circle');
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 5000);
  }
});