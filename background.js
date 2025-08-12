// DNS Ad Blocker Background Service Worker
console.log("DNS Ad Blocker background script loading...");

// Extension state
let extensionState = {
  enabled: true,
  statistics: {
    blockedRequests: 0,
    totalRequests: 0,
    sessionsBlocked: 0,
  },
  blockLists: [
    {
      name: "EasyList",
      enabled: true,
      url: "https://easylist.to/easylist/easylist.txt",
    },
    {
      name: "EasyPrivacy",
      enabled: true,
      url: "https://easylist.to/easylist/easyprivacy.txt",
    },
    {
      name: "uBlock Origin",
      enabled: true,
      url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
    },
    {
      name: "Steven Black",
      enabled: true,
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    },
    {
      name: "Steven Black + Social",
      enabled: false,
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social/hosts",
    },
    {
      name: "Steven Black + Gambling",
      enabled: false,
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling/hosts",
    },
  ],
  whitelistedSites: [],
  currentTab: null,
};

// Request log storage
let requestLog = [];
const MAX_LOG_ENTRIES = 1000;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log("DNS Ad Blocker installed");

  // Load saved state
  try {
    const saved = await chrome.storage.local.get(["extensionState"]);
    if (saved.extensionState) {
      extensionState = { ...extensionState, ...saved.extensionState };
    } else {
      // First install - ensure extension is enabled by default
      extensionState.enabled = true;
      await saveState();
      console.log("First install - extension enabled by default");
    }
  } catch (error) {
    console.error("Error loading saved state:", error);
  }

  // Set initial badge
  updateBadge();

  // Load default block rules
  await loadBlockingRules();
});

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  switch (message.action) {
    case "getStatus":
      sendResponse({
        success: true,
        enabled: extensionState.enabled,
        statistics: extensionState.statistics,
        blockLists: extensionState.blockLists,
        whitelistedSites: extensionState.whitelistedSites,
        currentTab: extensionState.currentTab,
      });
      break;

    case "getRequestLog":
      sendResponse({
        success: true,
        requestLog: requestLog.slice(0, message.limit || 100),
      });
      break;

    case "clearRequestLog":
      requestLog = [];
      sendResponse({
        success: true,
        message: "Request log cleared",
      });
      break;

    case "toggleProxy":
      toggleExtension()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response

    case "resetStatistics":
      resetStatistics()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response

    case "toggleSiteProtection":
      toggleSiteProtection(message.domain)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response

    case "toggleBlocklist":
      toggleBlocklist(message.index)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response

    case "addBlocklist":
      addBlocklist(message.name, message.url)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response

    case "removeBlocklist":
      removeBlocklist(message.index)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Async response

    case "getDefaultLists":
      sendResponse({
        success: true,
        defaultLists: getDefaultLists(),
      });
      break;

    default:
      sendResponse({ success: false, error: "Unknown action" });
  }
});

// Toggle extension on/off
async function toggleExtension() {
  try {
    extensionState.enabled = !extensionState.enabled;

    if (extensionState.enabled) {
      await enableBlocking();
    } else {
      await disableBlocking();
    }

    await saveState();
    updateBadge();

    console.log("Extension toggled:", extensionState.enabled ? "ON" : "OFF");

    return {
      success: true,
      enabled: extensionState.enabled,
      message: extensionState.enabled
        ? "DNS Ad Blocker enabled"
        : "DNS Ad Blocker disabled",
    };
  } catch (error) {
    console.error("Error toggling extension:", error);
    return { success: false, error: error.message };
  }
}

