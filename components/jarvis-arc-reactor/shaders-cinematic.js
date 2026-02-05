// ============================================
// JARVIS ARC REACTOR - CINEMATIC SHADERS v2.0
// Enhanced visuals with proper bloom control
// ============================================

// Core vertex shader with displacement
export const coreVertex = `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
uniform float time;
uniform float audioLevel;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  
  // Subtle displacement based on audio
  float displacement = sin(time * 3.0 + position.x * 10.0) * 0.02 * audioLevel;
  vec3 newPos = position + normal * displacement;
  vPosition = newPos;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
`;

// Main core fragment - Brilliant white-hot center
export const coreFragment = `
uniform float time;
uniform float intensity;
uniform float audioLevel;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;
  
  // Multi-layer glow for cinematic look
  // Inner white-hot core
  float coreIntensity = pow(max(0.0, 1.0 - dist * 8.0), 4.0);
  
  // Electric blue layer
  float blueLayer = pow(max(0.0, 1.0 - dist * 5.0), 3.0) * 0.6;
  
  // Cyan aura
  float cyanAura = pow(max(0.0, 1.0 - dist * 3.0), 2.0) * 0.3;
  
  // Outer atmospheric glow (very subtle)
  float atmosphere = pow(max(0.0, 1.0 - dist * 1.5), 1.5) * 0.08;
  
  // Audio reactivity - core pulses with sound
  float pulse = 1.0 + audioLevel * 0.5 + sin(time * 4.0) * 0.1;
  
  // Fresnel effect for edge definition
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
  
  // Color composition
  vec3 whiteHot = vec3(1.0, 0.98, 0.95) * coreIntensity * pulse;
  vec3 electricBlue = vec3(0.0, 0.6, 1.0) * blueLayer * pulse;
  vec3 cyanGlow = vec3(0.0, 0.9, 1.0) * cyanAura * (0.8 + audioLevel * 0.4);
  vec3 atmColor = vec3(0.1, 0.4, 0.8) * atmosphere;
  
  vec3 finalColor = whiteHot + electricBlue + cyanGlow + atmColor;
  
  // Enhanced alpha with fresnel
  float alpha = (coreIntensity * 0.9 + blueLayer * 0.7 + cyanAura * 0.4 + atmosphere * 0.2) * intensity;
  alpha += fresnel * 0.1 * audioLevel;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Plasma energy ring shaders
export const plasmaVertex = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
uniform float time;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const plasmaFragment = `
uniform float time;
uniform float intensity;
uniform vec3 color;
uniform float audioLevel;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Multiple flowing energy streams
  float flow1 = sin(vUv.x * 30.0 + time * 5.0) * 0.5 + 0.5;
  float flow2 = sin(vUv.x * 50.0 - time * 8.0 + audioLevel * 3.0) * 0.5 + 0.5;
  float flow3 = sin(vUv.x * 20.0 + time * 3.0) * 0.5 + 0.5;
  
  // Cross-flow pattern
  float crossFlow = sin(vUv.y * 10.0 + time * 2.0) * 0.5 + 0.5;
  
  // Fresnel for edge glow
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 1.5);
  
  // Energy intensity combines flows
  float energy = (flow1 * 0.4 + flow2 * 0.35 + flow3 * 0.25) * fresnel;
  energy *= (0.6 + crossFlow * 0.4);
  
  // Audio reactivity
  energy *= (0.8 + audioLevel * 0.6);
  
  // Color variation based on energy
  vec3 hotColor = vec3(0.8, 1.0, 1.0); // White-hot
  vec3 baseColor = color;
  vec3 finalColor = mix(baseColor, hotColor, energy * 0.5) * (0.3 + energy * 0.7);
  
  float alpha = (0.15 + energy * 0.65) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Enhanced coil shader with copper realism
export const coilVertex = `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
uniform float time;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const coilFragment = `
uniform float time;
uniform float intensity;
uniform vec3 baseColor;
uniform vec3 glowColor;
uniform float audioLevel;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  // Realistic copper material
  // Scratches/wear pattern
  float wear = sin(vUv.x * 100.0) * sin(vUv.y * 50.0) * 0.1 + 0.9;
  
  // Metallic gradient based on lighting
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
  
  // Copper base colors
  vec3 copperDark = vec3(0.45, 0.25, 0.1);
  vec3 copperLight = vec3(0.9, 0.55, 0.3);
  vec3 copperHighlight = vec3(1.0, 0.7, 0.4);
  
  // Mix based on fresnel and wear
  vec3 copper = mix(copperDark, copperLight, fresnel * wear);
  copper = mix(copper, copperHighlight, pow(fresnel, 2.0) * 0.5);
  
  // Energy glow pulse
  float pulse = 0.5 + 0.5 * sin(time * 3.0 + vUv.x * 20.0);
  pulse *= (0.7 + audioLevel * 0.6);
  
  // Blue energy bleeding into copper (magnetic effect)
  vec3 energy = glowColor * pulse * intensity * 0.4;
  
  // Rim lighting for definition
  float rim = pow(1.0 - abs(dot(vNormal, viewDir)), 4.0) * 0.3;
  
  vec3 finalColor = copper * 0.7 + energy + vec3(rim) * glowColor;
  
  gl_FragColor = vec4(finalColor, 0.95);
}
`;

// Energy particle shader
export const particleVertex = `
attribute float size;
attribute float opacity;
attribute vec3 customColor;
attribute float rotation;
uniform float time;
uniform float audioLevel;
varying float vOpacity;
varying vec3 vColor;
varying float vRotation;

