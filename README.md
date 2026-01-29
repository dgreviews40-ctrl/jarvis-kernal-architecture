# J.A.R.V.I.S. - Just A Rather Very Intelligent System

J.A.R.V.I.S. is an advanced AI kernel architecture that integrates multiple AI providers, smart home systems, and various sensors to create an intelligent assistant system.

## Features

- Multi-AI provider support (Gemini, Ollama)
- Home Assistant integration for smart home control
- Voice recognition and synthesis
- Computer vision capabilities with webcam and Home Assistant camera support
- Hardware monitoring and system diagnostics
- Plugin architecture with circuit breaker pattern
- Memory storage and recall system
- Graph-based dependency visualization

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Home Assistant instance (optional, for smart home features)
- Google Gemini API key (optional, for cloud AI features)

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd jarvis-kernel-architect
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

4. Start the development server:
```bash
npm run start
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run hardware` - Start hardware monitor
- `npm run proxy` - Start Home Assistant proxy
- `npm run start` - Start all services (hardware, proxy, and dev server)

## Architecture

The system follows a modular architecture with the following key components:

- **Kernel**: Core processing unit that routes requests to appropriate services
- **Providers**: AI service abstractions (Gemini, Ollama)
- **Services**: Specialized modules (voice, vision, hardware, Home Assistant)
- **Plugins**: Extendable functionality with circuit breaker protection
- **Memory**: Vector-based storage for context and learning
- **Graph**: Dependency visualization and system mapping

## Home Assistant Integration

To use Home Assistant features:

1. Ensure your Home Assistant instance is accessible
2. Generate a long-lived access token in Home Assistant
3. Configure the URL and token in the Settings interface
4. The system will connect through a local proxy to handle CORS restrictions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.