// Enable blocking rules
async function enableBlocking() {
  try {
    // Get enabled block lists
    const enabledLists = extensionState.blockLists.filter(
      (list) => list.enabled
    );

    // Create basic blocking rules for common ad domains
    const blockingRules = [
      // Google Ads
      {
        id: 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.doubleclick.net/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 2,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.googlesyndication.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 3,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://ads.google.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 4,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.googleadservices.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 5,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.googletagmanager.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      
      // Analytics and Tracking
      {
        id: 6,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.analytics.google.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 7,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.google-analytics.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 8,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.facebook.com/tr*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      
      // Amazon Ads
      {
        id: 9,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.amazon-adsystem.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 10,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://adsystem.amazon.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      
      // Other major ad networks
      {
        id: 11,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.adsystem.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 12,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.adscdn.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 13,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.2mdn.net/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 14,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.adsrvr.org/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
      {
        id: 15,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: "*://*.adnxs.com/*",
          resourceTypes: ["script", "xmlhttprequest", "image"],
        },
      },
    ];

    // Create allowlist rules for whitelisted sites (higher priority)
    const allowRules = [];
    let ruleId = 100; // Start allowlist rules at ID 100 to avoid conflicts

    extensionState.whitelistedSites.forEach((domain) => {
      // Add allow rules for each whitelisted domain with higher priority
      allowRules.push({
        id: ruleId++,
        priority: 10, // Higher priority than blocking rules
        action: { type: "allow" },
        condition: {
          initiatorDomains: [domain],
          resourceTypes: ["script", "xmlhttprequest", "image", "main_frame", "sub_frame"],
        },
      });
      
      // Also allow requests TO the whitelisted domain
      allowRules.push({
        id: ruleId++,
        priority: 10,
        action: { type: "allow" },
        condition: {
          requestDomains: [domain],
          resourceTypes: ["script", "xmlhttprequest", "image", "main_frame", "sub_frame"],
        },
      });
    });

    const allRules = [...blockingRules, ...allowRules];

    // First, remove ALL existing dynamic rules to ensure clean state
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map((rule) => rule.id);
      
      if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds,
        });
      }
    } catch (error) {
      console.log("No existing rules to remove or error removing:", error);
    }

    // Add rules using declarativeNetRequest
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: allRules,
    });

    console.log("Blocking rules enabled:", blockingRules.length);
    console.log("Allowlist rules for whitelisted sites:", allowRules.length);
    console.log("Whitelisted sites:", extensionState.whitelistedSites);
  } catch (error) {
    console.error("Error enabling blocking:", error);
    throw error;
  }
}

// Disable blocking rules
async function disableBlocking() {
  try {
    // Remove all dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map((rule) => rule.id);

    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });
    }

    console.log("Blocking rules disabled");
  } catch (error) {
    console.error("Error disabling blocking:", error);
    throw error;
  }
}

// Load default blocking rules
async function loadBlockingRules() {
  if (extensionState.enabled) {
    await enableBlocking();
  }
}

// Reset statistics
async function resetStatistics() {
  try {
    extensionState.statistics = {
      blockedRequests: 0,
      totalRequests: 0,
      sessionsBlocked: 0,
    };

    await saveState();
    updateBadge();

    console.log("Statistics reset");

    return {
      success: true,
      statistics: extensionState.statistics,
      message: "Statistics reset successfully",
    };
  } catch (error) {
    console.error("Error resetting statistics:", error);
    return { success: false, error: error.message };
  }
}

// Toggle site protection
async function toggleSiteProtection(domain) {
  try {
    if (!domain) {
      throw new Error("No domain provided");
    }

    const index = extensionState.whitelistedSites.indexOf(domain);
    let isWhitelisted;

    if (index > -1) {
      extensionState.whitelistedSites.splice(index, 1);
      isWhitelisted = false;
    } else {
      extensionState.whitelistedSites.push(domain);
      isWhitelisted = true;
    }

    await saveState();

    // Reload blocking rules to apply whitelist changes
    if (extensionState.enabled) {
      await enableBlocking();
      console.log("Blocking rules reloaded after site protection toggle");
    }

    console.log(
      "Site protection toggled for",
      domain,
      "- Whitelisted:",
      isWhitelisted,
      "- Total whitelisted sites:",
      extensionState.whitelistedSites.length
    );

    return {
      success: true,
      domain: domain,
      whitelisted: isWhitelisted,
      message: isWhitelisted
        ? `Protection disabled for ${domain}`
        : `Protection enabled for ${domain}`,
    };
  } catch (error) {
    console.error("Error toggling site protection:", error);
    return { success: false, error: error.message };
  }
}

