#!/usr/bin/env python3
"""
JARVIS CUDA Embedding Server
High-performance text embeddings using GPU acceleration

Replaces browser-based Transformers.js (CPU) with PyTorch CUDA
- 10x faster embedding generation
- Batch processing for efficiency
- Memory-efficient with 11GB VRAM management

Hardware: GTX 1080 Ti 11GB
Expected throughput: ~1000 docs/sec (vs ~100 docs/sec on CPU)
"""

import torch
import numpy as np
from sentence_transformers import SentenceTransformer
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import hashlib
import logging
from typing import List, Union
import gc

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
MODEL_NAME = "all-MiniLM-L6-v2"  # 384-dimensional embeddings
BATCH_SIZE = 32  # Process 32 texts at once
MAX_TEXT_LENGTH = 512  # Max tokens per text
PORT = 5002  # Different from Whisper (5001) and Piper (5000)

# Global model instance
model = None
device = None
embedding_cache = {}  # Simple LRU cache
CACHE_SIZE_LIMIT = 10000  # Max cached embeddings


def get_cache_key(text: str) -> str:
    """Generate cache key for text"""
    return hashlib.md5(text.encode()).hexdigest()[:16]


def manage_cache():
    """Keep cache size under control"""
    if len(embedding_cache) > CACHE_SIZE_LIMIT:
        # Remove oldest 20% of entries
        keys_to_remove = list(embedding_cache.keys())[:CACHE_SIZE_LIMIT // 5]
        for key in keys_to_remove:
            del embedding_cache[key]
        logger.info(f"Cache pruned: removed {len(keys_to_remove)} entries")


def initialize_model():
    """Load embedding model on GPU"""
    global model, device
    
    # Check CUDA availability
    if torch.cuda.is_available():
        device = "cuda"
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1e9
        logger.info(f"🚀 Using GPU: {gpu_name} ({vram_gb:.1f} GB VRAM)")
        
        # Log GPU memory before loading
        torch.cuda.empty_cache()
        allocated = torch.cuda.memory_allocated(0) / 1e9
        logger.info(f"GPU memory before model load: {allocated:.2f} GB")
    else:
        device = "cpu"
        logger.warning("⚠️  CUDA not available, using CPU (slower)")
    
    # Load model
    logger.info(f"Loading model: {MODEL_NAME}")
    start_time = time.time()
    
    model = SentenceTransformer(MODEL_NAME, device=device)
    
    load_time = time.time() - start_time
    logger.info(f"✅ Model loaded in {load_time:.2f}s")
    
    if device == "cuda":
        allocated = torch.cuda.memory_allocated(0) / 1e9
        reserved = torch.cuda.memory_reserved(0) / 1e9
        logger.info(f"GPU memory after load: {allocated:.2f} GB allocated, {reserved:.2f} GB reserved")
    
    # Warm up with dummy inference
    logger.info("Warming up GPU...")
    _ = model.encode(["warm up"], convert_to_numpy=True, show_progress_bar=False)
    logger.info("✅ Warmup complete")


def encode_texts(texts: Union[str, List[str]], use_cache: bool = True) -> np.ndarray:
    """
    Encode texts to embeddings
    
    Args:
        texts: Single text or list of texts
        use_cache: Whether to use embedding cache
    
    Returns:
        Numpy array of embeddings (shape: [N, 384])
    """
    global embedding_cache
    
    # Handle single text
    if isinstance(texts, str):
        texts = [texts]
        single_input = True
    else:
        single_input = False
    
    # Check cache for existing embeddings
    if use_cache:
        cached_results = {}
        texts_to_encode = []
        text_indices = []
        
        for i, text in enumerate(texts):
            cache_key = get_cache_key(text)
            if cache_key in embedding_cache:
                cached_results[i] = embedding_cache[cache_key]
            else:
                texts_to_encode.append(text)
                text_indices.append(i)
        
        if not texts_to_encode:
            # All cached
            embeddings = np.array([cached_results[i] for i in range(len(texts))])
            return embeddings[0] if single_input else embeddings
    else:
        texts_to_encode = texts
        text_indices = list(range(len(texts)))
    
    # Generate embeddings for non-cached texts
    if texts_to_encode:
        start_time = time.time()
        
        new_embeddings = model.encode(
            texts_to_encode,
            batch_size=BATCH_SIZE,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True  # L2 normalize
        )
        
        encode_time = (time.time() - start_time) * 1000
        logger.debug(f"Encoded {len(texts_to_encode)} texts in {encode_time:.1f}ms")
        
        # Cache new embeddings
        if use_cache:
            for i, (idx, text) in enumerate(zip(text_indices, texts_to_encode)):
                cache_key = get_cache_key(text)
                embedding_cache[cache_key] = new_embeddings[i]
            manage_cache()
        
        # Combine cached and new embeddings
        if use_cache and cached_results:
            embeddings = np.zeros((len(texts), 384), dtype=np.float32)
            for i, idx in enumerate(text_indices):
                embeddings[idx] = new_embeddings[i]
            for idx, emb in cached_results.items():
                embeddings[idx] = emb
        else:
            embeddings = new_embeddings
    else:
        embeddings = np.array([cached_results[i] for i in range(len(texts))])
    
    return embeddings[0] if single_input else embeddings


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_info = {
            "name": torch.cuda.get_device_name(0),
            "vram_total_gb": round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2),
            "vram_allocated_gb": round(torch.cuda.memory_allocated(0) / 1e9, 2),
            "vram_reserved_gb": round(torch.cuda.memory_reserved(0) / 1e9, 2),
        }
    
    return jsonify({
        "status": "healthy",
        "model": MODEL_NAME,
        "device": device,
        "cache_size": len(embedding_cache),
        "gpu": gpu_info
    })


