import * as THREE from 'three';
import { createAudioAnalyzer } from './audio.js';

/**
 * Authentic JARVIS Arc Reactor
 * Based on Tony Stark's Mark I/II Palladium Arc Reactor from the MCU
 * 
 * Key Design Elements:
 * - Central Palladium Core (bright white-blue)
 * - 10 Copper electromagnetic coils
 * - Silver mounting brackets
 * - Circuit board backing
 * - Connecting wires between coils
 * - Transparent housing with metallic ring
 * - Hexagonal bolt pattern
 */
export class AuthenticArcReactor {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      glowIntensity: options.glowIntensity ?? 1.0,
      audioReactivity: options.audioReactivity ?? true,
      colorMode: options.colorMode ?? 'classic', // classic, warm, cyberpunk
      ...options
    };

    // Color palettes for different modes
    this.colorPalettes = {
      classic: {
        core: 0x00ddff,      // Cyan
        innerRing: 0x00aaff, // Blue
        aura: 0x0088ff,      // Dark blue
        plasma: 0x00ffff,    // Bright cyan
        coilGlow: 0x0044aa,  // Dark blue
      },
      warm: {
        core: 0xffaa00,      // Orange
        innerRing: 0xff6600, // Dark orange
        aura: 0xff4400,      // Red-orange
        plasma: 0xff8800,    // Bright orange
        coilGlow: 0xff2200,  // Red
      },
      cyberpunk: {
        core: 0xff00ff,      // Magenta
        innerRing: 0xaa00ff, // Purple
        aura: 0xff0088,      // Pink
        plasma: 0xff00ff,    // Bright magenta
        coilGlow: 0x8800ff,  // Violet
      }
    };
    
    this.colors = this.colorPalettes[this.options.colorMode] || this.colorPalettes.classic;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.z = 8;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.time = 0;
    this.audioLevel = 0;
    this.smoothedAudio = 0;

    this._setupLighting();
    this._createPalladiumCore();
    this._createCoilAssembly();
    this._createMountingRing();
    this._createCircuitBoard();
    this._createWireConnections();
    this._createOuterHousing();
    this._createEnergyField();

    console.log('[AuthenticArcReactor] Mark I Palladium Reactor initialized');
  }

  _setupLighting() {
    // Ambient light for base visibility
    const ambient = new THREE.AmbientLight(0x1a1a2e, 0.3);
    this.scene.add(ambient);

    // Central glow light from the palladium core - uses color palette
    this.coreLight = new THREE.PointLight(this.colors.core, 2.0, 10);
    this.coreLight.position.set(0, 0, 0.5);
    this.scene.add(this.coreLight);

    // Rim light for metallic edges - tinted by core color
    const rimColor = new THREE.Color(this.colors.core).multiplyScalar(0.5);
    const rimLight = new THREE.DirectionalLight(rimColor, 0.5);
    rimLight.position.set(2, 2, 2);
    this.scene.add(rimLight);

    const rimLight2 = new THREE.DirectionalLight(rimColor, 0.3);
    rimLight2.position.set(-2, -2, 1);
    this.scene.add(rimLight2);

    // Under glow for coils
    const coilLight = new THREE.PointLight(0xff6600, 0.5, 5);
    coilLight.position.set(0, 0, -1);
    this.scene.add(coilLight);
  }

  // Level 1: The Palladium Core - The heart of the reactor
  _createPalladiumCore() {
    // Inner core - bright white-hot center (tinted by color mode)
    const coreGeometry = new THREE.CircleGeometry(0.6, 64);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.core = new THREE.Mesh(coreGeometry, this.coreMaterial);
    this.core.position.z = 0.3;
    this.scene.add(this.core);

    // Inner energy ring - uses color palette
    const innerRingGeo = new THREE.RingGeometry(0.5, 0.7, 64);
    this.innerRingMaterial = new THREE.MeshBasicMaterial({
      color: this.colors.innerRing,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.innerRing = new THREE.Mesh(innerRingGeo, this.innerRingMaterial);
    this.innerRing.position.z = 0.28;
    this.scene.add(this.innerRing);

    // Outer energy aura - uses color palette
    const auraGeo = new THREE.RingGeometry(0.7, 1.0, 64);
    this.auraMaterial = new THREE.MeshBasicMaterial({
      color: this.colors.aura,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.aura = new THREE.Mesh(auraGeo, this.auraMaterial);
    this.aura.position.z = 0.25;
    this.scene.add(this.aura);
  }

  // Level 2: The 10 Copper Coils - Electromagnetic assembly
  _createCoilAssembly() {
    this.coils = new THREE.Group();
    this.coilMeshes = [];
    
    const coilCount = 10;
    const radius = 1.8;

    for (let i = 0; i < coilCount; i++) {
      const angle = (i / coilCount) * Math.PI * 2;
      const coilGroup = new THREE.Group();

      // The copper coil itself - wound wire appearance
      const coilGeometry = new THREE.TorusGeometry(0.35, 0.12, 16, 32);
      const coilMaterial = new THREE.MeshStandardMaterial({
        color: 0xb87333, // Copper color
        metalness: 0.9,
        roughness: 0.4,
        emissive: this.colors.coilGlow,
        emissiveIntensity: 0.2
      });
      const coil = new THREE.Mesh(coilGeometry, coilMaterial);
      
      // Coil winding detail (smaller torus inside)
      const windingGeo = new THREE.TorusGeometry(0.35, 0.08, 12, 24);
      const windingMat = new THREE.MeshStandardMaterial({
        color: 0xcd853f, // Lighter copper
        metalness: 0.8,
        roughness: 0.5
      });
      const winding = new THREE.Mesh(windingGeo, windingMat);
      winding.position.z = 0.02;
      coil.add(winding);

      // Position the coil
      coilGroup.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      );
      coilGroup.rotation.z = angle;
      coilGroup.add(coil);

      // Store for animation
      coilGroup.userData = {
        baseAngle: angle,
        index: i,
        baseEmissive: 0.2
      };
      this.coilMeshes.push(coilGroup);
      this.coils.add(coilGroup);
    }

    this.scene.add(this.coils);
  }

  // Level 3: Silver Mounting Brackets - Hold the coils in place
  _createMountingRing() {
    this.mountingRing = new THREE.Group();

    // Main mounting ring
    const ringGeo = new THREE.TorusGeometry(2.2, 0.08, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0, // Silver
      metalness: 0.95,
      roughness: 0.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -0.1;
    this.mountingRing.add(ring);

    // Inner support ring
    const innerRingGeo = new THREE.TorusGeometry(1.4, 0.05, 12, 80);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
    innerRing.position.z = -0.05;
    this.mountingRing.add(innerRing);

    // Mounting brackets between coils
    const bracketCount = 10;
    for (let i = 0; i < bracketCount; i++) {
      const angle = (i / bracketCount) * Math.PI * 2 + (Math.PI / bracketCount);
      
      // Bracket arm
      const bracketGeo = new THREE.BoxGeometry(0.15, 0.8, 0.05);
      const bracket = new THREE.Mesh(bracketGeo, ringMat);
      bracket.position.set(
        Math.cos(angle) * 1.8,
        Math.sin(angle) * 1.8,
        0
      );
      bracket.rotation.z = angle;
      this.mountingRing.add(bracket);

      // Bolt head
      const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16);
      const bolt = new THREE.Mesh(boltGeo, ringMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(
        Math.cos(angle) * 2.2,
        Math.sin(angle) * 2.2,
        0
      );
      this.mountingRing.add(bolt);
    }

    this.scene.add(this.mountingRing);
  }

  // Level 4: Circuit Board Backing - The electronics
  _createCircuitBoard() {
    // Main PCB
    const pcbGeo = new THREE.CircleGeometry(2.5, 64);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x1a3300, // Dark green PCB
      metalness: 0.1,
      roughness: 0.8
    });
    this.pcb = new THREE.Mesh(pcbGeo, pcbMat);
    this.pcb.position.z = -0.3;
    this.scene.add(this.pcb);

    // Circuit traces
    const traceGroup = new THREE.Group();
    const traceCount = 20;
    
    for (let i = 0; i < traceCount; i++) {
      const angle = (i / traceCount) * Math.PI * 2;
      const traceGeo = new THREE.RingGeometry(
        0.8 + (i % 3) * 0.3,
        0.8 + (i % 3) * 0.3 + 0.03,
        32,
        1,
        angle,
        Math.PI * 0.3
      );
      const traceMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Copper trace
        transparent: true,
        opacity: 0.6
      });
      const trace = new THREE.Mesh(traceGeo, traceMat);
      trace.position.z = -0.28;
      traceGroup.add(trace);
    }
    
    this.scene.add(traceGroup);

    // Electronic components (chips, capacitors)
    const componentCount = 12;
    for (let i = 0; i < componentCount; i++) {
      const angle = (i / componentCount) * Math.PI * 2;
      const radius = 1.5 + Math.random() * 0.8;
      
      // Random component shape
      const compGeo = new THREE.BoxGeometry(
        0.1 + Math.random() * 0.1,
        0.1 + Math.random() * 0.1,
        0.05
      );
      const compMat = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0x333333 : 0x666666,
        metalness: 0.3,
        roughness: 0.7
      });
      const component = new THREE.Mesh(compGeo, compMat);
      component.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        -0.25
      );
      this.scene.add(component);
    }
  }

  // Level 5: Wire Connections - Connect coils to center
  _createWireConnections() {
    this.wires = new THREE.Group();
    const wireCount = 10;

    for (let i = 0; i < wireCount; i++) {
      const angle = (i / wireCount) * Math.PI * 2;
      const startRadius = 1.4;
      const endRadius = 0.7;

      // Create curved wire using tube geometry along a curve
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * startRadius, Math.sin(angle) * startRadius, -0.1),
        new THREE.Vector3(Math.cos(angle) * ((startRadius + endRadius) / 2), Math.sin(angle) * ((startRadius + endRadius) / 2), 0.1),
        new THREE.Vector3(Math.cos(angle) * endRadius, Math.sin(angle) * endRadius, 0.15)
      ]);

      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.02, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0xb87333, // Copper wire
        metalness: 0.7,
        roughness: 0.3
      });
      const wire = new THREE.Mesh(tubeGeo, tubeMat);
      this.wires.add(wire);
    }

    this.scene.add(this.wires);
  }

  // Level 6: Outer Housing - The metal case
  _createOuterHousing() {
    // Outer ring
    const outerGeo = new THREE.TorusGeometry(2.8, 0.15, 20, 100);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x888888, // Steel
      metalness: 0.9,
      roughness: 0.3,
      emissive: 0x001133,
      emissiveIntensity: 0.1
    });
    this.outerRing = new THREE.Mesh(outerGeo, outerMat);
    this.outerRing.position.z = -0.2;
    this.scene.add(this.outerRing);

    // Hex bolt pattern around outer ring
    const boltCount = 12;
    for (let i = 0; i < boltCount; i++) {
      const angle = (i / boltCount) * Math.PI * 2;
      
      // Hex bolt head
      const boltGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6);
      const bolt = new THREE.Mesh(boltGeo, outerMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(
        Math.cos(angle) * 2.8,
        Math.sin(angle) * 2.8,
        0
      );
      this.scene.add(bolt);

      // Bolt glow - uses color palette
      const boltGlowGeo = new THREE.CircleGeometry(0.12, 6);
      const boltGlowMat = new THREE.MeshBasicMaterial({
        color: this.colors.core,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
      });
      const boltGlow = new THREE.Mesh(boltGlowGeo, boltGlowMat);
      boltGlow.position.set(
        Math.cos(angle) * 2.8,
        Math.sin(angle) * 2.8,
        0.05
      );
      this.scene.add(boltGlow);
    }
  }

  // Level 7: Energy Field - The glowing plasma effect
  _createEnergyField() {
    // Inner plasma ring - uses color palette
    const plasmaGeo = new THREE.RingGeometry(0.3, 0.5, 64);
    this.plasmaMaterial = new THREE.MeshBasicMaterial({
      color: this.colors.plasma,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.plasmaRing = new THREE.Mesh(plasmaGeo, this.plasmaMaterial);
    this.plasmaRing.position.z = 0.35;
    this.scene.add(this.plasmaRing);

    // Rotating energy rings - uses color palette
    this.energyRings = new THREE.Group();
    
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(1.2 + i * 0.3, 0.02, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: this.colors.innerRing,
        transparent: true,
        opacity: 0.2 - i * 0.05,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = 0.1 + i * 0.05;
      ring.userData = { speed: (i + 1) * 0.5, direction: i % 2 === 0 ? 1 : -1 };
      this.energyRings.add(ring);
    }
    
    this.scene.add(this.energyRings);
  }

  async initAudio(stream) {
    if (this.audio) return;
    try {
      this.audio = await createAudioAnalyzer(stream);
      console.log('[AuthenticArcReactor] Audio initialized');
    } catch (err) {
      console.error('[AuthenticArcReactor] Audio init failed:', err);
    }
  }

  update() {
    this.time += 0.016;

    // Get audio data
    let fft = null;
    let fftLength = 0;
    
    if (this.audio) {
      fft = this.audio.getData();
      fftLength = fft ? fft.length : 0;
    }

    // Calculate audio levels
    let avg = 0;
    if (fft && fftLength > 0) {
      for (let i = 0; i < Math.min(fftLength, 64); i++) {
        avg += fft[i];
      }
      avg /= 64;
    }

    // Smooth audio response
    this.audioLevel = avg / 255;
    this.smoothedAudio = this.smoothedAudio * 0.8 + this.audioLevel * 0.2;
    const intensity = this.options.glowIntensity;

    // Animate palladium core
    const corePulse = 1 + Math.sin(this.time * 3) * 0.1 + this.smoothedAudio * 0.3;
    this.core.scale.setScalar(corePulse);
    this.coreMaterial.opacity = 0.8 + this.smoothedAudio * 0.2;
    
    // Core color shifts with audio
    const hue = 0.5 + this.smoothedAudio * 0.1; // Blue to cyan
    this.coreMaterial.color.setHSL(hue, 1, 0.5 + this.smoothedAudio * 0.3);

    // Animate inner ring
    this.innerRing.rotation.z = -this.time * 0.5;
    this.innerRingMaterial.opacity = (0.5 + this.smoothedAudio * 0.3) * intensity;

    // Animate aura
    this.aura.scale.setScalar(1 + Math.sin(this.time * 2) * 0.05 + this.smoothedAudio * 0.2);
    this.auraMaterial.opacity = (0.2 + this.smoothedAudio * 0.2) * intensity;

    // Animate coils with magnetic pulse effect
    this.coilMeshes.forEach((coilGroup, i) => {
      const offset = coilGroup.userData.baseAngle;
      const pulse = Math.sin(this.time * 4 + offset * 2) * 0.5 + 0.5;
      const audioBoost = this.smoothedAudio * Math.sin(offset * 3 + this.time * 5);
      
      const coil = coilGroup.children[0];
      coil.material.emissiveIntensity = coilGroup.userData.baseEmissive + pulse * 0.3 + audioBoost * 0.5;
      
      // Slight rotation of individual coils
      coil.rotation.x = Math.sin(this.time + i) * 0.05 * this.smoothedAudio;
    });

    // Rotate entire coil assembly slowly
    this.coils.rotation.z = this.time * 0.1;

    // Animate energy rings
    this.energyRings.children.forEach((ring) => {
      ring.rotation.z += ring.userData.speed * ring.userData.direction * 0.02;
      ring.scale.setScalar(1 + this.smoothedAudio * 0.1);
    });

    // Pulse the plasma ring
    this.plasmaRing.scale.setScalar(1 + Math.sin(this.time * 4) * 0.05 + this.smoothedAudio * 0.2);
    this.plasmaMaterial.opacity = (0.3 + this.smoothedAudio * 0.3) * intensity;

    // Update core light
    this.coreLight.intensity = 2.0 + this.smoothedAudio * 2.0;
    this.coreLight.color.setHSL(hue, 1, 0.5);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
