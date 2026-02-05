import * as THREE from 'three';
import { createAudioAnalyzer } from './audio.js';
import {
  coreVertex, coreFragment,
  plasmaVertex, plasmaFragment,
  coilVertex, coilFragment,
  particleVertex, particleFragment,
  glowVertex, glowFragment,
  arcVertex, arcFragment,
  hexTechVertex, hexTechFragment
} from './shaders-cinematic.js';

/**
 * Cinematic JARVIS Arc Reactor v2.0
 * Enhanced visuals with proper bloom control and multi-zone colors
 */
export class CinematicArcReactor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      enablePostProcessing: options.enablePostProcessing ?? true,
      particleCount: options.particleCount ?? 150,
      glowIntensity: options.glowIntensity ?? 1.0,
      colorShift: options.colorShift ?? 0, // 0 = classic, 1 = warm, 2 = cyberpunk
      ...options
    };

    this.scene = new THREE.Scene();

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.z = 6.5;

    // Renderer with high quality
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 0);
    
    const padding = 60;
    this.renderer.setSize(container.clientWidth + padding, container.clientHeight + padding);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.left = `-${padding / 2}px`;
    this.renderer.domElement.style.top = `-${padding / 2}px`;
    container.appendChild(this.renderer.domElement);

    // Audio smoothing
    this.lastAvg = 0;
    this.smoothedAudio = 0;
    this.audioLevelHistory = new Array(10).fill(0);

    // Color palettes based on mode
    this.colorPalettes = {
      classic: {
        core: 0x00ddff,
        plasma: 0x00aaff,
        coilGlow: 0x0088ff,
        segments: 0x88ffff,
        housing: 0x224466
      },
      warm: {
        core: 0xffaa00,
        plasma: 0xff6600,
        coilGlow: 0xff4400,
        segments: 0xffcc88,
        housing: 0x442211
      },
      cyberpunk: {
        core: 0xff00ff,
        plasma: 0xaa00ff,
        coilGlow: 0xff0088,
        segments: 0xff88ff,
        housing: 0x441144
      }
    };
    this.colors = this.colorPalettes[['classic', 'warm', 'cyberpunk'][this.options.colorShift]];

    // Build all components
    this._setupLighting();
    this._createInnerCore();
    this._createPlasmaRings();
    this._createCoilRings();
    this._createWaveform();
    this._createSegmentRings();
    this._createOuterHousing();
    this._createParticleSystem();
    this._createVolumetricGlows();
    this._createTechOverlay();

    this.time = 0;
    console.log('[ArcReactor Cinematic] v2.0 initialized with', this.options.particleCount, 'particles');
  }

  _setupLighting() {
    // Ambient fill
    const ambient = new THREE.AmbientLight(0x112244, 0.2);
    this.scene.add(ambient);

    // Main center light (subtle)
    this.centerLight = new THREE.PointLight(this.colors.core, 0.3, 3);
    this.centerLight.position.set(0, 0, 0.5);
    this.scene.add(this.centerLight);

    // Rim lights for metallic definition
    const rimLight1 = new THREE.DirectionalLight(0x4488ff, 0.6);
    rimLight1.position.set(2, 2, 2);
    this.scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x2244aa, 0.4);
    rimLight2.position.set(-2, -2, 1);
    this.scene.add(rimLight2);

    // Bottom fill
    const fillLight = new THREE.DirectionalLight(0x001133, 0.3);
    fillLight.position.set(0, -3, 0.5);
    this.scene.add(fillLight);
  }

  // Level 1: Brilliant inner core
  _createInnerCore() {
    this.coreMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 1.0 },
        audioLevel: { value: 0 }
      },
      vertexShader: coreVertex,
      fragmentShader: coreFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.core = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.4),
      this.coreMat
    );
    this.core.position.z = 0.4;
    this.scene.add(this.core);

    // Secondary core layer for depth
    this.coreInner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      })
    );
    this.coreInner.position.z = 0.41;
    this.scene.add(this.coreInner);
  }

  // Level 2: Energy plasma rings
  _createPlasmaRings() {
    this.plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.7 },
        color: { value: new THREE.Color(this.colors.plasma) },
        audioLevel: { value: 0 }
      },
      vertexShader: plasmaVertex,
      fragmentShader: plasmaFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Main plasma ring
    this.plasmaRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.025, 32, 100),
      this.plasmaMat
    );
    this.plasmaRing.position.z = 0.35;
    this.scene.add(this.plasmaRing);

    // Secondary counter-rotating ring
    this.plasmaRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.018, 32, 80),
      this.plasmaMat.clone()
    );
    this.plasmaRing2.material.uniforms.color.value = new THREE.Color(0x66eeff);
    this.plasmaRing2.position.z = 0.32;
    this.scene.add(this.plasmaRing2);

    // Third outer ring
    this.plasmaRing3 = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.012, 32, 60),
      this.plasmaMat.clone()
    );
    this.plasmaRing3.material.uniforms.color.value = new THREE.Color(0x44ccff);
    this.plasmaRing3.position.z = 0.28;
    this.scene.add(this.plasmaRing3);
  }

  // Level 3: Detailed copper coils
  _createCoilRings() {
    this.coils = new THREE.Group();

    const coilCount = 10;
    this.coilMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.6 },
        baseColor: { value: new THREE.Color(0xb87333) },
        glowColor: { value: new THREE.Color(this.colors.coilGlow) },
        audioLevel: { value: 0 }
      },
      vertexShader: coilVertex,
      fragmentShader: coilFragment,
      transparent: true
    });

    for (let i = 0; i < coilCount; i++) {
      const angle = (i / coilCount) * Math.PI * 2;
      const radius = 1.15;

      // Coil geometry - slightly thicker
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.05, 12, 24, Math.PI * 1.3),
        this.coilMat.clone()
      );

      coil.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0.25
      );
      coil.rotation.z = angle + Math.PI / 2;

      coil.userData = {
        baseEmissive: 0.3,
        index: i,
        angle: angle
      };

      this.coils.add(coil);
    }

    this.scene.add(this.coils);
  }

  // Level 4: Audio-reactive waveform
  _createWaveform() {
    this.POINTS = 200;
    this.waveRadius = 1.45;

    this.waveGeom = new THREE.BufferGeometry();
    this.wavePositions = new Float32Array(this.POINTS * 3);
    this.waveColors = new Float32Array(this.POINTS * 3);

    for (let i = 0; i < this.POINTS; i++) {
      const a = (i / this.POINTS) * Math.PI * 2;
      this.wavePositions[i * 3] = Math.cos(a) * this.waveRadius;
      this.wavePositions[i * 3 + 1] = Math.sin(a) * this.waveRadius;
      this.wavePositions[i * 3 + 2] = 0.15;

      // Gradient from cyan to blue
      const t = i / this.POINTS;
      this.waveColors[i * 3] = 0.0;
      this.waveColors[i * 3 + 1] = 0.6 + t * 0.4;
      this.waveColors[i * 3 + 2] = 1.0;
    }

    this.waveGeom.setAttribute('position', new THREE.BufferAttribute(this.wavePositions, 3));
    this.waveGeom.setAttribute('color', new THREE.BufferAttribute(this.waveColors, 3));

    this.waveMat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.waveform = new THREE.Points(this.waveGeom, this.waveMat);
    this.waveform.position.z = 0.15;
    this.scene.add(this.waveform);
  }

  // Level 5: Light segments with enhanced glow
  _createSegmentRings() {
    this.segments = new THREE.Group();
    this.segmentsInner = new THREE.Group();

    const count = 24;
    const innerCount = 12;

    // Outer segment ring
    for (let i = 0; i < count; i++) {
      const segGroup = new THREE.Group();

      // Main light bar
      const lightMat = new THREE.MeshBasicMaterial({
        color: this.colors.segments,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });

      const light = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.07),
        lightMat
      );

      // Glow backing
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
      });

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.15),
        glowMat
      );
      glow.position.z = -0.01;

      // Inner bright core
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });

      const coreBar = new THREE.Mesh(
        new THREE.PlaneGeometry(0.25, 0.03),
        coreMat
      );
      coreBar.position.z = 0.01;

      segGroup.add(glow);
      segGroup.add(light);
      segGroup.add(coreBar);

      const a = (i / count) * Math.PI * 2;
      segGroup.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.1);
      segGroup.rotation.z = a;

      segGroup.userData = {
        baseOpacity: 0.9,
        lightMat: lightMat,
        glowMat: glowMat,
        coreMat: coreMat,
        index: i
      };

      this.segments.add(segGroup);
    }

    // Inner segment ring
    for (let i = 0; i < innerCount; i++) {
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.045),
        new THREE.MeshBasicMaterial({
          color: 0xaaddff,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending
        })
      );

      const a = (i / innerCount) * Math.PI * 2 + Math.PI / innerCount;
      seg.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0.12);
      seg.rotation.z = a;

      seg.userData = { baseOpacity: 0.7 };
      this.segmentsInner.add(seg);
    }

    this.scene.add(this.segments);
    this.scene.add(this.segmentsInner);
  }

  // Level 6: Detailed outer housing
  _createOuterHousing() {
    // Main outer ring
    this.outerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.3, 2.5, 128),
      new THREE.MeshStandardMaterial({
        color: this.colors.housing,
        metalness: 0.85,
        roughness: 0.35,
        emissive: 0x001133,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      })
    );
    this.outerRing.position.z = 0.05;
    this.scene.add(this.outerRing);

    // Inner decorative ring
    this.innerDecorRing = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.15, 128),
      new THREE.MeshBasicMaterial({
        color: 0x4488aa,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      })
    );
    this.innerDecorRing.position.z = 0.06;
    this.scene.add(this.innerDecorRing);

    // Detail bolts around outer ring
    this.bolts = new THREE.Group();
    const boltCount = 12;
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.95,
      roughness: 0.2
    });

    for (let i = 0; i < boltCount; i++) {
      const a = (i / boltCount) * Math.PI * 2;

      // Bolt head
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16),
        boltMat
      );
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.05);

      // Glow around bolt
      const boltGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 16),
        new THREE.MeshBasicMaterial({
          color: 0x00aaff,
          transparent: true,
          opacity: 0.3,
          blending: THREE.AdditiveBlending
        })
      );
      boltGlow.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.08);

      this.bolts.add(bolt);
      this.bolts.add(boltGlow);
    }

    this.scene.add(this.bolts);
  }

  // Level 7: Fixed particle system
  _createParticleSystem() {
    const particleCount = this.options.particleCount;
    const geom = new THREE.BufferGeometry();

    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const rotations = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 2.0;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = Math.random() * 0.4;

      sizes[i] = 3 + Math.random() * 5;
      opacities[i] = 0.2 + Math.random() * 0.4;
      rotations[i] = Math.random() * Math.PI * 2;

      // Color gradient based on radius
      const t = (radius - 0.3) / 2.0;
      if (t < 0.3) {
        // Inner: white-blue
        colors[i * 3] = 0.2 + t;
        colors[i * 3 + 1] = 0.8 + t * 0.2;
        colors[i * 3 + 2] = 1.0;
      } else if (t < 0.7) {
        // Middle: cyan
        colors[i * 3] = 0.0;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 1.0;
      } else {
        // Outer: blue
        colors[i * 3] = 0.0;
        colors[i * 3 + 1] = 0.5;
        colors[i * 3 + 2] = 1.0;
      }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geom.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));

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

  // Level 8: Controlled volumetric glows
  _createVolumetricGlows() {
    // Core glow (very controlled)
    this.coreGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.6 * this.options.glowIntensity },
        glowColor: { value: new THREE.Color(this.colors.core) },
        audioLevel: { value: 0 }
      },
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.coreGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      this.coreGlowMat
    );
    this.coreGlow.position.z = 0.35;
    this.scene.add(this.coreGlow);

    // Outer atmospheric glow
    this.atmoGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.3 * this.options.glowIntensity },
        glowColor: { value: new THREE.Color(this.colors.plasma) },
        audioLevel: { value: 0 }
      },
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.atmoGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 4.0),
      this.atmoGlowMat
    );
    this.atmoGlow.position.z = -0.1;
    this.scene.add(this.atmoGlow);
  }

  // Level 9: Tech hex overlay
  _createTechOverlay() {
    this.hexMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.5 },
        audioLevel: { value: 0 }
      },
      vertexShader: hexTechVertex,
      fragmentShader: hexTechFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.hexOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 4.5),
      this.hexMat
    );
    this.hexOverlay.position.z = -0.2;
    this.scene.add(this.hexOverlay);
  }

  async initAudio(stream) {
    if (this.audio) return;
    try {
      this.audio = await createAudioAnalyzer(stream);
      console.log('[ArcReactor Cinematic] Audio initialized');
    } catch (err) {
      console.error('[ArcReactor Cinematic] Audio init failed:', err);
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
    let bass = 0;
    let treble = 0;

    if (fft && fftLength > 0) {
      const bassEnd = Math.floor(fftLength * 0.1);
      const trebleStart = Math.floor(fftLength * 0.5);

      for (let i = 0; i < Math.min(fftLength, 128); i++) {
        avg += fft[i];
        if (i < bassEnd) bass += fft[i];
        if (i >= trebleStart) treble += fft[i];
      }

      avg /= Math.min(fftLength, 128);
      bass /= bassEnd || 1;
      treble /= (fftLength - trebleStart) || 1;
    }

    // Smooth audio response
    this.lastAvg = this.lastAvg * 0.5 + avg * 0.5;
    const audioLevel = Math.min(this.lastAvg / 60, 1.0);

    // Update history for smoother effects
    this.audioLevelHistory.shift();
    this.audioLevelHistory.push(audioLevel);
    const smoothedAudio = this.audioLevelHistory.reduce((a, b) => a + b) / this.audioLevelHistory.length;
    this.smoothedAudio = smoothedAudio;

    // Update all components
    this._updateCore(audioLevel, smoothedAudio);
    this._updatePlasmaRings(audioLevel, smoothedAudio);
    this._updateCoils(smoothedAudio, bass);
    this._updateWaveform(fft, fftLength);
    this._updateSegments(fft, fftLength, smoothedAudio);
    this._updateHousing(smoothedAudio);
    this._updateParticles(smoothedAudio);
    this._updateGlows(smoothedAudio);
    this._updateTechOverlay(smoothedAudio);

    // Update center light
    if (this.centerLight) {
      this.centerLight.intensity = 0.3 + smoothedAudio * 0.4;
      this.centerLight.color.setHSL(0.55 - smoothedAudio * 0.1, 1, 0.5 + smoothedAudio * 0.3);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _updateCore(audioLevel, smoothedAudio) {
    this.coreMat.uniforms.time.value = this.time;
    this.coreMat.uniforms.intensity.value = 0.8 + smoothedAudio * 0.4;
    this.coreMat.uniforms.audioLevel.value = smoothedAudio;

    // Core pulses with bass
    this.core.scale.setScalar(1 + smoothedAudio * 0.15);
    this.coreInner.scale.setScalar(1 + audioLevel * 0.1);
  }

  _updatePlasmaRings(audioLevel, smoothedAudio) {
    this.plasmaMat.uniforms.time.value = this.time;
    this.plasmaMat.uniforms.intensity.value = 0.6 + smoothedAudio * 0.5;
    this.plasmaMat.uniforms.audioLevel.value = smoothedAudio;

    // Rotate rings at different speeds
    this.plasmaRing.rotation.z = this.time * 0.6;
    this.plasmaRing.rotation.x = Math.sin(this.time * 0.4) * 0.15;
    this.plasmaRing.rotation.y = Math.cos(this.time * 0.3) * 0.1;

    this.plasmaRing2.material.uniforms.time.value = this.time;
    this.plasmaRing2.material.uniforms.intensity.value = 0.5 + smoothedAudio * 0.4;
    this.plasmaRing2.material.uniforms.audioLevel.value = smoothedAudio;
    this.plasmaRing2.rotation.z = -this.time * 0.9;

    this.plasmaRing3.material.uniforms.time.value = this.time;
    this.plasmaRing3.material.uniforms.intensity.value = 0.4 + smoothedAudio * 0.3;
    this.plasmaRing3.material.uniforms.audioLevel.value = smoothedAudio;
    this.plasmaRing3.rotation.z = this.time * 0.3;
  }

  _updateCoils(smoothedAudio, bass) {
    this.coilMat.uniforms.time.value = this.time;
    this.coilMat.uniforms.intensity.value = 0.5 + smoothedAudio * 0.5;
    this.coilMat.uniforms.audioLevel.value = smoothedAudio;

    this.coils.children.forEach((coil, i) => {
      const offset = coil.userData.angle;
      const pulse = Math.sin(this.time * 3 + offset * 2) * 0.5 + 0.5;
      const audioPulse = smoothedAudio * Math.sin(offset * 3 + this.time * 5);
      const bassPulse = (bass / 100) * Math.sin(offset + this.time * 10);

      coil.material.uniforms.time.value = this.time;
      coil.material.uniforms.intensity.value = 0.5 + smoothedAudio * 0.6;
      coil.material.uniforms.audioLevel.value = smoothedAudio;
    });

    this.coils.rotation.z = this.time * 0.08;
  }

  _updateWaveform(fft, fftLength) {
    if (!fft) return;

    for (let i = 0; i < this.POINTS; i++) {
      const a = (i / this.POINTS) * Math.PI * 2;
      let amp = 0;

      if (fft && fftLength > 0) {
        const fftIndex = Math.floor((i / this.POINTS) * fftLength * 0.5);
        amp = fft[fftIndex] / 255;
      }

      const r = this.waveRadius * (1 + amp * 0.5 * (1 + this.smoothedAudio));
      this.wavePositions[i * 3] = Math.cos(a) * r;
      this.wavePositions[i * 3 + 1] = Math.sin(a) * r;
      this.wavePositions[i * 3 + 2] = 0.15 + amp * 0.25;

      // Color shift based on amplitude
      this.waveColors[i * 3] = amp * 0.6;
      this.waveColors[i * 3 + 1] = 0.6 + amp * 0.4;
      this.waveColors[i * 3 + 2] = 1.0;
    }

    this.waveGeom.attributes.position.needsUpdate = true;
    this.waveGeom.attributes.color.needsUpdate = true;
    this.waveform.rotation.z = -this.time * 0.3;
    this.waveMat.opacity = 0.5 + this.smoothedAudio * 0.5;
  }

  _updateSegments(fft, fftLength, smoothedAudio) {
    this.segments.children.forEach((segGroup, i) => {
      let boost = 0;
      if (fft && fftLength > 0) {
        const fftIndex = Math.floor((i / this.segments.children.length) * fftLength * 0.5);
        boost = fft[fftIndex] / 255;
      }

      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2 + i * 0.5);
      segGroup.scale.x = 1 + boost * 1.5;
      segGroup.scale.y = 1 + boost * 0.3;

      const opacity = segGroup.userData.baseOpacity * (0.6 + pulse * 0.4 + boost);
      segGroup.userData.lightMat.opacity = Math.min(opacity, 1);
      segGroup.userData.glowMat.opacity = Math.min(opacity * 0.5, 0.7);
      segGroup.userData.coreMat.opacity = Math.min(0.5 + boost * 0.5, 0.9);

      const energy = boost + smoothedAudio;
      segGroup.userData.lightMat.color.setHSL(0.5 - energy * 0.15, 1, 0.5 + energy * 0.4);
    });

    this.segments.rotation.z = this.time * 0.12;

    this.segmentsInner.children.forEach((seg, i) => {
      let boost = 0;
      if (fft && fftLength > 0) {
        const fftIndex = Math.floor((i / this.segmentsInner.children.length) * fftLength * 0.3);
        boost = fft[fftIndex] / 255;
      }
      seg.material.opacity = seg.userData.baseOpacity * (0.6 + boost * 1.2);
      seg.scale.x = 1 + boost * 0.5;
    });

    this.segmentsInner.rotation.z = -this.time * 0.18;
  }

  _updateHousing(smoothedAudio) {
    this.outerRing.material.emissiveIntensity = 0.2 + smoothedAudio * 0.4;
    this.innerDecorRing.material.opacity = 0.2 + smoothedAudio * 0.3;
    this.innerDecorRing.rotation.z = -this.time * 0.05;
  }

  _updateParticles(smoothedAudio) {
    this.particleMat.uniforms.time.value = this.time;
    this.particleMat.uniforms.audioLevel.value = smoothedAudio;
    this.particles.rotation.z = this.time * 0.1;
  }

  _updateGlows(smoothedAudio) {
    this.coreGlowMat.uniforms.time.value = this.time;
    this.coreGlowMat.uniforms.audioLevel.value = smoothedAudio;
    this.coreGlowMat.uniforms.intensity.value = (0.5 + smoothedAudio * 0.3) * this.options.glowIntensity;

    this.atmoGlowMat.uniforms.time.value = this.time;
    this.atmoGlowMat.uniforms.audioLevel.value = smoothedAudio;
    this.atmoGlowMat.uniforms.intensity.value = (0.25 + smoothedAudio * 0.15) * this.options.glowIntensity;
  }

  _updateTechOverlay(smoothedAudio) {
    this.hexMat.uniforms.time.value = this.time;
    this.hexMat.uniforms.audioLevel.value = smoothedAudio;
    this.hexMat.uniforms.intensity.value = 0.4 + smoothedAudio * 0.3;
    this.hexOverlay.rotation.z = this.time * 0.02;
  }

  destroy() {
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
