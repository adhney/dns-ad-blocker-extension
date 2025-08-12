class Statistics {
  constructor(dnsProxy) {
    this.dnsProxy = dnsProxy;
    this.startTime = Date.now();
  }
  
  getStats() {
    const stats = this.dnsProxy.getStatistics();
    const runningTime = Math.floor((Date.now() - this.startTime) / 1000); // in seconds
    
    return {
      ...stats,
      runningTime,
      blockPercentage: stats.totalRequests > 0 
        ? (stats.blockedRequests / stats.totalRequests * 100).toFixed(2) 
        : 0
    };
  }
  
  async resetStats() {
    this.startTime = Date.now();
    return await this.dnsProxy.resetStatistics();
  }
}

export default Statistics;