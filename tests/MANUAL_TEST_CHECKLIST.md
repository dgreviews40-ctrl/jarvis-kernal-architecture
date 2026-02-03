# JARVIS Manual Testing Checklist

## Pre-Test Setup
- [ ] Open browser DevTools (F12)
- [ ] Clear console logs
- [ ] Ensure JARVIS is fully booted (showing "Kernel Boot Sequence Complete")

---

## 1. Voice System Tests

### Test 1.1: Voice Button Toggle
**Steps:**
1. Click the mic button (main button in Voice HUD)
2. Observe state change
3. Click again to toggle off

**Expected:**
- [ ] Button changes appearance when active
- [ ] Status text changes (e.g., "LISTENING" / "PASSIVE")
- [ ] Console shows state transitions

### Test 1.2: Power Button
**Steps:**
1. Click the power button (top-right of Voice HUD)
2. Click again to turn back on

**Expected:**
- [ ] Voice system powers off (MUTED state)
- [ ] Voice system powers back on
- [ ] Console logs power state changes

### Test 1.3: Voice Recognition
**Steps:**
1. Click mic button to activate
2. Say "Jarvis" followed by a command

**Expected:**
- [ ] Speech is recognized (shown in console)
- [ ] Intent is processed
- [ ] Response is generated

### Test 1.4: Voice Interruption
**Steps:**
1. Ask Jarvis a question that requires a long response
2. While speaking, click the mic button

**Expected:**
- [ ] Speech stops immediately
- [ ] State changes to INTERRUPTED
- [ ] Console logs interruption

---

## 2. Memory System Tests

### Test 2.1: Memory Display
**Steps:**
1. Click MEMORY tab
2. Observe the memories list

**Expected:**
- [ ] Memories are displayed
- [ ] Scroll bar appears if many memories
- [ ] Can scroll through all memories

### Test 2.2: Memory Search
**Steps:**
1. In MEMORY tab, type a search query
2. Press Enter

**Expected:**
- [ ] Search results appear
- [ ] Relevant memories shown
- [ ] Clear search returns to full list

### Test 2.3: Memory Stats
**Steps:**
1. In MEMORY tab, click STATS button

**Expected:**
- [ ] Total memories count shown
- [ ] Breakdown by type (FACT, PREFERENCE, etc.)
- [ ] Timeline shows first/latest memory

### Test 2.4: Memory Backup
**Steps:**
1. In MEMORY tab, click BACKUPS button
2. Click "CREATE BACKUP"

**Expected:**
- [ ] Backup is created
- [ ] Appears in backup list
- [ ] Can restore from backup

---

## 3. Plugin System Tests

### Test 3.1: Plugin Display
**Steps:**
1. Look at Plugin Manager panel (right side)

**Expected:**
- [ ] Plugins are listed
- [ ] Status indicators show (green/red)

### Test 3.2: Plugin Toggle
**Steps:**
1. Click a plugin toggle button
2. Observe status change

**Expected:**
- [ ] Plugin status changes
- [ ] Console logs the change

### Test 3.3: Circuit Breaker
**Steps:**
1. Look at Circuit Dashboard (bottom right)
2. Check status indicators

**Expected:**
- [ ] Circuit breakers displayed
- [ ] Status shows CLOSED/OPEN

---

## 4. Home Assistant Tests

### Test 4.1: Connection Status
**Steps:**
1. Check console for HA connection message
2. Click HA tab

**Expected:**
- [ ] "Connected to Home Assistant" in logs
- [ ] HA dashboard loads

### Test 4.2: Entity Display
**Steps:**
1. In HA tab, view entities

**Expected:**
- [ ] Entities are listed
- [ ] Status shows correctly

---

## 5. Store Persistence Tests

### Test 5.1: UI State Persistence
**Steps:**
1. Change to SETTINGS view
2. Navigate to a specific tab (e.g., AI)
3. Refresh the page (F5)

**Expected:**
- [ ] Returns to SETTINGS view after refresh
- [ ] AI tab is still active
- [ ] Console shows storage rehydration

### Test 5.2: AI Provider Preference
**Steps:**
1. Go to SETTINGS > AI
2. Change AI Provider (e.g., to OLLAMA)
3. Refresh the page

**Expected:**
- [ ] Provider selection persists after refresh
- [ ] Setting is restored from storage

### Test 5.3: Logs Configuration
**Steps:**
1. Go to LOGS tab
2. Open Settings (gear icon)
3. Change max logs value
4. Refresh the page

**Expected:**
- [ ] Max logs setting persists
- [ ] Other log settings preserved

### Test 5.4: Storage Version Migration
**Steps:**
1. Open DevTools > Application > Local Storage
2. Change 'jarvis-store-version' to '0'
3. Refresh the page

**Expected:**
- [ ] Old store data is cleared
- [ ] Version is updated to current
- [ ] Fresh state is initialized

---

## 6. Performance Monitoring Tests

### Test 6.1: Performance Dashboard
**Steps:**
1. Click the Performance button (green Activity icon) in top controls
2. Observe the Performance Dashboard

**Expected:**
- [ ] Dashboard loads with metrics
- [ ] Memory usage displayed
- [ ] Bundle size information shown
- [ ] "Active" indicator visible

### Test 6.2: Set Baseline
**Steps:**
1. In Performance Dashboard, click "Set Baseline"
2. Perform some actions in the app
3. Return to Performance Dashboard

