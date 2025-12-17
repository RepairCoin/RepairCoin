/**
 * Clean .next directory before build (Windows-safe)
 *
 * This script handles the common EPERM error on Windows where
 * the .next/trace file gets locked by running processes.
 *
 * It attempts to:
 * 1. Kill any node processes that might be locking files
 * 2. Wait briefly for file handles to release
 * 3. Remove the .next directory with retries
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nextDir = path.join(__dirname, '..', '.next');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeWithRetry(dir, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
        console.log('✓ Cleaned .next directory');
      }
      return true;
    } catch (error) {
      if (i < retries - 1) {
        console.log(`Retry ${i + 1}/${retries}: Waiting for file handles to release...`);
        await sleep(2000);
      } else {
        console.warn('⚠ Could not fully clean .next directory, but build may still work');
        // Try to at least remove the problematic trace file
        try {
          const traceFile = path.join(dir, 'trace');
          if (fs.existsSync(traceFile)) {
            fs.unlinkSync(traceFile);
            console.log('✓ Removed .next/trace file');
          }
        } catch (e) {
          // Ignore - build might still work
        }
        return false;
      }
    }
  }
}

async function main() {
  console.log('Preparing for build...');

  // On Windows, try to release file handles
  if (process.platform === 'win32') {
    try {
      // This is a soft approach - just wait a moment for any file handles to release
      await sleep(500);
    } catch (e) {
      // Ignore errors
    }
  }

  await removeWithRetry(nextDir);
  console.log('Ready to build!\n');
}

main().catch(console.error);