@app.route('/embed', methods=['POST'])
def embed():
    """
    Generate embeddings for text(s)
    
    Request body:
        {
            "texts": "single text" or ["list", "of", "texts"],
            "use_cache": true (optional)
        }
    
    Response:
        {
            "embeddings": [[0.1, 0.2, ...], ...],
            "dimension": 384,
            "count": 1,
            "time_ms": 15.2
        }
    """
    start_time = time.time()
    
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                "error": "Missing 'texts' field in request body"
            }), 400
        
        texts = data['texts']
        use_cache = data.get('use_cache', True)
        
        # Validate input
        if isinstance(texts, str):
            if len(texts) > 10000:  # Reasonable limit
                return jsonify({"error": "Text too long (max 10000 chars)"}), 400
        elif isinstance(texts, list):
            if len(texts) > 1000:  # Batch limit
                return jsonify({"error": "Too many texts (max 1000)"}), 400
            texts = [t[:10000] for t in texts]  # Truncate long texts
        else:
            return jsonify({"error": "texts must be string or array"}), 400
        
        # Generate embeddings
        embeddings = encode_texts(texts, use_cache=use_cache)
        
        # Ensure 2D array for response
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return jsonify({
            "embeddings": embeddings.tolist(),
            "dimension": 384,
            "count": len(embeddings),
            "time_ms": round(elapsed_ms, 2),
            "device": device,
            "cached": use_cache
        })
        
    except Exception as e:
        logger.error(f"Error in embed: {e}")
        return jsonify({
            "error": str(e)
        }), 500


@app.route('/embed/single', methods=['POST'])
def embed_single():
    """
    Quick endpoint for single text (simpler response)
    
    Request body: {"text": "your text here"}
    """
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({"error": "Missing 'text' field"}), 400
        
        embedding = encode_texts(text)
        
        return jsonify({
            "embedding": embedding.tolist(),
            "dimension": 384
        })
        
    except Exception as e:
        logger.error(f"Error in embed_single: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/similarity', methods=['POST'])
def similarity():
    """
    Calculate cosine similarity between two texts
    
    Request body:
        {"text1": "first text", "text2": "second text"}
    
    Response:
        {"similarity": 0.85, "time_ms": 12.3}
    """
    start_time = time.time()
    
    try:
        data = request.get_json()
        text1 = data.get('text1', '')
        text2 = data.get('text2', '')
        
        if not text1 or not text2:
            return jsonify({"error": "Missing text1 or text2"}), 400
        
        # Encode both
        embeddings = encode_texts([text1, text2])
        
        # Cosine similarity (vectors are already normalized)
        similarity = np.dot(embeddings[0], embeddings[1])
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return jsonify({
            "similarity": round(float(similarity), 4),
            "time_ms": round(elapsed_ms, 2)
        })
        
    except Exception as e:
        logger.error(f"Error in similarity: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear the embedding cache"""
    global embedding_cache
    old_size = len(embedding_cache)
    embedding_cache.clear()
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    
    return jsonify({
        "message": "Cache cleared",
        "previous_size": old_size
    })


@app.route('/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics"""
    return jsonify({
        "cache_entries": len(embedding_cache),
        "cache_size_limit": CACHE_SIZE_LIMIT,
        "model": MODEL_NAME,
        "device": device
    })


def print_banner():
    """Print startup banner"""
    banner = r"""
    +============================================================+
    |            JARVIS CUDA Embedding Server                    |
    |                                                            |
    |   Model: all-MiniLM-L6-v2 (384-dim)                        |
    |   Port: 5002                                               |
    |   Hardware: GTX 1080 Ti (if available)                     |
    |                                                            |
    |   Endpoints:                                               |
    |     POST /embed        - Batch embeddings                  |
    |     POST /embed/single - Single embedding                  |
    |     POST /similarity   - Cosine similarity                 |
    |     GET  /health       - Health check                      |
    |                                                            |
    +============================================================+
    """
    print(banner)


if __name__ == '__main__':
    print_banner()
    initialize_model()
    
    logger.info(f"Starting server on port {PORT}")
    
    # Use threaded server for concurrent requests
    app.run(
        host='0.0.0.0',
        port=PORT,
        threaded=True,
        debug=False
    )
