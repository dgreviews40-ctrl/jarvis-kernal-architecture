import { BootPhase, BootState } from "../types";

export const BOOT_PHASES: BootPhase[] = [
  { 
    id: 0, 
    name: "SYSTEM CHECK", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Verifying Admin Privileges...",
      "Checking Write Access: C:\\ProgramData\\Jarvis",
      "Validating Environment Variables"
    ] 
  },
  { 
    id: 1, 
    name: "KERNEL MOUNT", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Initializing Event Bus...",
      "Mounting Logger (level: DEBUG)",
      "Loading Exception Handlers"
    ] 
  },
  { 
    id: 2, 
    name: "CORTEX LINK", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Connecting to Vector Store...",
      "Indexing Memory Fragments...",
      "Hydrating User Context"
    ] 
  },
  { 
    id: 3, 
    name: "NEURAL BRIDGE", 
    criticality: "LOW", 
    status: "PENDING", 
    logs: [
      "Pinging Gemini API...",
      "Checking Ollama Local Interface...",
      "Calibrating Intent Weights"
    ] 
  },
  { 
    id: 4, 
    name: "PERIPHERALS", 
    criticality: "LOW", 
    status: "PENDING", 
    logs: [
      "Spawning audio.exe adapter...",
      "Spawning camera.exe adapter...",
      "Handshaking IPC Pipes"
    ] 
  },
  { 
    id: 5, 
    name: "INTERFACE", 
    criticality: "HIGH", 
    status: "PENDING", 
    logs: [
      "Opening Localhost HTTP Server...",
      "Binding WebSocket Port 8080...",
      "Unlocking Dashboard UI"
    ] 
  }
];

class BootOrchestrator {
  private currentPhaseIndex = 0;
  private subscribers: ((phase: BootPhase, state: BootState) => void)[] = [];
  private isBooting = false;

  public subscribe(cb: (phase: BootPhase, state: BootState) => void) {
    this.subscribers.push(cb);
  }

  private notify(phase: BootPhase, state: BootState) {
    this.subscribers.forEach(cb => cb(phase, state));
  }

  public async startSequence() {
    if (this.isBooting) return; // Prevent double boot
    this.isBooting = true;
    this.currentPhaseIndex = 0;
    
    for (let i = 0; i < BOOT_PHASES.length; i++) {
      // Fix: Explicitly type the object so 'status' is mutable within the union type
      const phase: BootPhase = { ...BOOT_PHASES[i], status: 'IN_PROGRESS' };
      this.notify(phase, BootState.PHASE_BOOT);

      // Simulate varying processing times
      const processingTime = Math.random() * 800 + 400;
      await new Promise(r => setTimeout(r, processingTime));

      // Simulate success (mostly)
      phase.status = 'SUCCESS';
      
      // Special logic for API check simulation
      if (phase.name === "NEURAL BRIDGE") {
         if (!process.env.API_KEY) {
             phase.logs.push("WARNING: API Key missing. Degraded mode active.");
         }
      }

      this.notify(phase, BootState.PHASE_BOOT);
    }

    this.notify(BOOT_PHASES[BOOT_PHASES.length - 1], BootState.RUNNING);
    this.isBooting = false;
  }
}

export const bootLoader = new BootOrchestrator();