/**
 * NeuralNetworkCore - 3D Spherical Neural Network Visualization
 * 
 * A brain-inspired neural network forming a complete 3D globe:
 * - Nodes arranged in a spherical 3D pattern
 * - Multi-colored glowing nodes
 * - Triangular web connections throughout the sphere
 * - Electrical pulses traveling through connections
 * - Reactive to CPU/GPU load and voice state
 */

import * as THREE from 'three';

export class NeuralNetworkCore {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodeCount: options.nodeCount || 120,
      connectionDensity: options.connectionDensity || 0.12,
      radius: options.radius || 7,
      rotationSpeed: options.rotationSpeed || 0.001,
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

    // Multi-color palette
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
    this.createNeuralSphere();
    this.createPulseSystem();
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.025);
  }

  setupCamera() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 20);
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
    const ambientLight = new THREE.AmbientLight(0x111122, 0.3);
    this.scene.add(ambientLight);

    // Multi-colored point lights positioned around the sphere
    this.lights = [];
    const lightPositions = [
      { pos: [12, 8, 8], color: 0x00ddff },
      { pos: [-12, -8, 8], color: 0xff00ff },
      { pos: [8, -12, -8], color: 0xff8800 },
      { pos: [-8, 12, -8], color: 0x8844ff },
      { pos: [0, 0, 15], color: 0x00ff88 }
    ];

    lightPositions.forEach(({ pos, color }) => {
      const light = new THREE.PointLight(color, 0.6, 40);
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

  createNeuralSphere() {
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    const nodeCount = this.options.nodeCount;
    const radius = this.options.radius;

    // Create nodes in a spherical Fibonacci lattice pattern
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      
      const theta = phi * i; // golden angle increment
      
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      
      // Scale to desired radius
      const node = this.createNode(x * radius, y * radius, z * radius, i);
      this.nodes.push(node);
      this.meshGroup.add(node.mesh);
    }

    // Create connections between nearby nodes
    this.createSphereConnections();
  }

  createNode(x, y, z, index) {
    const color = this.getRandomColor();
    const size = 0.1 + Math.random() * 0.08;

    const geometry = new THREE.SphereGeometry(size, 12, 12);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85
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
    glow.scale.set(size * 5, size * 5, 1);
    mesh.add(glow);

    return {
      mesh,
      glow,
      originalPos: new THREE.Vector3(x, y, z),
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

  createSphereConnections() {
    const maxDistance = 3.5;
    const density = this.options.connectionDensity;

    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j];
        const dist = nodeA.originalPos.distanceTo(nodeB.originalPos);
        
        // Connect nearby nodes with probability based on density
        if (dist < maxDistance && Math.random() < density) {
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array([
            nodeA.mesh.position.x, nodeA.mesh.position.y, nodeA.mesh.position.z,
            nodeB.mesh.position.x, nodeB.mesh.position.y, nodeB.mesh.position.z
          ]);
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          
          // Gradient color between nodes
          const lineColor = nodeA.color.clone().lerp(nodeB.color, 0.5);
          
          const material = new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending
          });

          const line = new THREE.Line(geometry, material);
          this.meshGroup.add(line);
          
          this.connections.push({
            line,
            nodeA,
            nodeB,
            baseOpacity: 0.1 + Math.random() * 0.15,
            active: Math.random() > 0.5
          });
        }
      }
    }
  }

  createPulseSystem() {
    this.pulsePool = [];
    const pulseGeometry = new THREE.SphereGeometry(0.1, 10, 10);

    for (let i = 0; i < 50; i++) {
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
      glow.scale.set(0.6, 0.6, 1);
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
    pulse.speed = isBurst ? 0.025 + Math.random() * 0.02 : 0.015 + Math.random() * 0.01;
    pulse.connection = connection;
    pulse.mesh.visible = true;
    
    if (isBurst) {
      pulse.mesh.material.color.setHex(0xffffff);
      pulse.mesh.scale.setScalar(1.3);
      pulse.glow.material.opacity = 0.8;
      pulse.glow.scale.set(1, 1, 1);
    } else {
      pulse.mesh.material.color.copy(connection.nodeA.color);
      pulse.mesh.scale.setScalar(1);
      pulse.glow.material.opacity = 0.5;
      pulse.glow.scale.set(0.6, 0.6, 1);
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
      
      const fadeIn = Math.min(1, pulse.progress * 4);
      const fadeOut = Math.min(1, (1 - pulse.progress) * 4);
      const opacity = Math.min(fadeIn, fadeOut);
      
      pulse.mesh.material.opacity = opacity;
      if (pulse.glow) pulse.glow.material.opacity = opacity * 0.7;
      
      if (pulse.mesh.scale.x <= 1.2) {
        pulse.mesh.material.color.copy(
          pulse.connection.nodeA.color.clone().lerp(pulse.connection.nodeB.color, pulse.progress)
        );
        if (pulse.glow) pulse.glow.material.color.copy(pulse.mesh.material.color);
      }
    });

    // Spawn new pulses based on activity
    let spawnRate = 0.03 * activityMultiplier;
    if (voiceState === 'speaking') spawnRate = 0.2;
    else if (voiceState === 'listening') spawnRate = 0.12;
    
    if (Math.random() < spawnRate) {
      const activeConnections = this.connections.filter(c => c.active);
      if (activeConnections.length > 0) {
        const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        this.spawnPulse(conn, isVoiceActive);
        
        if (isVoiceActive && Math.random() < 0.25) {
          const conn2 = activeConnections[Math.floor(Math.random() * activeConnections.length)];
          setTimeout(() => this.spawnPulse(conn2, true), 40);
        }
      }
    }
  }

  getActivityMultiplier() {
    const cpuFactor = this.options.cpuLoad / 100;
    const gpuFactor = this.options.gpuLoad / 100;
    const voiceState = this.options.voiceState;
    
    let voiceFactor = 0.5;
    if (voiceState === 'speaking') voiceFactor = 2.5;
    else if (voiceState === 'listening') voiceFactor = 1.8;
    
    return 0.4 + (cpuFactor + gpuFactor) * 0.7 + voiceFactor;
  }

  updateNodes() {
    const time = this.time;
    const activityMultiplier = this.getActivityMultiplier();
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';

    this.nodes.forEach(node => {
      // Breathing animation - sphere expands/contracts slightly
      const breathe = Math.sin(time * 0.8 + node.pulsePhase) * 0.08;
      const voiceBreathe = isVoiceActive ? Math.sin(time * 3) * 0.15 : 0;
      const scale = 1 + breathe + voiceBreathe;
      
      node.mesh.position.copy(node.originalPos).multiplyScalar(scale);
      
      // Node pulsing
      const basePulse = Math.sin(time * 2 + node.pulsePhase) * 0.25 + 1;
      const voicePulse = isVoiceActive ? Math.sin(time * 6 + node.pulsePhase) * 0.4 : 0;
      const nodeScale = (basePulse + voicePulse) * this.options.activityLevel;
      
      node.mesh.scale.setScalar(nodeScale);
      
      // Opacity
      const baseOpacity = 0.7 + Math.sin(time * 1.5 + node.pulsePhase) * 0.25;
      const voiceOpacity = isVoiceActive ? 0.2 : 0;
      node.mesh.material.opacity = Math.min(1, (baseOpacity + voiceOpacity) * this.options.activityLevel);
      node.glow.material.opacity = Math.min(0.8, (0.4 + voiceOpacity * 0.5) * this.options.activityLevel);

      // Flash white during voice activity
      if (isVoiceActive) {
        const flash = (Math.sin(time * 7 + node.pulsePhase) + 1) * 0.5;
        node.mesh.material.color.copy(node.color).lerp(new THREE.Color(0xffffff), flash * 0.4);
      } else {
        node.mesh.material.color.copy(node.color);
      }
    });
  }

  updateConnections() {
    const activityMultiplier = this.getActivityMultiplier();
    const time = this.time;

    this.connections.forEach(conn => {
      // Update line positions
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
      const activityBoost = conn.active ? activityMultiplier * 0.25 : 0;
      const wave = Math.sin(time * 1.5 + conn.nodeA.index * 0.1) * 0.08;
      
      conn.line.material.opacity = Math.min(0.6, (baseOpacity + activityBoost + wave) * this.options.activityLevel);
    });
  }

  updateLights() {
    const time = this.time;
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';
    
    this.lights.forEach(({ light, basePos, phase }) => {
      // Orbit lights around the sphere
      const orbitSpeed = 0.3;
      const x = basePos[0] * Math.cos(time * orbitSpeed + phase) - basePos[2] * Math.sin(time * orbitSpeed + phase);
      const z = basePos[0] * Math.sin(time * orbitSpeed + phase) + basePos[2] * Math.cos(time * orbitSpeed + phase);
      
      light.position.x = x;
      light.position.z = z;
      light.position.y = basePos[1] + Math.sin(time * 0.5 + phase) * 2;
      
      const baseIntensity = 0.5 + Math.sin(time * 1.5 + phase) * 0.25;
      light.intensity = isVoiceActive ? baseIntensity * 2 : baseIntensity;
    });
  }

  animate() {
    if (this.isDestroyed) return;

    this.time += 0.016;

    // Rotate entire sphere
    this.meshGroup.rotation.y += this.options.rotationSpeed;
    this.meshGroup.rotation.x = Math.sin(this.time * 0.2) * 0.15;

    this.updateNodes();
    this.updateConnections();
    this.updateLights();
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
