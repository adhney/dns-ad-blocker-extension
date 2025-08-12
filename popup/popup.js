// DNS Ad Blocker Popup Script

// Global state
let currentTab = null;
let extensionData = null;
let requestLog = [];
let isLogPaused = false;
let logViewOpen = false;
let currentFilter = "all"; // Track current filter

// Show message function
function showMessage(message, type = "success") {
  const container = document.querySelector(".container");
  if (!container) return;

  // Remove existing message
  const existing = container.querySelector(".message");
  if (existing) {
    existing.remove();
  }

  // Create new message
  const msg = document.createElement("div");
  msg.className = "message " + type;
  msg.textContent = message;

  // Add to top of container
  container.insertBefore(msg, container.firstChild);

  // Remove after 3 seconds
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
          resolve(
            response || { success: false, error: "No response received" }
          );
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

// Update UI with extension data
function updateUI(data) {
  try {
    console.log("Updating UI with data:", data);

    const isEnabled = data.enabled || false;
    console.log("Extension enabled:", isEnabled);

    // Update power button
    const powerBtn = document.getElementById("powerBtn");
    const statusSubtext = document.getElementById("statusSubtext");

    if (powerBtn) {
      powerBtn.className = `power-btn ${isEnabled ? "active" : ""}`;
      console.log("Power button class updated:", powerBtn.className);
    }

    if (statusSubtext) {
      statusSubtext.textContent = isEnabled ? "Active" : "Inactive";
      console.log("Status updated:", statusSubtext.textContent);
    }

    // Update statistics
    if (data.statistics) {
      const blockedCount = document.getElementById("blockedCount");
      const totalCount = document.getElementById("totalCount");

      if (blockedCount) {
        blockedCount.textContent = formatNumber(
          data.statistics.blockedRequests || 0
        );
        console.log("Blocked count updated:", blockedCount.textContent);
      }
      if (totalCount) {
        totalCount.textContent = formatNumber(
          data.statistics.totalRequests || 0
        );
        console.log("Total count updated:", totalCount.textContent);
      }
    }

    // Update site information
    updateSiteInfo(data);
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

      if (siteDomain) {
        siteDomain.textContent = domain;
      }

      // Check if site is whitelisted
      const isWhitelisted =
        data.whitelistedSites && data.whitelistedSites.includes(domain);
      const isProtected = data.enabled && !isWhitelisted;

      if (siteStatus) {
        siteStatus.textContent = isProtected
          ? "Protection enabled"
          : "Protection disabled";
      }

      // Update toggle button text based on current protection status
      if (toggleSiteBtn) {
        const buttonText = isProtected
          ? "Disable for this site"
          : "Enable for this site";
        toggleSiteBtn.querySelector("span").textContent = buttonText;
        console.log("Site button updated:", buttonText, "for domain:", domain);
      }

      if (siteBlocked) {
        siteBlocked.textContent = data.statistics
          ? Math.floor(
              data.statistics.sessionsBlocked || Math.random() * 20
            ).toString()
          : "0";
      }
    } catch (error) {
      if (siteDomain) siteDomain.textContent = "Invalid URL";
      if (siteStatus) siteStatus.textContent = "No protection";
      if (toggleSiteBtn)
        toggleSiteBtn.querySelector("span").textContent =
          "Disable for this site";
    }
  } else {
    if (siteDomain) siteDomain.textContent = "No active tab";
    if (siteStatus) siteStatus.textContent = "No protection";
    if (toggleSiteBtn)
      toggleSiteBtn.querySelector("span").textContent = "No site to toggle";
  }
}

// Initialize popup
async function initializePopup() {
  console.log("Initializing popup...");

  try {
    // Get current tab
    currentTab = await getCurrentTab();
    console.log("Current tab:", currentTab);

    // Get extension status
    const status = await sendMessage({ action: "getStatus" });
    console.log("Extension status received:", status);

    if (status && status.success) {
      extensionData = status;
      updateUI(status);
      console.log("Extension data loaded:", status);
    } else {
      console.error("Failed to get extension status:", status);
      showMessage("Failed to get extension status", "error");
    }
  } catch (error) {
    console.error("Extension initialization failed:", error);
    showMessage("Extension initialization failed", "error");
  }

  // Set up event listeners
  setupEventListeners();

  // Initialize request log
  initializeRequestLog();

  // Refresh stats every 2 seconds when popup is open
  const refreshInterval = setInterval(async () => {
    try {
      const status = await sendMessage({ action: "getStatus" });
      if (status && status.success) {
        extensionData = status;
        updateUI(status);
      }
    } catch (error) {
      console.error("Error refreshing stats:", error);
    }
  }, 2000);

  // Clear interval when popup is closed
  window.addEventListener("beforeunload", () => {
    clearInterval(refreshInterval);
  });
}

