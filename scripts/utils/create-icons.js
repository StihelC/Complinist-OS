#!/usr/bin/env node
// Script to create application icons from CompliNIST logo

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', 'build');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Copy PNG for Linux (already done, but ensure it exists)
const pngSource = path.join(publicDir, 'CompliNISTLogo.png');
const pngDest = path.join(buildDir, 'icon.png');

if (fs.existsSync(pngSource)) {
  fs.copyFileSync(pngSource, pngDest);
  console.log('✅ Created build/icon.png for Linux');
} else {
  console.error('❌ CompliNISTLogo.png not found in public/');
  process.exit(1);
}

// For Windows ICO, electron-builder can convert PNG to ICO automatically
// But we can also try to create it if png-to-ico is available
try {
  const pngToIco = (await import('png-to-ico')).default;
  const icoDest = path.join(buildDir, 'icon.ico');
  
  pngToIco(pngSource)
    .then(buf => {
      fs.writeFileSync(icoDest, buf);
      console.log('✅ Created build/icon.ico for Windows');
      console.log('✅ Icons setup complete!');
    })
    .catch(err => {
      console.warn('⚠️  Could not create ICO file (electron-builder will convert PNG automatically):', err.message);
      console.log('ℹ️  electron-builder can convert PNG to ICO automatically, so this is OK');
      console.log('✅ Icons setup complete!');
    });
} catch (err) {
  console.log('ℹ️  png-to-ico not available - electron-builder will convert PNG to ICO automatically');
  console.log('✅ Icons setup complete!');
}

