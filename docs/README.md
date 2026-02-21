# JARVIS Documentation

Complete documentation for the JARVIS Kernel v1.5.1.

## Table of Contents

### 🚀 [Getting Started](#getting-started)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)

### 🏗️ [Architecture](./ARCHITECTURE.md)
- [System Overview](#system-overview)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Plugin System](#plugin-system)

### 💻 [Core OS](./CORE_OS.md)
- [System Metrics](./CORE_OS.md#system-metrics)
- [Process Management](./CORE_OS.md#process-management)
- [Predictive Analytics](./CORE_OS.md#predictive-analytics)
- [Hardware Monitoring](./CORE_OS.md#hardware-monitoring)

### 🎙️ [Voice System](./VOICE.md)
- [Setup](./VOICE.md#setup)
- [Configuration](./VOICE.md#configuration)
- [Troubleshooting](./VOICE.md#troubleshooting)

### 🔒 [Security](./SECURITY.md)
- [API Key Management](./SECURITY.md#api-key-management)
- [Data Privacy](./SECURITY.md#data-privacy)
- [Best Practices](./SECURITY.md#best-practices)

### 📚 [API Reference](./API.md)
- [Kernel API](./API.md#kernel-api)
- [Plugin API](./API.md#plugin-api)
- [Store API](./API.md#store-api)

### 📜 [Changelog](./CHANGELOG.md)
- [v1.5.1](./CHANGELOG.md#v151) - Current
- [v1.5.0](./CHANGELOG.md#v150) - 2026-02-08
- [v1.4.x](./CHANGELOG.md#v14x)
- [v1.3.x](./CHANGELOG.md#v13x)
- [v1.2.x](./CHANGELOG.md#v12x)
- [v1.1.x](./CHANGELOG.md#v11x)

### 🔧 [Development](./DEVELOPMENT.md)
- [Setup](./DEVELOPMENT.md#setup)
- [Contributing](./DEVELOPMENT.md#contributing)
- [Testing](./DEVELOPMENT.md#testing)

---

## Getting Started

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd jarvis-kernel-architect

# Install dependencies
npm install

# Download required voice files
Install-JARVIS-Voice.bat

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Quick Start

```bash
# Start development server
npm run dev

# Or start all services
npm run start
```

### Configuration

See `.env.example` for available configuration options.

---

## System Overview

JARVIS is built on a layered architecture:

```
┌─────────────────────────────────────────┐
│              APP LAYER                  │
│     Dashboard | Terminal | Plugins      │
├─────────────────────────────────────────┤
│           STATE LAYER                   │
│         Zustand Stores                  │
├─────────────────────────────────────────┤
│           SERVICE LAYER                 │
│  Kernel | Voice | Vision | Hardware     │
├─────────────────────────────────────────┤
│         INTELLIGENCE LAYER              │
│      Gemini | Ollama | Local AI         │
└─────────────────────────────────────────┘
```

---

## Quick Links

- [Main README](../README.md)
- [Issues](../.github/ISSUE_TEMPLATE/)
- [License](../LICENSE)