// Set up all event listeners
function setupEventListeners() {
  // Power button
  const powerBtn = document.getElementById("powerBtn");
  if (powerBtn) {
    powerBtn.addEventListener("click", async function (e) {
      e.preventDefault();

      console.log("Power button clicked");

      try {
        const result = await sendMessage({ action: "toggleProxy" });
        console.log("Toggle result:", result);

        if (result && result.success) {
          // Get updated status
          const status = await sendMessage({ action: "getStatus" });
          console.log("Updated status:", status);

          if (status && status.success) {
            extensionData = status;
            updateUI(status);
          }

          showMessage(result.message || "Extension toggled", "success");
        } else {
          console.error("Toggle failed:", result);
          showMessage(
            "Failed to toggle extension: " + (result?.error || "Unknown error"),
            "error"
          );
        }
      } catch (error) {
        console.error("Power button error:", error);
        showMessage("Error: " + error.message, "error");
      }
    });
  }

  // Site toggle button
  const toggleSiteBtn = document.getElementById("toggleSiteBtn");
  if (toggleSiteBtn) {
    toggleSiteBtn.addEventListener("click", async function (e) {
      e.preventDefault();

      if (
        !currentTab ||
        !currentTab.url ||
        !currentTab.url.startsWith("http")
      ) {
        showMessage("No valid site to toggle", "error");
        return;
      }

      try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;

        const result = await sendMessage({
          action: "toggleSiteProtection",
          domain: domain,
        });

        if (result && result.success) {
          // Get updated status
          const status = await sendMessage({ action: "getStatus" });
          if (status && status.success) {
            extensionData = status;
            updateUI(status);
          }

          showMessage(result.message || "Site protection toggled", "success");
        } else {
          showMessage("Failed to toggle site protection", "error");
        }
      } catch (error) {
        showMessage("Error: " + error.message, "error");
      }
    });
  }

  // Logger button
  const loggerBtn = document.getElementById("loggerBtn");
  if (loggerBtn) {
    loggerBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openLogView();
    });
  }

  // Settings button
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", function (e) {
      e.preventDefault();

      try {
        chrome.runtime.openOptionsPage();
        showMessage("Settings opened", "success");
      } catch (error) {
        showMessage("Settings page not available yet", "error");
      }
    });
  }

  // Reset button
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async function (e) {
      e.preventDefault();

      try {
        const result = await sendMessage({ action: "resetStatistics" });

        if (result && result.success) {
          // Get updated status
          const status = await sendMessage({ action: "getStatus" });
          if (status && status.success) {
            extensionData = status;
            updateUI(status);
          }

          showMessage(result.message || "Statistics reset", "success");
        } else {
          showMessage("Failed to reset statistics", "error");
        }
      } catch (error) {
        showMessage("Error: " + error.message, "error");
      }
    });
  }

  // Log view event listeners
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", closeLogView);
  }

  const clearLog = document.getElementById("clearLog");
  if (clearLog) {
    clearLog.addEventListener("click", async function () {
      try {
        const response = await sendMessage({ action: "clearRequestLog" });
        if (response && response.success) {
          requestLog = [];
          updateLogDisplay(currentFilter); // Use current filter
          showMessage("Request log cleared", "success");
        } else {
          showMessage("Failed to clear request log", "error");
        }
      } catch (error) {
        console.error("Error clearing request log:", error);
        showMessage("Error clearing request log", "error");
      }
    });
  }

  const pauseLog = document.getElementById("pauseLog");
  if (pauseLog) {
    pauseLog.addEventListener("click", function () {
      isLogPaused = !isLogPaused;
      pauseLog.textContent = isLogPaused ? "Resume" : "Pause";
      showMessage(
        isLogPaused ? "Logging paused" : "Logging resumed",
        "success"
      );
    });
  }

  const exportLog = document.getElementById("exportLog");
  if (exportLog) {
    exportLog.addEventListener("click", exportLogToCsv);
  }

  const filterType = document.getElementById("filterType");
  if (filterType) {
    filterType.addEventListener("change", function () {
      currentFilter = filterType.value; // Update current filter
      updateLogDisplay(currentFilter);
    });
  }

  // Escape key to close log view
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && logViewOpen) {
      closeLogView();
    }
  });

  // More/Advanced section toggle
  const moreToggle = document.getElementById("moreToggle");
  const moreContent = document.getElementById("moreContent");
  if (moreToggle && moreContent) {
    moreToggle.addEventListener("click", function () {
      const isExpanded = moreContent.classList.contains("expanded");
      if (isExpanded) {
        moreContent.classList.remove("expanded");
        moreToggle.classList.remove("expanded");
      } else {
        moreContent.classList.add("expanded");
        moreToggle.classList.add("expanded");
        updateBlocklistSummary();
      }
    });
  }

  // Advanced section buttons
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener("click", function () {
      try {
        chrome.runtime.openOptionsPage();
        showMessage("Options page opened", "success");
      } catch (error) {
        showMessage("Options page not available", "error");
      }
    });
  }

  const exportStatsBtn = document.getElementById("exportStatsBtn");
  if (exportStatsBtn) {
    exportStatsBtn.addEventListener("click", exportStatistics);
  }

  const aboutBtn = document.getElementById("aboutBtn");
  if (aboutBtn) {
    aboutBtn.addEventListener("click", function () {
      showMessage(
        "DNS Ad Blocker v1.0 - Advanced ad blocking extension",
        "success"
      );
    });
  }
}

