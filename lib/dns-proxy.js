class DNSProxy {
  constructor() {
    this.enabled = false;
    this.blockLists = [];
    this.cachedBlockedDomains = new Set();
    this.statistics = {
      totalRequests: 0,
      blockedRequests: 0,
      lastUpdated: Date.now(),
    };
    this.maxRules = 300000; // Chrome limit for dynamic rules
  }

  async initialize() {
    console.log("Initializing DNS Proxy...");

    // Load saved settings
    const settings = await chrome.storage.local.get([
      "enabled",
      "blockLists",
      "statistics",
    ]);
    this.enabled = settings.enabled || false;
    this.blockLists = settings.blockLists || [];
    this.statistics = settings.statistics || this.statistics;

    console.log("Loaded settings:", {
      enabled: this.enabled,
      blockListCount: this.blockLists.length,
    });

    // Compile blocklists into a single set for efficient lookups
    await this.compileBlocklists();

    // Set up blocking if enabled
    if (this.enabled) {
      await this.enableBlocking();
    }

    console.log("DNS Proxy initialized successfully");
  }

  async compileBlocklists() {
    this.cachedBlockedDomains = new Set();

    for (const list of this.blockLists) {
      if (!list.enabled) continue;

      try {
        const domains = await this.fetchBlocklist(list.url);
        domains.forEach((domain) => this.cachedBlockedDomains.add(domain));
        console.log(`Added ${domains.length} domains from ${list.name}`);
      } catch (error) {
        console.error(`Failed to fetch blocklist ${list.name}:`, error);
      }
    }

    console.log(
      `Compiled ${this.cachedBlockedDomains.size} domains into blocklist`
    );
  }

  async fetchBlocklist(url) {
    // Check if it's a built-in list or a URL
    if (url.startsWith("built-in:")) {
      return this.getBuiltInList(url.replace("built-in:", ""));
    }

    // Check if it's a data URL
    if (url.startsWith("data:")) {
      const content = atob(url.split(",")[1]);
      return this.parseBlocklist(content);
    }

    // For external URLs, we'll skip fetching for now to avoid CORS issues
    // In a real implementation, you'd fetch these in the background
    console.log(`Skipping external URL for now: ${url}`);
    return [];
  }

  parseBlocklist(text) {
    const lines = text.split("\n");
    const domains = [];

    for (let line of lines) {
      line = line.trim();
      if (line === "" || line.startsWith("#")) continue;

      // Handle hosts file format (127.0.0.1 domain.com)
      if (line.startsWith("127.0.0.1") || line.startsWith("0.0.0.0")) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          domains.push(parts[1]);
        }
        continue;
      }

      // Simple domain list format
      if (this.isValidDomain(line)) {
        domains.push(line);
      }
    }

    return domains;
  }

  isValidDomain(domain) {
    return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain);
  }

  getBuiltInList(listName) {
    const builtInLists = {
      "common-ads": [
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "adnxs.com",
        "google-analytics.com",
        "googletagmanager.com",
        "amazonadservices.com",
        "amazon-adsystem.com",
        "adsystem.amazon.com",
        "googletag.com",
        "facebook.com",
      ],
      trackers: [
        "google-analytics.com",
        "hotjar.com",
        "clicktale.net",
        "mouseflow.com",
        "fullstory.com",
        "loggly.com",
        "mixpanel.com",
        "segment.com",
        "intercom.io",
      ],
      malware: [
        "malware.domain.com",
        "phishing.example.com",
        "suspicious.site.com",
      ],
    };

    return builtInLists[listName] || [];
  }

  async enableBlocking() {
    console.log("Enabling blocking...");

    try {
      // Clear existing rules first
      const existingRules =
        await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIdsToRemove = existingRules.map((rule) => rule.id);

      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove,
        });
      }

      // Create blocking rules from domains
      const rules = this.createBlockingRules();

      if (rules.length > 0) {
        // Add rules in batches to avoid hitting limits
        const batchSize = 1000;
        for (let i = 0; i < rules.length; i += batchSize) {
          const batch = rules.slice(i, i + batchSize);
          await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: batch,
          });
          console.log(
            `Added batch ${i / batchSize + 1}/${Math.ceil(
              rules.length / batchSize
            )}`
          );
        }
      }

      this.enabled = true;
      await this.saveSettings();

      console.log(`Blocking enabled with ${rules.length} rules`);
    } catch (error) {
      console.error("Failed to enable blocking:", error);
      throw error;
    }
  }

  createBlockingRules() {
    const rules = [];
    const domains = Array.from(this.cachedBlockedDomains);

    // Limit to Chrome's maximum rules
    const maxDomains = Math.min(domains.length, this.maxRules);

    for (let i = 0; i < maxDomains; i++) {
      const domain = domains[i];

      rules.push({
        id: i + 1,
        priority: 1,
        action: {
          type: "block",
        },
        condition: {
          urlFilter: `*://${domain}/*`,
          resourceTypes: [
            "main_frame",
            "sub_frame",
            "stylesheet",
            "script",
            "image",
            "font",
            "object",
            "xmlhttprequest",
            "ping",
            "csp_report",
            "media",
            "websocket",
            "other",
          ],
        },
      });

      // Also block subdomains
      rules.push({
        id: i + maxDomains + 1,
        priority: 1,
        action: {
          type: "block",
        },
        condition: {
          urlFilter: `*://*.${domain}/*`,
          resourceTypes: [
            "main_frame",
            "sub_frame",
            "stylesheet",
            "script",
            "image",
            "font",
            "object",
            "xmlhttprequest",
            "ping",
            "csp_report",
            "media",
            "websocket",
            "other",
          ],
        },
      });
    }

    return rules.slice(0, this.maxRules); // Ensure we don't exceed Chrome's limit
  }

  async disableBlocking() {
    console.log("Disabling blocking...");

    try {
      // Remove all dynamic rules
      const existingRules =
        await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIdsToRemove = existingRules.map((rule) => rule.id);

      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove,
        });
      }

      this.enabled = false;
      await this.saveSettings();

      console.log("Blocking disabled");
    } catch (error) {
      console.error("Failed to disable blocking:", error);
      throw error;
    }
  }

  async toggleProxy() {
    console.log("Toggling proxy, current state:", this.enabled);

    try {
      if (this.enabled) {
        await this.disableBlocking();
      } else {
        await this.enableBlocking();
      }

      console.log("Toggle completed, new state:", this.enabled);
      return this.enabled;
    } catch (error) {
      console.error("Toggle failed:", error);
      throw error;
    }
  }

  async addBlocklist(name, url, enabled = true) {
    console.log(`Adding blocklist: ${name}`);
    this.blockLists.push({ name, url, enabled });
    await this.compileBlocklists();

    if (this.enabled) {
      await this.enableBlocking();
    }

    await this.saveSettings();
    return this.blockLists;
  }

  async removeBlocklist(index) {
    if (index >= 0 && index < this.blockLists.length) {
      console.log(`Removing blocklist at index ${index}`);
      this.blockLists.splice(index, 1);
      await this.compileBlocklists();

      if (this.enabled) {
        await this.enableBlocking();
      }

      await this.saveSettings();
    }

    return this.blockLists;
  }

  async toggleBlocklist(index) {
    if (index >= 0 && index < this.blockLists.length) {
      console.log(`Toggling blocklist at index ${index}`);
      this.blockLists[index].enabled = !this.blockLists[index].enabled;
      await this.compileBlocklists();

      if (this.enabled) {
        await this.enableBlocking();
      }

      await this.saveSettings();
    }

    return this.blockLists;
  }

  async saveSettings() {
    await chrome.storage.local.set({
      enabled: this.enabled,
      blockLists: this.blockLists,
    });
  }

  async saveStatistics() {
    await chrome.storage.local.set({
      statistics: this.statistics,
    });
  }

  async resetStatistics() {
    this.statistics = {
      totalRequests: 0,
      blockedRequests: 0,
      lastUpdated: Date.now(),
    };
    await this.saveStatistics();
    return this.statistics;
  }

  getStatistics() {
    return { ...this.statistics };
  }

  // Simulate statistics for now since we can't easily track with declarativeNetRequest
  updateStatistics() {
    // This is a simplified version - in reality you'd need to track actual requests
    this.statistics.totalRequests += Math.floor(Math.random() * 10) + 1;
    this.statistics.blockedRequests += Math.floor(Math.random() * 3);
    this.statistics.lastUpdated = Date.now();
  }
}

export default DNSProxy;