void main() {
  vOpacity = opacity;
  vColor = customColor;
  vRotation = rotation + time * 2.0;
  
  vec3 pos = position;
  
  // Spiral motion
  float angle = time * 1.5 + position.z * 5.0 + rotation;
  float radius = length(pos.xy) + sin(time * 2.0 + position.z * 10.0) * 0.05 * audioLevel;
  
  // Add some vertical float
  pos.z += sin(time * 3.0 + rotation * 10.0) * 0.1 * audioLevel;
  
  pos.x = cos(angle) * radius;
  pos.y = sin(angle) * radius;
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  
  // Size varies with audio
  float sizeMult = 1.0 + audioLevel * 1.5;
  gl_PointSize = size * (400.0 / -mvPosition.z) * sizeMult;
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particleFragment = `
uniform float time;
varying float vOpacity;
varying vec3 vColor;
varying float vRotation;

void main() {
  // Rotate particle UV
  vec2 coord = gl_PointCoord - vec2(0.5);
  float s = sin(vRotation);
  float c = cos(vRotation);
  vec2 rotated = vec2(
    coord.x * c - coord.y * s,
    coord.x * s + coord.y * c
  );
  rotated += vec2(0.5);
  
  // Star/spark shape
  float dist = length(rotated - vec2(0.5));
  float angle = atan(rotated.y - 0.5, rotated.x - 0.5);
  float star = 1.0 - smoothstep(0.0, 0.5, dist);
  
  // Add sparkle rays
  float rays = sin(angle * 4.0) * 0.5 + 0.5;
  star *= (0.7 + rays * 0.3);
  
  if (dist > 0.5) discard;
  
  // Soft glow center
  float glow = 1.0 - smoothstep(0.0, 0.3, dist);
  
  vec3 finalColor = vColor * (0.5 + glow * 0.5);
  float finalAlpha = vOpacity * star;
  
  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

// Volumetric glow shader (carefully controlled)
export const glowVertex = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const glowFragment = `
uniform float time;
uniform float intensity;
uniform vec3 glowColor;
uniform float audioLevel;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;
  
  // Controlled glow falloff
  float glow = pow(max(0.0, 1.0 - dist), 3.0);
  
  // Animated pulse
  float pulse = 0.85 + 0.15 * sin(time * 2.5) + audioLevel * 0.25;
  
  // Distance-based color shift
  vec3 innerColor = vec3(1.0, 1.0, 1.0);
  vec3 outerColor = glowColor;
  vec3 finalColor = mix(innerColor, outerColor, dist * 0.5) * glow * pulse;
  
  float alpha = glow * intensity * (0.3 + audioLevel * 0.2);
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Electric arc shader
export const arcVertex = `
attribute float arcOffset;
uniform float time;
uniform float audioLevel;
varying float vArcOffset;
varying float vIntensity;

void main() {
  vArcOffset = arcOffset;
  
  vec3 pos = position;
  // Jitter for electricity effect
  float jitter = sin(time * 20.0 + arcOffset * 100.0) * 0.02 * (1.0 + audioLevel);
  pos += normal * jitter;
  
  vIntensity = 0.5 + audioLevel * 0.5;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const arcFragment = `
uniform float time;
uniform vec3 arcColor;
uniform float intensity;
varying float vArcOffset;
varying float vIntensity;

void main() {
  // Flickering effect
  float flicker = sin(time * 30.0 + vArcOffset * 50.0) * 0.5 + 0.5;
  flicker *= sin(time * 45.0) * 0.5 + 0.5;
  
  // Core bright, edges fade
  float core = pow(flicker, 0.5);
  
  vec3 finalColor = arcColor * core * vIntensity * 2.0;
  float alpha = core * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

// Hexagon tech pattern shader
export const hexTechVertex = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const hexTechFragment = `
uniform float time;
uniform float intensity;
uniform float audioLevel;
varying vec2 vUv;

// Hexagon distance function
float hexDist(vec2 p) {
  p = abs(p);
  float c = dot(p, normalize(vec2(1.0, 1.73)));
  c = max(c, p.x);
  return c;
}

vec2 hexCoord(vec2 uv) {
  vec2 r = vec2(1.0, 1.73);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  return dot(a, a) < dot(b, b) ? a : b;
}

void main() {
  vec2 uv = vUv * 4.0;
  vec2 hex = hexCoord(uv);
  
  // Hexagon grid
  float h = hexDist(hex);
  float hexGrid = 1.0 - smoothstep(0.4, 0.5, h);
  
  // Data flow animation
  float flow = sin(uv.y * 2.0 - time * 3.0) * 0.5 + 0.5;
  flow *= sin(uv.x * 3.0 + time * 2.0) * 0.5 + 0.5;
  
  // Audio reactivity
  float audioPulse = (0.3 + audioLevel * 0.7);
  
  // Tech colors
  vec3 baseColor = vec3(0.0, 0.2, 0.4);
  vec3 lineColor = vec3(0.0, 0.8, 1.0) * audioPulse;
  vec3 dataColor = vec3(0.4, 0.9, 1.0) * flow * audioPulse;
  
  vec3 finalColor = baseColor * 0.1 + lineColor * hexGrid * 0.5 + dataColor * hexGrid * 0.3;
  
  float alpha = (0.05 + hexGrid * 0.4 * audioPulse) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;
