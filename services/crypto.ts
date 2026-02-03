/**
 * Web Crypto API based encryption for sensitive data
 * 
 * Features:
 * - AES-GCM encryption for API keys
 * - PBKDF2 key derivation
 * - Secure random IV generation
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

/**
 * Derive encryption key from password
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt sensitive data
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(data)
  );
  
  // Combine salt + iv + ciphertext
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Base64 encode for storage
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt sensitive data
 */
export async function decrypt(encryptedData: string, password: string): Promise<string | null> {
  try {
    const decoder = new TextDecoder();
    const data = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );
    
    // Extract salt, iv, and ciphertext
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const ciphertext = data.slice(28);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );
    
    return decoder.decode(decrypted);
  } catch (e) {
    console.error('[Crypto] Decryption failed:', e);
    return null;
  }
}

/**
 * Simple obfuscation for non-critical data (fallback)
 * Note: This is NOT secure, just prevents casual inspection
 */
export function obfuscate(data: string): string {
  return btoa(data.split('').reverse().join(''));
}

export function deobfuscate(data: string): string | null {
  try {
    return atob(data).split('').reverse().join('');
  } catch {
    return null;
  }
}