// Update badge with blocked count
function updateBadge() {
  const text = extensionState.enabled
    ? extensionState.statistics.blockedRequests.toString()
    : "OFF";

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({
    color: extensionState.enabled ? "#22c55e" : "#ef4444",
  });
}

// Toggle blocklist enabled/disabled state
async function toggleBlocklist(index) {
  try {
    if (index < 0 || index >= extensionState.blockLists.length) {
      throw new Error("Invalid blocklist index");
    }

    extensionState.blockLists[index].enabled =
      !extensionState.blockLists[index].enabled;

    await saveState();

    // Reload blocking rules if extension is enabled
    if (extensionState.enabled) {
      await loadBlockingRules();
    }

    console.log("Blocklist toggled:", extensionState.blockLists[index]);

    return {
      success: true,
      blockLists: extensionState.blockLists,
      message: `Blocklist ${
        extensionState.blockLists[index].enabled ? "enabled" : "disabled"
      }`,
    };
  } catch (error) {
    console.error("Error toggling blocklist:", error);
    return { success: false, error: error.message };
  }
}

// Add new blocklist
async function addBlocklist(name, url) {
  try {
    if (!name || !url) {
      throw new Error("Name and URL are required");
    }

    // Check if URL already exists
    const existingList = extensionState.blockLists.find(
      (list) => list.url === url
    );
    if (existingList) {
      throw new Error("Blocklist with this URL already exists");
    }

    // Add new blocklist
    const newList = {
      name: name.trim(),
      url: url.trim(),
      enabled: true,
    };

    extensionState.blockLists.push(newList);

    await saveState();

    // Reload blocking rules if extension is enabled
    if (extensionState.enabled) {
      await loadBlockingRules();
    }

    console.log("Blocklist added:", newList);

    return {
      success: true,
      blockLists: extensionState.blockLists,
      message: `Added ${name} successfully`,
    };
  } catch (error) {
    console.error("Error adding blocklist:", error);
    return { success: false, error: error.message };
  }
}

// Remove blocklist
async function removeBlocklist(index) {
  try {
    if (index < 0 || index >= extensionState.blockLists.length) {
      throw new Error("Invalid blocklist index");
    }

    const removedList = extensionState.blockLists.splice(index, 1)[0];

    await saveState();

    // Reload blocking rules if extension is enabled
    if (extensionState.enabled) {
      await loadBlockingRules();
    }

    console.log("Blocklist removed:", removedList);

    return {
      success: true,
      blockLists: extensionState.blockLists,
      message: `Removed ${removedList.name} successfully`,
    };
  } catch (error) {
    console.error("Error removing blocklist:", error);
    return { success: false, error: error.message };
  }
}

// Get default/recommended blocklists
function getDefaultLists() {
  return [
    {
      name: "EasyList",
      url: "https://easylist.to/easylist/easylist.txt",
      description: "Most popular general purpose ad blocking filter list",
    },
    {
      name: "EasyPrivacy",
      url: "https://easylist.to/easylist/easyprivacy.txt",
      description: "Blocks tracking scripts and other privacy invasions",
    },
    {
      name: "uBlock Origin Filters",
      url: "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
      description: "Additional filters from the uBlock Origin project",
    },
    {
      name: "Steven Black's Unified Hosts",
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
      description: "Unified hosts file with base adware + malware protection",
    },
    {
      name: "Steven Black's Unified Hosts + Social",
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social/hosts",
      description:
        "Base protection + social media blocking (Facebook, Twitter, etc.)",
    },
    {
      name: "Steven Black's Unified Hosts + Gambling",
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/gambling/hosts",
      description: "Base protection + gambling sites blocking",
    },
    {
      name: "Steven Black's Unified Hosts + Social + Gambling",
      url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/social-gambling/hosts",
      description: "Base protection + social media + gambling blocking",
    },
    {
      name: "Peter Lowe's Ad and tracking server list",
      url: "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext",
      description: "A comprehensive list of ad and tracking servers",
    },
    {
      name: "Malware Domain List",
      url: "https://www.malwaredomainlist.com/hostslist/hosts.txt",
      description: "Blocks domains hosting malware and malicious content",
    },
  ];
}

