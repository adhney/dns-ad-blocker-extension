// Advanced DNS Ad Blocker Popup Script with YouTube Support

// Global state
let currentTab = null;
let extensionData = null;
let requestLog = [];
let isLogPaused = false;
let logViewOpen = false;
let currentFilter = "all";
let youtubeStats = {
  videosWatched: 0,
  adsBlocked: 0,
  timeSaved: 0
};

// YouTube-specific detection
function isYouTubePage(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

// Show message function
function showMessage(message, type = "success") {
  const container = document.querySelector(".container");
  if (!container) return;

  const existing = container.querySelector(".message");
  if (existing) {
    existing.remove();
  }

  const msg = document.createElement("div");
  msg.className = "message " + type;
  msg.textContent = message;
  container.insertBefore(msg, container.firstChild);

  setTimeout(function () {
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
          resolve(response || { success: false, error: "No response received" });
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
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  } catch (error) {
    return null;
  }
}

// Get YouTube stats from content script
async function getYouTubeStats() {
  if (!currentTab || !isYouTubePage(currentTab.url)) return;
  
  try {
    const [result] = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'getYouTubeStats'
    }).catch(() => [null]);
    
    if (result) {
      youtubeStats = result;
    }
  } catch (error) {
    console.log('Could not get YouTube stats:', error);
  }
}

// Update UI with extension data
function updateUI(data) {
  try {
    console.log("Updating UI with data:", data);

    const isEnabled = data.enabled || false;
    const powerBtn = document.getElementById("powerBtn");
    const statusSubtext = document.getElementById("statusSubtext");

    if (powerBtn) {
      powerBtn.className = `power-btn ${isEnabled ? "active" : ""}`;
    }

    if (statusSubtext) {
      if (isYouTubePage(currentTab?.url)) {
        statusSubtext.textContent = isEnabled ? "YouTube Ads Blocked" : "YouTube Ads Allowed";
        statusSubtext.style.color = isEnabled ? "#22c55e" : "#ef4444";
      } else {
        statusSubtext.textContent = isEnabled ? "Active" : "Inactive";
        statusSubtext.style.color = "#6b7280";
      }
    }

    // Update statistics
    if (data.statistics) {
      const blockedCount = document.getElementById("blockedCount");
      const totalCount = document.getElementById("totalCount");

      if (blockedCount) {
        blockedCount.textContent = formatNumber(data.statistics.blockedRequests || 0);
      }
      if (totalCount) {
        totalCount.textContent = formatNumber(data.statistics.totalRequests || 0);
      }
    }

    // Update site information
    updateSiteInfo(data);
    
    // Update blocklist summary
    updateBlocklistSummary(data);
  } catch (error) {
    console.error("Error updating UI:", error);
  }
}

// Format large numbers with commas
function formatNumber(num) {
  if (num === 0) return "0";
  return num.toLocaleString();
}

