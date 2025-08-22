// General Advanced Ad Blocker Content Script
// Implements advanced ad blocking techniques for all websites

(function () {
  "use strict";

  console.log("[Advanced AdBlock] Initializing content script...");

  // Configuration
  const CONFIG = {
    blockInlineScripts: true,
    blockIframes: true,
    blockPopups: true,
    blockWebSockets: true,
    cosmenticFiltering: true,
    debugMode: false,
  };

  const debug = (...args) => {
    if (CONFIG.debugMode) {
      console.log("[Advanced AdBlock]", ...args);
    }
  };

  // ============= Advanced Element Hiding =============

  // Comprehensive list of ad selectors
  const universalAdSelectors = [
    // Generic ad containers
    '[id*="ad-"]:not([id*="load"]):not([id*="head"])',
    '[id*="ads-"]:not([id*="loads"])',
    '[id*="advert"]',
    '[id*="banner"]',
    '[id*="sponsor"]',
    '[id*="promo"]:not([id*="promotion-al"])',
    '[class*="ad-"]:not([class*="add"]):not([class*="admin"]):not([class*="load"]):not([class*="head"]):not([class*="adjust"]):not([class*="advance"])',
    '[class*="ads-"]:not([class*="loads"])',
    '[class*="advert"]',
    '[class*="banner"]:not([class*="banner-content"])',
    '[class*="sponsor"]',
    '[class*="promo"]:not([class*="promotion-al"])',

    // Specific ad types
    ".google-ads",
    ".googleads",
    ".ad-container",
    ".ad-wrapper",
    ".ad-unit",
    ".advertisement",
    ".ads-container",
    ".adsense",
    ".adsbygoogle",
    ".dfp-ad",
    ".display-ad",
    ".text-ad",
    ".native-ad",
    ".promoted-content",
    ".sponsored-content",
    ".paid-content",

    // Popup and overlay ads
    '[class*="popup"]:not([class*="popup-content"])',
    '[class*="overlay"]:not([class*="overlay-content"])',
    '[class*="modal"][class*="ad"]',
    ".interstitial",
    ".lightbox-ad",

    // Sidebar and widget ads
    ".sidebar-ad",
    ".widget-ad",
    ".side-banner",

    // Video ads
    ".video-ad",
    ".preroll-ad",
    ".midroll-ad",
    ".postroll-ad",

    // Social media ads
    '[data-testid*="promo"]',
    '[data-testid*="sponsor"]',
    '[aria-label*="Sponsored"]',
    '[aria-label*="Advertisement"]',

    // Newsletter and subscription popups
    ".newsletter-popup",
    ".subscribe-popup",
    ".email-capture",

    // Cookie banners (optional)
    ".cookie-banner",
    ".cookie-consent",
    ".gdpr-banner",
  ];

  // Hide elements with advanced techniques
  function hideAdElements() {
    // Method 1: Direct removal
    universalAdSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          // Check if element is actually visible and likely an ad
          if (isLikelyAd(el)) {
            el.style.display = "none !important";
            el.style.visibility = "hidden !important";
            el.style.opacity = "0 !important";
            el.style.height = "0 !important";
            el.style.width = "0 !important";
            el.style.overflow = "hidden !important";
            el.setAttribute("data-blocked-ad", "true");
            debug(`Hidden element: ${selector}`);
          }
        });
      } catch (e) {
        // Ignore selector errors
      }
    });

    // Method 2: Shadow DOM inspection
    inspectShadowDOM();
  }

  // Check if element is likely an ad
  function isLikelyAd(element) {
    if (!element) return false;

    // Skip if element is too small (likely not an ad)
    const rect = element.getBoundingClientRect();
    if (rect.width < 50 && rect.height < 50) return false;

    // Check for ad-related attributes
    const attributes = ["id", "class", "data-ad", "data-sponsor", "data-promo"];
    for (let attr of attributes) {
      const value = element.getAttribute(attr);
      if (value && /ad|sponsor|promo|banner/i.test(value)) {
        return true;
      }
    }

    // Check for ad-related content
    const text = element.textContent.toLowerCase();
    const adKeywords = ["advertisement", "sponsored", "promoted", "ads by"];
    if (adKeywords.some((keyword) => text.includes(keyword))) {
      return true;
    }

    return false;
  }

  // ============= Script Injection Blocking =============

  function blockScriptInjection() {
    // Override createElement to block ad scripts
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName) {
      const element = originalCreateElement.call(document, tagName);

      if (tagName.toLowerCase() === "script") {
        // Override src setter to block ad scripts
        const originalSrcSetter = Object.getOwnPropertyDescriptor(
          HTMLScriptElement.prototype,
          "src"
        ).set;
        Object.defineProperty(element, "src", {
          set: function (value) {
            if (isAdScript(value)) {
              debug(`Blocked script: ${value}`);
              return;
            }
            originalSrcSetter.call(this, value);
          },
        });
      }

      if (tagName.toLowerCase() === "iframe") {
        // Override src setter to block ad iframes
        const originalSrcSetter = Object.getOwnPropertyDescriptor(
          HTMLIFrameElement.prototype,
          "src"
        ).set;
        Object.defineProperty(element, "src", {
          set: function (value) {
            if (isAdUrl(value)) {
              debug(`Blocked iframe: ${value}`);
              return;
            }
            originalSrcSetter.call(this, value);
          },
        });
      }

      return element;
    };
  }

  // Check if URL is an ad script
  function isAdScript(url) {
    if (!url) return false;

    const adDomains = [
      "doubleclick.net",
      "googlesyndication.com",
      "googleadservices.com",
      "googletagmanager.com",
      "google-analytics.com",
      "facebook.com/tr",
      "amazon-adsystem.com",
      "adsystem.com",
      "adsrvr.org",
      "adnxs.com",
      "taboola.com",
      "outbrain.com",
      "criteo.com",
      "pubmatic.com",
      "smartadserver.com",
      "rubiconproject.com",
      "openx.net",
      "appnexus.com",
      "contextweb.com",
      "districtm.io",
      "sovrn.com",
      "indexexchange.com",
      "media.net",
      "revcontent.com",
      "yandex.ru/metrika",
      "mc.yandex.ru",
      "scorecardresearch.com",
      "quantserve.com",
      "hotjar.com",
      "mouseflow.com",
      "clarity.ms",
      "fullstory.com",
    ];

    return adDomains.some((domain) => url.includes(domain));
  }

  // Check if URL is likely an ad
  function isAdUrl(url) {
    if (!url) return false;
    return (
      isAdScript(url) ||
      url.includes("/ads/") ||
      url.includes("/ad/") ||
      url.includes("banner") ||
      url.includes("popup")
    );
  }

  // ============= Network Request Interception =============

  function interceptNetworkRequests() {
    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const url = args[0];

      if (typeof url === "string" && isAdUrl(url)) {
        debug(`Blocked fetch request: ${url}`);
        return Promise.resolve(
          new Response("", {
            status: 204,
            statusText: "No Content",
          })
        );
      }

      return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (isAdUrl(url)) {
        debug(`Blocked XHR request: ${url}`);
        this.abort();
        return;
      }
      return originalXHROpen.apply(this, arguments);
    };

    // Block WebSocket connections to ad servers
    if (CONFIG.blockWebSockets) {
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function (url) {
        if (isAdUrl(url)) {
          debug(`Blocked WebSocket: ${url}`);
          throw new Error("WebSocket blocked");
        }
        return new originalWebSocket(url);
      };
    }
  }

  // ============= Popup and Redirect Blocking =============

  function blockPopupsAndRedirects() {
    // Override window.open
    const originalOpen = window.open;
    window.open = function () {
      const url = arguments[0];
      if (!url || isAdUrl(url)) {
        debug(`Blocked popup: ${url}`);
        return null;
      }
      return originalOpen.apply(window, arguments);
    };

    // Block pop-unders
    let lastUserInteraction = 0;
    ["mousedown", "keydown", "touchstart"].forEach((event) => {
      document.addEventListener(
        event,
        () => {
          lastUserInteraction = Date.now();
        },
        true
      );
    });

    // Override location changes
    const originalPushState = history.pushState;
    history.pushState = function () {
      const url = arguments[2];
      if (url && isAdUrl(url)) {
        debug(`Blocked navigation: ${url}`);
        return;
      }
      return originalPushState.apply(history, arguments);
    };
  }

  // ============= Shadow DOM Inspection =============

  function inspectShadowDOM() {
    // Find all elements with shadow roots
    const allElements = document.querySelectorAll("*");
    allElements.forEach((element) => {
      if (element.shadowRoot) {
        // Apply ad hiding to shadow DOM
        universalAdSelectors.forEach((selector) => {
          try {
            const shadowElements =
              element.shadowRoot.querySelectorAll(selector);
            shadowElements.forEach((el) => {
              el.style.display = "none !important";
              debug(`Hidden shadow DOM element: ${selector}`);
            });
          } catch (e) {
            // Ignore errors
          }
        });
      }
    });
  }

  // ============= Anti-Anti-Adblock =============

  function bypassAdblockDetection() {
    // Common anti-adblock detection properties
    const fakeProperties = {
      canRunAds: true,
      hasAdblock: false,
      isAdBlockActive: false,
      adBlockEnabled: false,
      adBlockActive: false,
      adblock: false,
      adBlocker: false,
    };

    Object.keys(fakeProperties).forEach((prop) => {
      try {
        Object.defineProperty(window, prop, {
          value: fakeProperties[prop],
          writable: false,
          configurable: false,
        });
      } catch (e) {
        // Property might already be defined
      }
    });

    // Fake ad element to bypass detection
    const fakeAd = document.createElement("div");
    fakeAd.id = "adsense";
    fakeAd.className = "adsbygoogle";
    fakeAd.style.display = "none";
    fakeAd.innerHTML = "&nbsp;";
    document.body.appendChild(fakeAd);

    // Override common detection functions
    window.blockAdBlock = {
      onDetected: () => {},
      onNotDetected: () => {
        debug("Adblock detection bypassed");
      },
    };

    // Remove "please disable adblock" messages
    const antiAdblockSelectors = [
      '[class*="adblock-message"]',
      '[class*="adblock-notice"]',
      '[class*="adblock-warning"]',
      '[class*="disable-adblocker"]',
      '[class*="ad-blocker-message"]',
      '[id*="adblock-message"]',
      '[id*="adblock-notice"]',
      ".adblock-modal",
      ".turn-off-adblocker",
      ".whitelist-me",
    ];

    antiAdblockSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.remove();
        debug(`Removed anti-adblock element: ${selector}`);
      });
    });
  }

  // ============= Performance Optimization =============

  function optimizePerformance() {
    // Lazy load images to improve performance
    const images = document.querySelectorAll("img[data-src]");
    images.forEach((img) => {
      if (!isAdUrl(img.dataset.src)) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
    });

    // Remove empty ad containers to clean up layout
    const emptyContainers = document.querySelectorAll(
      '[data-blocked-ad="true"]'
    );
    emptyContainers.forEach((container) => {
      if (
        container.parentElement &&
        container.parentElement.children.length === 1
      ) {
        container.parentElement.remove();
      }
    });
  }

  // ============= Mutation Observer =============

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      // Batch process mutations for performance
      requestAnimationFrame(() => {
        hideAdElements();
        bypassAdblockDetection();
        optimizePerformance();
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href", "class", "id"],
    });

    debug("Mutation observer started");
  }

  // ============= CSS Injection =============

  function injectBlockingCSS() {
    const style = document.createElement("style");
    style.textContent = `
      /* Hide common ad elements */
      ${universalAdSelectors.join(",\n")} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
      }
      
      /* Hide elements with ad-related attributes */
      [data-blocked-ad="true"] {
        display: none !important;
      }
      
      /* Prevent ad placeholders from taking space */
      .ad-placeholder,
      .advertisement-placeholder {
        display: none !important;
      }
      
      /* Block sticky ads */
      [style*="position: sticky"][class*="ad"],
      [style*="position: fixed"][class*="ad"] {
        display: none !important;
      }
      
      /* Hide video ad overlays */
      .video-ads,
      .video-ad-container {
        display: none !important;
      }
    `;

    document.head.appendChild(style);
    debug("Blocking CSS injected");
  }

  // ============= Initialization =============

  function initialize() {
    try {
      debug("Initializing advanced ad blocker...");

      // Core blocking functions
      blockScriptInjection();
      interceptNetworkRequests();
      blockPopupsAndRedirects();

      // DOM manipulation
      hideAdElements();
      bypassAdblockDetection();
      injectBlockingCSS();

      // Setup continuous monitoring
      setupMutationObserver();

      // Periodic cleanup
      setInterval(() => {
        hideAdElements();
        bypassAdblockDetection();
        optimizePerformance();
      }, 2000);

      console.log("[Advanced AdBlock] Successfully initialized");
    } catch (error) {
      console.error("[Advanced AdBlock] Initialization error:", error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // Reinitialize on page navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(initialize, 100);
    }
  }).observe(document, { subtree: true, childList: true });

  // Export for debugging
  window.advancedAdBlocker = {
    CONFIG,
    hideAdElements,
    blockScriptInjection,
    bypassAdblockDetection,
    debug: () => {
      CONFIG.debugMode = !CONFIG.debugMode;
    },
  };
})();
