# __PLUGIN_NAME__

A JARVIS background service plugin that runs periodic tasks.

## Features

- Periodic data fetching
- Memory storage of results
- Configurable check intervals
- Notification on alerts

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Configuration

Edit the plugin settings in JARVIS:

| Setting | Default | Description |
|---------|---------|-------------|
| `intervalMinutes` | 5 | How often to run checks |
| `apiEndpoint` | - | URL to fetch data from |

## Customization

Modify `performCheck()` in `src/plugin.ts` to implement your service logic.

## Building

```bash
npm run build
```
