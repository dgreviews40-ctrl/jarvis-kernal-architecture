#!/usr/bin/env python3
"""
JARVIS LoRA Training Server - Local Fine-Tuning for Personalization

Provides GPU-accelerated LoRA (Low-Rank Adaptation) fine-tuning:
- Train small adapters (MBs, not GBs) on your 1080 Ti
- Personalize on conversation history
- Learn user preferences and writing style
- Train on user documents

Requirements: torch, transformers, peft, datasets, accelerate
Port: 5005
"""

import os
import sys
import json
import time
import uuid
import shutil
import re
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from collections import deque
import threading

# Dependency verification
def check_dependencies():
    """Verify all required dependencies are installed."""
    missing = []
    
    try:
        import torch
    except ImportError:
        missing.append("torch")
    
    try:
        import transformers
    except ImportError:
        missing.append("transformers")
    
    try:
        import peft
    except ImportError:
        missing.append("peft")
    
    try:
        from flask import Flask, request, jsonify
        from flask_cors import CORS
    except ImportError:
        missing.append("flask flask-cors")
    
    if missing:
        print("=" * 60)
        print("ERROR: Missing required dependencies:")
        for dep in missing:
            print(f"  - {dep}")
        print("\nInstall with: pip install " + " ".join(missing))
        print("=" * 60)
        sys.exit(1)
    
    return True

# Run dependency check
check_dependencies()

# Now import after verification
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    print("[WARNING] PyTorch not installed. LoRA server unavailable.")

try:
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
        Trainer,
        TrainerCallback,
        DataCollatorForLanguageModeling
    )
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    print("[WARNING] Transformers not installed.")

try:
    from peft import (
        LoraConfig,
        get_peft_model,
        PeftModel,
        TaskType,
        prepare_model_for_kbit_training
    )
    HAS_PEFT = True
except ImportError:
    HAS_PEFT = False
    print("[WARNING] PEFT not installed.")

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False
    print("[WARNING] Flask not installed.")

# Configuration
PORT = 5005
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DEFAULT_MODEL = "unsloth/Llama-3.2-1B-Instruct"  # Small, efficient base model
ADAPTERS_DIR = Path("adapters")
MAX_ADAPTERS = 10
MAX_GPU_MEMORY_GB = 8  # Leave some VRAM for other processes
MAX_REQUEST_SIZE_MB = 50  # Maximum request size
MAX_TRAINING_EXAMPLES = 1000  # Max examples per training job
MAX_EXAMPLE_LENGTH = 2000  # Max characters per example
ALLOWED_MODEL_NAME_PATTERN = re.compile(r'^[\w\-\/\.]+$')  # Valid model name pattern

# Model size estimation (approximate VRAM requirements in GB)
MODEL_VRAM_ESTIMATES = {
    '1B': 2,
    '2B': 4,
    '3B': 5,
    '3.2B': 5,
    '4B': 6,
    '7B': 8,
    '8B': 10,
    '13B': 16,
    '70B': 40,
}

def estimate_vram_requirement(model_name: str) -> float:
    """Estimate VRAM requirement for a model based on its name"""
    model_lower = model_name.lower()
    
    # Try to extract parameter size from model name
    import re
    match = re.search(r'(\d+\.?\d*)(b|B|billion)', model_lower)
    if match:
        size_str = match.group(1)
        try:
            size = float(size_str)
            # Rough estimate: ~1.5GB per billion parameters in 8-bit mode
            return size * 1.5
        except ValueError:
            pass
    
    # Check for known models
    if '1b' in model_lower or '1-b' in model_lower:
        return 2
    elif '3b' in model_lower or '3-b' in model_lower or '3.2' in model_lower:
        return 5
    elif '7b' in model_lower or '7-b' in model_lower:
        return 8
    elif '8b' in model_lower or '8-b' in model_lower:
        return 10
    elif '13b' in model_lower or '13-b' in model_lower:
        return 16
    elif '70b' in model_lower or '70-b' in model_lower:
        return 40
    
    return 8  # Default estimate

# ASCII art header
HEADER = """
+============================================================+
|              JARVIS LoRA Training Server                   |
|            Local Fine-Tuning & Personalization             |
+============================================================+
"""


@dataclass
class LoRAAdapter:
    """Represents a trained LoRA adapter"""
    id: str
    name: str
    base_model: str
    description: str
    created_at: str
    updated_at: str
    training_examples: int
    status: str  # 'ready', 'training', 'error'
    loss: Optional[float] = None
    adapter_path: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "base_model": self.base_model,
            "description": self.description,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "training_examples": self.training_examples,
            "status": self.status,
            "loss": self.loss,
            "adapter_path": self.adapter_path,
            "metadata": self.metadata or {}
        }


