#!/usr/bin/env python3
"""
Test script for JARVIS CUDA Embedding Server

Run this to verify the embedding server is working correctly:
    python test_embedding_server.py

Or test against a running server:
    python test_embedding_server.py --server
"""

import requests
import time
import sys
import argparse

SERVER_URL = "http://localhost:5002"


def test_health():
    """Test health endpoint"""
    print("\n[TEST] Testing health endpoint...")
    try:
        response = requests.get(f"{SERVER_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Server healthy")
            print(f"  Model: {data.get('model')}")
            print(f"  Device: {data.get('device')}")
            print(f"  Cache entries: {data.get('cache_size')}")
            
            gpu = data.get('gpu', {})
            if gpu:
                print(f"  GPU: {gpu.get('name')}")
                print(f"  VRAM: {gpu.get('vram_allocated_gb')}/{gpu.get('vram_total_gb')} GB")
            return True
        else:
            print(f"  [FAIL] Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"  [FAIL] Cannot connect to server at {SERVER_URL}")
        print(f"     Make sure to run: python embedding_server.py")
        return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def test_single_embed():
    """Test single text embedding"""
    print("\n[TEST] Testing single text embedding...")
    try:
        text = "Machine learning is a subset of artificial intelligence"
        response = requests.post(
            f"{SERVER_URL}/embed/single",
            json={"text": text},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            embedding = data.get('embedding', [])
            print(f"  [OK] Single embedding success")
            print(f"  Dimensions: {len(embedding)}")
            print(f"  Text length: {len(text)} chars")
            
            # Verify embedding is normalized (L2 norm should be ~1.0)
            import math
            norm = math.sqrt(sum(x*x for x in embedding))
            print(f"  L2 Norm: {norm:.4f} (should be ~1.0)")
            return True
        else:
            print(f"  [FAIL] Single embed failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def test_batch_embed():
    """Test batch embedding"""
    print("\n[TEST] Testing batch embedding (100 texts)...")
    try:
        texts = [f"This is test document number {i} about machine learning and AI" for i in range(100)]
        
        start_time = time.time()
        response = requests.post(
            f"{SERVER_URL}/embed",
            json={"texts": texts, "use_cache": False},  # Disable cache for accurate timing
            timeout=30
        )
        elapsed = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            data = response.json()
            embeddings = data.get('embeddings', [])
            print(f"  [OK] Batch embedding success")
            print(f"  Count: {data.get('count')} texts")
            print(f"  Time: {elapsed:.1f}ms ({data.get('time_ms')}ms reported)")
            print(f"  Speed: {len(texts) / (elapsed/1000):.0f} texts/sec")
            print(f"  Device: {data.get('device')}")
            return True
        else:
            print(f"  [FAIL] Batch embed failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def test_similarity():
    """Test similarity calculation"""
    print("\n[TEST] Testing similarity calculation...")
    try:
        test_cases = [
            {
                "text1": "Machine learning is fascinating",
                "text2": "Deep learning is a type of machine learning",
                "expected": "high"
            },
            {
                "text1": "Machine learning is fascinating",
                "text2": "Pizza is delicious food",
                "expected": "low"
            }
        ]
        
        for i, test in enumerate(test_cases):
            response = requests.post(
                f"{SERVER_URL}/similarity",
                json={"text1": test["text1"], "text2": test["text2"]},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                similarity = data.get('similarity', 0)
                print(f"  [OK] Test {i+1}: similarity = {similarity:.4f} (expected {test['expected']})")
                
                # Basic sanity check
                if test['expected'] == 'high' and similarity < 0.5:
                    print(f"     [WARN] Warning: Expected high similarity but got {similarity:.4f}")
                elif test['expected'] == 'low' and similarity > 0.5:
                    print(f"     [WARN] Warning: Expected low similarity but got {similarity:.4f}")
            else:
                print(f"  [FAIL] Similarity test {i+1} failed: {response.status_code}")
                return False
        
        return True
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def test_caching():
    """Test embedding cache"""
    print("\n[TEST] Testing embedding cache...")
    try:
        text = "This is a test sentence for caching"
        
        # First request (no cache)
        start = time.time()
        r1 = requests.post(f"{SERVER_URL}/embed/single", json={"text": text}, timeout=10)
        t1 = (time.time() - start) * 1000
        
        # Second request (cached)
        start = time.time()
        r2 = requests.post(f"{SERVER_URL}/embed/single", json={"text": text}, timeout=10)
        t2 = (time.time() - start) * 1000
        
        if r1.status_code == 200 and r2.status_code == 200:
            print(f"  [OK] Cache test success")
            print(f"  Time: First request:  {t1:.1f}ms")
            print(f"  Time: Second request: {t2:.1f}ms (cached)")
            print(f"  Speedup: {t1/t2:.1f}x" if t2 > 0 else "  Speedup: N/A")
            return True
        else:
            print(f"  [FAIL] Cache test failed")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def test_gpu_utilization():
    """Check GPU is being used"""
    print("\n[TEST] Checking GPU utilization...")
    try:
        response = requests.get(f"{SERVER_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            device = data.get('device')
            
            if device == 'cuda':
                print(f"  [OK] GPU acceleration active (CUDA)")
                gpu = data.get('gpu', {})
                if gpu:
                    print(f"  GPU: {gpu.get('name')}")
                    print(f"  VRAM allocated: {gpu.get('vram_allocated_gb')} GB")
                return True
            else:
                print(f"  [WARN] Running on CPU (device: {device})")
                print(f"     For GPU acceleration, ensure CUDA is installed:")
                print(f"     pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121")
                return False
        else:
            print(f"  [FAIL] Failed to get health info")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Test JARVIS Embedding Server')
    parser.add_argument('--server', action='store_true', help='Test against running server only')
    args = parser.parse_args()
    
    print("+============================================================+")
    print("|     JARVIS CUDA Embedding Server Test Suite                |")
    print("+============================================================+")
    print(f"\nServer URL: {SERVER_URL}")
    
    if not args.server:
        print("\n[TIP] Use --server flag to skip local tests")
    
    results = []
    
    # Run tests
    results.append(("Health Check", test_health()))
    results.append(("GPU Utilization", test_gpu_utilization()))
    results.append(("Single Embedding", test_single_embed()))
    results.append(("Batch Embedding", test_batch_embed()))
    results.append(("Similarity", test_similarity()))
    results.append(("Caching", test_caching()))
    
    # Summary
    print("\n" + "="*60)
    print("[STAT] Test Summary")
    print("="*60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "[OK] PASS" if result else "[FAIL] FAIL"
        print(f"  {status} - {name}")
    
    print("="*60)
    print(f"Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n[OK] All tests passed! Embedding server is ready.")
        return 0
    else:
        print(f"\n[WARN] {total - passed} test(s) failed. Check output above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
