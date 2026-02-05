import * as THREE from 'three';

/**
 * ArcReactor v20 - CINEMATIC MATERIALS EDITION
 * Premium metallic materials, iridescent core, copper coils with heat glow
 */
export class JarvisArcReactor {
  constructor(container) {
    this.container = container;
    this.time = 0;
    this.frameCount = 0;
    
    // Audio reactivity
    this.audioIntensity = 0;
    this.targetAudioIntensity = 0;
    this.frequencyData = new Uint8Array(64);
    
    // Set up Three.js scene
    this._setupScene();
    this._setupLighting();
    this._createMaterials();
    this._createInnerCore();
    this._createCoilRings();
    this._createWaveform();
    this._createSegmentRings();
    this._createOuterHousing();
    this._createGlowEffects();
    this._createAmbientDust();
    
    // Handle resize
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    
    // Start render loop
    this._animate();
    
    console.log('[ArcReactor] v20 - CINEMATIC MATERIALS EDITION');
  }

  _setupScene() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 18);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);
  }

  _setupLighting() {
    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0x112233, 0.4);
    this.scene.add(ambientLight);
    
    // Key light - warm from above-right
    const keyLight = new THREE.DirectionalLight(0xfff8e7, 1.5);
    keyLight.position.set(10, 15, 10);
    this.scene.add(keyLight);
    
    // Fill light - cool from left
    const fillLight = new THREE.DirectionalLight(0x4488cc, 0.6);
    fillLight.position.set(-10, 5, 8);
    this.scene.add(fillLight);
    
    // Rim light - dramatic from behind
    const rimLight = new THREE.DirectionalLight(0x00ffff, 1.0);
    rimLight.position.set(0, -5, -10);
    this.scene.add(rimLight);
    
    // Purple accent rim
    const purpleRim = new THREE.DirectionalLight(0x8844ff, 0.5);
    purpleRim.position.set(8, 0, -5);
    this.scene.add(purpleRim);
    
    // Internal core glow (subtle)
    this.coreLight = new THREE.PointLight(0x00ffff, 2, 8);
    this.coreLight.position.set(0, 0, 1);
    this.scene.add(this.coreLight);
  }

  _createMaterials() {
    // Gunmetal housing - brushed metal look
    this.housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.9,
      roughness: 0.3,
      envMapIntensity: 1.0
    });
    
    // Polished silver accents
    this.silverMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 1.0,
      roughness: 0.15
    });
    
    // Copper coils with emissive heat
    this.copperMaterial = new THREE.MeshStandardMaterial({
      color: 0xb87333,
      metalness: 0.8,
      roughness: 0.4
    });
    
    this.copperGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc5500,
      metalness: 0.6,
      roughness: 0.5,
      emissive: 0xff4400,
      emissiveIntensity: 0.3
    });
    
    // Iridescent core crystal
    this.coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x00ffff,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 1.5,
      ior: 1.5,
      iridescence: 1.0,
      iridescenceIOR: 1.3,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });
    
    // Cyan emissive segments
    this.segmentMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      metalness: 0.5,
      roughness: 0.2,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0
    });
    
    // Amber warm segments
    this.amberSegmentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.3,
      roughness: 0.3,
      emissive: 0xff8800,
      emissiveIntensity: 1.5
    });
    
    // Dark matte connectors
    this.matteBlackMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.2,
      roughness: 0.9
    });
  }

  _createInnerCore() {
    // Main crystal core
    const coreGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 32);
    this.core = new THREE.Mesh(coreGeometry, this.coreMaterial);
    this.core.rotation.x = Math.PI / 2;
    this.core.position.z = 0.3;
    this.scene.add(this.core);
    
    // Inner crystal facets
    const innerGeometry = new THREE.CylinderGeometry(0.7, 0.7, 0.3, 16);
    this.innerCore = new THREE.Mesh(innerGeometry, this.coreMaterial);
    this.innerCore.rotation.x = Math.PI / 2;
    this.innerCore.position.z = 0.5;
    this.scene.add(this.innerCore);
    
    // Metal core ring
    const ringGeometry = new THREE.TorusGeometry(1.3, 0.08, 16, 64);
    this.coreRing = new THREE.Mesh(ringGeometry, this.silverMaterial);
    this.scene.add(this.coreRing);
    
    // Cross pattern inside core
    const crossGeo = new THREE.BoxGeometry(1.8, 0.15, 0.05);
    this.cross1 = new THREE.Mesh(crossGeo, this.matteBlackMaterial);
    this.cross1.position.z = 0.15;
    this.scene.add(this.cross1);
    
    this.cross2 = new THREE.Mesh(crossGeo, this.matteBlackMaterial);
    this.cross2.rotation.z = Math.PI / 2;
    this.cross2.position.z = 0.15;
    this.scene.add(this.cross2);
  }

  _createCoilRings() {
    this.coils = [];
    const coilCount = 3;
    
    for (let ring = 0; ring < coilCount; ring++) {
      const radius = 2.2 + ring * 0.9;
      const segments = 10 + ring * 2;
      const coilsInRing = [];
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        // Copper coil body
        const coilGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 12);
        const coil = new THREE.Mesh(coilGeometry, this.copperMaterial);
        coil.position.set(x, y, 0);
        coil.rotation.z = angle;
        coil.lookAt(0, 0, 0);
        coil.rotateX(Math.PI / 2);
        
        // Coil end caps (silver)
        const capGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.05, 12);
        const cap1 = new THREE.Mesh(capGeometry, this.silverMaterial);
        cap1.position.y = 0.28;
        coil.add(cap1);
        
        const cap2 = new THREE.Mesh(capGeometry, this.silverMaterial);
        cap2.position.y = -0.28;
        coil.add(cap2);
        
        // Heat glow ring around coil
        const glowGeometry = new THREE.TorusGeometry(0.25, 0.03, 8, 24);
        const glowRing = new THREE.Mesh(glowGeometry, this.copperGlowMaterial);
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.y = 0;
        coil.add(glowRing);
        
        this.scene.add(coil);
        coilsInRing.push({ coil, glowRing, angle, baseIntensity: 0.2 + Math.random() * 0.3 });
      }
      
      this.coils.push(coilsInRing);
    }
  }

  _createWaveform() {
    // Create smooth ring geometry for waveform
    const curve = new THREE.EllipseCurve(
      0, 0,
      4.8, 4.8,
      0, 2 * Math.PI,
      false,
      0
    );
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => [p.x, p.y, 0]), 3));
    
    // Cyan energy waveform
    this.waveformMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    
    this.waveform = new THREE.Line(geometry, this.waveformMaterial);
    this.waveform.position.z = 0.2;
    this.scene.add(this.waveform);
    
    // Secondary waveform (amber)
    this.waveform2 = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.5,
      linewidth: 1
    }));
    this.waveform2.position.z = 0.15;
    this.waveform2.scale.set(0.95, 0.95, 1);
    this.scene.add(this.waveform2);
  }

  _createSegmentRings() {
    this.segments = [];
    
    // Inner cyan ring
    const innerCount = 8;
    const innerRadius = 3.8;
    
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2;
      const x = Math.cos(angle) * innerRadius;
      const y = Math.sin(angle) * innerRadius;
      
      const segGeometry = new THREE.BoxGeometry(0.5, 0.12, 0.08);
      const segment = new THREE.Mesh(segGeometry, this.segmentMaterial);
      segment.position.set(x, y, 0.1);
      segment.rotation.z = angle;
      
      this.scene.add(segment);
      this.segments.push({ mesh: segment, type: 'cyan', baseInt: 2.0 });
    }
    
    // Outer amber ring
    const outerCount = 10;
    const outerRadius = 4.2;
    
    for (let i = 0; i < outerCount; i++) {
      const angle = (i / outerCount) * Math.PI * 2;
      const x = Math.cos(angle) * outerRadius;
      const y = Math.sin(angle) * outerRadius;
      
      const segGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.06);
      const segment = new THREE.Mesh(segGeometry, this.amberSegmentMaterial);
      segment.position.set(x, y, 0.08);
      segment.rotation.z = angle;
      
      this.scene.add(segment);
      this.segments.push({ mesh: segment, type: 'amber', baseInt: 1.5 });
    }
  }

  _createOuterHousing() {
    // Main outer ring - gunmetal
    const ringGeometry = new THREE.TorusGeometry(5.5, 0.35, 24, 128);
    this.outerRing = new THREE.Mesh(ringGeometry, this.housingMaterial);
    this.scene.add(this.outerRing);
    
    // Inner decorative ring - silver
    const innerRingGeometry = new THREE.TorusGeometry(5.0, 0.1, 16, 96);
    this.innerDecorativeRing = new THREE.Mesh(innerRingGeometry, this.silverMaterial);
    this.innerDecorativeRing.position.z = 0.1;
    this.scene.add(this.innerDecorativeRing);
    
    // Outer decorative ring - silver
    const outerRingGeo = new THREE.TorusGeometry(6.0, 0.08, 16, 96);
    this.outerDecorativeRing = new THREE.Mesh(outerRingGeo, this.silverMaterial);
    this.outerDecorativeRing.position.z = -0.1;
    this.scene.add(this.outerDecorativeRing);
    
    // Screw heads around outer ring
    const screwCount = 12;
    for (let i = 0; i < screwCount; i++) {
      const angle = (i / screwCount) * Math.PI * 2;
      const x = Math.cos(angle) * 5.5;
      const y = Math.sin(angle) * 5.5;
      
      const screwGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
      const screw = new THREE.Mesh(screwGeo, this.matteBlackMaterial);
      screw.position.set(x, y, 0.25);
      screw.rotation.x = Math.PI / 2;
      screw.rotation.y = angle;
      
      this.scene.add(screw);
    }
    
    // Streaks detail on housing
    const streakGeo = new THREE.BoxGeometry(0.08, 0.8, 0.05);
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const x = Math.cos(angle) * 5.5;
      const y = Math.sin(angle) * 5.5;
      
      const streak = new THREE.Mesh(streakGeo, this.matteBlackMaterial);
      streak.position.set(x, y, 0.32);
      streak.rotation.z = angle;
      
      this.scene.add(streak);
    }
  }

  _createGlowEffects() {
    // Core glow sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(0.3, 'rgba(0, 200, 255, 0.4)');
    gradient.addColorStop(0.6, 'rgba(0, 150, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    const glowTexture = new THREE.CanvasTexture(canvas);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.coreGlow = new THREE.Sprite(glowMaterial);
    this.coreGlow.scale.set(4, 4, 1);
    this.coreGlow.position.z = 0.3;
    this.scene.add(this.coreGlow);
  }

  _createAmbientDust() {
    // Very subtle dust particles (not the blob culprit!)
    const particleCount = 15;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 4;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      sizes[i] = 0.02 + Math.random() * 0.04;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.05,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true
    });
    
    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }

  initAudio(audioStream) {
    return new Promise((resolve, reject) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        
        const source = audioContext.createMediaStreamSource(audioStream);
        source.connect(analyser);
        
        this.audioAnalyser = analyser;
        this.audioDataArray = new Uint8Array(analyser.frequencyBinCount);
        
        console.log('[ArcReactor] Audio initialized');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  updateAudio(audioData) {
    if (!audioData || audioData.length === 0) return;
    
    this.frequencyData.set(audioData);
    
    // Calculate average intensity
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i];
    }
    this.targetAudioIntensity = sum / (audioData.length * 255);
  }

  update() {
    this.time += 0.016;
    this.frameCount++;
    
    // Get audio data if available
    if (this.audioAnalyser && this.audioDataArray) {
      this.audioAnalyser.getByteFrequencyData(this.audioDataArray);
      let sum = 0;
      for (let i = 0; i < this.audioDataArray.length; i++) {
        sum += this.audioDataArray[i];
      }
      this.targetAudioIntensity = sum / (this.audioDataArray.length * 255);
    }
    
    // Smooth audio intensity
    this.audioIntensity += (this.targetAudioIntensity - this.audioIntensity) * 0.1;
    
    // Rotate core with iridescent shimmer
    if (this.core) {
      this.core.rotation.z += 0.005;
      // Pulsing emissive intensity
      const pulse = 0.8 + Math.sin(this.time * 2) * 0.2 + this.audioIntensity * 0.5;
      this.coreMaterial.emissiveIntensity = pulse;
    }
    
    if (this.innerCore) {
      this.innerCore.rotation.z -= 0.003;
    }
    
    // Animate coil heat glow
    this.coils.forEach((ring, ringIndex) => {
      ring.forEach((coilData, i) => {
        const heatPulse = coilData.baseIntensity + 
          Math.sin(this.time * 3 + i * 0.5 + ringIndex) * 0.1 +
          this.audioIntensity * 0.4;
        coilData.glowRing.material.emissiveIntensity = Math.max(0.1, heatPulse);
      });
    });
    
    // Animate waveforms
    if (this.waveform) {
      const scale = 1 + this.audioIntensity * 0.15;
      this.waveform.scale.set(scale, scale, 1);
      this.waveform.rotation.z += 0.002;
      this.waveform.material.opacity = 0.5 + this.audioIntensity * 0.5;
    }
    
    if (this.waveform2) {
      const scale2 = 0.95 - this.audioIntensity * 0.1;
      this.waveform2.scale.set(scale2, scale2, 1);
      this.waveform2.rotation.z -= 0.001;
      this.waveform2.material.opacity = 0.3 + this.audioIntensity * 0.4;
    }
    
    // Animate segments
    this.segments.forEach((seg, i) => {
      const flicker = Math.sin(this.time * 4 + i * 0.7) * 0.1;
      const audioBoost = this.audioIntensity * 0.8;
      seg.mesh.material.emissiveIntensity = seg.baseInt + flicker + audioBoost;
    });
    
    // Pulse core glow
    if (this.coreGlow) {
      const glowPulse = 0.5 + Math.sin(this.time * 1.5) * 0.1 + this.audioIntensity * 0.3;
      this.coreGlow.material.opacity = glowPulse;
      this.coreGlow.scale.setScalar(3.5 + Math.sin(this.time) * 0.3);
    }
    
    // Core light pulsing
    if (this.coreLight) {
      this.coreLight.intensity = 2 + Math.sin(this.time * 2) * 0.5 + this.audioIntensity * 2;
    }
    
    // Slow dust rotation
    if (this.dustParticles) {
      this.dustParticles.rotation.z += 0.0005;
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  _animate() {
    this.update();
    this.animationId = requestAnimationFrame(() => this._animate());
  }

  _handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this._handleResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

export default JarvisArcReactor;