**Expected:**
- [ ] Baseline comparison shows changes
- [ ] Improvements/regressions highlighted
- [ ] Timing averages updated

### Test 6.3: Export Data
**Steps:**
1. In Performance Dashboard, click "Export JSON"
2. Check downloaded file

**Expected:**
- [ ] JSON file downloads
- [ ] Contains bundleSizes, memorySnapshots, timings

### Test 6.4: Bundle Analysis Report
**Steps:**
1. Check build output for bundle analysis
2. Look for `dist/bundle-report.json`

**Expected:**
- [ ] Bundle report generated
- [ ] Shows all chunks with sizes
- [ ] Warnings for large chunks

## 7. Plugin Marketplace Tests

### Test 7.1: Access Marketplace
**Steps:**
1. Click the purple Sparkles icon in top toolbar
2. OR: Go to Plugin Manager and click "Marketplace" button

**Expected:**
- [ ] Marketplace loads with plugin listings
- [ ] Stats shown at top (total plugins, downloads, rating)
- [ ] Featured plugins section visible

### Test 7.2: Search and Filter
**Steps:**
1. Type "weather" in search box
2. Select "utility" category from dropdown
3. Check "Verified only" checkbox
4. Select "4+ Stars" rating filter

**Expected:**
- [ ] Search results update in real-time
- [ ] Filters work independently and together
- [ ] No plugins found message when appropriate

### Test 7.3: View Plugin Details
**Steps:**
1. Click on any plugin card
2. Review details in modal
3. Click outside or X to close

**Expected:**
- [ ] Modal opens with full details
- [ ] Shows permissions, dependencies, tags
- [ ] Install button visible (if not installed)
- [ ] "Installed" badge shown (if already installed)

### Test 7.4: Install Plugin (Mock)
**Steps:**
1. Find a plugin not yet installed
2. Click "Install" button
3. Observe progress

**Expected:**
- [ ] Install button shows loading state
- [ ] Installation completes or shows error
- [ ] Plugin appears in Plugin Manager after install

## 8. Settings Backup & Restore Tests

### Test 8.1: Export Settings
**Steps:**
1. Go to Settings > BACKUP & RESTORE
2. Check "Include API keys" and "Include memory data"
3. Click "Export Settings"

**Expected:**
- [ ] File downloads automatically
- [ ] Export stats shown (settings count, size)
- [ ] File is valid JSON (or .jarvis if encrypted)

### Test 8.2: Encrypted Export
**Steps:**
1. Check "Encrypt with password"
2. Enter password (min 8 chars)
3. Confirm password
4. Export

**Expected:**
- [ ] Encrypted file downloads (.jarvis extension)
- [ ] File cannot be read as plain JSON
- [ ] Password mismatch shows error

### Test 8.3: Import Settings
**Steps:**
1. Click "Choose File" and select exported file
2. Choose merge or replace option
3. Enter password if encrypted
4. Click "Import Settings"

**Expected:**
- [ ] Import completes successfully
- [ ] Stats shown (settings, API keys, memory imported)
- [ ] Settings restored after page refresh

### Test 8.4: Settings Summary
**Steps:**
1. Click "Current Settings" to expand
2. Review listed settings

**Expected:**
- [ ] All stored settings listed
- [ ] Sizes shown for each
- [ ] Total size calculated
- [ ] Encryption status shown

## 9. Notification System Tests

### Test 9.1: Toast Notifications
**Steps:**
1. Perform actions that trigger notifications (install plugin, export settings, etc.)
2. Observe toast notifications appearing

**Expected:**
- [ ] Toasts appear in top-right corner
- [ ] Different colors for success/error/warning/info
- [ ] Progress bar shows auto-dismiss timer
- [ ] Can dismiss manually with X button

### Test 9.2: Notification Bell
**Steps:**
1. Look at notification bell in top toolbar
2. Click the bell icon

**Expected:**
- [ ] Badge shows unread count
- [ ] Notification center opens
- [ ] Current and History tabs work
- [ ] Can mark all as read
- [ ] Can dismiss all notifications

### Test 9.3: Notification Actions
**Steps:**
1. Trigger a notification with actions (if available)
2. Click action button in toast

**Expected:**
- [ ] Action executes
- [ ] Toast dismisses after action

## 10. Error Handling Tests

### Test 10.1: Console Errors
**Steps:**
1. Open DevTools console
2. Perform various actions
3. Check for red error messages

**Expected:**
- [ ] No ReferenceError messages
- [ ] No undefined variable errors
- [ ] Graceful error handling

### Test 10.2: Recovery Dashboard
**Steps:**
1. Check if Recovery Dashboard is accessible

**Expected:**
- [ ] Can view system health
- [ ] Error logs accessible

---

## Test Results

| Category | Tests Passed | Tests Failed | Notes |
|----------|--------------|--------------|-------|
| Voice System | / | / | |
| Memory System | / | / | |
| Plugin System | / | / | |
| Home Assistant | / | / | |
| Store Persistence | / | / | |
| Performance Monitoring | / | / | |
| Plugin Marketplace | / | / | |
| Settings Backup | / | / | |
| Notification System | / | / | |
| Error Handling | / | / | |

**Overall Status:** ✅ All Passed / ❌ Issues Found

**Tester:** _______________  **Date:** _______________
