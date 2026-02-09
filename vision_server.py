#!/usr/bin/env python3
"""
JARVIS Vision Server - CLIP-based Image Analysis and Embedding

Provides GPU-accelerated image understanding:
- Generate image embeddings using CLIP
- Generate text embeddings for search
- Auto-caption images
- Tag detection

Requirements: transformers, torch, pillow, flask, flask-cors
Port: 5004
"""

import os
import sys
import io
import base64
import time
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
from collections import deque

import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

# Try to import torch and transformers
try:
    import torch
    import torch.nn.functional as F
    from transformers import (
        CLIPProcessor, 
        CLIPModel, 
        CLIPTokenizer,
        AutoProcessor,
        AutoModelForVision2Seq
    )
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    print("[WARNING] transformers/torch not installed. Vision server unavailable.")

# Configuration
MODEL_NAME = "openai/clip-vit-base-patch32"  # 512-dim embeddings
CAPTION_MODEL = "microsoft/git-base-coco"  # Image captioning
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PORT = 5004
MAX_IMAGE_SIZE = 1024  # Max dimension for input images
CACHE_SIZE = 1000

# ASCII art header (no Unicode)
HEADER = """
+============================================================+
|              JARVIS Vision Server                          |
|                 CLIP + Captioning                          |
+============================================================+
"""

@dataclass
class VisionCacheEntry:
    """Cached vision embedding result"""
    key: str
    embedding: np.ndarray
    timestamp: float
    
    def to_dict(self):
        return {
            "key": self.key,
            "embedding": self.embedding.tolist(),
            "timestamp": self.timestamp
        }

