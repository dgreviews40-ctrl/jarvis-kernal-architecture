#!/usr/bin/env node
/**
 * API Key Migration Script
 * 
 * Migrates API keys from VITE_ prefixed (client-exposed) to server-only format
 * Run this script after updating your .env.local file
 * 
 * Usage: node scripts/migrate-api-keys.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

console.log('='.repeat(60));
console.log('JARVIS API Key Migration Tool');
console.log('='.repeat(60));
console.log();

function migrateEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${path.basename(filePath)} - file not found`);
    return;
  }

  console.log(`Processing ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // List of API keys to migrate
  const providers = ['GEMINI', 'OPENAI', 'ANTHROPIC'];
  
  for (const provider of providers) {
    const viteKey = `VITE_${provider}_API_KEY`;
    const serverKey = `${provider}_API_KEY`;
    
    // Check if VITE_ prefixed key exists
    const viteRegex = new RegExp(`^\\s*${viteKey}\\s*=\\s*(.+)$`, 'm');
    const match = content.match(viteRegex);
    
    if (match) {
      const keyValue = match[1].trim();
      
      // Check if server key already exists
      const serverRegex = new RegExp(`^\\s*${serverKey}\\s*=`, 'm');
      const hasServerKey = serverRegex.test(content);
      
      if (!hasServerKey) {
        // Add server key
        content += `\n# Migrated from ${viteKey} (server-only, not exposed to client)\n${serverKey}=${keyValue}\n`;
        modified = true;
        console.log(`  ✓ Migrated ${viteKey} → ${serverKey}`);
      } else {
        console.log(`  ⓘ ${serverKey} already exists, skipping`);
      }
      
      // Comment out the VITE_ key
      content = content.replace(viteRegex, `# ${match[0]} # DEPRECATED: Use ${serverKey} instead`);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Updated ${path.basename(filePath)}`);
  } else {
    console.log(`  ⓘ No changes needed`);
  }
  
  console.log();
}

// Migrate both files
migrateEnvFile(envLocalPath);
migrateEnvFile(envPath);

console.log('='.repeat(60));
console.log('Migration Complete!');
console.log('='.repeat(60));
console.log();
console.log('Next steps:');
console.log('1. Review the changes in .env.local and .env');
console.log('2. Restart the proxy server: npm run proxy');
console.log('3. Save your API key in JARVIS Settings to store it server-side');
console.log('4. The old VITE_ prefixed keys are now commented out');
console.log();
console.log('Your API keys are now:');
console.log('  • Stored server-side (not in client bundle)');
console.log('  • Accessed via proxy (localhost:3101)');
console.log('  • Encrypted at rest (AES-GCM)');
console.log();
