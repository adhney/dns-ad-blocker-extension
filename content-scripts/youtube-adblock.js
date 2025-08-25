// YouTube Advanced Ad Blocker Content Script
// Implements multiple techniques to block YouTube ads

(function() {
  'use strict';

  console.log('[YouTube AdBlock] Initializing advanced YouTube ad blocker...');
  
  // Inject early to catch initial player setup
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // Override ytInitialPlayerResponse before YouTube uses it
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get() {
          return this._ytInitialPlayerResponse;
        },
        set(value) {
          if (value && value.adPlacements) {
            delete value.adPlacements;
          }
          if (value && value.playerAds) {
            delete value.playerAds;
          }
          if (value && value.adSlots) {
            delete value.adSlots;
          }
          this._ytInitialPlayerResponse = value;
        },
        configurable: true
      });
    })();
  `;
  
  // Inject as early as possible
  if (document.head) {
    document.head.insertBefore(script, document.head.firstChild);
  } else {
    document.documentElement.appendChild(script);
  }

  // Configuration
  const CONFIG = {
    debugMode: false,
    skipButtonDelay: 0, // Instantly click skip button when available
    hideOverlays: true,
    blockMidrollAds: true,
    blockEndscreenAds: true,
    blockSponsoredInfo: true,
    removeAdSlots: true,
    muteAdsIfPlaying: true
  };

  // Debug logger
  const debug = (...args) => {
    if (CONFIG.debugMode) {
      console.log('[YouTube AdBlock]', ...args);
    }
  };

  // ============= Core Ad Detection and Removal =============

  // 1. Intercept and modify YouTube's player configuration
  function interceptPlayerResponse() {
    const nativeParse = JSON.parse;
    JSON.parse = function(text) {
      const result = nativeParse.apply(this, arguments);
      
      if (result && result.playerResponse) {
        debug('Intercepted playerResponse');
        result.playerResponse = removeAdsFromPlayerResponse(result.playerResponse);
      }
      
      if (result && result.adPlacements) {
        debug('Removing ad placements');
        delete result.adPlacements;
      }
      
      // Remove VAST ad data
      if (result && result.playerAds) {
        debug('Removing playerAds');
        delete result.playerAds;
      }
      
      // Remove ad scheduling
      if (result && result.adScheduling) {
        debug('Removing adScheduling');
        delete result.adScheduling;
      }
      
      // Remove Google IMA SDK ads
      if (result && result.googleImaAds) {
        debug('Removing googleImaAds');
        delete result.googleImaAds;
      }
      
      return result;
    };
  }

  // 2. Remove ads from player response
  function removeAdsFromPlayerResponse(playerResponse) {
    if (typeof playerResponse === 'string') {
      playerResponse = JSON.parse(playerResponse);
    }

    // Remove various ad configurations
    const adPaths = [
      'playerAds',
      'adPlacements',
      'adSlots',
      'adParams',
      'adBreakParams',
      'adBreakHeartbeatParams',
      'streamingData.serverAbrStreamingUrl',
      'playerConfig.adRequestConfig',
      'playerConfig.adPlacementConfig',
      'playbackTracking.videostatsPlaybackUrl.baseUrl' // Remove ad tracking
    ];

    adPaths.forEach(path => {
      deleteProperty(playerResponse, path);
    });

    // Remove ad markers from player
    if (playerResponse.playerConfig?.audioConfig) {
      delete playerResponse.playerConfig.audioConfig.enablePerFormatLoudness;
    }

    // Clean up video details
    if (playerResponse.videoDetails) {
      playerResponse.videoDetails.isLiveContent = false;
      playerResponse.videoDetails.isLive = false;
      playerResponse.videoDetails.isPostLiveDvr = false;
    }

    // Remove midroll ad markers - IMPORTANT for preventing mid-video ads
    if (playerResponse.playerConfig?.mediaCommonConfig?.dynamicReadaheadConfig) {
      delete playerResponse.playerConfig.mediaCommonConfig.dynamicReadaheadConfig;
    }
    
    // Remove ad pods that define when mid-roll ads should play
    if (playerResponse.adPlacements) {
      playerResponse.adPlacements = [];
    }
    
    // Remove client-side ad insertion points
    if (playerResponse.playerAds) {
      playerResponse.playerAds = [];
    }

    return playerResponse;
  }

  // 3. Helper to delete nested properties
  function deleteProperty(obj, path) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((curr, part) => curr && curr[part], obj);
    if (target && last in target) {
      delete target[last];
      debug(`Removed ${path}`);
    }
  }

  // ============= DOM-based Ad Removal =============

  // 4. Remove ad containers and overlays
  function removeAdElements() {
    const adSelectors = [
      // Video ads
      '.video-ads',
      '.ytp-ad-module',
      '.ytp-ad-overlay-container',
      '.ytp-ad-message-container',
      '.ytp-ad-player-overlay', // Add this to remove black overlay
      
      // Overlay ads
      '.ytp-ad-overlay-slot',
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      '.ytp-ad-overlay-close-button',
      
      // Banner ads
      '#player-ads',
      '.ytd-banner-promo-renderer',
      'ytd-display-ad-renderer',
      'ytd-statement-banner-renderer',
      'ytd-masthead-ad-v3-renderer',
      'ytd-primetime-promo-renderer',
      
      // Sidebar ads
      '#secondary ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer',
      'ytd-promoted-video-renderer',
      
      // In-feed ads
      'ytd-in-feed-ad-layout-renderer',
      'ytd-ad-slot-renderer',
      'ytd-promoted-sparkles-text-search-renderer',
      
      // Popup and companion ads
      'tp-yt-paper-dialog:has(ytd-mealbar-promo-renderer)',
      'ytd-companion-slot-renderer',
      'ytd-action-companion-ad-renderer',
      
      // Endscreen ads
      '.ytp-ce-element',
      '.ytp-endscreen-content',
      
      // Merchandise and promotional content
      'ytd-merch-shelf-renderer',
      'ytd-offer-module-renderer',
      'ytd-brand-video-shelf-renderer',
      'ytd-brand-video-singleton-renderer'
    ];

    adSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.remove();
        debug(`Removed ad element: ${selector}`);
      });
    });
  }

  // Add new function to aggressively handle pre-roll ads
  function aggressivePreRollHandler() {
    // Check every 100ms for the first 5 seconds of page load
    let checks = 0;
    const preRollInterval = setInterval(() => {
      checks++;
      
      const player = document.querySelector('#movie_player');
      const video = document.querySelector('video');
      
      // Force remove ad states
      if (player) {
        if (player.classList.contains('ad-showing') || 
            player.classList.contains('ad-interrupting') ||
            player.classList.contains('ad-created')) {
          
          player.classList.remove('ad-showing', 'ad-interrupting', 'ad-created');
          debug('Removed ad classes in pre-roll handler');
          
          // Force skip
          const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button');
          if (skipBtn) skipBtn.click();
          
          // If video exists and is short (likely an ad), skip it
          if (video && video.duration && video.duration < 30) {
            video.currentTime = video.duration;
            debug('Skipped short pre-roll ad');
          }
        }
      }
      
      // Stop checking after 5 seconds (50 checks)
      if (checks > 50) {
        clearInterval(preRollInterval);
      }
    }, 100);
  }

  // 5. Skip video ads automatically
  function skipVideoAds() {
    // Skip button click - check multiple selectors
    const skipSelectors = [
      '.ytp-ad-skip-button',
      '.ytp-skip-ad-button', 
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-container button',
      'button[class*="skip"]',
      '.ytp-ad-skip-button-text'
    ];
    
    let skipClicked = false;
    for (const selector of skipSelectors) {
      const skipButton = document.querySelector(selector);
      if (skipButton && !skipClicked) {
        skipButton.click();
        skipClicked = true;
        debug('Clicked skip button: ' + selector);
        break;
      }
    }

    // Skip preview button
    const previewSkip = document.querySelector('.ytp-ad-preview-container');
    if (previewSkip) {
      previewSkip.style.display = 'none';
      debug('Hidden preview container');
    }
    
    // Check for unskippable video ads and handle them
    const video = document.querySelector('video');
    const player = document.querySelector('#movie_player');
    
    if (player && video && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
      // For unskippable ads, speed them up slightly and mute
      if (!skipButton && video.duration && video.duration < 30) {
        // Speed up short unskippable ads
        if (video.playbackRate < 2) {
          video.playbackRate = 2;
          debug('Speeding up unskippable ad to 2x');
        }
        
        // Mute the ad
        if (!video.muted) {
          video.muted = true;
          video.dataset.wasMutedForAd = 'true';
          debug('Muted unskippable ad');
        }
        
        // Try to skip to near the end for very short ads
        if (video.duration < 6 && video.currentTime < video.duration - 1) {
          video.currentTime = video.duration - 0.5;
          debug('Skipped to end of very short ad');
        }
      }
    } else if (video && video.dataset.wasMutedForAd === 'true') {
      // Restore normal state when ad ends
      video.playbackRate = 1;
      video.muted = false;
      delete video.dataset.wasMutedForAd;
    }
  }

  // 6. Handle video ad playback
  function handleVideoAdPlayback() {
    const video = document.querySelector('video');
    const player = document.querySelector('#movie_player');
    
    if (!video || !player) return;

    // Check if ad is playing
    const isAd = player.classList.contains('ad-showing') || 
                 player.classList.contains('ad-interrupting') ||
                 document.querySelector('.ytp-ad-player-overlay');

    if (isAd) {
      debug('Ad detected, attempting to skip...');
      
      // Remove the ad-showing classes to prevent black overlay
      player.classList.remove('ad-showing');
      player.classList.remove('ad-interrupting');
      
      // Don't manipulate playback rate or seeking - just click skip
      // This prevents the play/pause issues
    }
  }

  // ============= Advanced Techniques =============

  // 7. Override YouTube's ad-related functions
  function overrideYouTubeFunctions() {
    // Prevent ad tracking
    const overrides = [
      'ytInitialPlayerResponse',
      'ytInitialData',
      'ytcfg'
    ];

    overrides.forEach(prop => {
      if (window[prop]) {
        const original = window[prop];
        Object.defineProperty(window, prop, {
          get() {
            return cleanYouTubeData(original);
          },
          set(value) {
            return cleanYouTubeData(value);
          }
        });
      }
    });
  }

  // 8. Clean YouTube data objects
  function cleanYouTubeData(data) {
    if (!data) return data;
    
    try {
      const cleaned = JSON.parse(JSON.stringify(data));
      
      // Remove ad-related properties
      const adProps = [
        'adPlacements',
        'playerAds', 
        'adSlots',
        'adParams',
        'PLAYER_AD_PARAMS',
        'serializedAdServingDataEntry',
        'adBreakServiceRenderer'
      ];
      
      adProps.forEach(prop => {
        if (cleaned[prop]) {
          delete cleaned[prop];
        }
      });
      
      return cleaned;
    } catch (e) {
      return data;
    }
  }

  // 9. Block ad-related network requests
  function blockAdRequests() {
    // Override fetch to block ad requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      
      if (typeof url === 'string') {
        const adPatterns = [
          '/youtubei/v1/log_event',
          '/youtubei/v1/ad_break',
          '/youtubei/v1/get_ad',
          '/youtubei/v1/player/ad_break',
          '/youtubei/v1/next?adSignalsInfo',
          '/youtubei/v1/player?adSignalsInfo',
          'doubleclick.net',
          'googleadservices.com',
          'googlesyndication.com',
          'google-analytics.com',
          'googletagmanager.com',
          '/pagead/',
          '/ptracking',
          'adsystem',
          'adserver',
          '/get_video_info.*adformat',
          'get_midroll_info'
        ];
        
        if (adPatterns.some(pattern => url.includes(pattern))) {
          debug(`Blocked ad request: ${url}`);
          return Promise.resolve(new Response('{}', {
            status: 200,
            statusText: 'OK'
          }));
        }
      }
      
      return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      const adPatterns = [
        'doubleclick.net',
        '/get_video_info',
        '/youtubei/v1/log_event',
        '/youtubei/v1/ad_break'
      ];
      
      if (adPatterns.some(pattern => url.includes(pattern))) {
        debug(`Blocked XHR ad request: ${url}`);
        this.abort();
        return;
      }
      
      return originalOpen.apply(this, arguments);
    };
  }

  // 10. Remove sponsored segments and info cards
  function removeSponsoredContent() {
    if (!CONFIG.blockSponsoredInfo) return;

    // Remove info cards
    const infoCards = document.querySelectorAll('.ytp-ce-element, .ytp-cards-teaser');
    infoCards.forEach(card => card.remove());

    // Remove sponsored info
    const sponsoredInfo = document.querySelectorAll(
      '.ytd-promoted-sparkles-web-renderer',
      '.ytd-promoted-video-renderer',
      '.ytd-compact-promoted-video-renderer'
    );
    sponsoredInfo.forEach(el => el.remove());
  }

  // 11. Handle YouTube's anti-adblock detection
  function bypassAntiAdblock() {
    // Remove anti-adblock messages
    const antiAdblockSelectors = [
      'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
      '.ytd-enforcement-message-view-model',
      'ytd-popup-container:has(ytd-enforcement-message-view-model)',
      'yt-playability-error-supported-renderers'
    ];

    antiAdblockSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.remove();
        debug('Removed anti-adblock element');
      });
    });

    // Don't auto-play videos - let user control playback
    // This was causing the play/pause issues

    // Clear anti-adblock cookies
    if (document.cookie.includes('VISITOR_INFO1_LIVE')) {
      document.cookie = 'VISITOR_INFO1_LIVE=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.youtube.com';
    }
  }

  // 12. Mutation observer to handle dynamic content
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      // Check for video element changes (new video loaded)
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const hasVideo = Array.from(mutation.addedNodes).some(node => 
            node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))
          );
          
          if (hasVideo) {
            debug('New video detected, checking for pre-roll ads');
            setTimeout(() => {
              skipVideoAds();
              handleVideoAdPlayback();
            }, 100);
          }
        }
      }
      
      // Run ad removal functions
      removeAdElements();
      skipVideoAds();
      handleVideoAdPlayback();
      removeSponsoredContent();
      bypassAntiAdblock();
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id']
    });

    debug('Mutation observer initialized');
  }

  // 13. Enhanced ad detection for modern YouTube
  function enhancedAdDetection() {
    // Check for ad cues in the progress bar
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (progressBar) {
      const adMarkers = progressBar.querySelectorAll('.ytp-ad-marker');
      adMarkers.forEach(marker => {
        marker.remove();
        debug('Removed ad marker from progress bar');
      });
    }

    // Check for countdown timer (indicates ad is playing)
    const adTimer = document.querySelector('.ytp-ad-duration-remaining');
    if (adTimer) {
      const video = document.querySelector('video');
      if (video && video.duration) {
        video.currentTime = video.duration;
        debug('Skipped ad based on timer detection');
      }
    }
  }

  // 14. Periodic cleanup function
  function periodicCleanup() {
    // More aggressive checking for mid-roll ads
    setInterval(() => {
      removeAdElements();
      skipVideoAds();
      enhancedAdDetection();
      bypassAntiAdblock();
      
      // Extra check for mid-roll ads
      const player = document.querySelector('#movie_player');
      if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
        player.classList.remove('ad-showing', 'ad-interrupting');
        skipVideoAds(); // Try to skip again
      }
    }, 500); // Check every 500ms for faster response

    // Less frequent cleanup
    setInterval(() => {
      removeSponsoredContent();
      handleVideoAdPlayback();
    }, 3000);
  }

  // ============= Initialization =============

  function initialize() {
    debug('Starting YouTube ad blocker initialization...');

    // Check if we're on YouTube
    if (!window.location.hostname.includes('youtube.com')) {
      debug('Not on YouTube, skipping initialization');
      return;
    }

    // Apply all blocking techniques
    try {
      // Core interception
      interceptPlayerResponse();
      overrideYouTubeFunctions();
      blockAdRequests();

      // DOM manipulation
      removeAdElements();
      setupMutationObserver();

      // Start periodic cleanup
      periodicCleanup();

      // Initial cleanup
      setTimeout(() => {
        removeAdElements();
        skipVideoAds();
        removeSponsoredContent();
        bypassAntiAdblock();
      }, 1000);
      
      // Aggressive pre-roll ad handling on video load
      document.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
          const player = document.querySelector('#movie_player');
          if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
            player.classList.remove('ad-showing', 'ad-interrupting');
            skipVideoAds();
            debug('Removed pre-roll ad on navigation');
          }
        }, 100);
      });

      console.log('[YouTube AdBlock] Successfully initialized all blocking mechanisms');

    } catch (error) {
      console.error('[YouTube AdBlock] Initialization error:', error);
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Start aggressive pre-roll handling immediately
  aggressivePreRollHandler();
  
  // Also run on every navigation
  document.addEventListener('yt-navigate-start', () => {
    debug('Navigation started, preparing for pre-roll ads');
    aggressivePreRollHandler();
  });

  // Also initialize on YouTube's single-page app navigation
  window.addEventListener('yt-navigate-finish', () => {
    debug('YouTube navigation detected, reinitializing...');
    setTimeout(() => {
      removeAdElements();
      skipVideoAds();
      removeSponsoredContent();
      
      // Aggressive check for pre-roll ads
      const player = document.querySelector('#movie_player');
      const video = document.querySelector('video');
      
      if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
        player.classList.remove('ad-showing', 'ad-interrupting');
        skipVideoAds();
        debug('Handling pre-roll ad after navigation');
      }
      
      // If video is paused at start (likely due to ad), try to play
      if (video && video.paused && video.currentTime === 0) {
        setTimeout(() => {
          if (video.paused && !document.querySelector('.ytp-ad-preview-container')) {
            video.play().catch(() => {});
          }
        }, 500);
      }
    }, 100);
  });

  // Export for debugging
  window.youtubeAdBlocker = {
    CONFIG,
    removeAdElements,
    skipVideoAds,
    handleVideoAdPlayback,
    bypassAntiAdblock,
    debug: () => { CONFIG.debugMode = !CONFIG.debugMode; }
  };

})();
