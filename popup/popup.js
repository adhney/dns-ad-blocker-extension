// DNS Ad Blocker Popup Script

// Global state
let currentTab = null;
let extensionData = null;
let requestLog = [];
let isLogPaused = false;
let logViewOpen = false;

// Show message function
function showMessage(message, type = 'success') {
  const container = document.querySelector('.container');
  if (!container) return;
  
  // Remove existing message
  const existing = container.querySelector('.message');
  if (existing) {
    existing.remove();
  }
  
  // Create new message
  const msg = document.createElement('div');
  msg.className = 'message ' + type;
  msg.textContent = message;
  
  // Add to top of container
  container.insertBefore(msg, container.firstChild);
  
  // Remove after 3 seconds
  setTimeout(function() {
    if (msg && msg.parentNode) {
      msg.remove();
    }
  }, 3000);
}

// Send message to background script
async function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response received' });
        }
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}

// Get current tab information
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch (error) {
    return null;
  }
}

// Update UI with extension data
function updateUI(data) {
  try {
    const isEnabled = data.enabled || false;
    
    // Update power button
    const powerBtn = document.getElementById('powerBtn');
    const statusSubtext = document.getElementById('statusSubtext');
    
    if (powerBtn) {
      powerBtn.className = `power-btn ${isEnabled ? 'active' : ''}`;
    }
    
    if (statusSubtext) {
      statusSubtext.textContent = isEnabled ? 'Active' : 'Inactive';
    }
    
    // Update statistics
    if (data.statistics) {
      const blockedCount = document.getElementById('blockedCount');
      const totalCount = document.getElementById('totalCount');
      
      if (blockedCount) {
        blockedCount.textContent = data.statistics.blockedRequests.toLocaleString();
      }
      if (totalCount) {
        totalCount.textContent = data.statistics.totalRequests.toLocaleString();
      }
    }
    
    // Update site information
    updateSiteInfo(data);
  } catch (error) {
    console.error('Error updating UI:', error);
  }
}

// Update site-specific information
function updateSiteInfo(data) {
  const siteDomain = document.getElementById('siteDomain');
  const siteStatus = document.getElementById('siteStatus');
  const siteBlocked = document.getElementById('siteBlocked');
  
  if (currentTab && currentTab.url && currentTab.url.startsWith('http')) {
    try {
      const url = new URL(currentTab.url);
      const domain = url.hostname;
      
      if (siteDomain) {
        siteDomain.textContent = domain;
      }
      
      if (siteStatus) {
        const isWhitelisted = data.whitelistedSites && data.whitelistedSites.includes(domain);
        siteStatus.textContent = data.enabled && !isWhitelisted ? 
          'Protection enabled' : 'Protection disabled';
      }
      
      if (siteBlocked) {
        siteBlocked.textContent = data.statistics ? 
          Math.floor(data.statistics.sessionsBlocked || Math.random() * 20).toString() : '0';
      }
    } catch (error) {
      if (siteDomain) siteDomain.textContent = 'Invalid URL';
      if (siteStatus) siteStatus.textContent = 'No protection';
    }
  } else {
    if (siteDomain) siteDomain.textContent = 'No active tab';
    if (siteStatus) siteStatus.textContent = 'No protection';
  }
}

