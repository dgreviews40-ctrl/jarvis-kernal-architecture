# Changelog

All notable changes to the JARVIS Kernel Architect project.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Roadmap
- **[v1.5.1] Native Desktop AI** - Full hardware utilization
  - **Architecture:** Tauri + Rust native app (replaces browser limitations)
  - **GPU:** Direct CUDA bindings for GTX 1080 Ti 11GB
  - **LLM:** llama.cpp integration (Llama 3.1 70B, Mixtral 8x7B, CodeLlama 34B)
  - **Voice:** Local Whisper.cpp (no cloud, Ryzen 5 CPU)
  - **Vision:** LLaVA 34B multi-modal understanding
  - **Memory:** Vector DB using 32GB RAM (1M+ document RAG)
  - **Monitoring:** Real-time GPU temps, VRAM, power draw
  - **Features:** Hot model swapping, concurrent AI agents, voice cloning
  - **Performance:** 10 tok/s (70B), 45 tok/s (8B), 128K context window
  - **Privacy:** 100% offline capable, zero data transmission
  - See: `docs/roadmaps/v1.5.1-native-desktop-ai.md`

### Added
- **Real-Time System Dashboard** - Live monitoring dashboard with:
  - Real-time CPU and Memory usage charts with 2-minute history
  - Live process list with sorting, filtering, and kill controls
  - System alert panel with acknowledgment and pulse animations
  - Auto-refreshing metrics (configurable: 1s, 2s, 5s, 10s intervals)
  - Tabbed interface: Overview, Processes, Alerts
  - Summary stats bar showing top processes and resource usage
  - Integration with core.os v1.2.1 process management APIs
  - New components:
    - `RealtimeDashboard` - Main dashboard component
    - `RealtimeMetricsChart` - Live chart component
    - `RealtimeProcessList` - Process monitoring with controls
    - `RealtimeAlertPanel` - Alert management UI
  - New service: `realtimeMetrics.ts` - Event-driven metrics broadcasting
  - Added 'REALTIME' view to UI store and App.tsx navigation

## [core.os-1.2.1] - 2026-02-05

### Added
- **Process Management**: Full process monitoring and control capabilities
  - `getProcessList()` - List all running processes with filters
  - `getProcessStats()` - Get aggregate process statistics
  - `killProcess(pid, force?)` - Terminate processes by PID
  - `findProcesses(pattern)` - Search processes by name
  - `getTopCpuProcesses(n)` - Get top N CPU-consuming processes
  - `getTopMemoryProcesses(n)` - Get top N memory-consuming processes
  - `formatProcessList()` - Beautiful ASCII table formatting
  - Virtual process registration for tracking browser operations
- **New Commands**:
  - `process list` / `process all` - Show all processes
  - `process stats` / `process summary` - Show process statistics
  - `process cpu` / `process top` - Top 10 CPU processes
  - `process memory` / `process mem` - Top 10 memory processes
  - `kill <pid>` / `terminate <pid>` - Kill a process
  - `find <pattern>` / `search <pattern>` - Find processes by name
- **Process Interface Types**:
  - `ProcessInfo` - Process metadata (PID, name, status, CPU, memory)
  - `ProcessStats` - Aggregate statistics
  - `ProcessFilter` - Filter options for process queries
  - `ProcessKillResult` - Result of kill operation

### Changed
- **Version Bump**: core.os upgraded from v1.2.0 to v1.2.1
- **Plugin Manifest Updated**:
  - New `provides`: `process_list`, `process_kill`
  - New `capabilities`: `process_list`, `process_kill`
  - Updated description to include process management
- **Registry Version**: Bumped to v16 to clear cached plugin data

## [core.os-1.2.0] - 2026-02-05

### Added
- **System Integration**: Full integration with Voice, Display, and Cortex
  - Voice announcements for critical alerts
  - Voice commands for system queries
  - Real-time dashboard component (`CoreOsDashboard`)
  - Cortex health reporting and reliability tracking
  - Automatic event logging to Cortex
  - Custom event dispatch for React components
