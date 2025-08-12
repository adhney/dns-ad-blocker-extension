class BlocklistManager {
  constructor(dnsProxy) {
    this.dnsProxy = dnsProxy;
    this.defaultLists = [
      { name: "EasyList", url: "https://easylist.to/easylist/easylist.txt", description: "General ad blocking list" },
      { name: "AdGuard DNS", url: "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt", description: "Optimized for DNS blocking" },
      { name: "Common Ads", url: "built-in:common-ads", description: "Built-in list of common ad domains" },
      { name: "Trackers", url: "built-in:trackers", description: "Built-in list of tracking domains" }
    ];
  }
  
  async initialize() {
    // If no blocklists are configured, add default ones
    if (this.dnsProxy.blockLists.length === 0) {
      for (const list of this.defaultLists) {
        await this.dnsProxy.addBlocklist(list.name, list.url);
      }
    }
  }
  
  getAvailableDefaultLists() {
    return [...this.defaultLists];
  }
  
  async addList(name, url) {
    return await this.dnsProxy.addBlocklist(name, url);
  }
  
  async removeList(index) {
    return await this.dnsProxy.removeBlocklist(index);
  }
  
  async toggleList(index) {
    return await this.dnsProxy.toggleBlocklist(index);
  }
  
  async importListFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const domains = this.dnsProxy.parseBlocklist(content);
          
          if (domains.length === 0) {
            reject(new Error("No valid domains found in the file"));
            return;
          }
          
          // Create a data URL to store the content
          const dataUrl = `data:text/plain;base64,${btoa(content)}`;
          
          // Add the list
          await this.dnsProxy.addBlocklist(file.name, dataUrl);
          resolve({ name: file.name, domainsCount: domains.length });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };
      
      reader.readAsText(file);
    });
  }
  
  getCurrentLists() {
    return [...this.dnsProxy.blockLists];
  }
}

export default BlocklistManager;