@dataclass
class TrainingJob:
    """Represents an ongoing training job"""
    id: str
    adapter_id: str
    status: str  # 'pending', 'running', 'completed', 'failed', 'cancelled'
    progress: float  # 0-100
    current_epoch: int
    total_epochs: int
    current_loss: Optional[float]
    start_time: Optional[str]
    end_time: Optional[str]
    error_message: Optional[str]
    # Extended status for better UX
    phase: str = 'initializing'  # 'initializing', 'downloading', 'loading', 'training', 'saving'
    phase_message: str = ''  # Human-readable status message
    download_progress: float = 0.0  # 0-100 for model download
    download_total_mb: float = 0.0  # Total MB to download
    download_current_mb: float = 0.0  # Current MB downloaded
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "adapter_id": self.adapter_id,
            "status": self.status,
            "progress": round(self.progress, 2),
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "current_loss": self.current_loss,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "error_message": self.error_message,
            "phase": self.phase,
            "phase_message": self.phase_message,
            "download_progress": round(self.download_progress, 2),
            "download_total_mb": round(self.download_total_mb, 2),
            "download_current_mb": round(self.download_current_mb, 2)
        }


class ConversationDataset(Dataset):
    """Dataset for training on conversation history"""
    
    def __init__(self, conversations: List[Dict], tokenizer, max_length: int = 512):
        self.conversations = conversations
        self.tokenizer = tokenizer
        self.max_length = max_length
        
    def __len__(self):
        return len(self.conversations)
    
    def __getitem__(self, idx):
        conv = self.conversations[idx]
        
        # Format: "User: {input}\nAssistant: {output}"
        text = f"User: {conv.get('input', '')}\nAssistant: {conv.get('output', '')}"
        
        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding='max_length',
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].squeeze(),
            'attention_mask': encoding['attention_mask'].squeeze(),
            'labels': encoding['input_ids'].squeeze()
        }


