/**
 * NeuralNetworkCore - 3D Mesh Neural Network Visualization
 * 
 * A brain-inspired neural network with:
 * - 3D wave-like mesh surface
 * - Multi-colored glowing nodes
 * - Triangular web connections
 * - Organic brain-like structure
 * - Electrical pulses traveling through connections
 */

import * as THREE from 'three';

export class NeuralNetworkCore {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      gridSize: options.gridSize || 12,
      radius: options.radius || 8,
      waveHeight: options.waveHeight || 2,
      rotationSpeed: options.rotationSpeed || 0.001,
      pulseSpeed: options.pulseSpeed || 1.0,
      activityLevel: options.activityLevel ?? 0.7,
      cpuLoad: options.cpuLoad || 0,
      gpuLoad: options.gpuLoad || 0,
      voiceState: options.voiceState || 'idle',
      ...options
    };

    this.nodes = [];
    this.connections = [];
    this.pulses = [];
    this.time = 0;
    this.isDestroyed = false;

    // Multi-color palette (like the reference image)
    this.colors = {
      cyan: new THREE.Color(0x00ddff),
      magenta: new THREE.Color(0xff00ff),
      orange: new THREE.Color(0xff8800),
      purple: new THREE.Color(0x8844ff),
      pink: new THREE.Color(0xff4488),
      blue: new THREE.Color(0x4488ff)
    };

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.createNeuralMesh();
    this.createFloatingParticles();
    this.createPulseSystem();
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.03);
  }

  setupCamera() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 8, 18);
    this.camera.lookAt(0, 0, 0);
  }

  setupRenderer() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 600;
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0x111122, 0.4);
    this.scene.add(ambientLight);

    // Multi-colored point lights
    this.lights = [];
    const lightPositions = [
      { pos: [10, 5, 10], color: 0x00ddff },
      { pos: [-10, 5, 10], color: 0xff00ff },
      { pos: [0, -5, 10], color: 0xff8800 },
      { pos: [0, 8, 5], color: 0x8844ff }
    ];

    lightPositions.forEach(({ pos, color }) => {
      const light = new THREE.PointLight(color, 0.8, 30);
      light.position.set(...pos);
      this.scene.add(light);
      this.lights.push({ light, basePos: [...pos], phase: Math.random() * Math.PI * 2 });
    });
  }

  getRandomColor() {
    const colorKeys = Object.keys(this.colors);
    const key = colorKeys[Math.floor(Math.random() * colorKeys.length)];
    return this.colors[key];
  }

  createNeuralMesh() {
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    const gridSize = this.options.gridSize;
    const radius = this.options.radius;
    const nodes = [];

    // Create nodes in a circular grid pattern (polar coordinates)
    for (let ring = 0; ring < gridSize; ring++) {
      const r = (ring / (gridSize - 1)) * radius;
      const nodesInRing = Math.max(6, ring * 6);
      
      for (let i = 0; i < nodesInRing; i++) {
        const angle = (i / nodesInRing) * Math.PI * 2;
        
        // Base position
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        
        // Add wave height variation
        const waveOffset = Math.sin(angle * 3 + ring * 0.5) * this.options.waveHeight * (ring / gridSize);
        const y = waveOffset;

        const node = this.createNode(x, y, z, ring, i);
        nodes.push(node);
        this.nodes.push(node);
        this.meshGroup.add(node.mesh);
      }
    }

    // Create triangular mesh connections
    this.createTriangularConnections();
    
    // Create central energy core
    this.createCentralCore();
  }

  createCentralCore() {
    // Central energy sphere
    const coreGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    this.centralCore = new THREE.Mesh(coreGeometry, coreMaterial);
    this.meshGroup.add(this.centralCore);
    
    // Core glow
    const glowTexture = this.createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    this.coreGlow = new THREE.Sprite(glowMaterial);
    this.coreGlow.scale.set(4, 4, 1);
    this.centralCore.add(this.coreGlow);
    
    // Ripple ring effect
    const ringGeometry = new THREE.RingGeometry(1, 1.2, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ddff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.rippleRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.rippleRing.rotation.x = -Math.PI / 2;
    this.meshGroup.add(this.rippleRing);
  }

  createNode(x, y, z, ring, index) {
    const color = this.getRandomColor();
    const size = 0.08 + (1 - ring / this.options.gridSize) * 0.12;

    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);

    // Add glow sprite
    const glowTexture = this.createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(size * 6, size * 6, 1);
    mesh.add(glow);

    return {
      mesh,
      glow,
      originalPos: new THREE.Vector3(x, y, z),
      ring,
      index,
      color: color.clone(),
      baseSize: size,
      pulsePhase: Math.random() * Math.PI * 2,
      activity: Math.random()
    };
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  createTriangularConnections() {
    // Connect nodes to form triangular mesh
    const maxDistance = 2.5;

    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j];
        const dist = nodeA.originalPos.distanceTo(nodeB.originalPos);
        
        if (dist < maxDistance && Math.random() > 0.4) {
          // Create line connection
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array([
            nodeA.mesh.position.x, nodeA.mesh.position.y, nodeA.mesh.position.z,
            nodeB.mesh.position.x, nodeB.mesh.position.y, nodeB.mesh.position.z
          ]);
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          
          // Gradient color between the two nodes
          const lineColor = nodeA.color.clone().lerp(nodeB.color, 0.5);
          
          const material = new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending
          });

          const line = new THREE.Line(geometry, material);
          this.meshGroup.add(line);
          
          this.connections.push({
            line,
            nodeA,
            nodeB,
            baseOpacity: 0.15 + Math.random() * 0.2,
            active: Math.random() > 0.6
          });
        }
      }
    }
  }

  createFloatingParticles() {
    const particleCount = 80;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Random position in a spherical volume
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 8;
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = this.getRandomColor();
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.1 + Math.random() * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.meshGroup.add(this.particleSystem);
  }

  createPulseSystem() {
    this.pulsePool = [];
    // Larger, more visible pulses
    const pulseGeometry = new THREE.SphereGeometry(0.12, 12, 12);

    for (let i = 0; i < 60; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      
      const pulse = new THREE.Mesh(pulseGeometry, material.clone());
      pulse.visible = false;
      
      // Add glow to pulses
      const glowTexture = this.createGlowTexture();
      const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Sprite(glowMaterial);
      glow.scale.set(0.8, 0.8, 1);
      pulse.add(glow);
      
      this.meshGroup.add(pulse);
      
      this.pulsePool.push({
        mesh: pulse,
        glow: glow,
        active: false,
        progress: 0,
        speed: 0,
        connection: null
      });
    }
  }

  spawnPulse(connection, isBurst = false) {
    const pulse = this.pulsePool.find(p => !p.active);
    if (!pulse) return;

    pulse.active = true;
    pulse.progress = 0;
    // Faster pulses during bursts (voice activity)
    pulse.speed = isBurst ? 0.03 + Math.random() * 0.02 : 0.015 + Math.random() * 0.015;
    pulse.connection = connection;
    pulse.mesh.visible = true;
    
    // Brighter color for burst pulses
    const baseColor = connection.nodeA.color;
    if (isBurst) {
      pulse.mesh.material.color.setHex(0xffffff);
      pulse.mesh.scale.setScalar(1.5); // Larger during bursts
      pulse.glow.material.opacity = 0.9;
      pulse.glow.scale.set(1.2, 1.2, 1);
    } else {
      pulse.mesh.material.color.copy(baseColor);
      pulse.mesh.scale.setScalar(1);
      pulse.glow.material.opacity = 0.5;
      pulse.glow.scale.set(0.8, 0.8, 1);
    }
    
    pulse.mesh.material.opacity = 1;
  }

  updatePulses() {
    const activityMultiplier = this.getActivityMultiplier();
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';

    this.pulsePool.forEach(pulse => {
      if (!pulse.active) return;

      pulse.progress += pulse.speed * activityMultiplier;
      
      if (pulse.progress >= 1) {
        pulse.active = false;
        pulse.mesh.visible = false;
        return;
      }

      const start = pulse.connection.nodeA.mesh.position;
      const end = pulse.connection.nodeB.mesh.position;
      
      pulse.mesh.position.lerpVectors(start, end, pulse.progress);
      
      // Fade in then out
      const fadeIn = Math.min(1, pulse.progress * 4);
      const fadeOut = Math.min(1, (1 - pulse.progress) * 4);
      const opacity = Math.min(fadeIn, fadeOut);
      
      pulse.mesh.material.opacity = opacity;
      if (pulse.glow) pulse.glow.material.opacity = opacity * 0.7;
      
      // Color interpolation (only if not a burst pulse)
      if (pulse.mesh.scale.x <= 1.2) {
        pulse.mesh.material.color.copy(
          pulse.connection.nodeA.color.clone().lerp(pulse.connection.nodeB.color, pulse.progress)
        );
        if (pulse.glow) pulse.glow.material.color.copy(pulse.mesh.material.color);
      }
    });

    // Spawn new pulses - MUCH higher rate during voice activity
    let spawnRate = 0.04 * activityMultiplier;
    if (voiceState === 'speaking') spawnRate = 0.25; // Burst firing when speaking
    else if (voiceState === 'listening') spawnRate = 0.15; // Higher when listening
    
    if (Math.random() < spawnRate) {
      const activeConnections = this.connections.filter(c => c.active);
      if (activeConnections.length > 0) {
        const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        this.spawnPulse(conn, isVoiceActive);
        
        // During voice, spawn multiple pulses for burst effect
        if (isVoiceActive && Math.random() < 0.3) {
          const conn2 = activeConnections[Math.floor(Math.random() * activeConnections.length)];
          setTimeout(() => this.spawnPulse(conn2, true), 50);
        }
      }
    }
  }

  getActivityMultiplier() {
    const cpuFactor = this.options.cpuLoad / 100;
    const gpuFactor = this.options.gpuLoad / 100;
    const voiceState = this.options.voiceState;
    
    // Much higher multipliers for voice activity
    let voiceFactor = 0.6;
    if (voiceState === 'speaking') voiceFactor = 3.0; // 3x activity when speaking
    else if (voiceState === 'listening') voiceFactor = 2.0; // 2x when listening
    
    return 0.5 + (cpuFactor + gpuFactor) * 0.8 + voiceFactor;
  }

  updateNodes(deltaTime) {
    const time = this.time;
    const activityMultiplier = this.getActivityMultiplier();
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';

    this.nodes.forEach(node => {
      // Wave animation
      const waveX = Math.sin(time * 0.5 + node.originalPos.x * 0.3) * 0.3;
      const waveZ = Math.cos(time * 0.4 + node.originalPos.z * 0.3) * 0.3;
      const waveY = Math.sin(time * 0.6 + node.ring * 0.5) * 0.2;

      node.mesh.position.y = node.originalPos.y + waveY;
      node.mesh.position.x = node.originalPos.x + waveX * (node.ring / this.options.gridSize);
      node.mesh.position.z = node.originalPos.z + waveZ * (node.ring / this.options.gridSize);

      // Pulsing size - much larger during voice
      const basePulse = Math.sin(time * 3 + node.pulsePhase) * 0.3 + 1;
      const activityPulse = Math.sin(time * 5 * activityMultiplier + node.ring) * 0.3;
      const voiceBoost = isVoiceActive ? 0.5 : 0;
      const scale = (basePulse + activityPulse + voiceBoost) * this.options.activityLevel;
      
      node.mesh.scale.setScalar(scale);
      
      // Opacity pulse - brighter during voice
      const baseOpacity = 0.6 + Math.sin(time * 2 + node.pulsePhase) * 0.3;
      const voiceOpacity = isVoiceActive ? 0.3 : 0;
      node.mesh.material.opacity = Math.min(1, (baseOpacity + voiceOpacity) * this.options.activityLevel);
      node.glow.material.opacity = Math.min(0.9, (0.4 + voiceOpacity * 0.5) * this.options.activityLevel);

      // Color shift - flash white during voice
      if (isVoiceActive) {
        const flash = (Math.sin(time * 8 + node.pulsePhase) + 1) * 0.5;
        node.mesh.material.color.copy(node.color).lerp(new THREE.Color(0xffffff), flash * 0.5);
      } else if (activityMultiplier > 1.2) {
        const shift = (Math.sin(time * 4) + 1) * 0.5;
        node.mesh.material.color.copy(node.color).lerp(new THREE.Color(0xffffff), shift * 0.2);
      } else {
        node.mesh.material.color.copy(node.color);
      }
    });
  }

  updateConnections() {
    const activityMultiplier = this.getActivityMultiplier();
    const time = this.time;

    this.connections.forEach(conn => {
      // Update line positions to match moving nodes
      const positions = conn.line.geometry.attributes.position.array;
      positions[0] = conn.nodeA.mesh.position.x;
      positions[1] = conn.nodeA.mesh.position.y;
      positions[2] = conn.nodeA.mesh.position.z;
      positions[3] = conn.nodeB.mesh.position.x;
      positions[4] = conn.nodeB.mesh.position.y;
      positions[5] = conn.nodeB.mesh.position.z;
      conn.line.geometry.attributes.position.needsUpdate = true;

      // Opacity based on activity
      const baseOpacity = conn.baseOpacity;
      const activityBoost = conn.active ? activityMultiplier * 0.3 : 0;
      const wave = Math.sin(time * 2 + conn.nodeA.ring) * 0.1;
      
      conn.line.material.opacity = Math.min(0.7, (baseOpacity + activityBoost + wave) * this.options.activityLevel);
    });
  }

  updateParticles() {
    const time = this.time;
    const positions = this.particleSystem.geometry.attributes.position.array;

    for (let i = 0; i < 80; i++) {
      // Slow drift
      positions[i * 3 + 1] += Math.sin(time * 0.5 + i) * 0.005;
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.rotation.y = time * 0.05;
  }

  updateLights() {
    const time = this.time;
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';
    
    this.lights.forEach(({ light, basePos, phase }) => {
      light.position.x = basePos[0] + Math.sin(time * 0.5 + phase) * 2;
      light.position.y = basePos[1] + Math.cos(time * 0.3 + phase) * 2;
      // Much brighter during voice
      const baseIntensity = 0.6 + Math.sin(time * 2 + phase) * 0.3;
      light.intensity = isVoiceActive ? baseIntensity * 2.5 : baseIntensity;
    });
  }

  updateCentralCore() {
    const time = this.time;
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';
    const isSpeaking = voiceState === 'speaking';
    
    // Central core pulsing
    const basePulse = Math.sin(time * 3) * 0.3 + 1;
    const voicePulse = isVoiceActive ? Math.sin(time * 10) * 0.5 + 1.5 : 1;
    const scale = basePulse * voicePulse * this.options.activityLevel;
    
    this.centralCore.scale.setScalar(scale);
    this.centralCore.material.opacity = isVoiceActive ? 0.9 : 0.6;
    this.coreGlow.material.opacity = isVoiceActive ? 1.0 : 0.6;
    
    // Color shift during voice
    if (isSpeaking) {
      this.centralCore.material.color.setHex(0x00ff88); // Green when speaking
      this.coreGlow.material.color.setHex(0x00ff88);
    } else if (voiceState === 'listening') {
      this.centralCore.material.color.setHex(0x00ddff); // Cyan when listening
      this.coreGlow.material.color.setHex(0x00ddff);
    } else {
      this.centralCore.material.color.setHex(0xffffff);
      this.coreGlow.material.color.setHex(0xffffff);
    }
    
    // Ripple ring effect during voice
    if (isVoiceActive) {
      const rippleSpeed = isSpeaking ? 3 : 2;
      const ripplePhase = (time * rippleSpeed) % 1;
      this.rippleRing.scale.setScalar(1 + ripplePhase * 4);
      this.rippleRing.material.opacity = (1 - ripplePhase) * (isSpeaking ? 0.8 : 0.5);
      
      // Color ripple
      if (isSpeaking) {
        this.rippleRing.material.color.setHex(0x00ff88);
      } else {
        this.rippleRing.material.color.setHex(0x00ddff);
      }
    } else {
      this.rippleRing.material.opacity = 0;
    }
  }

  animate() {
    if (this.isDestroyed) return;

    const deltaTime = 0.016;
    this.time += deltaTime;

    // Rotate entire mesh slowly
    this.meshGroup.rotation.y += this.options.rotationSpeed;

    this.updateNodes(deltaTime);
    this.updateConnections();
    this.updateParticles();
    this.updateLights();
    this.updateCentralCore();
    this.updatePulses();

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // Public methods
  setActivityLevel(level) {
    this.options.activityLevel = Math.max(0.2, Math.min(1.5, level));
  }

  setCpuLoad(load) {
    this.options.cpuLoad = Math.max(0, Math.min(100, load));
  }

  setGpuLoad(load) {
    this.options.gpuLoad = Math.max(0, Math.min(100, load));
  }

  setVoiceState(state) {
    this.options.voiceState = state;
  }

  setRotationSpeed(speed) {
    this.options.rotationSpeed = speed;
  }

  resize() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    this.isDestroyed = true;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}

export default NeuralNetworkCore;