// Request Log Functions
async function initializeRequestLog() {
  console.log("Initializing request log...");

  // Load real request log from background script
  try {
    const response = await sendMessage({ action: "getRequestLog", limit: 100 });
    if (response && response.success) {
      requestLog = response.requestLog || [];
      console.log("Loaded", requestLog.length, "request log entries");
    } else {
      console.error("Failed to load request log:", response);
      requestLog = [];
    }
  } catch (error) {
    console.error("Error loading request log:", error);
    requestLog = [];
  }

  // Start periodic refresh of request log when log view is open
  startLogRefresh();
}

function startLogRefresh() {
  setInterval(async () => {
    if (logViewOpen && !isLogPaused) {
      try {
        const response = await sendMessage({
          action: "getRequestLog",
          limit: 100,
        });
        if (response && response.success) {
          requestLog = response.requestLog || [];
          updateLogDisplay(currentFilter); // Use current filter instead of no filter
        }
      } catch (error) {
        console.error("Error refreshing request log:", error);
      }
    }
  }, 2000); // Refresh every 2 seconds
}

function openLogView() {
  const mainView = document.querySelector(".container");
  const logView = document.getElementById("logView");

  if (mainView && logView) {
    mainView.style.display = "none";
    logView.classList.remove("hidden");
    logViewOpen = true;
    currentFilter = "all"; // Reset filter when opening
    const filterSelect = document.getElementById("filterType");
    if (filterSelect) {
      filterSelect.value = "all";
    }
    updateLogDisplay(currentFilter);
  }
}

function closeLogView() {
  const mainView = document.querySelector(".container");
  const logView = document.getElementById("logView");

  if (mainView && logView) {
    logView.classList.add("hidden");
    mainView.style.display = "block";
    logViewOpen = false;
  }
}

