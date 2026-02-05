import * as THREE from 'three';

/**
 * ArcReactor v24 - CABLE BUNDLES EDITION
 * Industrial cables connecting coils, particle trail, holographic rings, energy effects
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
    this._createEnergyPulses();
    this._createElectricalSparks();
    this._createHolographicRings();
    this._createCoreParticleTrail();
    this._createCableBundles();
    
    // Handle resize
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    
    // Start render loop
    this._animate();
    
    console.log('[ArcReactor] v24 - CABLE BUNDLES EDITION');
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

  _createEnergyPulses() {
    // Create energy pulses that travel along coil rings
    this.energyPulses = [];
    
    const pulseCount = 3;
    for (let i = 0; i < pulseCount; i++) {
      const radius = 2.2 + i * 0.9;
      
      // Create pulse geometry - glowing ring segment
      const curve = new THREE.EllipseCurve(
        0, 0,
        radius, radius,
        0, Math.PI / 8,
        false,
        0
      );
      const points = curve.getPoints(32);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const material = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0,
        linewidth: 3
      });
      
      const pulse = new THREE.Line(geometry, material);
      pulse.position.z = 0.15;
      this.scene.add(pulse);
      
      this.energyPulses.push({
        mesh: pulse,
        radius: radius,
        angle: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        intensity: 0,
        active: false,
        nextActivation: Math.random() * 3
      });
    }
  }

  _createElectricalSparks() {
    // Create electrical spark effects between coil rings
    this.sparks = [];
    const sparkCount = 5;
    
    for (let i = 0; i < sparkCount; i++) {
      // Create zigzag line for spark
      const segments = 8;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(segments * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        linewidth: 2
      });
      
      const spark = new THREE.Line(geometry, material);
      this.scene.add(spark);
      
      this.sparks.push({
        mesh: spark,
        positions: geometry.attributes.position,
        startPoint: new THREE.Vector3(),
        endPoint: new THREE.Vector3(),
        active: false,
        lifetime: 0,
        nextActivation: Math.random() * 2,
        geometry: geometry
      });
    }
    
    // Spark glow sprite
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(200, 240, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const glowTexture = new THREE.CanvasTexture(canvas);
    this.sparkGlowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  _createHolographicRings() {
    this.holographicRings = [];
    this.holographicGlyphs = [];
    
    // Create scanning line texture
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = 256;
    scanCanvas.height = 256;
    const scanCtx = scanCanvas.getContext('2d');
    
    // Draw scan lines
    scanCtx.fillStyle = 'rgba(0, 0, 0, 0)';
    scanCtx.fillRect(0, 0, 256, 256);
    
    for (let i = 0; i < 256; i += 4) {
      scanCtx.fillStyle = `rgba(0, 255, 255, ${0.1 + Math.random() * 0.2})`;
      scanCtx.fillRect(0, i, 256, 1);
    }
    
    // Draw hex grid pattern
    scanCtx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
    scanCtx.lineWidth = 1;
    const hexSize = 20;
    for (let y = 0; y < 256; y += hexSize * 1.5) {
      for (let x = 0; x < 256; x += hexSize * 1.732) {
        const offsetX = (y / (hexSize * 1.5)) % 2 === 0 ? 0 : hexSize * 0.866;
        scanCtx.beginPath();
        for (let j = 0; j < 6; j++) {
          const angle = (j * 60) * Math.PI / 180;
          const hx = x + offsetX + hexSize * Math.cos(angle);
          const hy = y + hexSize * Math.sin(angle);
          if (j === 0) scanCtx.moveTo(hx, hy);
          else scanCtx.lineTo(hx, hy);
        }
        scanCtx.closePath();
        scanCtx.stroke();
      }
    }
    
    const scanTexture = new THREE.CanvasTexture(scanCanvas);
    scanTexture.wrapS = THREE.RepeatWrapping;
    scanTexture.wrapT = THREE.RepeatWrapping;
    
    // Holographic ring material
    this.holographicMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      map: scanTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    // Create 3 floating holographic rings
    for (let i = 0; i < 3; i++) {
      const radius = 3.5 + i * 0.8;
      const tubeRadius = 0.02 + i * 0.01;
      
      // Main ring
      const ringGeometry = new THREE.TorusGeometry(radius, tubeRadius, 8, 64);
      const ring = new THREE.Mesh(ringGeometry, this.holographicMaterial.clone());
      ring.position.z = 1.5 + i * 0.4;
      ring.rotation.x = Math.PI / 2;
      
      // Inner detail ring
      const detailGeometry = new THREE.TorusGeometry(radius - 0.3, tubeRadius * 0.5, 6, 48);
      const detailRing = new THREE.Mesh(detailGeometry, this.holographicMaterial.clone());
      detailRing.material.opacity = 0.08;
      detailRing.position.z = 1.5 + i * 0.4;
      detailRing.rotation.x = Math.PI / 2;
      
      this.scene.add(ring);
      this.scene.add(detailRing);
      
      this.holographicRings.push({
        mainRing: ring,
        detailRing: detailRing,
        baseY: 1.5 + i * 0.4,
        rotationSpeed: 0.1 + i * 0.05,
        bobSpeed: 0.5 + i * 0.3,
        bobAmount: 0.1 + i * 0.05,
        textureOffset: Math.random()
      });
    }
    
    // Create floating data glyphs
    const glyphChars = ['01', '10', 'AF', '3D', '7E', 'B2', 'C4', 'E8', '00', '11', 'FF', 'AA'];
    
    for (let i = 0; i < 8; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const char = glyphChars[i % glyphChars.length];
      ctx.fillText(char, 32, 16);
      
      // Add glow effect
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.fillText(char, 32, 16);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      const sprite = new THREE.Sprite(material);
      const angle = (i / 8) * Math.PI * 2;
      const radius = 3 + Math.random() * 2;
      sprite.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        2 + Math.random() * 1.5
      );
      sprite.scale.set(0.5, 0.25, 1);
      
      this.scene.add(sprite);
      
      this.holographicGlyphs.push({
        sprite: sprite,
        basePos: sprite.position.clone(),
        angle: angle,
        radius: radius,
        orbitSpeed: 0.1 + Math.random() * 0.2,
        bobSpeed: 0.3 + Math.random() * 0.4,
        bobAmount: 0.05 + Math.random() * 0.1,
        fadeSpeed: 0.5 + Math.random() * 0.5,
        baseOpacity: 0.4 + Math.random() * 0.4
      });
    }
    
  }

  _createCoreParticleTrail() {
    // Create particles that rise from the core like heat/energy
    const particleCount = 25;
    this.coreParticles = [];
    
    // Create shared geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const opacities = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      // Start from random position near core center
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.8;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = 0.3 + Math.random() * 2; // Start at different heights
      
      sizes[i] = 0.03 + Math.random() * 0.05;
      opacities[i] = Math.random();
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    
    // Custom shader material for better looking particles
    const material = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.coreParticleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.coreParticleSystem);
    
    // Store particle data for animation
    this.coreParticleData = [];
    for (let i = 0; i < particleCount; i++) {
      this.coreParticleData.push({
        speed: 0.02 + Math.random() * 0.03,
        drift: (Math.random() - 0.5) * 0.01,
        resetHeight: 0.3 + Math.random() * 0.2,
        maxHeight: 3 + Math.random() * 2,
        baseSize: 0.03 + Math.random() * 0.05
      });
    }
  }

  _createCableBundles() {
    // Create thick electrical cables connecting coil rings
    this.cables = [];
    
    // Cable material - black rubber with slight shine
    const cableMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.1,
      roughness: 0.8
    });
    
    // Create cable bundles between coil rings
    const cableCount = 6;
    const ringRadii = [2.2, 3.1, 4.0]; // Radii of the 3 coil rings
    
    for (let i = 0; i < cableCount; i++) {
      const angle = (i / cableCount) * Math.PI * 2;
      
      // Create curved cable path using Catmull-Rom curve
      const points = [];
      
      // Start from inner ring
      const startRadius = ringRadii[0];
      points.push(new THREE.Vector3(
        Math.cos(angle) * startRadius,
        Math.sin(angle) * startRadius,
        -0.2
      ));
      
      // Control points for curve
      const midRadius1 = ringRadii[0] + (ringRadii[1] - ringRadii[0]) * 0.5;
      points.push(new THREE.Vector3(
        Math.cos(angle) * midRadius1,
        Math.sin(angle) * midRadius1,
        -0.4
      ));
      
      // Middle ring
      const midRadius = ringRadii[1];
      points.push(new THREE.Vector3(
        Math.cos(angle) * midRadius,
        Math.sin(angle) * midRadius,
        -0.3
      ));
      
      // Control point to outer
      const midRadius2 = ringRadii[1] + (ringRadii[2] - ringRadii[1]) * 0.5;
      points.push(new THREE.Vector3(
        Math.cos(angle) * midRadius2,
        Math.sin(angle) * midRadius2,
        -0.4
      ));
      
      // End at outer ring
      const endRadius = ringRadii[2];
      points.push(new THREE.Vector3(
        Math.cos(angle) * endRadius,
        Math.sin(angle) * endRadius,
        -0.2
      ));
      
      // Create smooth curve
      const curve = new THREE.CatmullRomCurve3(points);
      curve.curveType = 'catmullrom';
      curve.tension = 0.5;
      
      // Create tube geometry along curve
      const tubeGeometry = new THREE.TubeGeometry(curve, 32, 0.08, 8, false);
      const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
      this.scene.add(cable);
      
      // Add cable connectors at joints (small cylinders)
      const connectorGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 12);
      const connectorMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.6,
        roughness: 0.4
      });
      
      // Connector at inner ring
      const connector1 = new THREE.Mesh(connectorGeometry, connectorMaterial);
      connector1.position.set(
        Math.cos(angle) * startRadius,
        Math.sin(angle) * startRadius,
        -0.2
      );
      connector1.rotation.z = angle;
      connector1.lookAt(0, 0, -0.2);
      connector1.rotateX(Math.PI / 2);
      this.scene.add(connector1);
      
      // Connector at outer ring
      const connector2 = new THREE.Mesh(connectorGeometry, connectorMaterial);
      connector2.position.set(
        Math.cos(angle) * endRadius,
        Math.sin(angle) * endRadius,
        -0.2
      );
      connector2.rotation.z = angle;
      connector2.lookAt(0, 0, -0.2);
      connector2.rotateX(Math.PI / 2);
      this.scene.add(connector2);
      
      this.cables.push({
        cable: cable,
        connectors: [connector1, connector2],
        baseAngle: angle
      });
    }
    
    // Create radial cable connections (ring to ring)
    const radialCableCount = 8;
    for (let i = 0; i < radialCableCount; i++) {
      const angle = (i / radialCableCount) * Math.PI * 2 + (Math.PI / radialCableCount);
      
      // Cable from inner to middle ring
      const startR = ringRadii[0] + 0.3;
      const endR = ringRadii[1] - 0.3;
      
      const startPoint = new THREE.Vector3(
        Math.cos(angle) * startR,
        Math.sin(angle) * startR,
        -0.15
      );
      const endPoint = new THREE.Vector3(
        Math.cos(angle) * endR,
        Math.sin(angle) * endR,
        -0.15
      );
      
      // Create slightly curved path
      const midPoint = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.5);
      midPoint.z -= 0.15; // Dip in middle
      
      const curve = new THREE.QuadraticBezierCurve3(startPoint, midPoint, endPoint);
      const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.06, 8, false);
      const cable = new THREE.Mesh(tubeGeometry, cableMaterial);
      this.scene.add(cable);
      
      this.cables.push({ cable });
    }
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
    
    // Animate energy pulses traveling along coil rings
    if (this.energyPulses) {
      this.energyPulses.forEach((pulse, i) => {
        // Check if it's time to activate
        if (!pulse.active && this.time > pulse.nextActivation) {
          pulse.active = true;
          pulse.intensity = 1.0;
          pulse.angle = Math.random() * Math.PI * 2;
        }
        
        if (pulse.active) {
          // Move pulse along ring
          pulse.angle += pulse.speed * 0.016;
          pulse.intensity -= 0.008; // Fade out
          
          // Update pulse rotation
          pulse.mesh.rotation.z = pulse.angle;
          pulse.mesh.material.opacity = Math.max(0, pulse.intensity * 0.8);
          
          // Deactivate when faded
          if (pulse.intensity <= 0) {
            pulse.active = false;
            pulse.nextActivation = this.time + 1 + Math.random() * 3;
            pulse.mesh.material.opacity = 0;
          }
        }
      });
    }
    
    // Animate electrical sparks
    if (this.sparks) {
      this.sparks.forEach((spark, i) => {
        // Check if it's time to activate
        if (!spark.active && this.time > spark.nextActivation) {
          spark.active = true;
          spark.lifetime = 0.1 + Math.random() * 0.15;
          
          // Pick random start and end points between coil rings
          const angle1 = Math.random() * Math.PI * 2;
          const angle2 = angle1 + (Math.random() - 0.5) * 0.5;
          const radius1 = 2.2 + Math.floor(Math.random() * 2) * 0.9;
          const radius2 = 2.2 + Math.floor(Math.random() * 3) * 0.9;
          
          spark.startPoint.set(
            Math.cos(angle1) * radius1,
            Math.sin(angle1) * radius1,
            (Math.random() - 0.5) * 0.2
          );
          spark.endPoint.set(
            Math.cos(angle2) * radius2,
            Math.sin(angle2) * radius2,
            (Math.random() - 0.5) * 0.2
          );
          
          // Generate zigzag path
          const positions = spark.positions.array;
          const segments = positions.length / 3;
          
          for (let j = 0; j < segments; j++) {
            const t = j / (segments - 1);
            const jitter = (Math.random() - 0.5) * 0.3;
            
            positions[j * 3] = spark.startPoint.x + (spark.endPoint.x - spark.startPoint.x) * t + jitter;
            positions[j * 3 + 1] = spark.startPoint.y + (spark.endPoint.y - spark.startPoint.y) * t + jitter;
            positions[j * 3 + 2] = spark.startPoint.z + (spark.endPoint.z - spark.startPoint.z) * t;
          }
          
          spark.positions.needsUpdate = true;
          spark.mesh.material.opacity = 1;
          spark.mesh.material.color.setHex(Math.random() > 0.5 ? 0xffffff : 0x00ffff);
        }
        
        if (spark.active) {
          spark.lifetime -= 0.016;
          
          // Flicker effect
          spark.mesh.material.opacity = spark.lifetime > 0 ? (Math.random() * 0.5 + 0.5) : 0;
          
          // Jitter the spark path for electrical effect
          if (spark.lifetime > 0 && Math.random() > 0.5) {
            const positions = spark.positions.array;
            const segments = positions.length / 3;
            
            for (let j = 1; j < segments - 1; j++) {
              const t = j / (segments - 1);
              const jitter = (Math.random() - 0.5) * 0.2;
              
              positions[j * 3] = spark.startPoint.x + (spark.endPoint.x - spark.startPoint.x) * t + jitter;
              positions[j * 3 + 1] = spark.startPoint.y + (spark.endPoint.y - spark.startPoint.y) * t + jitter;
            }
            spark.positions.needsUpdate = true;
          }
          
          if (spark.lifetime <= 0) {
            spark.active = false;
            spark.mesh.material.opacity = 0;
            spark.nextActivation = this.time + 0.5 + Math.random() * 2;
          }
        }
      });
    }
    
    // Animate holographic rings
    if (this.holographicRings) {
      this.holographicRings.forEach((ring, i) => {
        // Rotate rings
        ring.mainRing.rotation.z += ring.rotationSpeed * 0.016;
        ring.detailRing.rotation.z -= ring.rotationSpeed * 0.008;
        
        // Bob up and down
        const bobOffset = Math.sin(this.time * ring.bobSpeed + i) * ring.bobAmount;
        ring.mainRing.position.z = ring.baseY + bobOffset;
        ring.detailRing.position.z = ring.baseY + bobOffset;
        
        // Pulsing opacity
        const pulseOpacity = 0.15 + Math.sin(this.time * 2 + i) * 0.05 + this.audioIntensity * 0.1;
        ring.mainRing.material.opacity = Math.max(0.05, pulseOpacity);
        ring.detailRing.material.opacity = Math.max(0.03, pulseOpacity * 0.5);
        
        // Scroll texture
        if (ring.mainRing.material.map) {
          ring.mainRing.material.map.offset.y -= 0.005;
        }
      });
    }
    
    // Animate holographic glyphs
    if (this.holographicGlyphs) {
      this.holographicGlyphs.forEach((glyph, i) => {
        // Orbit around center
        glyph.angle += glyph.orbitSpeed * 0.016;
        
        // Bob up and down
        const bobOffset = Math.sin(this.time * glyph.bobSpeed + i * 0.5) * glyph.bobAmount;
        
        // Update position
        glyph.sprite.position.x = Math.cos(glyph.angle) * glyph.radius;
        glyph.sprite.position.y = Math.sin(glyph.angle) * glyph.radius;
        glyph.sprite.position.z = glyph.basePos.z + bobOffset;
        
        // Fade in/out
        const fadePhase = (this.time * glyph.fadeSpeed + i) % (Math.PI * 2);
        const fadeOpacity = Math.sin(fadePhase) * 0.5 + 0.5;
        glyph.sprite.material.opacity = glyph.baseOpacity * fadeOpacity;
        
        // Scale with audio
        const audioScale = 1 + this.audioIntensity * 0.3;
        glyph.sprite.scale.set(0.5 * audioScale, 0.25 * audioScale, 1);
      });
    }
    
    // Animate core particle trail
    if (this.coreParticleSystem && this.coreParticleData) {
      const positions = this.coreParticleSystem.geometry.attributes.position.array;
      
      for (let i = 0; i < this.coreParticleData.length; i++) {
        const data = this.coreParticleData[i];
        
        // Move particle upward
        positions[i * 3 + 2] += data.speed * (1 + this.audioIntensity * 2);
        
        // Add slight drift
        positions[i * 3] += data.drift + Math.sin(this.time * 2 + i) * 0.002;
        positions[i * 3 + 1] += Math.cos(this.time * 1.5 + i) * 0.002;
        
        // Reset particle when it reaches max height
        if (positions[i * 3 + 2] > data.maxHeight) {
          positions[i * 3 + 2] = data.resetHeight;
          // Randomize new starting position near core
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 0.6;
          positions[i * 3] = Math.cos(angle) * radius;
          positions[i * 3 + 1] = Math.sin(angle) * radius;
        }
      }
      
      this.coreParticleSystem.geometry.attributes.position.needsUpdate = true;
      
      // Pulse opacity with audio
      this.coreParticleSystem.material.opacity = 0.4 + Math.sin(this.time * 3) * 0.2 + this.audioIntensity * 0.4;
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
