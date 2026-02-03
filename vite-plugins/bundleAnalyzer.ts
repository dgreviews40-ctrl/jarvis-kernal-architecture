/**
 * Vite Bundle Analyzer Plugin
 * 
 * Records bundle sizes during build for performance monitoring
 */

import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';

interface BundleMetric {
  chunkName: string;
  size: number;
  gzipSize: number;
  timestamp: number;
}

interface BundleReport {
  buildTime: number;
  chunks: BundleMetric[];
  totalSize: number;
  totalGzipSize: number;
}

export function bundleAnalyzerPlugin(options: {
  outputPath?: string;
  generateReport?: boolean;
} = {}): Plugin {
  const { 
    outputPath = './dist/bundle-report.json',
    generateReport = true 
  } = options;

  const chunks: BundleMetric[] = [];
  let buildStartTime: number;

  return {
    name: 'jarvis-bundle-analyzer',
    apply: 'build',
    
    buildStart() {
      buildStartTime = Date.now();
      console.log('\n📦 Bundle Analysis Started...\n');
    },

    generateBundle(outputOptions, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          const code = chunk.code;
          const size = Buffer.byteLength(code, 'utf-8');
          const gzipSize = gzipSync(code).length;

          chunks.push({
            chunkName: fileName,
            size,
            gzipSize,
            timestamp: Date.now(),
          });

          // Log chunk info
          const sizeKB = (size / 1024).toFixed(2);
          const gzipKB = (gzipSize / 1024).toFixed(2);
          const warning = gzipSize > 1024 * 1024 ? ' ⚠️ CRITICAL' : 
                         gzipSize > 500 * 1024 ? ' ⚠️ WARNING' : '';
          
          console.log(`  ${fileName.padEnd(40)} ${sizeKB.padStart(8)}KB  →  ${gzipKB.padStart(8)}KB (gzipped)${warning}`);
        }
      }
    },

    closeBundle() {
      const buildTime = Date.now() - buildStartTime;
      const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
      const totalGzipSize = chunks.reduce((sum, c) => sum + c.gzipSize, 0);

      const report: BundleReport = {
        buildTime,
        chunks,
        totalSize,
        totalGzipSize,
      };

      // Write report
      if (generateReport) {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      }

      // Print summary
      console.log('\n' + '='.repeat(70));
      console.log('📊 Bundle Analysis Summary');
      console.log('='.repeat(70));
      console.log(`  Total Chunks:     ${chunks.length}`);
      console.log(`  Total Size:       ${(totalSize / 1024).toFixed(2)} KB`);
      console.log(`  Total (gzipped):  ${(totalGzipSize / 1024).toFixed(2)} KB`);
      console.log(`  Build Time:       ${(buildTime / 1000).toFixed(2)}s`);
      
      // Size warnings
      if (totalGzipSize > 1024 * 1024) {
        console.log('\n  ⚠️  WARNING: Total bundle size exceeds 1MB!');
        console.log('     Consider code splitting or lazy loading.');
      } else if (totalGzipSize > 500 * 1024) {
        console.log('\n  ⚠️  WARNING: Total bundle size exceeds 500KB');
        console.log('     Monitor size growth carefully.');
      } else {
        console.log('\n  ✅ Bundle size is healthy');
      }
      
      console.log('='.repeat(70) + '\n');

      // Check individual chunks
      const largeChunks = chunks.filter(c => c.gzipSize > 500 * 1024);
      if (largeChunks.length > 0) {
        console.log('⚠️  Large chunks detected:');
        largeChunks.forEach(c => {
          console.log(`   - ${c.chunkName}: ${(c.gzipSize / 1024).toFixed(2)}KB`);
        });
        console.log('');
      }
    },
  };
}

// Helper to compare with previous build
export function compareWithPreviousBuild(
  current: BundleReport, 
  previousPath: string
): { 
  sizeChange: number; 
  sizeChangePercent: number;
  newChunks: string[];
  removedChunks: string[];
  changedChunks: Array<{ name: string; oldSize: number; newSize: number; change: number }>;
} {
  if (!fs.existsSync(previousPath)) {
    return {
      sizeChange: 0,
      sizeChangePercent: 0,
      newChunks: current.chunks.map(c => c.chunkName),
      removedChunks: [],
      changedChunks: [],
    };
  }

  const previous: BundleReport = JSON.parse(fs.readFileSync(previousPath, 'utf-8'));
  const currentChunks = new Map(current.chunks.map(c => [c.chunkName, c]));
  const previousChunks = new Map(previous.chunks.map(c => [c.chunkName, c]));

  const newChunks: string[] = [];
  const removedChunks: string[] = [];
  const changedChunks: Array<{ name: string; oldSize: number; newSize: number; change: number }> = [];

  // Find new and changed chunks
  for (const [name, chunk] of currentChunks) {
    const prev = previousChunks.get(name);
    if (!prev) {
      newChunks.push(name);
    } else if (prev.gzipSize !== chunk.gzipSize) {
      changedChunks.push({
        name,
        oldSize: prev.gzipSize,
        newSize: chunk.gzipSize,
        change: chunk.gzipSize - prev.gzipSize,
      });
    }
  }

  // Find removed chunks
  for (const name of previousChunks.keys()) {
    if (!currentChunks.has(name)) {
      removedChunks.push(name);
    }
  }

  const sizeChange = current.totalGzipSize - previous.totalGzipSize;
  const sizeChangePercent = previous.totalGzipSize > 0 
    ? (sizeChange / previous.totalGzipSize) * 100 
    : 0;

  return {
    sizeChange,
    sizeChangePercent,
    newChunks,
    removedChunks,
    changedChunks,
  };
}