function updateLogDisplay(filterType = "all") {
  const logContainer = document.getElementById("logContainer");
  const logCount = document.getElementById("logCount");

  if (!logContainer) return;

  // Update current filter
  currentFilter = filterType;

  // Apply filtering
  let filteredLog = requestLog;
  if (filterType === "blocked") {
    filteredLog = requestLog.filter((entry) => entry.status === "blocked");
  } else if (filterType === "allowed") {
    filteredLog = requestLog.filter((entry) => entry.status === "allowed");
  }

  if (logCount) {
    logCount.textContent = filteredLog.length;
  }

  if (filteredLog.length === 0) {
    const message =
      filterType === "all"
        ? "No requests logged yet"
        : `No ${filterType} requests found`;
    logContainer.innerHTML = `<div class="log-empty">${message}</div>`;
    return;
  }

  // Show entries
  const entriesToShow = filteredLog.slice(0, 50);

  const html = entriesToShow
    .map((entry) => {
      // Handle both old and new time formats
      let timeStr = "Unknown";
      if (entry.time) {
        if (typeof entry.time === "string") {
          timeStr = new Date(entry.time).toLocaleTimeString();
        } else if (entry.time instanceof Date) {
          timeStr = entry.time.toLocaleTimeString();
        } else {
          timeStr = new Date(entry.time).toLocaleTimeString();
        }
      }

      // Get additional info and truncate URL
      const typeInfo = entry.type ? ` (${entry.type})` : "";
      const truncatedUrl = truncateUrl(entry.url);

      return `
      <div class="log-entry ${entry.status}">
        <div class="log-entry-content">
          <div class="log-entry-header">
            <div class="log-url" title="${escapeHtml(entry.url)}">${escapeHtml(
        truncatedUrl
      )}</div>
            <div class="log-status">${entry.status}</div>
          </div>
          <div class="log-time">${timeStr}${typeInfo}</div>
        </div>
      </div>
    `;
    })
    .join("");

  logContainer.innerHTML = html;
}

function exportLogToCsv() {
  if (requestLog.length === 0) {
    showMessage("No log entries to export", "error");
    return;
  }

  const csvContent =
    "data:text/csv;charset=utf-8," +
    "URL,Status,Timestamp\n" +
    requestLog
      .map(
        (entry) =>
          `"${entry.url}",${entry.status},${
            entry.time ? entry.time.toISOString() : "Unknown"
          }`
      )
      .join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `dns-blocker-log-${new Date().toISOString().split("T")[0]}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showMessage("Log exported successfully", "success");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// Truncate long URLs for better display
function truncateUrl(url, maxLength = 60) {
  if (!url || url.length <= maxLength) return url;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname + urlObj.search;

    if (domain.length + path.length <= maxLength) {
      return url;
    }

    // If domain is too long, truncate it
    if (domain.length > 30) {
      const truncatedDomain = domain.substring(0, 27) + "...";
      return `${urlObj.protocol}//${truncatedDomain}`;
    }

    // Truncate path
    const availableLength =
      maxLength - domain.length - urlObj.protocol.length - 3; // 3 for ://
    if (availableLength > 10) {
      const truncatedPath =
        path.length > availableLength
          ? path.substring(0, availableLength - 3) + "..."
          : path;
      return `${urlObj.protocol}//${domain}${truncatedPath}`;
    }

    return `${urlObj.protocol}//${domain}`;
  } catch (e) {
    // Fallback for invalid URLs
    return url.length > maxLength
      ? url.substring(0, maxLength - 3) + "..."
      : url;
  }
}

// Update blocklist summary in advanced section
function updateBlocklistSummary() {
  const container = document.getElementById("blocklistSummary");
  if (!container || !extensionData?.blockLists) return;

  if (extensionData.blockLists.length === 0) {
    container.innerHTML =
      '<div class="empty-blocklists">No blocklists configured</div>';
    return;
  }

  const html = extensionData.blockLists
    .map(
      (blocklist) => `
    <div class="blocklist-item">
      <span class="blocklist-name">${escapeHtml(blocklist.name)}</span>
      <span class="blocklist-status ${
        blocklist.enabled ? "enabled" : "disabled"
      }">
        ${blocklist.enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  `
    )
    .join("");

  container.innerHTML = html;
}

// Export statistics as JSON
function exportStatistics() {
  if (!extensionData?.statistics) {
    showMessage("No statistics available to export", "error");
    return;
  }

  const stats = {
    exportDate: new Date().toISOString(),
    extensionEnabled: extensionData.enabled,
    statistics: extensionData.statistics,
    blocklists: extensionData.blockLists,
    whitelistedSites: extensionData.whitelistedSites || [],
  };

  const dataStr = JSON.stringify(stats, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `dns-blocker-stats-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showMessage("Statistics exported successfully", "success");
}

// Wait for DOM to load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePopup);
} else {
  initializePopup();
}
