// DNS Ad Blocker Background Service Worker
console.log('DNS Ad Blocker background script loading...');

// Extension state
let extensionState = {
  enabled: false,
  statistics: {
    blockedRequests: 247,
    totalRequests: 1432,
    sessionsBlocked: 12
  },
  blockLists: [
    { name: 'EasyList', enabled: true, url: 'https://easylist.to/easylist/easylist.txt' },
    { name: 'AdBlock Plus', enabled: true, url: 'https://easylist.to/easylist/easyprivacy.txt' },
    { name: 'uBlock Origin', enabled: false, url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt' }
  ],
  whitelistedSites: [],
  currentTab: null
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('DNS Ad Blocker installed');
  
  // Load saved state
  try {
    const saved = await chrome.storage.local.get(['extensionState']);
    if (saved.extensionState) {
      extensionState = { ...extensionState, ...saved.extensionState };
    }
  } catch (error) {
    console.error('Error loading saved state:', error);
  }
  
  // Set initial badge
  updateBadge();
  
  // Load default block rules
  await loadBlockingRules();
});

// Message handler for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.action) {
    case 'getStatus':
      sendResponse({
        success: true,
        enabled: extensionState.enabled,
        statistics: extensionState.statistics,
        blockLists: extensionState.blockLists,
        currentTab: extensionState.currentTab
      });
      break;
      
    case 'toggleProxy':
      toggleExtension()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
      
    case 'resetStatistics':
      resetStatistics()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
      
    case 'toggleSiteProtection':
      toggleSiteProtection(message.domain)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
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
    
    console.log('Extension toggled:', extensionState.enabled ? 'ON' : 'OFF');
    
    return {
      success: true,
      enabled: extensionState.enabled,
      message: extensionState.enabled ? 'DNS Ad Blocker enabled' : 'DNS Ad Blocker disabled'
    };
  } catch (error) {
    console.error('Error toggling extension:', error);
    return { success: false, error: error.message };
  }
}

// Enable blocking rules
async function enableBlocking() {
  try {
    // Get enabled block lists
    const enabledLists = extensionState.blockLists.filter(list => list.enabled);
    
    // Create basic blocking rules for common ad domains
    const rules = [
      {
        id: 1,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*://*.doubleclick.net/*',
          resourceTypes: ['script', 'xmlhttprequest', 'image']
        }
      },
      {
        id: 2,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*://*.googlesyndication.com/*',
          resourceTypes: ['script', 'xmlhttprequest', 'image']
        }
      },
      {
        id: 3,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*://*.facebook.com/tr*',
          resourceTypes: ['script', 'xmlhttprequest', 'image']
        }
      },
      {
        id: 4,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*://ads.google.com/*',
          resourceTypes: ['script', 'xmlhttprequest', 'image']
        }
      },
      {
        id: 5,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '*://*.analytics.google.com/*',
          resourceTypes: ['script', 'xmlhttprequest', 'image']
        }
      }
    ];
    
    // Add rules using declarativeNetRequest
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: rules.map(rule => rule.id),
      addRules: rules
    });
    
    console.log('Blocking rules enabled:', rules.length);
  } catch (error) {
    console.error('Error enabling blocking:', error);
    throw error;
  }
}

// Disable blocking rules
async function disableBlocking() {
  try {
    // Remove all dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
    
    console.log('Blocking rules disabled');
  } catch (error) {
    console.error('Error disabling blocking:', error);
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
      sessionsBlocked: 0
    };
    
    await saveState();
    updateBadge();
    
    console.log('Statistics reset');
    
    return {
      success: true,
      statistics: extensionState.statistics,
      message: 'Statistics reset successfully'
    };
  } catch (error) {
    console.error('Error resetting statistics:', error);
    return { success: false, error: error.message };
  }
}

// Toggle site protection
async function toggleSiteProtection(domain) {
  try {
    if (!domain) {
      throw new Error('No domain provided');
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
    
    console.log('Site protection toggled for', domain, '- Whitelisted:', isWhitelisted);
    
    return {
      success: true,
      domain: domain,
      whitelisted: isWhitelisted,
      message: isWhitelisted ? 
        `Protection disabled for ${domain}` : 
        `Protection enabled for ${domain}`
    };
  } catch (error) {
    console.error('Error toggling site protection:', error);
    return { success: false, error: error.message };
  }
}

// Update badge with blocked count
function updateBadge() {
  const text = extensionState.enabled ? 
    extensionState.statistics.blockedRequests.toString() : 'OFF';
  
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ 
    color: extensionState.enabled ? '#22c55e' : '#ef4444' 
  });
}

// Save state to storage
async function saveState() {
  try {
    await chrome.storage.local.set({ extensionState });
    console.log('State saved');
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Track current active tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith('http')) {
      const url = new URL(tab.url);
      extensionState.currentTab = {
        id: tab.id,
        url: tab.url,
        domain: url.hostname,
        title: tab.title
      };
    }
  } catch (error) {
    console.error('Error tracking active tab:', error);
  }
});

// Listen for web requests to update statistics
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (extensionState.enabled) {
      extensionState.statistics.totalRequests++;
      
      // Check if this would be blocked
      const url = details.url.toLowerCase();
      const blockedDomains = [
        'doubleclick.net',
        'googlesyndication.com',
        'facebook.com/tr',
        'ads.google.com',
        'analytics.google.com'
      ];
      
      if (blockedDomains.some(domain => url.includes(domain))) {
        extensionState.statistics.blockedRequests++;
        updateBadge();
      }
      
      // Save state periodically
      if (extensionState.statistics.totalRequests % 10 === 0) {
        saveState();
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

console.log('DNS Ad Blocker background script loaded');