// Helper function to add request to log
function addRequestToLog(url, status, details = {}) {
  const entry = {
    url: url,
    status: status, // 'blocked' or 'allowed'
    time: new Date(),
    type: details.type || "unknown",
    tabId: details.tabId || null,
    initiator: details.initiator || null,
  };

  requestLog.unshift(entry);

  // Keep only recent entries
  if (requestLog.length > MAX_LOG_ENTRIES) {
    requestLog = requestLog.slice(0, MAX_LOG_ENTRIES);
  }

  console.log("Request logged:", entry.status, entry.url.substring(0, 100));
}

// Check if URL should be blocked
function shouldBlockUrl(url) {
  const urlLower = url.toLowerCase();
  const blockedDomains = [
    // Google Ads and Analytics
    "doubleclick.net",
    "googlesyndication.com",
    "ads.google.com",
    "analytics.google.com",
    "googletagmanager.com",
    "google-analytics.com",
    "googleadservices.com",
    
    // Social Media Tracking
    "facebook.com/tr",
    
    // Amazon Ads
    "adsystem.amazon.com",
    "amazon-adsystem.com",
    
    // Other major ad networks
    "adsystem.com",
    "adscdn.com",
    "2mdn.net",
    "adsrvr.org",
    "adnxs.com",
  ];

  return blockedDomains.some((domain) => urlLower.includes(domain));
}

// Save state to storage
async function saveState() {
  try {
    await chrome.storage.local.set({ extensionState });
    console.log("State saved");
  } catch (error) {
    console.error("Error saving state:", error);
  }
}

// Track current active tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith("http")) {
      const url = new URL(tab.url);
      extensionState.currentTab = {
        id: tab.id,
        url: tab.url,
        domain: url.hostname,
        title: tab.title,
      };
    }
  } catch (error) {
    console.error("Error tracking active tab:", error);
  }
});

// Listen for web requests to update statistics and log
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (extensionState.enabled) {
      extensionState.statistics.totalRequests++;

      // Check if this request should be blocked
      const shouldBlock = shouldBlockUrl(details.url);

      // Add to request log
      addRequestToLog(details.url, shouldBlock ? "blocked" : "allowed", {
        type: details.type,
        tabId: details.tabId,
        initiator: details.initiator,
      });

      // If it would be blocked, increment blocked count
      if (shouldBlock) {
        extensionState.statistics.blockedRequests++;
        updateBadge();
      }

      // Save state periodically
      if (extensionState.statistics.totalRequests % 10 === 0) {
        saveState();
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Listen for blocked requests using declarativeNetRequest
if (
  chrome.declarativeNetRequest &&
  chrome.declarativeNetRequest.onRuleMatchedDebug
) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (extensionState.enabled && info.request) {
      extensionState.statistics.blockedRequests++;
      updateBadge();

      // Add to request log with blocked status
      addRequestToLog(info.request.url, "blocked", {
        type: info.request.resourceType,
        tabId: info.request.tabId,
        initiator: info.request.initiator,
      });

      // Save state periodically
      if (extensionState.statistics.blockedRequests % 5 === 0) {
        saveState();
      }

      console.log(
        "Blocked request via declarativeNetRequest:",
        info.request.url
      );
    }
  });
} else {
  console.log(
    "declarativeNetRequest debug API not available, using webRequest fallback"
  );
}

console.log("DNS Ad Blocker background script loaded");
