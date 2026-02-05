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
    const pulseGeometry = new THREE.SphereGeometry(0.06, 8, 8);

    for (let i = 0; i < 40; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      
      const pulse = new THREE.Mesh(pulseGeometry, material.clone());
      pulse.visible = false;
      this.meshGroup.add(pulse);
      
      this.pulsePool.push({
        mesh: pulse,
        active: false,
        progress: 0,
        speed: 0,
        connection: null
      });
    }
  }

  spawnPulse(connection) {
    const pulse = this.pulsePool.find(p => !p.active);
    if (!pulse) return;

    pulse.active = true;
    pulse.progress = 0;
    pulse.speed = 0.015 + Math.random() * 0.02;
    pulse.connection = connection;
    pulse.mesh.visible = true;
    pulse.mesh.material.color.copy(connection.nodeA.color);
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

      const start = pulse.connection.nodeA.mesh.position;
      const end = pulse.connection.nodeB.mesh.position;
      
      pulse.mesh.position.lerpVectors(start, end, pulse.progress);
      
      // Fade in then out
      const fadeIn = Math.min(1, pulse.progress * 3);
      const fadeOut = Math.min(1, (1 - pulse.progress) * 3);
      pulse.mesh.material.opacity = Math.min(fadeIn, fadeOut);
      
      // Color interpolation
      pulse.mesh.material.color.copy(
        pulse.connection.nodeA.color.clone().lerp(pulse.connection.nodeB.color, pulse.progress)
      );
    });

    // Spawn new pulses
    const spawnRate = 0.03 * activityMultiplier;
    if (Math.random() < spawnRate) {
      const activeConnections = this.connections.filter(c => c.active);
      if (activeConnections.length > 0) {
        const conn = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        this.spawnPulse(conn);
      }
    }
  }

  getActivityMultiplier() {
    const cpuFactor = this.options.cpuLoad / 100;
    const gpuFactor = this.options.gpuLoad / 100;
    const voiceFactor = this.options.voiceState === 'speaking' ? 1.8 : 
                       this.options.voiceState === 'listening' ? 1.4 : 0.6;
    
    return 0.5 + (cpuFactor + gpuFactor) * 0.6 + voiceFactor * 0.4;
  }

  updateNodes(deltaTime) {
    const time = this.time;
    const activityMultiplier = this.getActivityMultiplier();

    this.nodes.forEach(node => {
      // Wave animation
      const waveX = Math.sin(time * 0.5 + node.originalPos.x * 0.3) * 0.3;
      const waveZ = Math.cos(time * 0.4 + node.originalPos.z * 0.3) * 0.3;
      const waveY = Math.sin(time * 0.6 + node.ring * 0.5) * 0.2;

      node.mesh.position.y = node.originalPos.y + waveY;
      node.mesh.position.x = node.originalPos.x + waveX * (node.ring / this.options.gridSize);
      node.mesh.position.z = node.originalPos.z + waveZ * (node.ring / this.options.gridSize);

      // Pulsing size
      const pulse = Math.sin(time * 3 + node.pulsePhase) * 0.3 + 1;
      const activityPulse = Math.sin(time * 5 * activityMultiplier + node.ring) * 0.2;
      const scale = (pulse + activityPulse) * this.options.activityLevel;
      
      node.mesh.scale.setScalar(scale);
      
      // Opacity pulse
      node.mesh.material.opacity = (0.6 + Math.sin(time * 2 + node.pulsePhase) * 0.3) * this.options.activityLevel;
      node.glow.material.opacity = (0.4 + Math.sin(time * 2 + node.pulsePhase) * 0.2) * this.options.activityLevel;

      // Color shift based on activity
      if (activityMultiplier > 1.2) {
        const shift = (Math.sin(time * 4) + 1) * 0.5;
        node.mesh.material.color.copy(node.color).lerp(new THREE.Color(0xffffff), shift * 0.3);
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
    
    this.lights.forEach(({ light, basePos, phase }) => {
      light.position.x = basePos[0] + Math.sin(time * 0.5 + phase) * 2;
      light.position.y = basePos[1] + Math.cos(time * 0.3 + phase) * 2;
      light.intensity = 0.6 + Math.sin(time * 2 + phase) * 0.3;
    });
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