- **Integration Module**: `services/coreOsIntegration.ts`
  - Centralized integration management
  - Configurable alert thresholds
  - Smart alert throttling
  - Background monitoring coordination
- **Dashboard Component**: `components/CoreOsDashboard.tsx`
  - Real-time metrics display (2s refresh)
  - Visual health score with color coding
  - Progress bars for all metrics
  - Alert panel with acknowledgment
  - Diagnostic report viewer
  - Responsive grid layout
- **Voice Commands**: Natural language system queries
  - "System status" - Full status report
  - "Battery status" - Battery information
  - "Memory usage" - Memory consumption
  - "Run diagnostics" - Diagnostic summary
- **Documentation**: Complete integration guide (`docs/CORE_OS_INTEGRATION.md`)
- **Browser Testing**: Comprehensive browser test suite
  - `tests/coreOs_browser_integration_test.html` - Full integration tests
  - `tests/BROWSER_TEST_GUIDE.md` - Testing documentation
  - 40+ individual test cases covering all features
  - Automated test suite with 12 core tests
  - API detection and compatibility checking
  - Voice, Display, and Cortex integration tests
- **Storage Monitoring**: Integration with Storage API
  - Storage quota and usage tracking
  - Available space calculation
  - Percentage used indicator
- **Performance Metrics**: Real-time performance tracking
  - Memory pressure detection (nominal/fair/serious/critical)
  - Latency measurement
  - Estimated FPS tracking
- **CPU Monitoring**: Node.js CPU usage tracking
  - CPU usage percentage
  - Load average (Unix systems)
- **Predictive Analytics**: ML-like trend analysis
  - Memory usage trend detection (increasing/stable/decreasing)
  - Battery time remaining estimation
  - System health score (0-100)
  - Automated recommendations
- **Alert System**: Proactive system monitoring
  - Automatic alert generation for critical conditions
  - Alert acknowledgment system
  - Alert persistence
  - Critical/Warning/Info levels
- **Auto-Monitoring**: Background system monitoring
  - Configurable monitoring interval
  - Automatic metrics recording
  - Background alert checking
  - Start/stop controls
- **Enhanced Diagnostics**: v1.2.0 report format
  - CPU information section
  - Storage information section
  - Performance metrics section
  - Health score display
  - Active alerts display
  - Recommendations section
- **New Utility Functions**:
  - `formatDuration()`: Format milliseconds to readable duration
  - `recordMetrics()`: Record metrics for trend analysis
  - `startMonitoring()`: Start auto-monitoring
  - `stopMonitoring()`: Stop auto-monitoring

### Changed
- **Version Bump**: core.os upgraded from v1.1.0 to v1.2.0
- **Plugin Manifest Updated**:
  - New `provides`: `storage_info`, `performance_metrics`, `predictive_analysis`, `system_alerts`
  - New `capabilities`: `storage_monitoring`, `performance_tracking`, `predictive_analytics`, `automated_alerting`
  - Enhanced description
- **Network Info**: Added `online` status field
- **System Metrics**: Added CPU usage tracking
- **Diagnostics Report**: Enhanced ASCII format with more sections
- **Uptime Formatting**: Now supports days (e.g., "5d 3h 12m")

### New Commands
| Command | Description |
|---------|-------------|
| `storage` / `disk` | Show storage usage information |
| `performance` / `perf` | Show performance metrics |
| `predict` / `analysis` / `forecast` | Show predictive analysis |
| `alerts` / `warnings` | Show active system alerts |
| `monitor` / `watch` | Toggle auto-monitoring on/off |

## [core.os-1.1.0] - 2026-02-05

### Added
- **System Metrics Collection**: Real-time memory monitoring via `process.memoryUsage()`
  - Heap used/total tracking
  - RSS (Resident Set Size) monitoring
  - External memory tracking
  - Process uptime tracking
- **Battery Status Monitoring**: Integration with Navigator Battery API
  - Battery level percentage
  - Charging state detection
  - Time to full/empty estimates
  - Graceful fallback for unsupported environments
