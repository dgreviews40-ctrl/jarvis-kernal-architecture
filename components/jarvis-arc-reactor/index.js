// JARVIS Arc Reactor Exports
// Original version (stable, minimal)
export { JarvisArcReactor } from './ArcReactor-v7.js';

// Cinematic version (enhanced visuals, more effects)
export { CinematicArcReactor } from './ArcReactor-cinematic.js';

// Authentic version (MCU-accurate Mark I/II design)
export { AuthenticArcReactor } from './ArcReactor-authentic.js';

// Shader exports for custom implementations
export {
  coreVertex, coreFragment,
  plasmaVertex, plasmaFragment,
  coilVertex, coilFragment,
  particleVertex, particleFragment,
  glowVertex, glowFragment,
  arcVertex, arcFragment,
  hexTechVertex, hexTechFragment
} from './shaders-cinematic.js';
