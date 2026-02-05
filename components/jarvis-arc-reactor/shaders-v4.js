// ============================================
// JARVIS ARC REACTOR - CINEMATIC SHADERS
// VERSION: 4 - TINY CORE - 90% REDUCED GLOW
// ============================================

// Core vertex shader
export const coreVertex = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Main core fragment - ULTRA tiny contained center
// CACHE_BUST: 20260205-1810
export const coreFragment = `
uniform float time;
uniform float intensity;
uniform float audioLevel;
varying vec2 vUv;

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;
  
  // ULTRA SHARP - 95% smaller than original
  float coreGlow = pow(max(0.0, 1.0 - dist * 20.0), 20.0);
  
  // Minimal blue layer
  float blueGlow = pow(max(0.0, 1.0 - dist * 15.0), 15.0) * 0.2;
  
  // Barely there aura
  float auraGlow = pow(max(0.0, 1.0 - dist * 10.0), 10.0) * 0.02;
  
  // Subtle pulse
  float pulse = 0.8 + 0.2 * sin(time * 2.0) + audioLevel * 0.3;
  
  // Color layers - very reduced intensity
  vec3 whiteHot = vec3(1.0, 1.0, 1.0) * coreGlow * 0.5;
  vec3 electricBlue = vec3(0.2, 0.6, 1.0) * blueGlow * pulse * 0.2;
  vec3 cyanAura = vec3(0.1, 0.8, 1.0) * auraGlow * pulse * 0.05;
  
  vec3 finalColor = whiteHot + electricBlue + cyanAura;
  float alpha = (coreGlow * 0.4 + blueGlow * 0.1 + auraGlow * 0.02) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Energy ring shader with flowing effect
export const ringVertex = `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ringFragment = `
uniform float time;
uniform float intensity;
uniform vec3 color;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  // Flowing energy effect
  float flow = sin(vUv.x * 20.0 + time * 4.0) * 0.5 + 0.5;
  float flow2 = sin(vUv.x * 40.0 - time * 6.0) * 0.5 + 0.5;
  
  // Fresnel effect for edge glow
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
  
  float energy = (flow * 0.6 + flow2 * 0.4) * fresnel;
  
  vec3 finalColor = color * (0.3 + energy * 0.7) * intensity;
  float alpha = (0.2 + energy * 0.8) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Coil/Wire shader
export const coilVertex = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const coilFragment = `
uniform float time;
uniform float intensity;
uniform vec3 baseColor;
uniform vec3 glowColor;
varying vec2 vUv;

void main() {
  // Copper wire look with energy pulse
  float pulse = 0.5 + 0.5 * sin(time * 2.0 + vUv.x * 10.0);
  
  // Metallic gradient
  float metallic = 0.3 + 0.4 * sin(vUv.y * 3.14159);
  
  vec3 copper = vec3(0.72, 0.45, 0.2) * metallic;
  vec3 energy = glowColor * pulse * intensity;
  
  vec3 finalColor = copper * 0.3 + energy;
  
  gl_FragColor = vec4(finalColor, 0.9);
}
`;

// Particle shader for energy particles
export const particleVertex = `
attribute float size;
attribute float opacity;
attribute vec3 customColor;
uniform float time;
uniform float audioLevel;
varying float vOpacity;
varying vec3 vColor;

void main() {
  vOpacity = opacity;
  vColor = customColor;
  
  vec3 pos = position;
  // Particles spiral outward
  float angle = time * 2.0 + position.z * 3.0;
  float radius = length(pos.xy) + sin(time + position.z) * 0.1 * audioLevel;
  pos.x = cos(angle) * radius;
  pos.y = sin(angle) * radius;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z) * (1.0 + audioLevel);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particleFragment = `
uniform float time;
varying float vOpacity;
varying vec3 vColor;

void main() {
  // Circular particle
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;
  
  // Soft glow edge
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  
  gl_FragColor = vec4(vColor, vOpacity * glow);
}
`;

// Hexagon grid shader for the reactor face - simplified
export const hexVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const hexFragment = `
uniform float time;
uniform float intensity;
uniform float audioLevel;
varying vec2 vUv;

void main() {
  vec2 uv = vUv * 3.0;
  float t = time * 2.0;
  
  // Simple grid pattern
  float gridX = abs(fract(uv.x) - 0.5);
  float gridY = abs(fract(uv.y) - 0.5);
  float grid = 1.0 - smoothstep(0.0, 0.1, min(gridX, gridY));
  
  // Audio-responsive illumination
  float audioPulse = sin(t) * 0.5 + 0.5;
  audioPulse *= (0.5 + audioLevel);
  
  // Colors
  vec3 baseColor = vec3(0.0, 0.4, 0.6);
  vec3 glowColor = vec3(0.2, 0.9, 1.0) * audioPulse;
  
  vec3 finalColor = baseColor * 0.1 + glowColor * grid;
  
  float alpha = (0.1 + grid * 0.5) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Volumetric glow shader - subtle and contained
export const glowVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// CACHE_BUST: 20260205-1810
export const glowFragment = `
uniform float time;
uniform float intensity;
uniform vec3 glowColor;
uniform float audioLevel;
varying vec2 vUv;

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;
  
  // ULTRA SHARP - 95% smaller
  float glow = pow(max(0.0, 1.0 - dist * 15.0), 20.0);
  
  // Subtle pulse
  float pulse = 0.9 + 0.1 * sin(time * 2.0) + audioLevel * 0.2;
  
  float totalGlow = glow * pulse * intensity;
  
  // Very soft color output
  gl_FragColor = vec4(glowColor * totalGlow * 0.1, totalGlow * 0.2);
}
`;
