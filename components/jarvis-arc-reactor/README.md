# JARVIS Arc Reactor

A cinematic, audio-reactive 3D Arc Reactor visualization for JARVIS, inspired by Iron Man's iconic reactor design.

## Versions

### Classic (v7) - Stable
The original implementation with:
- Inner core glow
- Electromagnetic coil rings
- Audio-reactive waveform
- Light segments
- Outer housing with bolts

### Cinematic (v2.0) - Enhanced
The upgraded version with dramatic improvements:

#### Visual Enhancements
- **Brilliant Core Shader** - Multi-layer glow with white-hot center, electric blue layer, and cyan aura
- **Triple Plasma Rings** - Three counter-rotating energy rings with flowing shader effects
- **Realistic Copper Coils** - Detailed metallic material with wear patterns and magnetic energy bleed
- **150+ Particles** - Spark effects with spiral motion and audio reactivity
- **Volumetric Glows** - Controlled atmospheric lighting without artifacts
- **Tech Hex Overlay** - Futuristic hexagonal grid with data flow animation
- **Corner Accents** - Tech-themed UI elements

#### Audio Reactivity
- Full spectrum analysis (bass, mid, treble)
- Component-specific reactions:
  - Core pulses with bass
  - Plasma rings accelerate with audio
  - Coils glow brighter with magnetic pulses
  - Waveform morphs to frequency data
  - Particles spiral faster with beats
- Smooth interpolation for fluid motion

#### Color Modes
1. **Classic Blue** - Traditional arc reactor colors (cyan/blue)
2. **Warm Orange** - Heat-inspired palette (orange/red)
3. **Cyberpunk Neon** - Futuristic magenta/pink tones

## Usage

### Basic (Classic Mode)
```tsx
import { JarvisArcReactor } from './components/JarvisArcReactor';

<JarvisArcReactor
  audioStream={microphoneStream}
  width={400}
  height={400}
  glowIntensity={1.2}
/>
```

### Enhanced (Cinematic Mode)
```tsx
<JarvisArcReactor
  audioStream={microphoneStream}
  width={500}
  height={500}
  enhanced={true}
  colorMode="classic"
  showControls={true}
  particleCount={150}
  glowIntensity={1.0}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `audioStream` | `MediaStream \| null` | - | Microphone stream for audio reactivity |
| `width` | `number` | 400 | Canvas width in pixels |
| `height` | `number` | 400 | Canvas height in pixels |
| `glowIntensity` | `number` | 1.2 | Overall glow brightness (0-2) |
| `rotationSpeed` | `number` | 1.0 | Base rotation speed multiplier |
| `enhanced` | `boolean` | false | Enable cinematic mode |
| `colorMode` | `'classic' \| 'warm' \| 'cyberpunk'` | 'classic' | Color palette |
| `showControls` | `boolean` | true | Show control panel (enhanced only) |
| `particleCount` | `number` | 150 | Number of spark particles |

## UI Controls (Enhanced Mode)

When `showControls={true}`, an interactive panel appears with:

- **Color Mode Selector** - Switch between Classic/Warm/Cyberpunk
- **Glow Intensity Slider** - Real-time brightness adjustment (0-200%)
- **Live Stats** - FPS counter, particle count, coil/segment counts
- **Audio Indicator** - Shows when audio stream is active

## Architecture

```
JarvisArcReactor (React Wrapper)
├── Classic Mode → ArcReactor-v7.js
└── Enhanced Mode → ArcReactor-cinematic.js
    ├── _createInnerCore() - Shader-based brilliant core
    ├── _createPlasmaRings() - 3 animated energy rings
    ├── _createCoilRings() - 10 detailed copper coils
    ├── _createWaveform() - Audio-reactive point ring
    ├── _createSegmentRings() - 24+12 light segments
    ├── _createOuterHousing() - Metallic housing with bolts
    ├── _createParticleSystem() - 150 spark particles
    ├── _createVolumetricGlows() - Controlled glow planes
    └── _createTechOverlay() - Hex grid background
```

## Shaders

### coreFragment
Multi-layer glow with:
- White-hot inner core
- Electric blue mid-layer
- Cyan atmospheric aura
- Fresnel edge effects
- Audio-reactive pulsing

### plasmaFragment
Energy ring shader with:
- Multiple flowing streams
- Cross-pattern interference
- Fresnel edge highlighting
- Color shifting based on energy

### coilFragment
Realistic copper material:
- Scratch/wear patterns
- Metallic gradients
- Magnetic energy bleeding
- Rim lighting

### particleFragment
Spark/star particles:
- Rotating star shape
- Rays with glow center
- Variable opacity

### glowFragment
Controlled volumetric glow:
- Distance-based falloff
- Animated pulsing
- Color temperature shift

### hexTechFragment
Tech grid overlay:
- Hexagonal distance field
- Data flow animation
- Audio-pulse illumination

## Performance

- **Target FPS**: 60fps on modern devices
- **Optimized**: Uses buffer geometry for particles
- **Smart Updates**: Only updates changed attributes
- **Audio Processing**: 1024-point FFT at 60fps
- **Mobile**: Tested on mid-range devices

## Browser Support

- Chrome 90+ (Recommended)
- Firefox 88+
- Edge 90+
- Safari 14+ (Limited - no audio reactivity)

Requires WebGL 2.0 for full shader effects.

## Files

```
components/jarvis-arc-reactor/
├── index.js                    # Exports
├── ArcReactor-v7.js           # Classic implementation
├── ArcReactor-cinematic.js    # Enhanced implementation
├── shaders-cinematic.js       # GLSL shaders
├── audio.js                   # Audio analyzer
└── README.md                  # This file

components/
├── JarvisArcReactor.tsx       # React wrapper (both modes)
└── JarvisArcReactorEnhanced.tsx # Standalone enhanced wrapper
```

## Future Enhancements

- [ ] Post-processing bloom (Three.js EffectComposer)
- [ ] Electric arc effects between coils
- [ ] Heat distortion shaders
- [ ] Holographic UI elements
- [ ] Mobile-optimized particle counts
- [ ] Custom color picker
- [ ] Preset animations (startup, shutdown, overload)
