#!/usr/bin/env python3
"""
Fixed Whisper STT Server for JARVIS - OPTIMIZED VERSION
Local speech-to-text using OpenAI Whisper
Optimized for GPU (CUDA) if available

FIXES:
- Better error handling for 500 errors
- Improved audio format compatibility
- Enhanced debugging for transcription issues
- Proper temporary file cleanup
"""

import whisper
import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import os
import torch
import time
import wave
import io
import numpy as np
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Configuration - OPTIMIZED for speed
MODEL_SIZE = "small"  # Options: tiny, base, small, medium, large
# 'small' provides better accuracy for wake word detection while still being fast on GPU
PORT = 5001

# Check for CUDA
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Loading Whisper model '{MODEL_SIZE}' on {DEVICE}...")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA device: {torch.cuda.get_device_name(0)}")

try:
    # Load model with optimizations
    model = whisper.load_model(MODEL_SIZE).to(DEVICE)

    # OPTIMIZATION: Compile model for PyTorch 2.0+ (significant speedup)
    if hasattr(torch, 'compile') and DEVICE == "cuda":
        try:
            print("Compiling model for faster inference...")
            model = torch.compile(model)
            print("Model compiled successfully!")
        except Exception as e:
            print(f"Model compilation not available: {e}")

    print("Model loaded successfully!")

    # OPTIMIZATION: Warm up the model with a dummy inference
    if DEVICE == "cuda":
        print("Warming up GPU...")
        dummy_audio = torch.randn(16000).cuda()  # 1 second of audio
        with torch.no_grad():
            _ = model.transcribe(dummy_audio, language='en', fp16=True)
        print("GPU warmed up!")
        
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@app.route('/health', methods=['GET'])
def health():
    if model is None:
        return jsonify({
            "status": "error",
            "model": MODEL_SIZE,
            "device": DEVICE,
            "cuda_available": torch.cuda.is_available(),
            "error": "Model failed to load"
        }), 500
    
    return jsonify({
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available()
    })

def convert_opus_to_pcm(opus_data):
    """Convert Opus-encoded data to PCM format for Whisper"""
    try:
        # This is a simplified conversion - in practice, you'd need a proper decoder
        # For now, we'll just return the raw data and let Whisper handle it
        return opus_data
    except Exception as e:
        print(f"Error converting Opus to PCM: {e}")
        return opus_data

@app.route('/transcribe', methods=['POST'])
def transcribe():
    start_time = time.time()

    # Validate request
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "No audio file selected"}), 400

    # Validate file type
    filename = secure_filename(audio_file.filename)
    if not filename.lower().endswith(('.wav', '.mp3', '.flac', '.webm', '.m4a', '.ogg')):
        return jsonify({"error": f"Unsupported file type: {filename}"}), 400

    language = request.form.get('language', 'en')
    partial = request.form.get('partial', 'false').lower() == 'true'

    # Save to temp file with proper extension
    file_ext = os.path.splitext(filename)[1]
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        # Check if file exists and has content
        if not tmp_path or not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            return jsonify({"error": "Uploaded file is empty"}), 400

        # IMPROVED: Transcribe with accuracy-focused parameters for wake word detection
        result = model.transcribe(
            tmp_path,
            language=language,
            fp16=(DEVICE == "cuda"),  # Use fp16 on GPU for speed
            temperature=0.0,  # More deterministic, faster
            condition_on_previous_text=True,  # Better continuity
            initial_prompt="This is a voice command to an AI assistant named Jarvis. Wake word: Jarvis.",
            suppress_tokens="-1",  # Suppress special tokens
            # IMPROVED: Better accuracy settings for wake word detection
            best_of=3 if DEVICE == "cuda" else 1,  # Sample more candidates for accuracy
            beam_size=3 if DEVICE == "cuda" else 1,  # Beam search for better accuracy
            patience=1.5,  # Increase patience for beam search
            compression_ratio_threshold=2.4,  # Filter out repetitive gibberish
            logprob_threshold=-1.0,  # Filter out low-confidence results
            no_speech_threshold=0.3,  # Lower threshold to catch quiet speech
        )

        text = result["text"].strip()

        # Determine if this looks like a complete utterance
        is_final = text.endswith(('.', '!', '?')) if text else False

        processing_time = time.time() - start_time
        print(f"Transcribed in {processing_time:.2f}s: {text}")

        response = {
            "text": text,
            "language": language,
            "device": DEVICE,
            "processing_time": round(processing_time, 3),
            "isFinal": is_final
        }

        # Add partial result info if requested
        if partial:
            response["isPartial"] = not is_final

        return jsonify(response)

    except Exception as e:
        processing_time = time.time() - start_time
        print(f"Transcription error after {processing_time:.2f}s: {e}")
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                print(f"Warning: Could not delete temp file {tmp_path}: {e}")

@app.route('/transcribe-stream', methods=['POST'])
def transcribe_stream():
    """
    EXPERIMENTAL: Streaming transcription endpoint
    For future WebSocket or chunked transfer implementation
    """
    # This is a placeholder for future streaming implementation
    return jsonify({"error": "Streaming not yet implemented"}), 501

if __name__ == '__main__':
    if model is None:
        print("ERROR: Server cannot start because model failed to load.")
        exit(1)
    
    print(f"\n{'='*50}")
    print(f"Whisper STT Server starting on port {PORT}")
    print(f"Model: {MODEL_SIZE} | Device: {DEVICE}")
    print(f"{'='*50}\n")

    # OPTIMIZATION: Use threaded server for concurrent requests
    app.run(host='0.0.0.0', port=PORT, threaded=True, debug=False)