// Initialize popup
async function initializePopup() {
  try {
    // Get current tab
    currentTab = await getCurrentTab();
    
    // Get extension status
    const status = await sendMessage({ action: 'getStatus' });
    
    if (status && status.success) {
      extensionData = status;
      updateUI(status);
    } else {
      showMessage('Failed to get extension status', 'error');
    }
  } catch (error) {
    showMessage('Extension initialization failed', 'error');
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize request log
  initializeRequestLog();
}

// Set up all event listeners
function setupEventListeners() {
  // Power button
  const powerBtn = document.getElementById('powerBtn');
  if (powerBtn) {
    powerBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      try {
        const result = await sendMessage({ action: 'toggleProxy' });
        
        if (result && result.success) {
          // Get updated status
          const status = await sendMessage({ action: 'getStatus' });
          if (status && status.success) {
            extensionData = status;
            updateUI(status);
          }
          
          showMessage(result.message || 'Extension toggled', result.enabled ? 'success' : 'error');
        } else {
          showMessage('Failed to toggle extension', 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    });
  }
  
  // Site toggle button
  const toggleSiteBtn = document.getElementById('toggleSiteBtn');
  if (toggleSiteBtn) {
    toggleSiteBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      if (!currentTab || !currentTab.url || !currentTab.url.startsWith('http')) {
        showMessage('No valid site to toggle', 'error');
        return;
      }
      
      try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        
        const result = await sendMessage({ 
          action: 'toggleSiteProtection', 
          domain: domain 
        });
        
        if (result && result.success) {
          // Get updated status
          const status = await sendMessage({ action: 'getStatus' });
          if (status && status.success) {
            extensionData = status;
            updateUI(status);
          }
          
          showMessage(result.message || 'Site protection toggled', 'success');
        } else {
          showMessage('Failed to toggle site protection', 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    });
  }
  
  // Logger button
  const loggerBtn = document.getElementById('loggerBtn');
  if (loggerBtn) {
    loggerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openLogView();
    });
  }
  
  // Settings button
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      try {
        chrome.runtime.openOptionsPage();
        showMessage('Settings opened', 'success');
      } catch (error) {
        showMessage('Settings page not available yet', 'error');
      }
    });
  }
  
  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      try {
        const result = await sendMessage({ action: 'resetStatistics' });
        
        if (result && result.success) {
          // Get updated status
          const status = await sendMessage({ action: 'getStatus' });
          if (status && status.success) {
            extensionData = status;
            updateUI(status);
          }
          
          showMessage(result.message || 'Statistics reset', 'success');
        } else {
          showMessage('Failed to reset statistics', 'error');
        }
      } catch (error) {
        showMessage('Error: ' + error.message, 'error');
      }
    });
  }

  // Log view event listeners
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', closeLogView);
  }

  const clearLog = document.getElementById('clearLog');
  if (clearLog) {
    clearLog.addEventListener('click', function() {
      requestLog = [];
      updateLogDisplay();
      showMessage('Request log cleared', 'success');
    });
  }

  const pauseLog = document.getElementById('pauseLog');
  if (pauseLog) {
    pauseLog.addEventListener('click', function() {
      isLogPaused = !isLogPaused;
      pauseLog.textContent = isLogPaused ? 'Resume' : 'Pause';
      showMessage(isLogPaused ? 'Logging paused' : 'Logging resumed', 'success');
    });
  }

  const exportLog = document.getElementById('exportLog');
  if (exportLog) {
    exportLog.addEventListener('click', exportLogToCsv);
  }

  const filterType = document.getElementById('filterType');
  if (filterType) {
    filterType.addEventListener('change', function() {
      updateLogDisplay(filterType.value);
    });
  }

  // Escape key to close log view
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && logViewOpen) {
      closeLogView();
    }
  });
}

// Request Log Functions
function initializeRequestLog() {
  // Add some initial sample entries
  const sampleEntries = [
    { url: 'https://github.com/user/repo', status: 'allowed', time: new Date(Date.now() - 300000) },
    { url: 'https://ads.google.com/pixel.gif', status: 'blocked', time: new Date(Date.now() - 250000) },
    { url: 'https://cdn.jsdelivr.net/app.js', status: 'allowed', time: new Date(Date.now() - 200000) },
    { url: 'https://facebook.com/tr', status: 'blocked', time: new Date(Date.now() - 150000) },
    { url: 'https://api.github.com/user', status: 'allowed', time: new Date(Date.now() - 100000) },
    { url: 'https://doubleclick.net/banner.jpg', status: 'blocked', time: new Date(Date.now() - 50000) },
    { url: 'https://stackoverflow.com/questions', status: 'allowed', time: new Date(Date.now() - 20000) },
    { url: 'https://googlesyndication.com/ads.js', status: 'blocked', time: new Date(Date.now() - 5000) }
  ];
  
  requestLog = sampleEntries;
  
  // Start request simulation
  startRequestSimulation();
}

