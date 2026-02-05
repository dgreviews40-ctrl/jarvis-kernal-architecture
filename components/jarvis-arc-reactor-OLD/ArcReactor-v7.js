import * as THREE from 'three';
import { createAudioAnalyzer } from './audio.js';
import { 
  coreVertex, coreFragment, 
  ringVertex, ringFragment,
  coilVertex, coilFragment,
  particleVertex, particleFragment,
  hexVertex, hexFragment,
  glowVertex, glowFragment
} from './shaders-v4.js';

/**
 * Cinematic JARVIS Arc Reactor
 * Inspired by Iron Man's arc reactor with realistic materials and effects
 */
export class JarvisArcReactor {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    
    // Camera setup - adjusted for full arc reactor visibility
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.z = 6.5;

    // Renderer with high quality settings
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    // Add padding to renderer size to prevent glow clipping
    const padding = 60;
    this.renderer.setSize(container.clientWidth + padding, container.clientHeight + padding);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Center the canvas with negative margins
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.left = `-${padding/2}px`;
    this.renderer.domElement.style.top = `-${padding/2}px`;
    container.appendChild(this.renderer.domElement);

    // Audio smoothing
    this.lastAvg = 0;
    this.smoothedAudio = 0;
    
    // Build the reactor
    this._setupLighting();
    this._createInnerCore();
    // DISABLED FOR TESTING: this._createPlasmaRing();
    this._createCoilRings();
    this._createWaveform();
    this._createSegmentRings();
    this._createOuterHousing();
    this._createParticleSystem();
    // DISABLED FOR TESTING: this._createVolumetricGlow();
    
    // Time tracking
    this.time = 0;
    console.log('[ArcReactor] v8 - CORE 0.05x0.05 - PLASMA & GLOW DISABLED');
  }

  _setupLighting() {
    // Ambient fill
    const ambient = new THREE.AmbientLight(0x112244, 0.3);
    this.scene.add(ambient);
    
    // Main blue light from center - reduced intensity and range
    this.centerLight = new THREE.PointLight(0x00ddff, 0.4, 2);
    this.centerLight.position.set(0, 0, 0.5);
    this.scene.add(this.centerLight);
    
    // Rim light for metallic edges
    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.8);
    rimLight.position.set(2, 2, 2);
    this.scene.add(rimLight);
    
    const rimLight2 = new THREE.DirectionalLight(0x2244aa, 0.5);
    rimLight2.position.set(-2, -2, 1);
    this.scene.add(rimLight2);
  }

  // Level 1: The bright white-hot inner core
  _createInnerCore() {
    // Force shader recompilation by adding timestamp comment
    const cacheBust = `// ${Date.now()}\n`;
    
    // Main core shader - ULTRA TINY
    this.coreMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 1.8 },
        audioLevel: { value: 0 }
      },
      vertexShader: cacheBust + coreVertex,
      fragmentShader: cacheBust + `
uniform float time;
uniform float intensity;
uniform float audioLevel;
varying vec2 vUv;

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;
  
  // ULTRA SHARP - 95% smaller than original
  float coreGlow = pow(max(0.0, 1.0 - dist * 25.0), 25.0);
  
  // Minimal blue layer
  float blueGlow = pow(max(0.0, 1.0 - dist * 18.0), 18.0) * 0.15;
  
  // Barely there aura
  float auraGlow = pow(max(0.0, 1.0 - dist * 12.0), 12.0) * 0.01;
  
  // Subtle pulse
  float pulse = 0.8 + 0.2 * sin(time * 2.0) + audioLevel * 0.3;
  
  // Color layers - very reduced intensity
  vec3 whiteHot = vec3(1.0, 1.0, 1.0) * coreGlow * 0.4;
  vec3 electricBlue = vec3(0.2, 0.6, 1.0) * blueGlow * pulse * 0.15;
  vec3 cyanAura = vec3(0.1, 0.8, 1.0) * auraGlow * pulse * 0.03;
  
  vec3 finalColor = whiteHot + electricBlue + cyanAura;
  float alpha = (coreGlow * 0.3 + blueGlow * 0.08 + auraGlow * 0.01) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.core = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.05),
      this.coreMat
    );
    this.core.position.z = 0.4;
    this.scene.add(this.core);
    
    console.log('[ArcReactor] CORE GEOMETRY REDUCED TO 0.05x0.05 - SHOULD BE PINPOINT');
    
    // Inner hexagon pattern overlay
    this.hexMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.8 },
        audioLevel: { value: 0 }
      },
      vertexShader: hexVertex,
      fragmentShader: hexFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.hexGrid = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.25),
      this.hexMat
    );
    this.hexGrid.position.z = 0.41;
    this.scene.add(this.hexGrid);
  }

  // Level 2: Rotating plasma energy ring - ULTRA TINY
  _createPlasmaRing() {
    const cacheBust = `// ${Date.now()}\n`;
    
    this.plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.4 },
        color: { value: new THREE.Color(0x00ddff) }
      },
      vertexShader: cacheBust + `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
      fragmentShader: cacheBust + `
