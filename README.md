# DNS Ad Blocker Extension

A powerful Chrome extension that blocks ads at the DNS level using customizable blocklists, similar to a VPN but with more flexibility.

## Features

- **DNS-level ad blocking**: Blocks ads before they even load by intercepting DNS requests
- **Customizable blocklists**: Import and manage multiple blocklists
- **Built-in lists**: Includes common ad domains, trackers, and malware lists
- **Real-time statistics**: Track blocked requests and performance metrics
- **Easy-to-use interface**: Simple popup and options pages for configuration
- **File import**: Import custom blocklists from text files

## Installation

### Development Mode

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your extensions list

### Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once reviewed and approved.

## Usage

### Getting Started

1. Click the DNS Ad Blocker icon in your toolbar
2. Toggle the "Ad Blocking" switch to enable the extension
3. The extension will start blocking ads using the default blocklists

### Managing Blocklists

1. Click "Options" in the popup to open the options page
2. View your current blocklists and their status
3. Add new blocklists by URL or import from files
4. Toggle individual lists on/off as needed
5. Remove lists you no longer want

### Adding Custom Blocklists

#### By URL
1. Go to Options → Add Blocklist
2. Enter a name and URL for the blocklist
3. Click "Add List"

#### By File Import
1. Go to Options → Import from File
2. Select a text file containing domains (one per line)
3. Click "Import"

### Monitoring Performance

The popup shows real-time statistics:
- **Requests Blocked**: Total number of blocked requests
- **Total Requests**: All DNS requests processed
- **Block Percentage**: Percentage of requests blocked

## Supported Blocklist Formats

The extension supports multiple blocklist formats:

### Simple Domain List
```
example.com
ads.example.com
tracker.domain.com
```

### Hosts File Format
```
127.0.0.1 ads.example.com
0.0.0.0 tracker.domain.com
```

### With Comments
```
# This is a comment
ads.example.com
# Another comment
tracker.domain.com
```

## Default Blocklists

The extension includes several built-in lists:

- **Common Ads**: Popular advertising domains
- **Trackers**: Common tracking and analytics domains
- **EasyList**: Community-maintained ad blocking list
- **AdGuard DNS**: Optimized for DNS-level blocking

## Technical Details

### How It Works

1. The extension creates a PAC (Proxy Auto-Configuration) script
2. DNS requests are intercepted and checked against compiled blocklists
3. Blocked domains are redirected to an invalid proxy, preventing connections
4. Statistics are collected and displayed in real-time

### Permissions Required

- `proxy`: To configure DNS blocking
- `networking.config`: To modify network settings
- `storage`: To save settings and blocklists
- `declarativeNetRequest`: For request filtering
- `webRequest`: To monitor and block requests
- `tabs`: To access tab information

## Privacy

This extension:
- ✅ Blocks ads and trackers to improve your privacy
- ✅ Works locally without sending data to external servers
- ✅ Stores all settings and blocklists locally
- ❌ Does not collect or transmit personal information
- ❌ Does not monitor your browsing habits

## Troubleshooting

### Extension Not Blocking Ads

1. Ensure the extension is enabled (toggle in popup)
2. Check that you have active blocklists in Options
3. Try disabling and re-enabling the extension
4. Clear browser cache and restart Chrome

### Performance Issues

1. Reduce the number of enabled blocklists
2. Remove very large blocklists (>100k domains)
3. Reset statistics to clear memory usage
4. Restart Chrome if issues persist

### Websites Not Loading

Some legitimate websites might be blocked:
1. Check if the domain is in your blocklists
2. Temporarily disable the extension to test
3. Remove or modify problematic blocklists
4. Report false positives to blocklist maintainers

## Development

### Project Structure

```
dns-filter-extension/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── popup/                 # Popup interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/               # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── lib/                   # Core functionality
│   ├── dns-proxy.js
│   ├── blocklist-manager.js
│   └── statistics.js
└── assets/                # Icons and images
```

### Building

No build process is required. The extension uses vanilla JavaScript and can be loaded directly into Chrome.

### Testing

1. Load the extension in developer mode
2. Open Chrome DevTools and check the console for errors
3. Test with known ad-serving websites
4. Verify statistics are updating correctly
5. Test adding/removing blocklists

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Disclaimer

This extension is for educational and personal use. Some websites rely on advertising revenue to provide free content. Please consider supporting websites you value by whitelisting them or using their premium, ad-free options.

## Support

For issues, questions, or feature requests, please open an issue on the project repository.
