/**
 * NeuralNetworkCore - 3D Spherical Neural Network Visualization
 * 
 * A dense brain-inspired neural network forming a complete 3D globe:
 * - 120 nodes with MANY connections (dense mesh)
 * - All nodes connected to nearby nodes forming a web
 * - Multi-colored glowing nodes
 * - Electrical pulses traveling through connections
 * - Adjustable node size
 */

import * as THREE from 'three';

export class NeuralNetworkCore {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodeCount: options.nodeCount || 120,
      nodeSize: options.nodeSize || 0.08,
      connectionDistance: options.connectionDistance || 4.5,
      rotationSpeed: options.rotationSpeed || 0.001,
      brightness: options.brightness ?? 1.0,
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
      blue: new THREE.Color(0x4488ff),
      green: new THREE.Color(0x00ff88)
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
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);
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
    const ambientLight = new THREE.AmbientLight(0x222244, 0.4);
    this.scene.add(ambientLight);

    // Multiple colored lights around the sphere
    this.lights = [];
    const lightConfigs = [
      { pos: [15, 10, 10], color: 0x00ddff, intensity: 1.2 },
      { pos: [-15, -10, 10], color: 0xff00ff, intensity: 1.2 },
      { pos: [10, -15, -10], color: 0xff8800, intensity: 1.2 },
      { pos: [-10, 15, -10], color: 0x8844ff, intensity: 1.2 },
      { pos: [0, 0, 18], color: 0x00ff88, intensity: 1.0 }
    ];

    lightConfigs.forEach(({ pos, color, intensity }) => {
      const light = new THREE.PointLight(color, intensity, 50);
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
    const radius = 7;

    // Create nodes in spherical Fibonacci lattice
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      
      const node = this.createNode(x * radius, y * radius, z * radius, i);
      this.nodes.push(node);
      this.meshGroup.add(node.mesh);
    }

    // Create DENSE connections - each node connects to ALL nearby nodes
    this.createDenseConnections();
  }

  createNode(x, y, z, index) {
    const color = this.getRandomColor();
    const size = this.options.nodeSize;

    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);

    // Glow sprite - size independent of node size
    const glowTexture = this.createGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Sprite(glowMaterial);
    // Glow size is fixed regardless of node size
    glow.scale.set(0.5, 0.5, 1);
    mesh.add(glow);

    return {
      mesh,
      glow,
      originalPos: new THREE.Vector3(x, y, z),
      index,
      color: color.clone(),
      baseSize: size,
      pulsePhase: Math.random() * Math.PI * 2,
      connections: [] // Track which connections this node has
    };
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    return new THREE.CanvasTexture(canvas);
  }

  createDenseConnections() {
    const maxDistance = this.options.connectionDistance;
    const minDistance = 1.5; // Don't connect too close nodes

    // For each node, connect to ALL other nodes within range
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      let connectionCount = 0;
      
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        
        const nodeB = this.nodes[j];
        const dist = nodeA.originalPos.distanceTo(nodeB.originalPos);
        
        // Connect if within range and not too close
        if (dist >= minDistance && dist <= maxDistance) {
          this.createConnection(nodeA, nodeB);
          connectionCount++;
        }
      }
      
      // Ensure each node has at least some connections
      if (connectionCount < 3) {
        // Find closest nodes and connect to them
        const distances = this.nodes
          .map((n, idx) => ({ node: n, idx, dist: nodeA.originalPos.distanceTo(n.originalPos) }))
          .filter(d => d.idx !== i && d.dist > 0)
          .sort((a, b) => a.dist - b.dist);
        
        for (let k = 0; k < Math.min(3 - connectionCount, distances.length); k++) {
          this.createConnection(nodeA, distances[k].node);
        }
      }
    }
  }

  createConnection(nodeA, nodeB) {
    // Check if connection already exists
    const exists = this.connections.some(c => 
      (c.nodeA === nodeA && c.nodeB === nodeB) || 
      (c.nodeA === nodeB && c.nodeB === nodeA)
    );
    
    if (exists) return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      nodeA.mesh.position.x, nodeA.mesh.position.y, nodeA.mesh.position.z,
      nodeB.mesh.position.x, nodeB.mesh.position.y, nodeB.mesh.position.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const lineColor = nodeA.color.clone().lerp(nodeB.color, 0.5);
    
    const material = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    const line = new THREE.Line(geometry, material);
    this.meshGroup.add(line);
    
    const connection = {
      line,
      nodeA,
      nodeB,
      baseOpacity: 0.25 + Math.random() * 0.2,
      active: true
    };
    
    this.connections.push(connection);
    nodeA.connections.push(connection);
    nodeB.connections.push(connection);
  }

  createPulseSystem() {
    this.pulsePool = [];
    const pulseGeometry = new THREE.SphereGeometry(0.08, 10, 10);

    for (let i = 0; i < 60; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      
      const pulse = new THREE.Mesh(pulseGeometry, material.clone());
      pulse.visible = false;
      
      const glowTexture = this.createGlowTexture();
      const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Sprite(glowMaterial);
      glow.scale.set(0.5, 0.5, 1);
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
    pulse.speed = isBurst ? 0.03 + Math.random() * 0.02 : 0.018 + Math.random() * 0.012;
    pulse.connection = connection;
    pulse.mesh.visible = true;
    
    if (isBurst) {
      pulse.mesh.material.color.setHex(0xffffff);
      pulse.mesh.scale.setScalar(1.4);
      pulse.glow.material.opacity = 0.9;
      pulse.glow.scale.set(0.8, 0.8, 1);
    } else {
      pulse.mesh.material.color.copy(connection.nodeA.color);
      pulse.mesh.scale.setScalar(1);
      pulse.glow.material.opacity = 0.6;
      pulse.glow.scale.set(0.5, 0.5, 1);
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
      
      const fadeIn = Math.min(1, pulse.progress * 5);
      const fadeOut = Math.min(1, (1 - pulse.progress) * 5);
      const opacity = Math.min(fadeIn, fadeOut);
      
      pulse.mesh.material.opacity = opacity;
      if (pulse.glow) pulse.glow.material.opacity = opacity * 0.8;
      
      if (pulse.mesh.scale.x <= 1.2) {
        pulse.mesh.material.color.lerpColors(
          pulse.connection.nodeA.color,
          pulse.connection.nodeB.color,
          pulse.progress
        );
        if (pulse.glow) pulse.glow.material.color.copy(pulse.mesh.material.color);
      }
    });

    // Spawn pulses
    let spawnRate = 0.04 * activityMultiplier;
    if (voiceState === 'speaking') spawnRate = 0.25;
    else if (voiceState === 'listening') spawnRate = 0.15;
    
    if (Math.random() < spawnRate) {
      const conn = this.connections[Math.floor(Math.random() * this.connections.length)];
      if (conn) {
        this.spawnPulse(conn, isVoiceActive);
        
        if (isVoiceActive && Math.random() < 0.3) {
          const conn2 = this.connections[Math.floor(Math.random() * this.connections.length)];
          setTimeout(() => this.spawnPulse(conn2, true), 30);
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
    
    return 0.5 + (cpuFactor + gpuFactor) * 0.8 + voiceFactor;
  }

  updateNodes() {
    const time = this.time;
    const activityMultiplier = this.getActivityMultiplier();
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';
    const brightness = this.options.brightness;

    this.nodes.forEach(node => {
      // Breathing animation
      const breathe = Math.sin(time * 0.7 + node.pulsePhase) * 0.06;
      const voiceBreathe = isVoiceActive ? Math.sin(time * 2.5) * 0.1 : 0;
      const scale = 1 + breathe + voiceBreathe;
      
      node.mesh.position.copy(node.originalPos).multiplyScalar(scale);
      
      // Node pulsing - size change but brightness stays
      const basePulse = Math.sin(time * 2 + node.pulsePhase) * 0.2 + 1;
      const voicePulse = isVoiceActive ? Math.sin(time * 5 + node.pulsePhase) * 0.3 : 0;
      const sizeMult = (basePulse + voicePulse);
      
      // Apply node size with pulsing
      node.mesh.scale.setScalar(node.baseSize * sizeMult * 10); // Scale up for visibility
      
      // Brightness is independent of activity - uses brightness option
      const baseOpacity = 0.8 * brightness;
      const pulseOpacity = Math.sin(time * 2 + node.pulsePhase) * 0.15;
      node.mesh.material.opacity = Math.min(1, baseOpacity + pulseOpacity);
      
      // Glow opacity also uses brightness
      node.glow.material.opacity = 0.5 * brightness;

      // Flash during voice
      if (isVoiceActive) {
        const flash = (Math.sin(time * 6 + node.pulsePhase) + 1) * 0.5;
        node.mesh.material.color.copy(node.color).lerp(new THREE.Color(0xffffff), flash * 0.35);
      } else {
        node.mesh.material.color.copy(node.color);
      }
    });
  }

  updateConnections() {
    const brightness = this.options.brightness;
    const activityMultiplier = this.getActivityMultiplier();
    const time = this.time;

    this.connections.forEach(conn => {
      // Update positions
      const positions = conn.line.geometry.attributes.position.array;
      positions[0] = conn.nodeA.mesh.position.x;
      positions[1] = conn.nodeA.mesh.position.y;
      positions[2] = conn.nodeA.mesh.position.z;
      positions[3] = conn.nodeB.mesh.position.x;
      positions[4] = conn.nodeB.mesh.position.y;
      positions[5] = conn.nodeB.mesh.position.z;
      conn.line.geometry.attributes.position.needsUpdate = true;

      // Opacity based on brightness and activity
      const baseOpacity = conn.baseOpacity * brightness;
      const activityBoost = (activityMultiplier - 1) * 0.15;
      const wave = Math.sin(time * 1.5 + conn.nodeA.index * 0.05) * 0.05;
      
      conn.line.material.opacity = Math.min(0.8, baseOpacity + activityBoost + wave);
    });
  }

  updateLights() {
    const time = this.time;
    const brightness = this.options.brightness;
    const voiceState = this.options.voiceState;
    const isVoiceActive = voiceState === 'speaking' || voiceState === 'listening';
    
    this.lights.forEach(({ light, basePos, phase }) => {
      const orbitSpeed = 0.25;
      const x = basePos[0] * Math.cos(time * orbitSpeed + phase) - basePos[2] * Math.sin(time * orbitSpeed + phase);
      const z = basePos[0] * Math.sin(time * orbitSpeed + phase) + basePos[2] * Math.cos(time * orbitSpeed + phase);
      
      light.position.x = x;
      light.position.z = z;
      light.position.y = basePos[1] + Math.sin(time * 0.4 + phase) * 3;
      
      const baseIntensity = (0.8 + Math.sin(time * 1.2 + phase) * 0.3) * brightness;
      light.intensity = isVoiceActive ? baseIntensity * 1.8 : baseIntensity;
    });
  }

  animate() {
    if (this.isDestroyed) return;

    this.time += 0.016;

    // Rotate sphere
    this.meshGroup.rotation.y += this.options.rotationSpeed;
    this.meshGroup.rotation.x = Math.sin(this.time * 0.15) * 0.1;

    this.updateNodes();
    this.updateConnections();
    this.updateLights();
    this.updatePulses();

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // Public methods
  setNodeSize(size) {
    this.options.nodeSize = Math.max(0.03, Math.min(0.2, size));
    // Update all existing nodes
    this.nodes.forEach(node => {
      node.baseSize = this.options.nodeSize;
      // Recreate geometry with new size
      node.mesh.geometry.dispose();
      node.mesh.geometry = new THREE.SphereGeometry(size, 16, 16);
    });
  }

  setBrightness(brightness) {
    this.options.brightness = Math.max(0.3, Math.min(1.5, brightness));
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
