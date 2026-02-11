# __PLUGIN_NAME__

A JARVIS command plugin that handles voice commands.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This starts a dev server. In JARVIS, install from `http://localhost:3456`.

## Available Commands

| Command | Description |
|---------|-------------|
| "hello" | Greets the user |
| "what time is it" | Tells the current time |
| "remember [text]" | Stores text in memory |
| "recall [query]" | Searches stored memories |

## Configuration

Edit `manifest.json` to add more commands and permissions.

## Building

```bash
npm run build
```

Creates a `dist/` folder ready for distribution.
