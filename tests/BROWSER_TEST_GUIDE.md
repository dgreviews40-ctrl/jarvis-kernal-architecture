# core.os v1.2.0 Browser Testing Guide

This guide describes how to test core.os v1.2.0 functionality in the browser.

## Test Files

| File | Purpose |
|------|---------|
| `coreOs_browser_test.html` | Basic functionality tests (v1.1.0 features) |
| `coreOs_browser_integration_test.html` | Full integration tests (v1.2.0 features) |

## Running Tests

### Option 1: Direct File Open
Simply double-click the HTML file or open it in a browser:
```
tests/coreOs_browser_integration_test.html
```

### Option 2: Via Dev Server
```bash
npm run dev
# Then open: http://localhost:3004/tests/coreOs_browser_integration_test.html
```

## Test Coverage

### API Detection Tests
- ✅ Battery API availability
- ✅ Network Info API availability
- ✅ Storage API availability
- ✅ Performance Memory API availability
- ✅ Speech Synthesis API availability
- ✅ Custom Events support

### Core Function Tests
- ✅ `formatBytes()` - Byte formatting (B, KB, MB, GB, TB)
- ✅ `formatUptime()` - Uptime formatting (d, h, m, s)
- ✅ `formatDuration()` - Duration formatting (ms, s, m, h)
- ✅ `getSystemMetrics()` - Memory and uptime metrics
- ✅ `getPerformanceMetrics()` - Memory pressure and latency

### Async API Tests
- ✅ `getBatteryInfo()` - Battery level, charging status
- ✅ `getNetworkInfo()` - Connection type, speed, online status
- ✅ `getStorageInfo()` - Storage quota and usage
- ✅ `getPredictiveAnalysis()` - Health score and recommendations
- ✅ `recordMetrics()` - Metrics history recording

### Alert System Tests
- ✅ `checkSystemAlerts()` - Automatic alert detection
- ✅ `getActiveAlerts()` - Retrieve active alerts
- ✅ `acknowledgeAlert()` - Alert acknowledgment
- ✅ Alert simulation (critical, warning, info)
- ✅ Alert display and management

### Auto-Monitoring Tests
- ✅ `startMonitoring()` - Begin background monitoring
- ✅ `stopMonitoring()` - Stop background monitoring
- ✅ `isMonitoring()` - Check monitoring status
- ✅ Live metrics display (real-time updates)
- ✅ Memory usage progress bar

### Diagnostics Tests
- ✅ `runDiagnostics()` - Full ASCII diagnostic report
- ✅ Quick diagnostics check
- ✅ Formatted output display

### Integration Tests

#### Voice Integration
- ✅ Voice announcement test
- ✅ System status speech synthesis
- ✅ Browser TTS fallback

#### Display Integration
- ✅ Display data package generation
- ✅ Custom event dispatch (`coreos-alert`)
- ✅ Event listener verification

#### Cortex Integration
- ✅ Cortex report simulation
- ✅ Reliability score tracking
- ✅ Event logging verification

### Automated Test Suite
- ✅ 12 automated tests
- ✅ Pass/fail reporting
- ✅ Duration tracking
- ✅ Detailed error messages

## Expected Results

### All Tests Pass
```
📊 Test Summary
Total Tests: 12
Passed: 12
Failed: 0
Duration: ~150ms
```

### API Support (Typical)
```
✅ Battery API - Supported (Chrome, Edge)
✅ Network Info API - Supported (Chrome, Edge)
⚠️ Storage API - May require HTTPS
✅ Performance Memory - Supported (Chrome)
✅ Speech Synthesis - Supported (All modern browsers)
✅ Custom Events - Supported (All browsers)
```

## Browser Compatibility

| Browser | Support Level | Notes |
|---------|---------------|-------|
| Chrome 90+ | ⭐⭐⭐ Full | All APIs supported |
| Edge 90+ | ⭐⭐⭐ Full | All APIs supported |
| Firefox 88+ | ⭐⭐☆ Good | No Battery API |
| Safari 14+ | ⭐⭐☆ Good | Limited API support |

## Troubleshooting

### Tests Not Running
- Check browser console for JavaScript errors
- Ensure file is loaded via HTTP(S) for Storage API
- Try refreshing the page

### Voice Not Working
- Check if browser supports Speech Synthesis
- Ensure volume is up and not muted
- Some browsers require user interaction first

### Storage API Fails
- Storage API requires secure context (HTTPS or localhost)
- Open via `http://localhost:3004/` when using dev server

### Battery API Not Available
- Battery API is being deprecated in some browsers
- Test will show as unsupported but won't fail

## Manual Testing Checklist

### Basic Functions
- [ ] Click "Test formatBytes()" - Shows formatted bytes
- [ ] Click "Test formatUptime()" - Shows formatted uptime
- [ ] Click "Test getSystemMetrics()" - Shows memory metrics

### Async APIs
- [ ] Click "Test getBatteryInfo()" - Shows battery data (if supported)
- [ ] Click "Test getNetworkInfo()" - Shows network data
- [ ] Click "Test getStorageInfo()" - Shows storage data (if HTTPS)

### Alerts
- [ ] Click "Simulate Critical" - Alert appears in display
- [ ] Click "Acknowledge Alert" - Alert is marked acknowledged
- [ ] Click "Clear All Alerts" - All alerts removed

### Monitoring
- [ ] Click "Start Monitoring" - Live metrics begin updating
- [ ] Watch memory progress bar change
- [ ] Click "Stop Monitoring" - Updates stop

### Diagnostics
- [ ] Click "Run Full Diagnostics" - ASCII report displayed
- [ ] Report shows v1.2.0 and all system sections

### Voice
- [ ] Click "Test Voice Announcement" - Computer speaks
- [ ] Click "Test Speak Status" - Status spoken aloud

### Integration
- [ ] Click "Test Custom Event" - Event logged to console
- [ ] Click "Test Cortex Report" - Report simulated

### Automated Suite
- [ ] Click "Run All Tests" - All 12 tests execute
- [ ] Verify summary shows 12/12 passed

## Test Console

The test page includes a console that logs all activity:
- **Green** - Info messages
- **Yellow** - Warnings
- **Red** - Errors
- **Blue** - Debug info

Use the "Clear Console" button to reset the log.

## Extending Tests

To add new tests, edit the `addTest()` calls in the HTML file:

```javascript
addTest('My New Test', async () => {
    const result = await coreOs.myNewFunction();
    return result.expectedProperty === 'expectedValue';
});
```

## Continuous Testing

For CI/CD integration, consider using Playwright or Puppeteer:

```javascript
// Example Playwright test
const { test, expect } = require('@playwright/test');

test('core.os browser test', async ({ page }) => {
    await page.goto('file://tests/coreOs_browser_integration_test.html');
    await page.click('text=Run All Tests');
    await expect(page.locator('#passedTests')).toHaveText('12');
});
```

## Summary

These browser tests validate:
1. ✅ All core.os v1.2.0 functions work in browser
2. ✅ API fallbacks handle unsupported browsers
3. ✅ Voice integration functions correctly
4. ✅ Display integration provides real-time data
5. ✅ Cortex integration events fire properly
6. ✅ Auto-monitoring runs without errors

**Total Test Coverage: 40+ individual test cases**