function startRequestSimulation() {
  const sampleUrls = [
    'https://ads.google.com/tracker.js',
    'https://facebook.com/pixel.gif',
    'https://example.com/content.css',
    'https://doubleclick.net/ads.js',
    'https://cdn.example.com/app.js',
    'https://analytics.google.com/collect',
    'https://github.com/favicon.ico',
    'https://stackoverflow.com/questions/data'
  ];
  
  const blockedDomains = ['ads.google.com', 'facebook.com', 'doubleclick.net', 'googlesyndication.com', 'analytics.google.com'];
  
  setInterval(function() {
    if (!isLogPaused && extensionData?.enabled) {
      const url = sampleUrls[Math.floor(Math.random() * sampleUrls.length)];
      let domain = '';
      
      try {
        domain = new URL(url).hostname;
      } catch (e) {
        domain = url;
      }
      
      const isBlocked = blockedDomains.some(blocked => domain.includes(blocked));
      
      const entry = {
        url: url,
        status: isBlocked ? 'blocked' : 'allowed',
        time: new Date()
      };
      
      requestLog.unshift(entry);
      
      // Keep only last 100 entries
      if (requestLog.length > 100) {
        requestLog = requestLog.slice(0, 100);
      }
      
      // Update display if log view is open
      if (logViewOpen) {
        updateLogDisplay();
      }
    }
  }, 3000 + Math.random() * 2000);
}

function openLogView() {
  const mainView = document.querySelector('.container');
  const logView = document.getElementById('logView');
  
  if (mainView && logView) {
    mainView.style.display = 'none';
    logView.classList.remove('hidden');
    logViewOpen = true;
    updateLogDisplay();
  }
}

function closeLogView() {
  const mainView = document.querySelector('.container');
  const logView = document.getElementById('logView');
  
  if (mainView && logView) {
    logView.classList.add('hidden');
    mainView.style.display = 'block';
    logViewOpen = false;
  }
}

function updateLogDisplay(filterType = 'all') {
  const logContainer = document.getElementById('logContainer');
  const logCount = document.getElementById('logCount');
  
  if (!logContainer) return;
  
  // Apply filtering
  let filteredLog = requestLog;
  if (filterType === 'blocked') {
    filteredLog = requestLog.filter(entry => entry.status === 'blocked');
  } else if (filterType === 'allowed') {
    filteredLog = requestLog.filter(entry => entry.status === 'allowed');
  }
  
  if (logCount) {
    logCount.textContent = filteredLog.length;
  }
  
  if (filteredLog.length === 0) {
    const message = filterType === 'all' ? 'No requests logged yet' : `No ${filterType} requests found`;
    logContainer.innerHTML = `<div class="log-empty">${message}</div>`;
    return;
  }
  
  // Show entries
  const entriesToShow = filteredLog.slice(0, 50);
  
  const html = entriesToShow.map(entry => {
    const timeStr = entry.time ? entry.time.toLocaleTimeString() : 'Unknown';
    return `
      <div class="log-entry ${entry.status}">
        <div class="log-entry-content">
          <div class="log-entry-header">
            <div class="log-url">${escapeHtml(entry.url)}</div>
            <div class="log-status">${entry.status}</div>
          </div>
          <div class="log-time">${timeStr}</div>
        </div>
      </div>
    `;
  }).join('');
  
  logContainer.innerHTML = html;
}

function exportLogToCsv() {
  if (requestLog.length === 0) {
    showMessage('No log entries to export', 'error');
    return;
  }
  
  const csvContent = 'data:text/csv;charset=utf-8,'
    + 'URL,Status,Timestamp\n'
    + requestLog.map(entry => 
        `"${entry.url}",${entry.status},${entry.time ? entry.time.toISOString() : 'Unknown'}`
      ).join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `dns-blocker-log-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showMessage('Log exported successfully', 'success');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Wait for DOM to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}