class VisionServer:
    """
    CLIP-based vision server for image understanding and search.
    """
    
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)
        
        self.clip_model = None
        self.clip_processor = None
        self.caption_model = None
        self.caption_processor = None
        self.cache: Dict[str, VisionCacheEntry] = {}
        self.request_times = deque(maxlen=100)
        
        self.setup_routes()
        
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint"""
            return jsonify({
                "status": "ok" if self.clip_model else "loading",
                "device": DEVICE,
                "model": MODEL_NAME,
                "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
                "cache_size": len(self.cache),
                "avg_request_time_ms": self.get_avg_request_time()
            })
        
        @self.app.route('/embed/image', methods=['POST'])
        def embed_image():
            """Generate embedding for an image"""
            start_time = time.time()
            
            try:
                data = request.json
                image_data = data.get('image', '')
                use_cache = data.get('use_cache', True)
                
                if not image_data:
                    return jsonify({"error": "No image provided"}), 400
                
                # Check cache
                cache_key = self.get_cache_key(image_data)
                if use_cache and cache_key in self.cache:
                    entry = self.cache[cache_key]
                    self.record_request_time(time.time() - start_time)
                    return jsonify({
                        "embedding": entry.embedding.tolist(),
                        "cached": True,
                        "time_ms": (time.time() - start_time) * 1000
                    })
                
                # Process image
                image = self.decode_image(image_data)
                embedding = self.get_image_embedding(image)
                
                # Cache result
                if use_cache:
                    self.cache[cache_key] = VisionCacheEntry(
                        key=cache_key,
                        embedding=embedding,
                        timestamp=time.time()
                    )
                
                self.record_request_time(time.time() - start_time)
                
                return jsonify({
                    "embedding": embedding.tolist(),
                    "cached": False,
                    "time_ms": (time.time() - start_time) * 1000
                })
                
            except Exception as e:
                print(f"[ERROR] embed_image: {e}")
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/embed/text', methods=['POST'])
        def embed_text():
            """Generate embedding for text (for image search)"""
            start_time = time.time()
            
            try:
                data = request.json
                text = data.get('text', '')
                
                if not text:
                    return jsonify({"error": "No text provided"}), 400
                
                embedding = self.get_text_embedding(text)
                
                self.record_request_time(time.time() - start_time)
                
                return jsonify({
                    "embedding": embedding.tolist(),
                    "time_ms": (time.time() - start_time) * 1000
                })
                
            except Exception as e:
                print(f"[ERROR] embed_text: {e}")
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/analyze', methods=['POST'])
        def analyze():
            """Full image analysis: embedding + caption + tags"""
            start_time = time.time()
            
            try:
                data = request.json
                image_data = data.get('image', '')
                
                if not image_data:
                    return jsonify({"error": "No image provided"}), 400
                
                image = self.decode_image(image_data)
                
                # Get all analysis in parallel
                embedding = self.get_image_embedding(image)
                caption = self.generate_caption(image)
                tags = self.detect_tags(image, embedding)
                
                self.record_request_time(time.time() - start_time)
                
                return jsonify({
                    "embedding": embedding.tolist(),
                    "description": caption,
                    "tags": tags,
                    "time_ms": (time.time() - start_time) * 1000
                })
                
            except Exception as e:
                print(f"[ERROR] analyze: {e}")
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/caption', methods=['POST'])
        def caption():
            """Generate caption for an image"""
            start_time = time.time()
            
            try:
                data = request.json
                image_data = data.get('image', '')
                
                if not image_data:
                    return jsonify({"error": "No image provided"}), 400
                
                image = self.decode_image(image_data)
                caption_text = self.generate_caption(image)
                
                self.record_request_time(time.time() - start_time)
                
                return jsonify({
                    "caption": caption_text,
                    "time_ms": (time.time() - start_time) * 1000
                })
                
            except Exception as e:
                print(f"[ERROR] caption: {e}")
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/similarity', methods=['POST'])
        def similarity():
            """Calculate similarity between image and text, or two images"""
            try:
                data = request.json
                image1 = data.get('image1')
                image2 = data.get('image2')
                text = data.get('text')
                
                if image1 and text:
                    # Image-text similarity
                    img = self.decode_image(image1)
                    img_emb = self.get_image_embedding(img)
                    txt_emb = self.get_text_embedding(text)
                    
                    similarity = self.cosine_similarity(img_emb, txt_emb)
                    
                elif image1 and image2:
                    # Image-image similarity
                    img1 = self.decode_image(image1)
                    img2 = self.decode_image(image2)
                    
                    emb1 = self.get_image_embedding(img1)
                    emb2 = self.get_image_embedding(img2)
                    
                    similarity = self.cosine_similarity(emb1, emb2)
                    
                else:
                    return jsonify({"error": "Provide image1+text or image1+image2"}), 400
                
                return jsonify({"similarity": float(similarity)})
                
            except Exception as e:
                print(f"[ERROR] similarity: {e}")
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/cache/clear', methods=['POST'])
        def clear_cache():
            """Clear embedding cache"""
            self.cache.clear()
            return jsonify({"status": "ok", "message": "Cache cleared"})
    
    def load_models(self):
        """Load CLIP and captioning models"""
        print("[Vision] Loading CLIP model...")
        
        # Load CLIP
        self.clip_processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        self.clip_model = CLIPModel.from_pretrained(MODEL_NAME).to(DEVICE)
        self.clip_model.eval()
        
        print(f"[Vision] CLIP loaded on {DEVICE}")
        
        # Try to load caption model
        try:
            print("[Vision] Loading caption model...")
            self.caption_processor = AutoProcessor.from_pretrained(CAPTION_MODEL)
            self.caption_model = AutoModelForVision2Seq.from_pretrained(CAPTION_MODEL).to(DEVICE)
            self.caption_model.eval()
            print("[Vision] Caption model loaded")
        except Exception as e:
            print(f"[Vision] Caption model failed: {e}")
            self.caption_model = None
    
    def decode_image(self, image_data: str) -> Image.Image:
        """Decode base64 image data to PIL Image"""
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large
        max_dim = max(image.size)
        if max_dim > MAX_IMAGE_SIZE:
            ratio = MAX_IMAGE_SIZE / max_dim
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        return image
    
    def get_image_embedding(self, image: Image.Image) -> np.ndarray:
        """Generate CLIP embedding for image"""
        with torch.no_grad():
            inputs = self.clip_processor(images=image, return_tensors="pt").to(DEVICE)
            image_features = self.clip_model.get_image_features(**inputs)
            # Normalize
            image_features = F.normalize(image_features, dim=-1)
            return image_features.cpu().numpy()[0]
    
    def get_text_embedding(self, text: str) -> np.ndarray:
        """Generate CLIP embedding for text"""
        with torch.no_grad():
            inputs = self.clip_processor(text=text, return_tensors="pt", truncation=True).to(DEVICE)
            text_features = self.clip_model.get_text_features(**inputs)
            # Normalize
            text_features = F.normalize(text_features, dim=-1)
            return text_features.cpu().numpy()[0]
    
    def generate_caption(self, image: Image.Image) -> str:
        """Generate image caption"""
        if self.caption_model is None:
            return ""
        
        try:
            with torch.no_grad():
                inputs = self.caption_processor(images=image, return_tensors="pt").to(DEVICE)
                generated_ids = self.caption_model.generate(**inputs, max_length=50)
                caption = self.caption_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                return caption.strip()
        except Exception as e:
            print(f"[WARNING] Caption generation failed: {e}")
            return ""
    
    def detect_tags(self, image: Image.Image, embedding: np.ndarray) -> List[str]:
        """Detect tags using CLIP zero-shot classification"""
        tag_candidates = [
            "photo", "screenshot", "document", "chart", "diagram",
            "person", "people", "face", "selfie", "group",
            "indoor", "outdoor", "nature", "city", "building",
            "animal", "pet", "dog", "cat", "bird",
            "food", "meal", "drink", "restaurant",
            "vehicle", "car", "transportation",
            "technology", "computer", "phone", "screen",
            "art", "drawing", "painting", "sketch",
            "text", "handwriting", "code", "interface",
            "day", "night", "sunset", "landscape"
        ]
        
        try:
            # Get text embeddings for all tags
            tag_embeddings = []
            for tag in tag_candidates:
                emb = self.get_text_embedding(f"a photo of {tag}")
                tag_embeddings.append(emb)
            
            tag_embeddings = np.array(tag_embeddings)
            
            # Calculate similarities
            similarities = np.dot(tag_embeddings, embedding)
            
            # Get top tags above threshold
            threshold = 0.25
            top_indices = np.where(similarities > threshold)[0]
            
            # Sort by similarity
            top_tags = sorted(
                [(tag_candidates[i], float(similarities[i])) for i in top_indices],
                key=lambda x: x[1],
                reverse=True
            )
            
            # Return top 5 tags
            return [tag for tag, _ in top_tags[:5]]
            
        except Exception as e:
            print(f"[WARNING] Tag detection failed: {e}")
            return []
    
    def cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        return float(np.dot(a, b))
    
    def get_cache_key(self, image_data: str) -> str:
        """Generate cache key for image"""
        import hashlib
        return hashlib.md5(image_data[:1000].encode()).hexdigest()
    
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
        
        if not HAS_TRANSFORMERS:
            print("[ERROR] Transformers/PyTorch not installed!")
            print("[ERROR] Run: pip install transformers torch pillow flask flask-cors")
            sys.exit(1)
        
        # Load models
        self.load_models()
        
        print(f"\n[Vision] Server starting on port {PORT}")
        print(f"[Vision] Device: {DEVICE}")
        if DEVICE == "cuda":
            print(f"[Vision] GPU: {torch.cuda.get_device_name(0)}")
            print(f"[Vision] VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB")
        print(f"[Vision] Endpoints:")
        print(f"  - GET  /health          - Health check")
        print(f"  - POST /embed/image     - Image embedding")
        print(f"  - POST /embed/text      - Text embedding")
        print(f"  - POST /analyze         - Full analysis")
        print(f"  - POST /caption         - Generate caption")
        print(f"  - POST /similarity      - Image-text/image similarity")
        print(f"  - POST /cache/clear     - Clear cache")
        print("")
        
        # Run Flask
        self.app.run(host='0.0.0.0', port=PORT, threaded=True)


if __name__ == '__main__':
    server = VisionServer()
    server.run()