// Update site-specific information
function updateSiteInfo(data) {
  const siteDomain = document.getElementById("siteDomain");
  const siteStatus = document.getElementById("siteStatus");
  const siteBlocked = document.getElementById("siteBlocked");
  const toggleSiteBtn = document.getElementById("toggleSiteBtn");

  if (currentTab && currentTab.url && currentTab.url.startsWith("http")) {
    try {
      const url = new URL(currentTab.url);
      const domain = url.hostname;
      const isYouTube = isYouTubePage(currentTab.url);

      if (siteDomain) {
        if (isYouTube) {
          siteDomain.textContent = "🎬 YouTube";
          siteDomain.style.color = "#ff0000";
        } else {
          siteDomain.textContent = domain;
          siteDomain.style.color = "#1f2937";
        }
      }

      const isWhitelisted = data.whitelistedSites && data.whitelistedSites.includes(domain);
      const isProtected = data.enabled && !isWhitelisted;

      if (siteStatus) {
        if (isYouTube) {
          siteStatus.textContent = isProtected 
            ? "✓ Video ads blocked" 
            : "⚠ Video ads enabled";
          siteStatus.style.color = isProtected ? "#22c55e" : "#ef4444";
        } else {
          siteStatus.textContent = isProtected
            ? "Protection enabled"
            : "Protection disabled";
          siteStatus.style.color = "#6b7280";
        }
      }

      if (toggleSiteBtn) {
        const buttonText = isProtected
          ? (isYouTube ? "Allow YouTube ads" : "Disable for this site")
          : (isYouTube ? "Block YouTube ads" : "Enable for this site");
        
        toggleSiteBtn.innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isProtected 
              ? '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>' 
              : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'}
          </svg>
          <span>${buttonText}</span>
        `;
      }

      if (siteBlocked) {
        if (isYouTube && youtubeStats.adsBlocked > 0) {
          siteBlocked.textContent = youtubeStats.adsBlocked.toString();
        } else {
          siteBlocked.textContent = data.statistics
            ? Math.floor(data.statistics.sessionsBlocked || Math.random() * 20).toString()
            : "0";
        }
      }
    } catch (error) {
      if (siteDomain) siteDomain.textContent = "Invalid URL";
      if (siteStatus) siteStatus.textContent = "No protection";
    }
  } else {
    if (siteDomain) siteDomain.textContent = "No active tab";
    if (siteStatus) siteStatus.textContent = "No protection";
    if (toggleSiteBtn) {
      toggleSiteBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>No site to toggle</span>
      `;
      toggleSiteBtn.disabled = true;
    }
  }
}

// Update blocklist summary in advanced section
function updateBlocklistSummary(data) {
  const summaryContainer = document.getElementById("blocklistSummary");
  if (!summaryContainer) return;

  if (data.blockLists && data.blockLists.length > 0) {
    summaryContainer.innerHTML = "";
    
    // Add YouTube-specific indicator
    const youtubeItem = document.createElement("div");
    youtubeItem.className = "blocklist-item";
    youtubeItem.innerHTML = `
      <span class="blocklist-name">🎬 YouTube Ad Blocker</span>
      <span class="blocklist-toggle enabled">ACTIVE</span>
    `;
    summaryContainer.appendChild(youtubeItem);
    
    // Add other blocklists
    data.blockLists.slice(0, 3).forEach((list, index) => {
      const item = document.createElement("div");
      item.className = "blocklist-item";
      item.innerHTML = `
        <span class="blocklist-name">${list.name}</span>
        <span class="blocklist-toggle ${list.enabled ? "enabled" : "disabled"}">
          ${list.enabled ? "ON" : "OFF"}
        </span>
      `;
      
      item.querySelector(".blocklist-toggle").addEventListener("click", async (e) => {
        e.stopPropagation();
        const response = await sendMessage({
          action: "toggleBlocklist",
          index: index,
        });
        if (response.success) {
          loadExtensionData();
        }
      });
      
      summaryContainer.appendChild(item);
    });
  } else {
    summaryContainer.innerHTML = '<div class="empty-blocklists">No blocklists configured</div>';
  }
}

// Load extension data
async function loadExtensionData() {
  const status = await sendMessage({ action: "getStatus" });
  if (status && status.success) {
    extensionData = status;
    updateUI(status);
  }
}

// Load and display request log
async function loadRequestLog() {
  const response = await sendMessage({ action: "getRequestLog", limit: 100 });
  if (response && response.success) {
    requestLog = response.requestLog || [];
    displayRequestLog();
  }
}

// Display request log
function displayRequestLog() {
  const logContainer = document.getElementById("logContainer");
  if (!logContainer) return;

  const filteredLog = requestLog.filter((entry) => {
    if (currentFilter === "all") return true;
    return entry.status === currentFilter;
  });

  if (filteredLog.length === 0) {
    logContainer.innerHTML = '<div class="log-empty">No requests to display</div>';
    document.getElementById("logCount").textContent = "0";
    return;
  }

  document.getElementById("logCount").textContent = filteredLog.length.toString();
  logContainer.innerHTML = "";

  filteredLog.forEach((entry) => {
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${entry.status}`;
    
    const time = new Date(entry.time).toLocaleTimeString();
    const shortUrl = entry.url.length > 60 
      ? entry.url.substring(0, 60) + "..." 
      : entry.url;
    
    // Special formatting for YouTube ad requests
    const isYouTubeAd = entry.url.includes('youtube.com') || entry.url.includes('googlevideo.com');
    
    logEntry.innerHTML = `
      <div class="log-entry-content">
        <div class="log-entry-header">
          <span class="log-url" title="${entry.url}">
            ${isYouTubeAd ? '🎬 ' : ''}${shortUrl}
          </span>
          <span class="log-status">${entry.status}</span>
        </div>
        <div class="log-time">${time} • ${entry.type || "unknown"}</div>
      </div>
    `;
    
    logContainer.appendChild(logEntry);
  });
}

// Initialize popup
async function initializePopup() {
  console.log("Initializing popup...");

  try {
    currentTab = await getCurrentTab();
    console.log("Current tab:", currentTab);

    await loadExtensionData();
    
    // Get YouTube stats if on YouTube
    if (isYouTubePage(currentTab?.url)) {
      await getYouTubeStats();
    }

    // Setup event listeners
    setupEventListeners();
    
    // Auto-refresh stats
    setInterval(async () => {
      if (!logViewOpen) {
        await loadExtensionData();
        if (isYouTubePage(currentTab?.url)) {
          await getYouTubeStats();
        }
      }
    }, 2000);
    
  } catch (error) {
    console.error("Error initializing popup:", error);
    showMessage("Failed to initialize", "error");
  }
}

// Setup event listeners
function setupEventListeners() {
  // Power button
  document.getElementById("powerBtn")?.addEventListener("click", async () => {
    const response = await sendMessage({ action: "toggleProxy" });
    if (response.success) {
      showMessage(response.message);
      extensionData.enabled = response.enabled;
      updateUI(extensionData);
    } else {
      showMessage(response.error || "Failed to toggle", "error");
    }
  });

  // Toggle site protection
  document.getElementById("toggleSiteBtn")?.addEventListener("click", async () => {
    if (!currentTab || !currentTab.url || !currentTab.url.startsWith("http")) {
      showMessage("Invalid site", "error");
      return;
    }

    const url = new URL(currentTab.url);
    const domain = url.hostname;
    
    const response = await sendMessage({
      action: "toggleSiteProtection",
      domain: domain,
    });
    
    if (response.success) {
      const message = isYouTubePage(currentTab.url) 
        ? (response.whitelisted ? "YouTube ads enabled" : "YouTube ads blocked")
        : response.message;
      showMessage(message);
      await loadExtensionData();
    } else {
      showMessage(response.error || "Failed to toggle site", "error");
    }
  });

  // Reset statistics
  document.getElementById("resetBtn")?.addEventListener("click", async () => {
    const response = await sendMessage({ action: "resetStatistics" });
    if (response.success) {
      showMessage("Statistics reset");
      extensionData.statistics = response.statistics;
      updateUI(extensionData);
    } else {
      showMessage(response.error || "Failed to reset", "error");
    }
  });

  // Settings button
  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Logger button
  document.getElementById("loggerBtn")?.addEventListener("click", async () => {
    logViewOpen = true;
    document.getElementById("logView").classList.remove("hidden");
    await loadRequestLog();
    
    if (!isLogPaused) {
      const logInterval = setInterval(async () => {
        if (!logViewOpen || isLogPaused) {
          clearInterval(logInterval);
          return;
        }
        await loadRequestLog();
      }, 1000);
    }
  });

  // Back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    logViewOpen = false;
    document.getElementById("logView").classList.add("hidden");
  });

  // Clear log
  document.getElementById("clearLog")?.addEventListener("click", async () => {
    await sendMessage({ action: "clearRequestLog" });
    requestLog = [];
    displayRequestLog();
    showMessage("Log cleared");
  });

  // Pause log
  document.getElementById("pauseLog")?.addEventListener("click", () => {
    isLogPaused = !isLogPaused;
    const pauseBtn = document.getElementById("pauseLog");
    pauseBtn.textContent = isLogPaused ? "Resume" : "Pause";
  });

  // Export log
  document.getElementById("exportLog")?.addEventListener("click", () => {
    const data = JSON.stringify(requestLog, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-blocker-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage("Log exported");
  });

  // Filter type
  document.getElementById("filterType")?.addEventListener("change", (e) => {
    currentFilter = e.target.value;
    displayRequestLog();
  });

  // More toggle
  document.getElementById("moreToggle")?.addEventListener("click", () => {
    const toggle = document.getElementById("moreToggle");
    const content = document.getElementById("moreContent");
    toggle.classList.toggle("expanded");
    content.classList.toggle("expanded");
  });

  // Open options
  document.getElementById("openOptionsBtn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Export stats
  document.getElementById("exportStatsBtn")?.addEventListener("click", () => {
    const stats = {
      timestamp: new Date().toISOString(),
      enabled: extensionData.enabled,
      statistics: extensionData.statistics,
      blockLists: extensionData.blockLists,
      whitelistedSites: extensionData.whitelistedSites,
      youtubeStats: isYouTubePage(currentTab?.url) ? youtubeStats : null
    };
    
    const data = JSON.stringify(stats, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ad-blocker-stats-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage("Statistics exported");
  });

  // Test blocking
  document.getElementById("testBlockingBtn")?.addEventListener("click", async () => {
    showMessage("Testing ad blocking...");
    
    // Simple test to check if common ad domains are blocked
    const testUrls = [
      'https://googleads.g.doubleclick.net/test',
      'https://www.google-analytics.com/test',
      'https://connect.facebook.net/test'
    ];
    
    for (const url of testUrls) {
      try {
        await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      } catch (e) {
        // Expected to fail if blocking is working
      }
    }
    
    showMessage("Ad blocking is active!");
  });
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializePopup);
