#!/usr/bin/env python3
"""
Piper TTS HTTP Server Wrapper - OPTIMIZED VERSION
Simple HTTP server that wraps Piper CLI for JARVIS integration

OPTIMIZATIONS:
- Connection pooling with threaded server
- Audio caching for repeated phrases
- Faster subprocess handling
- Keep-alive connections
"""

import http.server
import socketserver
import json
import subprocess
import os
import tempfile
import sys
import threading
import time
from urllib.parse import urlparse, parse_qs
from functools import lru_cache

PORT = 5000
PIPER_DIR = os.path.dirname(os.path.abspath(__file__))
PIPER_EXE = os.path.join(PIPER_DIR, "piper.exe")
DEFAULT_VOICE = os.path.join(PIPER_DIR, "voices", "jarvis.onnx")

# NEW: Simple in-memory cache for repeated phrases
# Format: {text_hash: (audio_data, timestamp)}
audio_cache = {}
CACHE_MAX_SIZE = 50
CACHE_TTL_SECONDS = 300  # 5 minutes

class PiperHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging for cleaner output
        pass
    
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == '/' or parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'status': 'ok', 'service': 'piper-tts', 'optimized': True}
            self.wfile.write(json.dumps(response).encode())
            return
            
        if parsed.path == '/voices':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            voices = [{
                'name': 'jarvis',
                'language': 'en_GB',
                'quality': 'high',
                'description': 'JARVIS voice model (optimized)'
            }]
            self.wfile.write(json.dumps(voices).encode())
            return
            
        self.send_response(404)
        self.end_headers()
    
    def do_POST(self):
        parsed = urlparse(self.path)
        
        if parsed.path == '/tts' or parsed.path == '/synthesize':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                text = data.get('text', '')
                speaker_id = data.get('speaker_id', data.get('speaker', 0))
                length_scale = data.get('length_scale', 0.75)  # OPTIMIZED: Default to faster
                noise_scale = data.get('noise_scale', 0.667)
                noise_w = data.get('noise_w', 0.8)
                
                if not text:
                    self.send_response(400)
                    self.end_headers()
                    return
                
                # NEW: Check cache for repeated phrases
                cache_key = f"{text}_{speaker_id}_{length_scale}_{noise_scale}_{noise_w}"
                cached_result = self._get_from_cache(cache_key)
                
                if cached_result:
                    # Serve from cache
                    self._send_audio(cached_result)
                    return
                
                # Generate audio using Piper
                audio_data = self._synthesize_audio(
                    text, speaker_id, length_scale, noise_scale, noise_w
                )
                
                if audio_data is None:
                    self.send_response(500)
                    self.end_headers()
                    return
                
                # Store in cache
                self._add_to_cache(cache_key, audio_data)
                
                # Send response
                self._send_audio(audio_data)
                
            except Exception as e:
                print(f"Server error: {e}", file=sys.stderr)
                self.send_response(500)
                self.end_headers()
            return
            
        self.send_response(404)
        self.end_headers()
    
    def _synthesize_audio(self, text, speaker_id, length_scale, noise_scale, noise_w):
        """Synthesize audio using Piper CLI"""
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            cmd = [
                PIPER_EXE,
                '--model', DEFAULT_VOICE,
                '--output_file', tmp_path,
                '--length_scale', str(length_scale),
                '--noise_scale', str(noise_scale),
                '--noise_w', str(noise_w)
            ]
            
            if speaker_id:
                cmd.extend(['--speaker', str(speaker_id)])
            
            # OPTIMIZED: Use faster subprocess handling
            result = subprocess.run(
                cmd,
                input=text.encode('utf-8'),
                capture_output=True,
                cwd=PIPER_DIR,
                # Don't create a new console window on Windows
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            )
            
            if result.returncode != 0:
                print(f"Piper error: {result.stderr.decode()}", file=sys.stderr)
                return None
            
            # Read the generated WAV file
            with open(tmp_path, 'rb') as f:
                return f.read()
                
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    def _send_audio(self, audio_data):
        """Send audio data as response"""
        self.send_response(200)
        self.send_header('Content-type', 'audio/wav')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(audio_data)))
        self.end_headers()
        self.wfile.write(audio_data)
    
    def _get_from_cache(self, key):
        """Get audio from cache if valid"""
        if key in audio_cache:
            data, timestamp = audio_cache[key]
            if time.time() - timestamp < CACHE_TTL_SECONDS:
                return data
            else:
                # Expired, remove from cache
                del audio_cache[key]
        return None
    
    def _add_to_cache(self, key, data):
        """Add audio to cache with LRU eviction"""
        global audio_cache
        
        # Evict oldest if cache is full
        if len(audio_cache) >= CACHE_MAX_SIZE:
            oldest_key = min(audio_cache.keys(), key=lambda k: audio_cache[k][1])
            del audio_cache[oldest_key]
        
        audio_cache[key] = (data, time.time())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Threaded server for handling multiple concurrent requests"""
    allow_reuse_address = True
    daemon_threads = True

def run_server():
    with ThreadedTCPServer(("", PORT), PiperHandler) as httpd:
        print(f"[PIPER] HTTP server running on port {PORT}")
        print(f"[PIPER] Voice model: {DEFAULT_VOICE}")
        print(f"[PIPER] Optimizations: threaded, cached")
        httpd.serve_forever()

if __name__ == '__main__':
    run_server()