class LoRATrainingServer:
    """
    LoRA Fine-Tuning Server for JARVIS personalization.
    """
    
    def __init__(self):
        self.app = Flask(__name__)
        self.app.config['MAX_CONTENT_LENGTH'] = MAX_REQUEST_SIZE_MB * 1024 * 1024
        CORS(self.app)
        
        self.adapters: Dict[str, LoRAAdapter] = {}
        self.jobs: Dict[str, TrainingJob] = {}
        self.current_job: Optional[TrainingJob] = None
        self.training_thread: Optional[threading.Thread] = None
        self.stop_training = False
        
        # Model cache
        self.base_model = None
        self.base_tokenizer = None
        self.current_adapter_model = None
        self.last_model_used: Optional[str] = None  # Track which model is loaded
        
        # Auto-unload settings (unload after 5 minutes of inactivity)
        self.auto_unload_timeout = 300  # 5 minutes in seconds
        self.last_generation_time = 0
        self.unload_timer: Optional[threading.Timer] = None
        self.unload_lock = threading.Lock()
        
        # Metrics
        self.request_times = deque(maxlen=100)
        
        # Ensure adapters directory exists
        ADAPTERS_DIR.mkdir(exist_ok=True)
        
        self.load_adapters()
        self.setup_routes()
    
    def validate_model_name(self, model_name: str) -> tuple[bool, str]:
        """Validate model name for security."""
        if not model_name or not isinstance(model_name, str):
            return False, "Model name is required"
        
        if len(model_name) > 100:
            return False, "Model name too long (max 100 characters)"
        
        if not ALLOWED_MODEL_NAME_PATTERN.match(model_name):
            return False, "Invalid model name format"
        
        return True, ""
    
    def validate_training_examples(self, examples: List[Dict]) -> tuple[bool, str]:
        """Validate training examples."""
        if not isinstance(examples, list):
            return False, "Examples must be a list"
        
        if len(examples) > MAX_TRAINING_EXAMPLES:
            return False, f"Too many examples. Maximum: {MAX_TRAINING_EXAMPLES}"
        
        for i, example in enumerate(examples):
            if not isinstance(example, dict):
                return False, f"Example {i} must be an object"
            
            input_text = example.get('input', '')
            output_text = example.get('output', '')
            
            if not isinstance(input_text, str) or not isinstance(output_text, str):
                return False, f"Example {i}: input and output must be strings"
            
            if len(input_text) > MAX_EXAMPLE_LENGTH:
                return False, f"Example {i}: input too long (max {MAX_EXAMPLE_LENGTH} chars)"
            
            if len(output_text) > MAX_EXAMPLE_LENGTH:
                return False, f"Example {i}: output too long (max {MAX_EXAMPLE_LENGTH} chars)"
        
        return True, ""
    
    def validate_adapter_name(self, name: str) -> tuple[bool, str]:
        """Validate adapter name."""
        if not name or not isinstance(name, str):
            return False, "Adapter name is required"
        
        if len(name) > 50:
            return False, "Adapter name too long (max 50 characters)"
        
        # Only allow alphanumeric, spaces, and basic punctuation
        if not re.match(r'^[\w\s\-\.]+$', name):
            return False, "Invalid adapter name format"
        
        return True, ""
    
    def _schedule_unload(self):
        """Schedule automatic model unload after timeout"""
        with self.unload_lock:
            # Cancel any existing timer
            if self.unload_timer:
                self.unload_timer.cancel()
            
            # Don't unload if currently training
            if self.current_job and self.current_job.status == 'running':
                return
            
            # Start new timer
            self.unload_timer = threading.Timer(
                self.auto_unload_timeout, 
                self._auto_unload_model
            )
            self.unload_timer.daemon = True
            self.unload_timer.start()
            print(f"[LoRA] Model will unload in {self.auto_unload_timeout}s if unused")
    
    def _auto_unload_model(self):
        """Automatically unload model to free GPU memory"""
        with self.unload_lock:
            # Check if enough time has passed since last generation
            time_since_last = time.time() - self.last_generation_time
            
            if time_since_last < self.auto_unload_timeout:
                # Was used recently, reschedule
                remaining = self.auto_unload_timeout - time_since_last
                self.unload_timer = threading.Timer(remaining, self._auto_unload_model)
                self.unload_timer.daemon = True
                self.unload_timer.start()
                return
            
            # Don't unload if training is active
            if self.current_job and self.current_job.status == 'running':
                print("[LoRA] Auto-unload skipped: training in progress")
                return
            
            # Unload the model
            if self.base_model is not None or self.current_adapter_model is not None:
                print("[LoRA] Auto-unloading model to free GPU memory...")
                self._unload_model()
                print("[LoRA] Model unloaded. GPU memory freed.")
    
    def _unload_model(self):
        """Unload model from GPU memory"""
        import gc
        
        if self.current_adapter_model is not None:
            del self.current_adapter_model
            self.current_adapter_model = None
        
        if self.base_model is not None:
            del self.base_model
            self.base_model = None
        
        # Force garbage collection
        gc.collect()
        
        # Clear GPU cache
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
    
    def _update_last_used(self):
        """Update timestamp and schedule unload"""
        self.last_generation_time = time.time()
        self._schedule_unload()
    
    def setup_routes(self):
        """Setup Flask API routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint"""
            gpu_info = None
            if torch.cuda.is_available():
                gpu_info = {
                    "name": torch.cuda.get_device_name(0),
                    "total_memory_gb": torch.cuda.get_device_properties(0).total_memory / 1e9,
                    "allocated_gb": torch.cuda.memory_allocated(0) / 1e9,
                    "reserved_gb": torch.cuda.memory_reserved(0) / 1e9
                }
            
            # Calculate time until auto-unload
            time_until_unload = None
            if self.base_model is not None and self.last_generation_time > 0:
                elapsed = time.time() - self.last_generation_time
                if elapsed < self.auto_unload_timeout:
                    time_until_unload = round(self.auto_unload_timeout - elapsed)
            
            return jsonify({
                "status": "ok" if HAS_TORCH and HAS_PEFT else "unavailable",
                "device": DEVICE,
                "gpu": gpu_info,
                "adapters_count": len(self.adapters),
                "current_job": self.current_job.to_dict() if self.current_job else None,
                "avg_request_time_ms": self.get_avg_request_time(),
                "model_loaded": self.base_model is not None,
                "loaded_adapter": self.last_model_used,
                "auto_unload_timeout": self.auto_unload_timeout,
                "time_until_unload_seconds": time_until_unload
            })
        
        @self.app.route('/adapters', methods=['GET'])
        def list_adapters():
            """List all adapters"""
            return jsonify({
                "adapters": [a.to_dict() for a in self.adapters.values()]
            })
        
        @self.app.route('/adapters', methods=['POST'])
        def create_adapter():
            """Create a new adapter"""
            if not request.is_json:
                return jsonify({"error": "Content-Type must be application/json"}), 415
            
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify({"error": "Invalid JSON payload"}), 400
            
            name = data.get('name', 'Unnamed Adapter')
            description = data.get('description', '')
            base_model = data.get('base_model', DEFAULT_MODEL)
            
            # Validate adapter name
            is_valid, error_msg = self.validate_adapter_name(name)
            if not is_valid:
                return jsonify({"error": error_msg}), 400
            
            # Validate model name
            is_valid, error_msg = self.validate_model_name(base_model)
            if not is_valid:
                return jsonify({"error": error_msg}), 400
            
            # Check if it's an Ollama model (doesn't contain '/')
            is_ollama_model = '/' not in base_model
            
            # Check adapter limit
            if len(self.adapters) >= MAX_ADAPTERS:
                return jsonify({
                    "error": f"Maximum number of adapters reached ({MAX_ADAPTERS}). Delete an existing adapter first."
                }), 400
            
            adapter_id = str(uuid.uuid4())[:8]
            adapter = LoRAAdapter(
                id=adapter_id,
                name=name,
                base_model=base_model,
                description=description[:500] if isinstance(description, str) else '',  # Limit description length
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
                training_examples=0,
                status='initialized',
                adapter_path=str(ADAPTERS_DIR / adapter_id),
                metadata={
                    'is_ollama_model': is_ollama_model,
                    'warning': 'Ollama model selected. Make sure this model is compatible with Hugging Face transformers.' if is_ollama_model else None
                }
            )
            
            self.adapters[adapter_id] = adapter
            self.save_adapter_config(adapter)
            
            return jsonify({
                "success": True,
                "adapter": adapter.to_dict()
            })
        
        @self.app.route('/adapters/<adapter_id>', methods=['GET'])
        def get_adapter(adapter_id):
            """Get adapter details"""
            if adapter_id not in self.adapters:
                return jsonify({"error": "Adapter not found"}), 404
            
            return jsonify({"adapter": self.adapters[adapter_id].to_dict()})
        
        @self.app.route('/adapters/<adapter_id>', methods=['DELETE'])
        def delete_adapter(adapter_id):
            """Delete an adapter"""
            if adapter_id not in self.adapters:
                return jsonify({"error": "Adapter not found"}), 404
            
            adapter = self.adapters[adapter_id]
            
            # Delete adapter files
            if adapter.adapter_path and Path(adapter.adapter_path).exists():
                shutil.rmtree(adapter.adapter_path)
            
            del self.adapters[adapter_id]
            
            # Delete config file
            config_path = ADAPTERS_DIR / f"{adapter_id}.json"
            if config_path.exists():
                config_path.unlink()
            
            return jsonify({"success": True, "message": "Adapter deleted"})
        
        @self.app.route('/unload', methods=['POST'])
        def unload_model():
            """Manually unload model from GPU to free memory"""
            if self.current_job and self.current_job.status == 'running':
                return jsonify({
                    "success": False,
                    "message": "Cannot unload while training is in progress"
                }), 409
            
            self._unload_model()
            
            # Cancel any pending unload timer
            with self.unload_lock:
                if self.unload_timer:
                    self.unload_timer.cancel()
                    self.unload_timer = None
            
            return jsonify({
                "success": True,
                "message": "Model unloaded. GPU memory freed."
            })
        
        @self.app.route('/config', methods=['GET', 'POST'])
        def config():
            """Get or set server configuration"""
            if request.method == 'GET':
                return jsonify({
                    "auto_unload_timeout": self.auto_unload_timeout,
                    "device": DEVICE,
                    "model_loaded": self.base_model is not None
                })
            
            # POST - update config
            data = request.json or {}
            if 'auto_unload_timeout' in data:
                new_timeout = int(data['auto_unload_timeout'])
                if new_timeout >= 60:  # Minimum 1 minute
                    self.auto_unload_timeout = new_timeout
                    return jsonify({
                        "success": True,
                        "auto_unload_timeout": self.auto_unload_timeout
                    })
                else:
                    return jsonify({
                        "error": "auto_unload_timeout must be at least 60 seconds"
                    }), 400
            
            return jsonify({"success": True})
        
        @self.app.route('/train', methods=['POST'])
        def start_training():
            """Start a training job"""
            if not request.is_json:
                return jsonify({"error": "Content-Type must be application/json"}), 415
            
            if self.current_job and self.current_job.status == 'running':
                return jsonify({
                    "error": "Training already in progress",
                    "current_job": self.current_job.to_dict()
                }), 409
            
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                return jsonify({"error": "Invalid JSON payload"}), 400
            
            adapter_id = data.get('adapter_id')
            training_data = data.get('training_data', [])
            config = data.get('config', {})
            
            if not adapter_id or adapter_id not in self.adapters:
                return jsonify({"error": "Invalid adapter ID"}), 400
            
            if not training_data:
                return jsonify({"error": "No training data provided"}), 400
            
            # Validate training examples
            is_valid, error_msg = self.validate_training_examples(training_data)
            if not is_valid:
                return jsonify({"error": error_msg}), 400
            
            # Validate config parameters
            if not isinstance(config, dict):
                return jsonify({"error": "Config must be an object"}), 400
            
            epochs = config.get('epochs', 3)
            if not isinstance(epochs, int) or epochs < 1 or epochs > 20:
                return jsonify({"error": "Epochs must be an integer between 1 and 20"}), 400
            
            # Create training job
            job_id = str(uuid.uuid4())[:8]
            job = TrainingJob(
                id=job_id,
                adapter_id=adapter_id,
                status='pending',
                progress=0.0,
                current_epoch=0,
                total_epochs=config.get('epochs', 3),
                current_loss=None,
                start_time=None,
                end_time=None,
                error_message=None,
                phase='initializing',
                phase_message='Preparing training...'
            )
            
            self.jobs[job_id] = job
            self.current_job = job
            
            # Start training in background thread
            self.stop_training = False
            self.training_thread = threading.Thread(
                target=self._training_worker,
                args=(job, training_data, config)
            )
            self.training_thread.start()
            
            return jsonify({
                "success": True,
                "job": job.to_dict()
            })
        
        @self.app.route('/train/<job_id>', methods=['GET'])
        def get_job_status(job_id):
            """Get training job status"""
            if job_id not in self.jobs:
                return jsonify({"error": "Job not found"}), 404
            
            return jsonify({"job": self.jobs[job_id].to_dict()})
        
        @self.app.route('/train/<job_id>/cancel', methods=['POST'])
        def cancel_training(job_id):
            """Cancel a training job"""
            if job_id not in self.jobs:
                return jsonify({"error": "Job not found"}), 404
            
            job = self.jobs[job_id]
            if job.status not in ['running', 'pending']:
                return jsonify({"error": f"Job is already {job.status}"}), 400
            
            self.stop_training = True
            job.status = 'cancelled'
            job.end_time = datetime.now().isoformat()
            
            return jsonify({"success": True, "job": job.to_dict()})
        
        @self.app.route('/generate', methods=['POST'])
        def generate():
            """Generate text with an adapter"""
            start_time = time.time()
            
            try:
                data = request.json
                adapter_id = data.get('adapter_id')
                prompt = data.get('prompt', '')
                max_tokens = data.get('max_tokens', 256)
                temperature = data.get('temperature', 0.7)
                
                if not adapter_id or adapter_id not in self.adapters:
                    return jsonify({"error": "Invalid adapter ID"}), 400
                
                adapter = self.adapters[adapter_id]
                if adapter.status != 'ready':
                    return jsonify({"error": "Adapter not ready"}), 400
                
                # Generate with adapter
                result = self.generate_with_adapter(
                    adapter_id, prompt, max_tokens, temperature
                )
                
                self.record_request_time(time.time() - start_time)
                
                return jsonify({
                    "text": result,
                    "time_ms": (time.time() - start_time) * 1000
                })
                
            except Exception as e:
                print(f"[ERROR] Generate failed: {e}")
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/jobs', methods=['GET'])
        def list_jobs():
            """List all training jobs"""
            return jsonify({
                "jobs": [j.to_dict() for j in self.jobs.values()],
                "current_job": self.current_job.to_dict() if self.current_job else None
            })
    
    def _training_worker(self, job: TrainingJob, training_data: List[Dict], config: Dict):
        """Background worker for training"""
        try:
            job.status = 'running'
            job.start_time = datetime.now().isoformat()
            
            adapter = self.adapters[job.adapter_id]
            adapter.status = 'training'
            
            # Training parameters
            epochs = config.get('epochs', 3)
            batch_size = config.get('batch_size', 4)
            learning_rate = config.get('learning_rate', 2e-4)
            lora_r = config.get('lora_r', 16)
            lora_alpha = config.get('lora_alpha', 32)
            
            job.total_epochs = epochs
            
            # Check if model might be too large for GPU
            if torch.cuda.is_available():
                vram_estimate = estimate_vram_requirement(adapter.base_model)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                # 8-bit quantization reduces memory by ~50%, so we can fit larger models
                vram_with_8bit = vram_estimate * 0.6  # 8-bit uses ~60% of FP16 memory
                print(f"[LoRA] Model VRAM estimate: {vram_estimate:.1f}GB (FP16), ~{vram_with_8bit:.1f}GB (8-bit), Available GPU memory: {gpu_memory:.1f}GB")
                
                if vram_with_8bit > gpu_memory * 0.95:
                    raise MemoryError(
                        f"Model {adapter.base_model} requires ~{vram_estimate:.1f}GB VRAM (FP16) or "
                        f"~{vram_with_8bit:.1f}GB (8-bit), but your GPU only has {gpu_memory:.1f}GB. "
                        f"Please use a smaller model (e.g., unsloth/Llama-3.2-1B-Instruct)"
                    )
            
            # Load base model and tokenizer
            job.phase = 'downloading'
            job.phase_message = f'Downloading {adapter.base_model} from Hugging Face...'
            print(f"[LoRA] Loading base model: {adapter.base_model}")
            self._load_base_model(adapter.base_model, job)
            
            # Setup LoRA config
            print(f"[LoRA] Setting up LoRA config (r={lora_r}, alpha={lora_alpha})")
            lora_config = LoraConfig(
                r=lora_r,
                lora_alpha=lora_alpha,
                target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
                lora_dropout=0.05,
                bias="none",
                task_type=TaskType.CAUSAL_LM
            )
            
            # Get PEFT model
            job.phase = 'loading'
            job.phase_message = 'Setting up LoRA adapters...'
            
            # Check if model is 8-bit and prepare accordingly
            is_8bit = hasattr(self.base_model, 'is_loaded_in_8bit') and self.base_model.is_loaded_in_8bit
            
            if is_8bit:
                print("[LoRA] Preparing 8-bit model for training...")
                model = prepare_model_for_kbit_training(self.base_model)
            else:
                model = self.base_model
                if torch.cuda.is_available():
                    model = model.to(DEVICE)
            
            model = get_peft_model(model, lora_config)
            model.print_trainable_parameters()
            
            # Prepare dataset
            job.phase = 'loading'
            job.phase_message = 'Preparing training data...'
            dataset = ConversationDataset(training_data, self.base_tokenizer)
            
            # Training arguments
            training_args = TrainingArguments(
                output_dir=adapter.adapter_path,
                num_train_epochs=epochs,
                per_device_train_batch_size=batch_size,
                learning_rate=learning_rate,
                logging_steps=10,
                save_strategy="epoch",
                fp16=torch.cuda.is_available(),
                gradient_accumulation_steps=4,
                warmup_steps=10,
                weight_decay=0.01,
            )
            
            # Custom callback for progress
            class ProgressCallback(TrainerCallback):
                def __init__(self, job_ref, server_ref, total_epochs_ref):
                    self.job = job_ref
                    self.server = server_ref
                    self.total_epochs = total_epochs_ref
                
                def on_train_begin(self, args, state, control, **kwargs):
                    """Called at the beginning of training"""
                    self.job.phase = 'training'
                    self.job.phase_message = f'Starting training...'
                    return control
                
                def on_epoch_begin(self, args, state, control, **kwargs):
                    """Called at the beginning of each epoch"""
                    self.job.current_epoch = int(state.epoch) + 1
                    self.job.phase_message = f'Training epoch {self.job.current_epoch}/{self.total_epochs}...'
                    return control
                
                def on_log(self, args, state, control, logs=None, **kwargs):
                    """Called when logs are available"""
                    if logs and 'loss' in logs:
                        self.job.current_loss = logs['loss']
                        adapter.loss = logs['loss']
                    if state.max_steps > 0:
                        self.job.progress = (state.global_step / state.max_steps) * 100
                    
                    if self.server.stop_training:
                        control.should_training_stop = True
                    return control
                
                def on_train_end(self, args, state, control, **kwargs):
                    """Called at the end of training"""
                    self.job.progress = 100.0
                    return control
            
            # Create trainer
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=dataset,
                data_collator=DataCollatorForLanguageModeling(
                    self.base_tokenizer, mlm=False
                ),
            )
            
            # Add callback
            progress_callback = ProgressCallback(job, self, epochs)
            trainer.add_callback(progress_callback)
            
            # Train
            job.phase = 'training'
            job.phase_message = f'Training epoch 1/{epochs}...'
            print(f"[LoRA] Starting training for {epochs} epochs...")
            
            try:
                trainer.train()
            except RuntimeError as e:
                error_msg = str(e).lower()
                # Handle meta device gradient error by falling back to FP16
                if 'meta' in error_msg and ('gradient' in error_msg or 'backward' in error_msg or 'device' in error_msg):
                    print("[LoRA] 8-bit training failed with device error. Retrying with FP16...")
                    job.phase_message = 'Retrying with FP16 (8-bit incompatible)...'
                    
                    # Clear cache and reload model in FP16
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                    
                    # Reload base model in FP16
                    print("[LoRA] Reloading model in FP16 mode...")
                    del model
                    del trainer
                    self.base_model = None
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                    
                    # Load in FP16
                    self.base_model = AutoModelForCausalLM.from_pretrained(
                        adapter.base_model,
                        torch_dtype=torch.float16,
                        low_cpu_mem_usage=False
                    )
                    if torch.cuda.is_available():
                        self.base_model = self.base_model.to(DEVICE)
                    
                    # Recreate PEFT model
                    model = get_peft_model(self.base_model, lora_config)
                    model.print_trainable_parameters()
                    
                    # Recreate trainer
                    trainer = Trainer(
                        model=model,
                        args=training_args,
                        train_dataset=dataset,
                        data_collator=DataCollatorForLanguageModeling(
                            self.base_tokenizer, mlm=False
                        ),
                    )
                    progress_callback = ProgressCallback(job, self, epochs)
                    trainer.add_callback(progress_callback)
                    
                    # Retry training
                    print("[LoRA] Retrying training with FP16...")
                    trainer.train()
                else:
                    raise
            
            # Save adapter
            job.phase = 'saving'
            job.phase_message = 'Saving trained adapter...'
            print(f"[LoRA] Saving adapter to {adapter.adapter_path}")
            model.save_pretrained(adapter.adapter_path)
            self.base_tokenizer.save_pretrained(adapter.adapter_path)
            
            # Update adapter status
            adapter.status = 'ready'
            adapter.training_examples = len(training_data)
            adapter.updated_at = datetime.now().isoformat()
            self.save_adapter_config(adapter)
            
            job.status = 'completed'
            job.progress = 100.0
            job.end_time = datetime.now().isoformat()
            
            print(f"[LoRA] Training completed successfully!")
            
        except Exception as e:
            import traceback
            error_msg = f"{type(e).__name__}: {str(e)}"
            print(f"[ERROR] Training failed: {error_msg}")
            traceback.print_exc()
            job.status = 'failed'
            job.end_time = datetime.now().isoformat()
            
            # Provide helpful error messages for common failures
            error_str = str(e).lower()
            if 'out of memory' in error_str or 'cuda' in error_str and 'memory' in error_str:
                job.error_message = (
                    f"GPU out of memory. The model is too large for your GPU. "
                    f"Try: 1) Smaller model (1B or 3B), 2) Reduce batch size to 1, "
                    f"3) Close other GPU apps. Original error: {str(e)[:100]}"
                )
            elif 'connection' in error_str or 'timeout' in error_str or 'ssl' in error_str:
                job.error_message = (
                    f"Download failed - check internet connection. "
                    f"The model files couldn't be downloaded from Hugging Face. "
                    f"Original error: {str(e)[:100]}"
                )
            elif 'permission' in error_str:
                job.error_message = f"Permission denied - check file permissions. Error: {str(e)[:100]}"
            else:
                job.error_message = f"{type(e).__name__}: {str(e)[:200]}"
            
            adapter = self.adapters.get(job.adapter_id)
            if adapter:
                adapter.status = 'error'
                # Store error message in metadata for UI display
                if adapter.metadata is None:
                    adapter.metadata = {}
                adapter.metadata['error_message'] = job.error_message
                adapter.metadata['error_time'] = datetime.now().isoformat()
                self.save_adapter_config(adapter)
        
        finally:
            self.current_job = None
            # Clear GPU cache
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
    
    def _load_base_model(self, model_name: str, job: Optional[TrainingJob] = None):
        """Load base model and tokenizer with progress tracking"""
        if self.base_model is None or self.base_model.config.name_or_path != model_name:
            print(f"[LoRA] Loading {model_name}...")
            
            if job:
                job.phase = 'downloading'
                job.phase_message = f'Downloading {model_name}... (this may take several minutes)'
            
            self.base_tokenizer = AutoTokenizer.from_pretrained(model_name)
            if self.base_tokenizer.pad_token is None:
                self.base_tokenizer.pad_token = self.base_tokenizer.eos_token
            
            if job:
                job.phase = 'loading'
                job.phase_message = 'Loading model into GPU memory...'
                job.download_progress = 100.0
            
            # Load in 8-bit if GPU available to save VRAM
            if torch.cuda.is_available():
                try:
                    # Use BitsAndBytesConfig for 8-bit loading (transformers 4.30+)
                    from transformers import BitsAndBytesConfig
                    quantization_config = BitsAndBytesConfig(load_in_8bit=True)
                    
                    self.base_model = AutoModelForCausalLM.from_pretrained(
                        model_name,
                        quantization_config=quantization_config,
                        torch_dtype=torch.float16,
                        low_cpu_mem_usage=False  # Prevent meta tensor issues
                    )
                except Exception as e:
                    print(f"[LoRA] 8-bit loading failed ({e}), falling back to FP16")
                    if job:
                        job.phase_message = 'Loading model (FP16 mode)...'
                    self.base_model = AutoModelForCausalLM.from_pretrained(
                        model_name,
                        torch_dtype=torch.float16,
                        low_cpu_mem_usage=False
                    )
            else:
                self.base_model = AutoModelForCausalLM.from_pretrained(model_name)
            
            print(f"[LoRA] Model loaded successfully")
    
    def generate_with_adapter(
        self,
        adapter_id: str,
        prompt: str,
        max_tokens: int = 256,
        temperature: float = 0.7
    ) -> str:
        """Generate text using a trained adapter"""
        adapter = self.adapters[adapter_id]
        
        # Load base model if needed
        self._load_base_model(adapter.base_model)
        
        # Load adapter (cache it if same adapter requested again)
        if self.current_adapter_model is None or self.last_model_used != adapter_id:
            print(f"[LoRA] Loading adapter: {adapter.name}")
            self.current_adapter_model = PeftModel.from_pretrained(self.base_model, adapter.adapter_path)
            self.last_model_used = adapter_id
        
        self.current_adapter_model.eval()
        
        # Tokenize
        inputs = self.base_tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(DEVICE)
        
        # Generate
        with torch.no_grad():
            outputs = self.current_adapter_model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.base_tokenizer.pad_token_id
            )
        
        # Decode
        generated_text = self.base_tokenizer.decode(
            outputs[0][inputs['input_ids'].shape[1]:],
            skip_special_tokens=True
        )
        
        # Update last used time and schedule auto-unload
        self._update_last_used()
        
        return generated_text.strip()
    
    def load_adapters(self):
        """Load adapter configurations from disk"""
        if not ADAPTERS_DIR.exists():
            return
        
        for config_file in ADAPTERS_DIR.glob("*.json"):
            try:
                with open(config_file, 'r') as f:
                    data = json.load(f)
                
                adapter = LoRAAdapter(**data)
                self.adapters[adapter.id] = adapter
                print(f"[LoRA] Loaded adapter: {adapter.name} ({adapter.id})")
            except Exception as e:
                print(f"[WARNING] Failed to load adapter from {config_file}: {e}")
    
    def save_adapter_config(self, adapter: LoRAAdapter):
        """Save adapter configuration to disk"""
        config_path = ADAPTERS_DIR / f"{adapter.id}.json"
        with open(config_path, 'w') as f:
            json.dump(adapter.to_dict(), f, indent=2)
    
    def record_request_time(self, duration: float):
        """Record request duration for metrics"""
        self.request_times.append(duration)
    
    def get_avg_request_time(self) -> float:
        """Get average request time in ms"""
        if not self.request_times:
            return 0
        return (sum(self.request_times) / len(self.request_times)) * 1000
    
    def run(self):
        """Start the server"""
        print(HEADER)
        
        if not (HAS_TORCH and HAS_PEFT and HAS_FLASK):
            print("[ERROR] Required dependencies not installed!")
            print("[ERROR] Run: pip install torch transformers peft flask flask-cors")
            sys.exit(1)
        
        print(f"\n[LoRA] Server starting on port {PORT}")
        print(f"[LoRA] Device: {DEVICE}")
        print(f"[LoRA] Adapters directory: {ADAPTERS_DIR.absolute()}")
        print(f"[LoRA] Loaded {len(self.adapters)} adapters")
        
        if torch.cuda.is_available():
            print(f"[LoRA] GPU: {torch.cuda.get_device_name(0)}")
            print(f"[LoRA] VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB")
        
        print(f"\n[LoRA] Endpoints:")
        print(f"  - GET  /health                - Health check")
        print(f"  - GET  /adapters              - List adapters")
        print(f"  - POST /adapters              - Create adapter")
        print(f"  - GET  /adapters/<id>         - Get adapter details")
        print(f"  - DELETE /adapters/<id>       - Delete adapter")
        print(f"  - POST /train                 - Start training")
        print(f"  - GET  /train/<job_id>        - Get job status")
        print(f"  - POST /train/<job_id>/cancel - Cancel training")
        print(f"  - GET  /jobs                  - List all jobs")
        print(f"  - POST /generate              - Generate with adapter")
        print(f"  - POST /unload                - Unload model from GPU")
        print(f"  - GET/POST /config            - Get/set config (auto_unload_timeout)")
        print(f"\n[LoRA] Auto-unload: {self.auto_unload_timeout}s of inactivity")
        print("")
        
        # Run Flask
        self.app.run(host='0.0.0.0', port=PORT, threaded=True)


if __name__ == '__main__':
    server = LoRATrainingServer()
    server.run()
