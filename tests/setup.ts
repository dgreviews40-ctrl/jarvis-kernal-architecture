/**
 * Test Setup File
 * 
 * Runs before each test file to set up the environment
 */

// Polyfill File.prototype.text() for jsdom
if (typeof File !== 'undefined' && !File.prototype.text) {
  File.prototype.text = function(): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// Polyfill Blob.prototype.text() for jsdom if needed
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function(): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// Mock crypto.subtle for tests if not available
if (typeof crypto === 'undefined' || !crypto.subtle) {
  (globalThis as any).crypto = {
    subtle: {
      digest: async () => new ArrayBuffer(32),
      importKey: async () => ({}),
      encrypt: async () => new ArrayBuffer(32),
      decrypt: async () => new ArrayBuffer(32),
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// Clean up localStorage between tests
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
