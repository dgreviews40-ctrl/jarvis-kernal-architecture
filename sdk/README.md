# JARVIS Plugin SDK

Build JARVIS plugins faster with TypeScript, hot reload, and a simplified API.

## Packages

| Package | Description |
|---------|-------------|
| [`create-jarvis-plugin`](./packages/create-jarvis-plugin) | CLI tool for scaffolding plugins |
| [`@jarvis/sdk`](./packages/jarvis-sdk) | Core SDK library |

## Templates

| Template | Use Case |
|----------|----------|
| [`command-plugin`](./templates/command-plugin) | Voice command handlers |
| [`service-plugin`](./templates/service-plugin) | Background services |
| [`ui-plugin`](./templates/ui-plugin) | React UI panels |

## Quick Start

```bash
# Create new plugin
npx create-jarvis-plugin my-plugin

# Or with template
npx create-jarvis-plugin my-service --template service

# Navigate and develop
cd my-plugin
npm install
npm run dev
```

## Documentation

- [SDK Guide](./docs/README.md)
- [API Reference](./docs/API.md) (coming soon)
- [Examples](./docs/EXAMPLES.md) (coming soon)

## Architecture

```
sdk/
├── packages/
│   ├── create-jarvis-plugin/    # CLI scaffolding
│   └── jarvis-sdk/              # Core library
├── templates/
│   ├── command-plugin/          # Voice command template
│   ├── service-plugin/          # Background service template
│   └── ui-plugin/               # React UI template
└── docs/                        # Documentation
```

## Development

### Build SDK

```bash
cd packages/jarvis-sdk
npm install
npm run build
```

### Test CLI

```bash
cd packages/create-jarvis-plugin
npm install
node bin/create-jarvis-plugin.js test-plugin
```

## License

MIT