- **Network Information**: Integration with Navigator Connection API
  - Effective connection type (4g, 3g, etc.)
  - Downlink speed estimation
  - Round-trip time (RTT) latency
  - Data saver mode detection
- **Plugin Health Monitoring**: Comprehensive plugin status tracking
  - Active/Disabled/Error/Paused counts
  - Detailed plugin information (id, name, version, status)
  - Consistency validation
- **Diagnostic Report Generation**: Beautiful ASCII-formatted system reports
  - Box-drawn Unicode borders
  - Organized sections (Memory, System, Battery, Network, Plugins)
  - Real-time data aggregation
- **Utility Functions**:
  - `formatBytes()`: Human-readable byte formatting (B, KB, MB, GB, TB)
  - `formatUptime()`: Human-readable uptime (h, m, s)
  - Edge case handling for negative/NaN/Infinity values

### Changed
- **Version Bump**: core.os upgraded from v1.0.0 to v1.1.0
- **Plugin Manifest Updated**:
  - New `provides`: `system_metrics`, `battery_status`, `network_info`
  - New `capabilities`: `metrics_collection`, `health_monitoring`, `battery_monitoring`, `network_monitoring`
  - Enhanced description with feature list
- **Execution Engine**: Updated `core.os` command handlers
  - New commands: `metrics`, `battery`, `health`, `full`
  - Enhanced output with version info
  - Async support for battery diagnostics
- **Registry Version**: Bumped to v14 to clear cached plugin data

### Fixed
- **Error Handling**: Fixed `error.message` access on `unknown` type in CircuitBreaker
- **Edge Cases**: `formatBytes()` now handles negative numbers, NaN, and Infinity
- **Array Bounds**: Added protection against array overflow in byte formatting

### Testing
- Added comprehensive test suite (`tests/coreOs_test.ts`)
- Added Node.js standalone tests (`tests/coreOs_standalone_test.mjs`)
- 17/17 tests passing for pure functions

### Documentation
- Updated README.md with core.os v1.1.0 features
- Added capability/command reference table
- Added usage examples

---

## [core.os-1.0.0] - Earlier

### Added
- Initial System Core plugin
- Basic hardware control permissions
- System diagnostics capability (mock)
- Process management capability
- Filesystem abstraction
- OS-level control provider
- Circuit breaker integration
- Basic command handlers:
  - `diagnostic` / `scan`: Mock diagnostic output
  - `network` / `probe`: Mock network status
  - `circuit` / `reset`: Circuit breaker reset
  - `memory` / `optimize`: Mock memory optimization

---

## Plugin Version Reference

| Plugin | Current Version | Status |
|--------|-----------------|--------|
| core.os | 1.2.1 | ✅ Active |
| core.network | 1.0.0 | ✅ Active |
| core.memory | 2.0.0 | ✅ Active |
| core.ai | 1.0.0 | ✅ Active |
| plugin.voice | 1.0.0 | ✅ Active |
| plugin.vision | 1.0.0 | ✅ Active |
| integration.home_assistant | 1.0.0 | ✅ Active |
| plugin.weather | 1.0.0 | ✅ Active |
| display.core | 1.0.0 | ✅ Active |

---

## Future Roadmap

### core.os v1.2.0 (Completed) ✅
- [x] CPU monitoring
- [x] Storage monitoring
- [x] Performance metrics
- [x] Predictive analytics
- [x] System alerts

### core.os v1.2.1 (Completed) ✅
- [x] Process list and management

### core.os v1.3.0 (Planned)
- [ ] CPU temperature monitoring (node-systeminformation)
- [ ] Disk usage statistics (detailed per-disk)
- [ ] System load averages
- [ ] Network interface details
- [ ] Process tree visualization

### core.os v2.0.0 (Planned)
- [ ] Hardware sensor integration (fan speed, voltage)
- [ ] GPU monitoring
- [ ] Storage health (SMART data)
- [ ] Real-time system alerts
- [ ] Predictive failure analysis