uniform float time;
uniform float intensity;
uniform vec3 color;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  // Flowing energy effect
  float flow = sin(vUv.x * 20.0 + time * 4.0) * 0.5 + 0.5;
  float flow2 = sin(vUv.x * 40.0 - time * 6.0) * 0.5 + 0.5;
  
  // Fresnel effect for edge glow - reduced
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 1.5);
  
  float energy = (flow * 0.6 + flow2 * 0.4) * fresnel;
  
  vec3 finalColor = color * (0.2 + energy * 0.5) * intensity;
  float alpha = (0.1 + energy * 0.5) * intensity;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Main energy ring - ULTRA small
    this.plasmaRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.015, 16, 100),
      this.plasmaMat
    );
    this.plasmaRing.position.z = 0.35;
    this.scene.add(this.plasmaRing);
    
    // Secondary counter-rotating ring - ULTRA small
    this.plasmaRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.01, 16, 80),
      this.plasmaMat.clone()
    );
    this.plasmaRing2.material.uniforms.color.value = new THREE.Color(0x66eeff);
    this.plasmaRing2.position.z = 0.32;
    this.scene.add(this.plasmaRing2);
  }

  // Level 3: Electromagnetic coil rings (the iconic copper coils)
  _createCoilRings() {
    this.coils = new THREE.Group();
    
    const coilCount = 10;
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0xb87333,
      metalness: 0.9,
      roughness: 0.3,
      emissive: 0x0044aa,
      emissiveIntensity: 0.2
    });
    
    for (let i = 0; i < coilCount; i++) {
      const angle = (i / coilCount) * Math.PI * 2;
      const radius = 1.15;
      
      // Coil ring segment
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.04, 8, 20, Math.PI * 1.3),
        coilMat.clone()
      );
      
      coil.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0.25
      );
      coil.rotation.z = angle + Math.PI / 2;
      
      // Add energy glow to each coil
      coil.userData.baseEmissive = 0.2;
      coil.userData.index = i;
      
      this.coils.add(coil);
    }
    
    this.scene.add(this.coils);
  }

  // Level 4: Audio-reactive waveform ring
  _createWaveform() {
    this.POINTS = 180;
    this.waveRadius = 1.45;

    this.waveGeom = new THREE.BufferGeometry();
    this.wavePositions = new Float32Array(this.POINTS * 3);
    this.waveColors = new Float32Array(this.POINTS * 3);
    
    for (let i = 0; i < this.POINTS; i++) {
      const a = (i / this.POINTS) * Math.PI * 2;
      this.wavePositions[i * 3] = Math.cos(a) * this.waveRadius;
      this.wavePositions[i * 3 + 1] = Math.sin(a) * this.waveRadius;
      this.wavePositions[i * 3 + 2] = 0.15;
      
      // Gradient colors from cyan to blue
      this.waveColors[i * 3] = 0.0;
      this.waveColors[i * 3 + 1] = 0.8 + (i / this.POINTS) * 0.2;
      this.waveColors[i * 3 + 2] = 1.0;
    }
    
    this.waveGeom.setAttribute('position', new THREE.BufferAttribute(this.wavePositions, 3));
    this.waveGeom.setAttribute('color', new THREE.BufferAttribute(this.waveColors, 3));

    this.waveMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      linewidth: 2
    });

    this.waveform = new THREE.LineLoop(this.waveGeom, this.waveMat);
    this.waveform.position.z = 0.15;
    this.scene.add(this.waveform);
  }

  // Level 5: Light segments (the iconic arc reactor lights)
  _createSegmentRings() {
    this.segments = new THREE.Group();
    this.segmentsInner = new THREE.Group();
    
    const count = 24;
    const innerCount = 12;
    
    // Outer segment ring
    for (let i = 0; i < count; i++) {
      const segGroup = new THREE.Group();
      
      // The light bar
      const lightMat = new THREE.MeshBasicMaterial({
        color: 0x88ffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      
      const light = new THREE.Mesh(
        new THREE.PlaneGeometry(0.35, 0.06),
        lightMat
      );
      
      // Glow behind the light
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
      });
      
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.12),
        glowMat
      );
      glow.position.z = -0.01;
      
      segGroup.add(glow);
      segGroup.add(light);
      
      const a = (i / count) * Math.PI * 2;
      segGroup.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.1);
      segGroup.rotation.z = a;
      
      // Store for animation
      segGroup.userData = { 
        baseOpacity: 0.8, 
        lightMat: lightMat,
        glowMat: glowMat,
        index: i 
      };
      
      this.segments.add(segGroup);
    }
    
    // Inner segment ring (smaller, different color)
    for (let i = 0; i < innerCount; i++) {
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.04),
        new THREE.MeshBasicMaterial({
          color: 0xaaddff,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending
        })
      );
      
      const a = (i / innerCount) * Math.PI * 2 + Math.PI / innerCount;
      seg.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0.12);
      seg.rotation.z = a;
      
      seg.userData = { baseOpacity: 0.6 };
      this.segmentsInner.add(seg);
    }
    
    this.scene.add(this.segments);
    this.scene.add(this.segmentsInner);
  }

  // Level 6: Outer housing ring
  _createOuterHousing() {
    // Main outer ring
    this.outerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.3, 2.45, 128),
      new THREE.MeshStandardMaterial({
        color: 0x224466,
        metalness: 0.8,
        roughness: 0.4,
        emissive: 0x001133,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      })
    );
    this.outerRing.position.z = 0.05;
    this.scene.add(this.outerRing);
    
    // No outer glow ring - removed to prevent blue blob
    
    // Detail bolts/screws around outer ring
    this.bolts = new THREE.Group();
    const boltCount = 12;
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.95,
      roughness: 0.2
    });
    
    for (let i = 0; i < boltCount; i++) {
      const a = (i / boltCount) * Math.PI * 2;
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16),
        boltMat
      );
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0.05);
      this.bolts.add(bolt);
    }
    this.scene.add(this.bolts);
  }

  // Level 7: Floating energy particles
  _createParticleSystem() {
    const particleCount = 100;
    const geom = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 1.8;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = Math.random() * 0.5;
      
      sizes[i] = 2 + Math.random() * 4;
      opacities[i] = 0.3 + Math.random() * 0.5;
      
      // Blue to cyan gradient
      colors[i * 3] = 0.0;
      colors[i * 3 + 1] = 0.6 + Math.random() * 0.4;
      colors[i * 3 + 2] = 1.0;
    }
    
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geom.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    
    this.particleMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        audioLevel: { value: 0 }
      },
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.particles = new THREE.Points(geom, this.particleMat);
    this.particles.position.z = 0.3;
    this.scene.add(this.particles);
  }

  // Level 8: Very subtle volumetric glow - ULTRA minimal
  _createVolumetricGlow() {
    const cacheBust = `// ${Date.now()}\n`;
    
    // Single tiny glow behind core - ULTRA subtle
    this.volGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.15 },
        glowColor: { value: new THREE.Color(0x0088cc) },
        audioLevel: { value: 0 }
      },
      vertexShader: cacheBust + glowVertex,
      fragmentShader: cacheBust + `
uniform float time;
uniform float intensity;
uniform vec3 glowColor;
uniform float audioLevel;
varying vec2 vUv;

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;
  
  // ULTRA SHARP - 95% smaller
  float glow = pow(max(0.0, 1.0 - dist * 20.0), 25.0);
  
  // Subtle pulse
  float pulse = 0.9 + 0.1 * sin(time * 2.0) + audioLevel * 0.2;
  
  float totalGlow = glow * pulse * intensity;
  
  // Very soft color output
  gl_FragColor = vec4(glowColor * totalGlow * 0.08, totalGlow * 0.15);
}
`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Tiny glow just behind the core
    this.volGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.15),
      this.volGlowMat
    );
    this.volGlow.position.z = -0.05;
    this.scene.add(this.volGlow);
  }

  async initAudio(stream) {
    if (this.audio) return;
    try {
      this.audio = await createAudioAnalyzer(stream);
      console.log('[ArcReactor] Audio initialized successfully');
    } catch (err) {
      console.error('[ArcReactor] Failed to initialize audio:', err);
    }
  }

  update() {
    this.time += 0.016;
    
    // Get FFT data
    let fft = null;
    let fftLength = 0;
    
    if (this.audio) {
      fft = this.audio.getData();
      fftLength = fft ? fft.length : 0;
    }
    
    // Calculate audio levels with smoothing
    let avg = 0;
    let maxVal = 0;
    if (fft && fftLength > 0) {
      const len = Math.min(fftLength, 128);
      for (let i = 0; i < len; i++) {
        avg += fft[i];
        if (fft[i] > maxVal) maxVal = fft[i];
      }
      avg /= len;
    }
    
    // Smooth audio response
    this.lastAvg = this.lastAvg * 0.6 + avg * 0.4;
    const audioLevel = Math.min(this.lastAvg / 60, 1.0); // Normalize
    this.smoothedAudio = this.smoothedAudio * 0.8 + audioLevel * 0.2;
    
    // Debug logging
    if (!this._frameCount) this._frameCount = 0;
    this._frameCount++;
    if (this._frameCount % 60 === 0) {
      console.log('[ArcReactor] avg:', avg.toFixed(1), 'audioLevel:', audioLevel.toFixed(2));
    }

    // ============================================
    // UPDATE ALL COMPONENTS
    // ============================================
    
    // 1. Core - pulse with audio (contained)
    this.coreMat.uniforms.time.value = this.time;
    this.coreMat.uniforms.intensity.value = 0.7 + this.smoothedAudio * 0.4;
    this.coreMat.uniforms.audioLevel.value = this.smoothedAudio;
    this.core.scale.setScalar(1 + this.smoothedAudio * 0.1);
    
    // Hex grid
    this.hexMat.uniforms.time.value = this.time;
    this.hexMat.uniforms.audioLevel.value = this.smoothedAudio;
    this.hexGrid.rotation.z = this.time * 0.1;
    
    // 2. Plasma rings - DISABLED FOR TESTING
    // this.plasmaMat.uniforms.time.value = this.time;
    // this.plasmaMat.uniforms.intensity.value = 0.6 + this.smoothedAudio * 0.8;
    // this.plasmaRing.rotation.z = this.time * 0.5;
    // this.plasmaRing.rotation.x = Math.sin(this.time * 0.3) * 0.1;
    // this.plasmaRing.rotation.y = Math.cos(this.time * 0.2) * 0.1;
    // this.plasmaRing2.material.uniforms.time.value = this.time;
    // this.plasmaRing2.material.uniforms.intensity.value = 0.5 + this.smoothedAudio * 0.6;
    // this.plasmaRing2.rotation.z = -this.time * 0.7;
    
    // 3. Coils - energy pulse through them
    this.coils.children.forEach((coil, i) => {
      const offset = (i / this.coils.children.length) * Math.PI * 2;
      const pulse = Math.sin(this.time * 3 + offset) * 0.5 + 0.5;
      const audioPulse = this.smoothedAudio * Math.sin(offset * 3 + this.time * 5);
      
      coil.material.emissiveIntensity = coil.userData.baseEmissive + 
        pulse * 0.3 + audioPulse * 0.8;
    });
    this.coils.rotation.z = this.time * 0.05;
    
    // 4. Waveform - dramatic FFT visualization
    for (let i = 0; i < this.POINTS; i++) {
      const a = (i / this.POINTS) * Math.PI * 2;
      
      let amp = 0;
      if (fft && fftLength > 0) {
        const fftIndex = Math.floor((i / this.POINTS) * fftLength * 0.5);
        amp = fft[fftIndex] / 255;
      }
      
      // Smooth the amplitude
      const smoothAmp = amp * 0.7 + 0.3;
      
      // Radius deformation
      const r = this.waveRadius * (1 + amp * 0.6 * (1 + this.smoothedAudio));
      this.wavePositions[i * 3] = Math.cos(a) * r;
      this.wavePositions[i * 3 + 1] = Math.sin(a) * r;
      
      // Z-position bounce with audio
      this.wavePositions[i * 3 + 2] = 0.15 + amp * 0.3;
      
      // Color shift with audio
      this.waveColors[i * 3] = amp * 0.5; // Add some red for high energy
      this.waveColors[i * 3 + 1] = 0.7 + amp * 0.3;
      this.waveColors[i * 3 + 2] = 1.0;
    }
    this.waveGeom.attributes.position.needsUpdate = true;
    this.waveGeom.attributes.color.needsUpdate = true;
    this.waveform.rotation.z = -this.time * 0.2;
    this.waveMat.opacity = 0.5 + this.smoothedAudio * 0.5;
    
    // 5. Segments - react to frequency bins
    this.segments.children.forEach((segGroup, i) => {
      let boost = 0;
      if (fft && fftLength > 0) {
        const fftIndex = Math.floor((i / this.segments.children.length) * fftLength * 0.5);
        boost = fft[fftIndex] / 255;
      }
      
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2 + i * 0.5);
      
      // Scale the light
      segGroup.scale.x = 1 + boost * 2.0;
      segGroup.scale.y = 1 + boost * 0.5;
      
      // Brightness
      const opacity = segGroup.userData.baseOpacity * (0.5 + pulse * 0.5 + boost);
      segGroup.userData.lightMat.opacity = Math.min(opacity, 1.0);
      segGroup.userData.glowMat.opacity = Math.min(opacity * 0.5, 0.6);
      
      // Color shift to white when loud
      const energy = boost + this.smoothedAudio;
      segGroup.userData.lightMat.color.setHSL(
        0.5 - energy * 0.1, // Shift toward blue-white
        1.0 - energy * 0.3,
        0.5 + energy * 0.5
      );
    });
    this.segments.rotation.z = this.time * 0.1;
    
    // Inner segments
    this.segmentsInner.children.forEach((seg, i) => {
      let boost = 0;
      if (fft && fftLength > 0) {
        const fftIndex = Math.floor((i / this.segmentsInner.children.length) * fftLength * 0.3);
        boost = fft[fftIndex] / 255;
      }
      seg.material.opacity = seg.userData.baseOpacity * (0.5 + boost * 2.0);
      seg.scale.x = 1 + boost;
    });
    this.segmentsInner.rotation.z = -this.time * 0.15;
    
    // 6. Outer housing - subtle pulse
    this.outerRing.material.emissiveIntensity = 0.3 + this.smoothedAudio * 0.5;
    
    // 7. Particles - swirl with audio
    this.particleMat.uniforms.time.value = this.time;
    this.particleMat.uniforms.audioLevel.value = this.smoothedAudio;
    this.particles.rotation.z = this.time * 0.3;
    
    // 8. Volumetric glow - DISABLED FOR TESTING
    // this.volGlowMat.uniforms.time.value = this.time;
    // this.volGlowMat.uniforms.audioLevel.value = this.smoothedAudio;
    // this.volGlowMat.uniforms.intensity.value = 0.1 + this.smoothedAudio * 0.2;
    
    // Center light intensity - reduced
    this.centerLight.intensity = 0.2 + this.smoothedAudio * 0.2;
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}


