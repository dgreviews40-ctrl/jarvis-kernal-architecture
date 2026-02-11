#!/usr/bin/env node

/**
 * JARVIS Plugin CLI
 * 
 * Development tools for JARVIS plugins:
 *   jarvis-plugin dev       - Start dev server with hot reload
 *   jarvis-plugin validate  - Validate plugin manifest and code
 *   jarvis-plugin build     - Build plugin for distribution
 */

import { program } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { createServer } from 'http';
import { watch } from 'fs';
import { WebSocketServer } from 'ws';

const cwd = process.cwd();
const manifestPath = path.join(cwd, 'manifest.json');

async function loadManifest() {
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red('❌ No manifest.json found. Are you in a plugin directory?'));
    process.exit(1);
  }
  return fs.readJson(manifestPath);
}

// Dev server with hot reload
async function devCommand(options) {
  const manifest = await loadManifest();
  const port = options.port || 3456;
  
  console.log(chalk.blue(`🔧 Starting dev server for ${manifest.name}...\n`));
  
  // Check for SDK
  const pkgPath = path.join(cwd, 'package.json');
  const hasSdk = await fs.pathExists(pkgPath) && 
    (await fs.readJson(pkgPath)).dependencies?.['@jarvis/sdk'];
  
  if (!hasSdk) {
    console.log(chalk.yellow('⚠️  @jarvis/sdk not found. Run: npm install @jarvis/sdk\n'));
  }
  
  // Create HTTP server for serving plugin files
  const server = createServer(async (req, res) => {
    const url = req.url === '/' ? '/manifest.json' : req.url;
    const filePath = path.join(cwd, url);
    
    // Security: only serve files from plugin directory
    if (!filePath.startsWith(cwd)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    try {
      const content = await fs.readFile(filePath);
      const ext = path.extname(filePath);
      const contentType = {
        '.json': 'application/json',
        '.js': 'application/javascript',
        '.ts': 'application/typescript',
        '.html': 'text/html',
        '.css': 'text/css',
      }[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  // WebSocket for hot reload
  const wss = new WebSocketServer({ server });
  const clients = new Set();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });
  
  // Watch for changes
  const watcher = watch(cwd, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('node_modules')) {
      console.log(chalk.gray(`📝 ${eventType}: ${filename}`));
      clients.forEach(ws => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'reload', file: filename }));
        }
      });
    }
  });
  
  server.listen(port, () => {
    console.log(chalk.green(`✅ Dev server running at http://localhost:${port}`));
    console.log(chalk.white('\nIn JARVIS, install from:'));
    console.log(chalk.cyan(`  http://localhost:${port}`));
    console.log(chalk.gray('\nPress Ctrl+C to stop\n'));
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\n🛑 Shutting down...'));
    watcher.close();
    server.close();
    process.exit(0);
  });
}

// Validate plugin
async function validateCommand() {
  console.log(chalk.blue('🔍 Validating plugin...\n'));
  
  const manifest = await loadManifest();
  const errors = [];
  const warnings = [];
  
  // Required fields
  const required = ['id', 'name', 'version', 'engineVersion', 'entry'];
  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // ID format
  if (manifest.id && !/^[a-z0-9][a-z0-9.-]*$/.test(manifest.id)) {
    errors.push('Invalid plugin ID format (use lowercase, numbers, dots, hyphens)');
  }
  
  // Version format
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Invalid version format (expected semver like 1.0.0)');
  }
  
  // Entry points
  if (manifest.entry && !manifest.entry.background && !manifest.entry.ui) {
    errors.push('Plugin must have at least one entry point (background or ui)');
  }
  
  // Check if entry files exist
  if (manifest.entry?.background) {
    const bgPath = path.join(cwd, 'src', manifest.entry.background);
    if (!await fs.pathExists(bgPath)) {
      warnings.push(`Background entry not found: ${manifest.entry.background}`);
    }
  }
  
  if (manifest.entry?.ui) {
    const uiPath = path.join(cwd, 'src', manifest.entry.ui);
    if (!await fs.pathExists(uiPath)) {
      warnings.push(`UI entry not found: ${manifest.entry.ui}`);
    }
  }
  
  // SDK usage
  const pkgPath = path.join(cwd, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    if (!pkg.dependencies?.['@jarvis/sdk']) {
      warnings.push('Consider using @jarvis/sdk for better developer experience');
    }
  }
  
  // Results
  if (errors.length === 0 && warnings.length === 0) {
    console.log(chalk.green('✅ Plugin is valid!\n'));
  } else {
    if (errors.length > 0) {
      console.log(chalk.red('❌ Errors:'));
      errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
      console.log();
    }
    if (warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Warnings:'));
      warnings.forEach(w => console.log(chalk.yellow(`  • ${w}`)));
      console.log();
    }
  }
  
  process.exit(errors.length > 0 ? 1 : 0);
}

// Build plugin
async function buildCommand() {
  console.log(chalk.blue('📦 Building plugin...\n'));
  
  const manifest = await loadManifest();
  const distDir = path.join(cwd, 'dist');
  
  // Clean/create dist
  await fs.ensureDir(distDir);
  await fs.emptyDir(distDir);
  
  // Copy manifest
  await fs.copy(manifestPath, path.join(distDir, 'manifest.json'));
  
  // Copy src files (in real build, would transpile)
  const srcDir = path.join(cwd, 'src');
  if (await fs.pathExists(srcDir)) {
    await fs.copy(srcDir, path.join(distDir, 'src'));
  }
  
  // Copy package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    await fs.copy(pkgPath, path.join(distDir, 'package.json'));
  }
  
  console.log(chalk.green(`✅ Built ${manifest.name} v${manifest.version}`));
  console.log(chalk.gray(`   Output: ${distDir}\n`));
}

program
  .name('jarvis-plugin')
  .description('JARVIS Plugin Development CLI')
  .version('1.0.0');

program
  .command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port number', '3456')
  .action(devCommand);

program
  .command('validate')
  .description('Validate plugin manifest and code')
  .action(validateCommand);

program
  .command('build')
  .description('Build plugin for distribution')
  .action(buildCommand);

program.parse();
