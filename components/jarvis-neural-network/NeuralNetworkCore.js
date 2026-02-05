/**
 * NeuralNetworkCore - Circular Neural Network Visualization
 * 
 * A brain-inspired neural network in a circular arc-reactor-like design.
 * Features:
 * - Nodes arranged in concentric rings (circular layers)
 * - Dynamic connections between nodes
 * - Electrical impulses firing between neurons
 * - Rotating animation
 * - Reactive to CPU/GPU load and voice activity
 */

import * as THREE from 'three';

export class NeuralNetworkCore {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodeCount: options.nodeCount || 64,
      connectionDensity: options.connectionDensity || 0.15,
      rotationSpeed: options.rotationSpeed || 0.002,
      pulseSpeed: options.pulseSpeed || 1.0,
      activityLevel: options.activityLevel || 0.5,
      colorTheme: options.colorTheme || 'cyan',
      cpuLoad: options.cpuLoad || 0,
      gpuLoad: options.gpuLoad || 0,
      voiceState: options.voiceState || 'idle', // 'idle', 'listening', 'speaking'
      ...options
    };

    this.nodes = [];
    this.connections = [];
    this.pulses = [];
    this.time = 0;
    this.isDestroyed = false;

    // Color themes
    this.colorThemes = {
      cyan: {
        node: 0x00ddff,
        connection: 0x0088aa,
        pulse: 0x00ffff,
        glow: 0x00aaff
      },
      orange: {
        node: 0xff8800,
        connection: 0xaa4400,
        pulse: 0xffaa00,
        glow: 0xff6600
      },
      purple: {
        node: 0xff00ff,
        connection: 0xaa00aa,
        pulse: 0xff88ff,
        glow: 0xcc00ff
      },
      green: {
        node: 0x00ff88,
        connection: 0x00aa44,
        pulse: 0x88ffaa,
        glow: 0x00ff66
      }
    };

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
    this.createNeuralNetwork();
    this.addEventListeners();
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);
  }

  setupCamera() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.z = 18;
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
    // Ambient light for base visibility
    const ambientLight = new THREE.AmbientLight(0x222222, 0.5);
    this.scene.add(ambientLight);

    // Central glow light
    this.centralLight = new THREE.PointLight(
      this.getThemeColor('glow'),
      1,
      30
    );
    this.centralLight.position.set(0, 0, 2);
    this.scene.add(this.centralLight);

    // Dynamic lights that will pulse
    this.pulseLight1 = new THREE.PointLight(this.getThemeColor('pulse'), 0, 20);
    this.pulseLight1.position.set(8, 8, 5);
    this.scene.add(this.pulseLight1);

    this.pulseLight2 = new THREE.PointLight(this.getThemeColor('pulse'), 0, 20);
    this.pulseLight2.position.set(-8, -8, 5);
    this.scene.add(this.pulseLight2);
  }

  getThemeColor(key) {
    const theme = this.colorThemes[this.options.colorTheme] || this.colorThemes.cyan;
    return theme[key];
  }

  createNeuralNetwork() {
    this.networkGroup = new THREE.Group();
    this.scene.add(this.networkGroup);

    this.createNodes();
    this.createConnections();
    this.createCentralCore();
    this.createPulseSystem();
  }

  createNodes() {
    const nodeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: this.getThemeColor('node'),
      transparent: true,
      opacity: 0.9
    });

    // Create nodes in concentric rings (circular layers like a brain)
    const ringCount = 4;
    const nodesPerRing = Math.floor(this.options.nodeCount / ringCount);
    
    for (let ring = 0; ring < ringCount; ring++) {
      const radius = 3 + ring * 2.5; // Rings at radius 3, 5.5, 8, 10.5
      const ringNodes = ring === 0 ? 8 : nodesPerRing + ring * 4;
      
      for (let i = 0; i < ringNodes; i++) {
        const angle = (i / ringNodes) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = (Math.random() - 0.5) * 1.5; // Slight depth variation

        const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
        node.position.set(x, y, z);
        
        // Store node data
        node.userData = {
          ring: ring,
          index: i,
          angle: angle,
          radius: radius,
          baseOpacity: 0.6 + Math.random() * 0.4,
          pulsePhase: Math.random() * Math.PI * 2,
          activationLevel: Math.random()
        };

        this.networkGroup.add(node);
        this.nodes.push(node);
      }
    }

    // Add some random inner nodes (like a central brain cluster)
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 2.5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = (Math.random() - 0.5) * 2;

      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        nodeMaterial.clone()
      );
      node.position.set(x, y, z);
      
      node.userData = {
        ring: -1, // Inner cluster
        index: i,
        baseOpacity: 0.8,
        pulsePhase: Math.random() * Math.PI * 2,
        activationLevel: Math.random()
      };

      this.networkGroup.add(node);
      this.nodes.push(node);
    }
  }

  createConnections() {
    const connectionMaterial = new THREE.LineBasicMaterial({
      color: this.getThemeColor('connection'),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });

    // Connect nodes within rings and between adjacent rings
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j];
        const distance = nodeA.position.distanceTo(nodeB.position);
        
        // Connection probability based on distance and density setting
        const maxDistance = nodeA.userData.ring === nodeB.userData.ring ? 3 : 4;
        const shouldConnect = distance < maxDistance && Math.random() < this.options.connectionDensity;
        
        if (shouldConnect) {
          const geometry = new THREE.BufferGeometry().setFromPoints([
            nodeA.position,
            nodeB.position
          ]);
          
          const line = new THREE.Line(geometry, connectionMaterial.clone());
          line.userData = {
            nodeA: nodeA,
            nodeB: nodeB,
            baseOpacity: 0.2 + Math.random() * 0.3,
            active: Math.random() > 0.7 // Some connections are more active
          };
          
          this.networkGroup.add(line);
          this.connections.push(line);
        }
      }
    }
  }

  createCentralCore() {
    // Central glowing core (like the arc reactor center)
    const coreGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: this.getThemeColor('glow'),
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    this.centralCore = new THREE.Mesh(coreGeometry, coreMaterial);
    this.networkGroup.add(this.centralCore);

    // Outer glow ring
    const ringGeometry = new THREE.TorusGeometry(1.8, 0.1, 16, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.getThemeColor('pulse'),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    
    this.coreRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.coreRing.position.z = 0;
    this.networkGroup.add(this.coreRing);

    // Inner energy particles
    const particleCount = 30;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 1;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: this.getThemeColor('pulse'),
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    this.coreParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.networkGroup.add(this.coreParticles);
  }

  createPulseSystem() {
    // Create reusable pulse particles
    this.pulsePool = [];
    const pulseGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: this.getThemeColor('pulse'),
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });

    // Pre-create pulse objects
    for (let i = 0; i < 50; i++) {
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial.clone());
      pulse.visible = false;
      this.networkGroup.add(pulse);
      this.pulsePool.push({
        mesh: pulse,
        active: false,
        progress: 0,
        speed: 0,
        nodeA: null,
        nodeB: null
      });
    }
  }

  spawnPulse(connection) {
    // Find inactive pulse from pool
    const pulse = this.pulsePool.find(p => !p.active);
    if (!pulse) return;

    pulse.active = true;
    pulse.progress = 0;
    pulse.speed = 0.02 + Math.random() * 0.03;
    pulse.nodeA = connection.userData.nodeA;
    pulse.nodeB = connection.userData.nodeB;
    pulse.mesh.visible = true;
    pulse.mesh.material.opacity = 1;
  }

  updatePulses() {
    const activityMultiplier = this.getActivityMultiplier();
    
    this.pulsePool.forEach(pulse => {
      if (!pulse.active) return;

      pulse.progress += pulse.speed * activityMultiplier;
      
      if (pulse.progress >= 1) {
        pulse.active = false;
        pulse.mesh.visible = false;
        return;
      }

      // Interpolate position
      const start = pulse.nodeA.position;
      const end = pulse.nodeB.position;
      
      pulse.mesh.position.lerpVectors(start, end, pulse.progress);
      pulse.mesh.material.opacity = 1 - Math.abs(pulse.progress - 0.5) * 2;
      
      // Scale pulse based on progress
      const scale = 1 + Math.sin(pulse.progress * Math.PI) * 0.5;
      pulse.mesh.scale.setScalar(scale);
    });

    // Spawn new pulses based on activity
    const spawnRate = 0.05 * activityMultiplier;
    if (Math.random() < spawnRate) {
      const activeConnections = this.connections.filter(c => c.userData.active);
      if (activeConnections.length > 0) {
        const connection = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        this.spawnPulse(connection);
      }
    }
  }

  getActivityMultiplier() {
    // Combine CPU, GPU load and voice state for activity
    const cpuFactor = this.options.cpuLoad / 100;
    const gpuFactor = this.options.gpuLoad / 100;
    const voiceFactor = this.options.voiceState === 'speaking' ? 1.5 : 
                       this.options.voiceState === 'listening' ? 1.2 : 0.5;
    
    return 0.5 + (cpuFactor + gpuFactor) * 0.5 + voiceFactor * 0.3;
  }

  updateNodes(deltaTime) {
    const time = this.time;
    const activityMultiplier = this.getActivityMultiplier();
    
    this.nodes.forEach(node => {
      const data = node.userData;
      
      // Pulsing opacity
      const pulse = Math.sin(time * 2 + data.pulsePhase) * 0.3 + 0.7;
      const activityPulse = Math.sin(time * 5 * activityMultiplier) * 0.2;
      
      node.material.opacity = (data.baseOpacity * pulse + activityPulse) * this.options.activityLevel;
      
      // Scale based on activation
      const targetScale = 1 + data.activationLevel * 0.5 * activityMultiplier;
      node.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    });
  }

  updateConnections() {
    const activityMultiplier = this.getActivityMultiplier();
    
    this.connections.forEach(connection => {
      const baseOpacity = connection.userData.baseOpacity;
      const activityBoost = connection.userData.active ? activityMultiplier * 0.3 : 0;
      
      connection.material.opacity = Math.min(0.8, (baseOpacity + activityBoost) * this.options.activityLevel);
    });
  }

  updateCore(deltaTime) {
    const time = this.time;
    const activityMultiplier = this.getActivityMultiplier();
    
    // Rotate core ring
    this.coreRing.rotation.z += this.options.rotationSpeed * 2;
    this.coreRing.rotation.x = Math.sin(time * 0.5) * 0.1;
    
    // Pulse central core
    const corePulse = Math.sin(time * 3 * activityMultiplier) * 0.2 + 0.8;
    this.centralCore.scale.setScalar(1 + corePulse * 0.1);
    this.centralCore.material.opacity = 0.4 + corePulse * 0.3;
    
    // Rotate core particles
    this.coreParticles.rotation.z -= this.options.rotationSpeed * 3;
    
    // Update lights based on activity
    const lightIntensity = 0.5 + activityMultiplier * 0.8;
    this.centralLight.intensity = lightIntensity;
    this.pulseLight1.intensity = Math.sin(time * 4) * 0.5 * activityMultiplier;
    this.pulseLight2.intensity = Math.cos(time * 3) * 0.5 * activityMultiplier;
  }

  animate() {
    if (this.isDestroyed) return;

    const deltaTime = 0.016;
    this.time += deltaTime;

    // Rotate entire network slowly
    this.networkGroup.rotation.z += this.options.rotationSpeed;
    this.networkGroup.rotation.y = Math.sin(this.time * 0.2) * 0.1;

    this.updateNodes(deltaTime);
    this.updateConnections();
    this.updateCore(deltaTime);
    this.updatePulses();

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // Public methods for external control
  setActivityLevel(level) {
    this.options.activityLevel = Math.max(0, Math.min(1, level));
  }

  setCpuLoad(load) {
    this.options.cpuLoad = Math.max(0, Math.min(100, load));
  }

  setGpuLoad(load) {
    this.options.gpuLoad = Math.max(0, Math.min(100, load));
  }

  setVoiceState(state) {
    this.options.voiceState = state; // 'idle', 'listening', 'speaking'
  }

  setColorTheme(theme) {
    if (this.colorThemes[theme]) {
      this.options.colorTheme = theme;
      this.updateColors();
    }
  }

  updateColors() {
    const theme = this.colorThemes[this.options.colorTheme];
    
    // Update node colors
    this.nodes.forEach(node => {
      node.material.color.setHex(theme.node);
    });
    
    // Update connection colors
    this.connections.forEach(connection => {
      connection.material.color.setHex(theme.connection);
    });
    
    // Update pulse colors
    this.pulsePool.forEach(pulse => {
      pulse.mesh.material.color.setHex(theme.pulse);
    });
    
    // Update core colors
    this.centralCore.material.color.setHex(theme.glow);
    this.coreRing.material.color.setHex(theme.pulse);
    this.coreParticles.material.color.setHex(theme.pulse);
    this.centralLight.color.setHex(theme.glow);
    this.pulseLight1.color.setHex(theme.pulse);
    this.pulseLight2.color.setHex(theme.pulse);
  }

  setRotationSpeed(speed) {
    this.options.rotationSpeed = speed;
  }

  setPulseSpeed(speed) {
    this.options.pulseSpeed = speed;
  }

  resize() {
    if (!this.container || !this.camera || !this.renderer) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  addEventListeners() {
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
  }

  destroy() {
    this.isDestroyed = true;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    window.removeEventListener('resize', this.resizeHandler);
    
    // Clean up Three.js objects
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
