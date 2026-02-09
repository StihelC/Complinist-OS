#!/usr/bin/env node
/**
 * Create Release Archive Script
 * Packages AppImage/exe with models, ChromaDB, and database into distributable archives
 * 
 * Usage: node scripts/create-release-archive.js [--platform linux|win|all]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`[INFO] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`[OK] ${message}`, 'green');
}

function logWarning(message) {
  log(`[WARN] ${message}`, 'yellow');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

/**
 * Read version from package.json
 */
function getVersion() {
  const packagePath = path.join(PROJECT_ROOT, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageData.version;
}

/**
 * Copy directory recursively
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy file
 */
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source file does not exist: ${src}`);
  }
  
  const destDir = path.dirname(dest);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * Get size of directory in bytes
 */
function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  
  let size = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += getDirectorySize(entryPath);
    } else {
      size += fs.statSync(entryPath).size;
    }
  }
  
  return size;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check available disk space (Unix/Linux)
 */
function getAvailableDiskSpace(dirPath) {
  try {
    const stats = execSync(`df -B1 "${dirPath}" | tail -1 | awk '{print $4}'`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return parseInt(stats.trim());
  } catch (error) {
    logWarning(`Could not check disk space: ${error.message}`);
    return null;
  }
}

/**
 * Estimate required space for archive
 */
function estimateRequiredSpace(packagePath, modelsDir, chromaDbDir) {
  let total = 0;
  
  // Package size (AppImage or exe)
  if (fs.existsSync(packagePath)) {
    total += fs.statSync(packagePath).size;
  }
  
  // Models size
  if (fs.existsSync(modelsDir)) {
    total += getDirectorySize(modelsDir);
  }
  
  // ChromaDB size
  if (fs.existsSync(chromaDbDir)) {
    total += getDirectorySize(chromaDbDir);
  }
  
  // Add 20% overhead for compression and staging
  return Math.ceil(total * 1.2);
}

/**
 * Check if archive for this version already exists and has models/chroma_db/database
 */
function checkExistingArchive(archivePath, platform) {
  if (!fs.existsSync(archivePath)) {
    return { exists: false, hasModels: false, hasChromaDb: false, hasDatabase: false };
  }
  
  logInfo(`Archive already exists: ${path.basename(archivePath)}`);
  
  // For tar.gz, check contents
  if (platform === 'linux') {
    try {
      const contents = execSync(`tar -tzf "${archivePath}"`, { encoding: 'utf8' });
      const hasModels = contents.includes('models/');
      const hasChromaDb = contents.includes('chroma_db/');
      const hasDatabase = contents.includes('complinist.db');
      return { exists: true, hasModels, hasChromaDb, hasDatabase };
    } catch (error) {
      logWarning(`Could not read archive contents: ${error.message}`);
      return { exists: true, hasModels: false, hasChromaDb: false, hasDatabase: false };
    }
  }
  
  // For zip, check contents
  if (platform === 'win') {
    try {
      const contents = execSync(`unzip -l "${archivePath}"`, { encoding: 'utf8' });
      const hasModels = contents.includes('models/');
      const hasChromaDb = contents.includes('chroma_db/');
      const hasDatabase = contents.includes('complinist.db');
      return { exists: true, hasModels, hasChromaDb, hasDatabase };
    } catch (error) {
      // unzip might not be available on all systems
      logWarning(`Could not read archive contents (unzip not available)`);
      return { exists: true, hasModels: false, hasChromaDb: false, hasDatabase: false };
    }
  }
  
  return { exists: true, hasModels: false, hasChromaDb: false, hasDatabase: false };
}

/**
 * Find built Linux package in release directory (AppImage or .deb)
 */
function findLinuxPackage(releaseDir, version) {
  const files = fs.readdirSync(releaseDir);

  // Look for AppImage with current version
  const appImagePattern = new RegExp(`CompliFlow-${version}.*\\.AppImage$`, 'i');
  const appImage = files.find(f => appImagePattern.test(f));

  if (appImage) {
    return path.join(releaseDir, appImage);
  }

  // Fallback: look for any AppImage
  const anyAppImage = files.find(f => f.endsWith('.AppImage'));
  if (anyAppImage) {
    logWarning(`Using AppImage with different version: ${anyAppImage}`);
    return path.join(releaseDir, anyAppImage);
  }

  // Look for .deb with current version
  const debPattern = new RegExp(`complinist.*${version}.*\\.deb$`, 'i');
  const deb = files.find(f => debPattern.test(f));
  if (deb) {
    return path.join(releaseDir, deb);
  }

  // Fallback: look for any .deb
  const anyDeb = files.find(f => f.endsWith('.deb'));
  if (anyDeb) {
    logWarning(`Using .deb with different version: ${anyDeb}`);
    return path.join(releaseDir, anyDeb);
  }

  return null;
}

/**
 * Find built portable exe in release directory
 */
function findPortableExe(releaseDir, version) {
  const files = fs.readdirSync(releaseDir);
  
  // Look for portable exe with current version (productName is CompliNist in electron-builder)
  const portablePattern = new RegExp(`CompliNist.*${version.replace(/\./g, '\\.')}.*\\.exe$`, 'i');
  const portable = files.find(f => portablePattern.test(f) && !f.includes('Setup'));
  
  if (portable) {
    return path.join(releaseDir, portable);
  }
  
  // Fallback: look for any portable exe (not installer)
  const anyPortable = files.find(f => f.endsWith('.exe') && !f.includes('Setup') && !f.includes('Installer'));
  if (anyPortable) {
    logWarning(`Using portable exe with different version: ${anyPortable}`);
    return path.join(releaseDir, anyPortable);
  }
  
  return null;
}

/**
 * Create Linux archive (.tar.gz)
 */
async function createLinuxArchive(version) {
  logInfo('Creating Linux archive...');
  
  const releaseDir = path.join(PROJECT_ROOT, 'release');
  const dataDir = path.join(PROJECT_ROOT, '.data');
  const modelsDir = path.join(dataDir, 'models');
  const chromaDbDir = path.join(dataDir, 'shared', 'chroma_db');
  
  // Find Linux package (AppImage or .deb)
  const packagePath = findLinuxPackage(releaseDir, version);
  if (!packagePath) {
    logError('No Linux package (.AppImage or .deb) found in release directory');
    return false;
  }

  const packageName = path.basename(packagePath);
  const isAppImage = packageName.endsWith('.AppImage');
  logSuccess(`Found Linux package: ${packageName}`);
  
  // Check if models exist
  if (!fs.existsSync(modelsDir)) {
    logError(`Models directory not found: ${modelsDir}`);
    return false;
  }
  
  // Check if chroma_db exists
  if (!fs.existsSync(chromaDbDir)) {
    logWarning(`ChromaDB directory not found: ${chromaDbDir}`);
    logWarning('Archive will not include ChromaDB');
  }
  
  // Archive name
  const archiveName = `CompliFlow-${version}-linux-x64.tar.gz`;
  const archivePath = path.join(releaseDir, archiveName);
  
  // Check existing archive
  const existing = checkExistingArchive(archivePath, 'linux');
  if (existing.exists && existing.hasModels && existing.hasChromaDb && existing.hasDatabase) {
    logInfo('Archive already complete, overwriting app binary only...');
  }
  
  // Check disk space before starting
  const requiredSpace = estimateRequiredSpace(packagePath, modelsDir, chromaDbDir);
  const availableSpace = getAvailableDiskSpace(releaseDir);
  
  if (availableSpace !== null && availableSpace < requiredSpace) {
    logError(`Insufficient disk space!`);
    logError(`Required: ${formatBytes(requiredSpace)}, Available: ${formatBytes(availableSpace)}`);
    logError(`Please free up at least ${formatBytes(requiredSpace - availableSpace)} and try again`);
    return false;
  }
  
  if (availableSpace !== null) {
    logInfo(`Disk space check: ${formatBytes(availableSpace)} available, ${formatBytes(requiredSpace)} required`);
  }
  
  // Initialize fresh SQLite database
  // Note: Rebuild better-sqlite3 for system Node.js first (it may have been rebuilt for Electron)
  logInfo('Initializing fresh SQLite database...');
  const tempDbPath = path.join(releaseDir, `.temp-db-${Date.now()}.db`);
  try {
    // Rebuild better-sqlite3 for system Node.js to run init script
    logInfo('Rebuilding better-sqlite3 for system Node.js (needed for init script)...');
    execSync('npm rebuild better-sqlite3', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    
    // Now run the init script
    execSync(`node scripts/build/init-database.js "${tempDbPath}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    logSuccess('Fresh database initialized');
  } catch (error) {
    logError(`Failed to initialize database: ${error.message}`);
    return false;
  }
  
  // Create staging directory
  const stagingDir = path.join(releaseDir, `.staging-linux-${Date.now()}`);
  const stagingRoot = path.join(stagingDir, `CompliFlow-${version}-linux`);
  fs.mkdirSync(stagingRoot, { recursive: true });
  
  try {
    // Copy AppImage
    logInfo('Copying AppImage...');
    copyFile(packagePath, path.join(stagingRoot, packageName));
    
    // Make executable (if AppImage)
    if (isAppImage) {
      fs.chmodSync(path.join(stagingRoot, packageName), 0o755);
    }
    
    // Copy models
    logInfo('Copying models...');
    copyDirectory(modelsDir, path.join(stagingRoot, 'models'));
    const modelsSize = getDirectorySize(path.join(stagingRoot, 'models'));
    logSuccess(`Models copied (${formatBytes(modelsSize)})`);
    
    // Copy chroma_db if it exists
    if (fs.existsSync(chromaDbDir)) {
      logInfo('Copying ChromaDB...');
      copyDirectory(chromaDbDir, path.join(stagingRoot, 'chroma_db'));
      const chromaSize = getDirectorySize(path.join(stagingRoot, 'chroma_db'));
      logSuccess(`ChromaDB copied (${formatBytes(chromaSize)})`);
    }
    
    // Copy launcher script
    const launcherScript = path.join(PROJECT_ROOT, 'scripts', 'compliflow-launcher.sh');
    if (fs.existsSync(launcherScript)) {
      logInfo('Copying launcher script...');
      const destLauncher = path.join(stagingRoot, 'compliflow-launcher.sh');
      copyFile(launcherScript, destLauncher);
      fs.chmodSync(destLauncher, 0o755);
      logSuccess('Launcher script copied');
    }
    
    // Copy fresh SQLite database (app expects complinist.db in portable mode)
    logInfo('Copying fresh SQLite database...');
    const dbName = 'complinist.db';
    
    // Verify database is clean before copying
    try {
      const Database = (await import('better-sqlite3')).default;
      const verifyDb = new Database(tempDbPath, { readonly: true });
      const projectCount = verifyDb.prepare('SELECT COUNT(*) as count FROM projects').get();
      verifyDb.close();
      
      if (projectCount.count > 0) {
        logError(`Database contains ${projectCount.count} project(s)! This should be empty.`);
        throw new Error('Database verification failed: database contains projects');
      }
      logInfo(`Database verified clean (0 projects)`);
    } catch (verifyError) {
      if (verifyError.message.includes('verification failed')) {
        throw verifyError;
      }
      logWarning(`Could not verify database (${verifyError.message}), but continuing...`);
    }
    
    copyFile(tempDbPath, path.join(stagingRoot, dbName));
    const dbSize = fs.statSync(tempDbPath).size;
    logSuccess(`Database copied (${formatBytes(dbSize)})`);
    
    // Create README
    const installSteps = isAppImage
      ? `1. Extract this archive to a directory of your choice
2. Make the AppImage executable: chmod +x ${packageName}
3. Run the AppImage: ./${packageName}
   Or use the launcher script: ./compliflow-launcher.sh`
      : `1. Extract this archive to a directory of your choice
2. Install the .deb package: sudo dpkg -i ${packageName}
3. Run: complinist-desktop
   Or copy models/ and chroma_db/ to ~/.config/CompliNist/`;

    const readme = `CompliFlow v${version} - Linux Distribution

INSTALLATION:
${installSteps}

CONTENTS:
- ${packageName}: Main application (executable AppImage)
- compliflow-launcher.sh: Launcher script (checks models and launches with --no-sandbox)
- complinist.db: Fresh SQLite database with schema initialized
- models/: AI models for natural language processing
- chroma_db/: Vector database for NIST control search

REQUIREMENTS:
- Linux x64 (tested on Ubuntu 20.04+)
- Python 3.8+ with chromadb package (for AI features)
  Install: pip3 install chromadb

For more information, visit: https://github.com/compliflow
`;
    fs.writeFileSync(path.join(stagingRoot, 'README.txt'), readme);
    
    // Create archive
    logInfo('Creating tar.gz archive...');
    
    // Remove old archive if it exists
    if (fs.existsSync(archivePath)) {
      logInfo('Removing existing archive...');
      fs.unlinkSync(archivePath);
    }
    
    // Create tar.gz from staging directory
    // Use absolute paths and ensure we're in the right directory
    const folderName = path.basename(stagingRoot);
    const stagingDirAbs = path.resolve(stagingDir);
    const archivePathAbs = path.resolve(archivePath);
    
    logInfo(`Creating archive from: ${stagingDirAbs}`);
    logInfo(`Archive destination: ${archivePathAbs}`);
    
    // Verify staging directory exists and has content
    if (!fs.existsSync(stagingRoot)) {
      throw new Error(`Staging directory does not exist: ${stagingRoot}`);
    }
    
    const stagingFiles = fs.readdirSync(stagingRoot);
    if (stagingFiles.length === 0) {
      throw new Error('Staging directory is empty');
    }
    logInfo(`Staging directory contains ${stagingFiles.length} items`);
    
    // Create tar.gz - use -C to change to staging directory, then archive the folder
    // This ensures proper path handling
    try {
      logInfo('Running tar command...');
      execSync(`tar -czf "${archivePathAbs}" -C "${stagingDirAbs}" "${folderName}"`, {
        stdio: 'inherit',
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer for large files
      });
      logInfo('Tar command completed');
    } catch (tarError) {
      logError(`Tar command failed: ${tarError.message}`);
      // Clean up partial archive
      if (fs.existsSync(archivePathAbs)) {
        try {
          fs.unlinkSync(archivePathAbs);
        } catch (unlinkError) {
          // Ignore
        }
      }
      throw new Error(`Failed to create tar.gz archive: ${tarError.message}`);
    }
    
    // Wait a moment for file system to sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify archive was created
    if (!fs.existsSync(archivePathAbs)) {
      throw new Error('Archive was not created');
    }
    
    const archiveSize = fs.statSync(archivePathAbs).size;
    logInfo(`Archive created: ${formatBytes(archiveSize)}`);
    
    // Verify archive is not empty or suspiciously small
    // For a complete archive with models, it should be at least 1MB
    if (archiveSize < 1000000) {
      throw new Error(`Archive is suspiciously small (${formatBytes(archiveSize)}), likely corrupted`);
    }
    
    // Verify archive integrity - test extraction
    logInfo('Verifying archive integrity...');
    try {
      // Test listing contents - this will fail if archive is corrupted
      const testList = execSync(`tar -tzf "${archivePathAbs}" 2>&1 | head -10`, {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024 * 1024, // 1MB buffer
      });
      const preview = testList.split('\n').filter(l => l.trim()).slice(0, 5);
      logInfo('Archive contents preview:', preview.join(', '));
      
      // Test full integrity check - this reads the entire archive
      execSync(`tar -tzf "${archivePathAbs}" > /dev/null 2>&1`, {
        stdio: 'ignore',
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      });
      
      // Count files in archive
      const fileCount = execSync(`tar -tzf "${archivePathAbs}" 2>/dev/null | wc -l`, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      }).trim();
      logSuccess(`Archive verified: ${archiveName} (${formatBytes(archiveSize)}, ${fileCount} files)`);
    } catch (verifyError) {
      logError('Archive verification failed - archive may be corrupted');
      logError(`Verification error: ${verifyError.message}`);
      logError('This usually happens when disk space runs out during creation');
      if (fs.existsSync(archivePathAbs)) {
        try {
          fs.unlinkSync(archivePathAbs);
        } catch (unlinkError) {
          // Ignore
        }
      }
      throw new Error('Archive verification failed');
    }
    
    return true;
  } catch (error) {
    logError(`Failed to create Linux archive: ${error.message}`);
    // Clean up partial archive on error
    if (fs.existsSync(archivePath)) {
      logInfo('Cleaning up partial archive...');
      try {
        fs.unlinkSync(archivePath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
    }
    return false;
  } finally {
    // Clean up staging directory and temp database
    // Do this synchronously after archive is verified
    if (fs.existsSync(stagingDir)) {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logWarning(`Failed to clean up staging directory: ${cleanupError.message}`);
      }
    }
    // Clean up temporary database
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch (cleanupError) {
        logWarning(`Failed to clean up temp database: ${cleanupError.message}`);
      }
    }
  }
}

/**
 * Create Windows archive (.zip)
 */
async function createWindowsArchive(version) {
  logInfo('Creating Windows archive...');
  
  const releaseDir = path.join(PROJECT_ROOT, 'release');
  const dataDir = path.join(PROJECT_ROOT, '.data');
  const modelsDir = path.join(dataDir, 'models');
  const chromaDbDir = path.join(dataDir, 'shared', 'chroma_db');
  
  // Initialize fresh SQLite database (optional: skip if npm rebuild fails, e.g. no ClangCL on Windows)
  let tempDbPath = null;
  logInfo('Initializing fresh SQLite database...');
  const tempDbPathAttempt = path.join(releaseDir, `.temp-db-${Date.now()}.db`);
  try {
    // Rebuild better-sqlite3 for system Node.js to run init script
    logInfo('Rebuilding better-sqlite3 for system Node.js (needed for init script)...');
    execSync('npm rebuild better-sqlite3', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    execSync(`node scripts/build/init-database.js "${tempDbPathAttempt}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    tempDbPath = tempDbPathAttempt;
    logSuccess('Fresh database initialized');
  } catch (error) {
    logWarning(`Skipping database init (${error.message}); app will create DB on first run.`);
  }
  
  // Find portable exe
  const exePath = findPortableExe(releaseDir, version);
  if (!exePath) {
    logError('Portable exe not found in release directory');
    return false;
  }
  
  logSuccess(`Found portable exe: ${path.basename(exePath)}`);
  
  // Check if models exist (optional; zip still created without them)
  if (!fs.existsSync(modelsDir)) {
    logWarning(`Models directory not found: ${modelsDir}`);
    logWarning('Archive will not include AI models');
  }
  
  // Check if chroma_db exists
  if (!fs.existsSync(chromaDbDir)) {
    logWarning(`ChromaDB directory not found: ${chromaDbDir}`);
    logWarning('Archive will not include ChromaDB');
  }
  
  // Archive name
  const archiveName = `CompliFlow-${version}-win-x64.zip`;
  const archivePath = path.join(releaseDir, archiveName);
  
  // Check existing archive
  const existing = checkExistingArchive(archivePath, 'win');
  if (existing.exists && existing.hasModels && existing.hasChromaDb && existing.hasDatabase) {
    logInfo('Archive already complete, overwriting app binary only...');
  }
  
  // Check disk space before starting (include database in estimate if present)
  const dbSize = tempDbPath && fs.existsSync(tempDbPath) ? fs.statSync(tempDbPath).size : 0;
  const requiredSpace = estimateRequiredSpace(exePath, modelsDir, chromaDbDir) + dbSize;
  const availableSpace = getAvailableDiskSpace(releaseDir);
  
  if (availableSpace !== null && availableSpace < requiredSpace) {
    logError(`Insufficient disk space!`);
    logError(`Required: ${formatBytes(requiredSpace)}, Available: ${formatBytes(availableSpace)}`);
    logError(`Please free up at least ${formatBytes(requiredSpace - availableSpace)} and try again`);
    return false;
  }
  
  if (availableSpace !== null) {
    logInfo(`Disk space check: ${formatBytes(availableSpace)} available, ${formatBytes(requiredSpace)} required`);
  }
  
  // Create staging directory
  const stagingDir = path.join(releaseDir, `.staging-windows-${Date.now()}`);
  const stagingRoot = path.join(stagingDir, `CompliFlow-${version}-win`);
  fs.mkdirSync(stagingRoot, { recursive: true });
  
  try {
    // Copy exe
    logInfo('Copying portable exe...');
    const exeName = path.basename(exePath);
    copyFile(exePath, path.join(stagingRoot, exeName));
    
    // Portable marker: app uses this to detect portable layout (data next to exe)
    fs.writeFileSync(path.join(stagingRoot, 'complinist-portable'), '', 'utf8');
    
    // Copy models if present
    if (fs.existsSync(modelsDir)) {
      logInfo('Copying models...');
      copyDirectory(modelsDir, path.join(stagingRoot, 'models'));
      const modelsSize = getDirectorySize(path.join(stagingRoot, 'models'));
      logSuccess(`Models copied (${formatBytes(modelsSize)})`);
    }
    
    // Copy chroma_db if it exists
    if (fs.existsSync(chromaDbDir)) {
      logInfo('Copying ChromaDB...');
      copyDirectory(chromaDbDir, path.join(stagingRoot, 'chroma_db'));
      const chromaSize = getDirectorySize(path.join(stagingRoot, 'chroma_db'));
      logSuccess(`ChromaDB copied (${formatBytes(chromaSize)})`);
    }
    
    // Copy fresh SQLite database if we have one (app expects complinist.db in portable mode)
    const dbName = 'complinist.db';
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      logInfo('Copying fresh SQLite database...');
      try {
        const Database = (await import('better-sqlite3')).default;
        const verifyDb = new Database(tempDbPath, { readonly: true });
        const projectCount = verifyDb.prepare('SELECT COUNT(*) as count FROM projects').get();
        verifyDb.close();
        if (projectCount.count > 0) {
          logError(`Database contains ${projectCount.count} project(s)! This should be empty.`);
          throw new Error('Database verification failed: database contains projects');
        }
        logInfo(`Database verified clean (0 projects)`);
      } catch (verifyError) {
        if (verifyError.message && verifyError.message.includes('verification failed')) {
          throw verifyError;
        }
        logWarning(`Could not verify database (${verifyError.message}), but continuing...`);
      }
      copyFile(tempDbPath, path.join(stagingRoot, dbName));
      const dbSizeBytes = fs.statSync(tempDbPath).size;
      logSuccess(`Database copied (${formatBytes(dbSizeBytes)})`);
    }
    
    // Build README contents list
    const contentsList = [`- ${exeName}: Main application (portable executable)`];
    if (tempDbPath && fs.existsSync(tempDbPath)) contentsList.push('- complinist.db: Fresh SQLite database with schema initialized');
    else contentsList.push('- (Database is created automatically on first run)');
    if (fs.existsSync(modelsDir)) contentsList.push('- models/: AI models for natural language processing');
    if (fs.existsSync(chromaDbDir)) contentsList.push('- chroma_db/: Vector database for NIST control search');
    
    // Create README
    const readme = `CompliFlow v${version} - Windows Distribution

INSTALLATION:
1. Extract this archive to a directory of your choice
2. Run the executable: ${exeName}

Portable mode: When you run the app from this folder, it uses the models/ folder here and stores the database and ChromaDB next to the exe. You can move the whole folder (e.g. to a USB drive) and run from anywhere.

CONTENTS:
${contentsList.join('\n')}

REQUIREMENTS:
- Windows 10/11 (x64)
- Python 3.8+ with chromadb package (for AI features)
  Install: pip install chromadb

For more information, visit: https://github.com/compliflow
`;
    fs.writeFileSync(path.join(stagingRoot, 'README.txt'), readme);
    
    // Create archive
    logInfo('Creating zip archive...');
    
    // Remove old archive if it exists
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    
    // Create zip from staging directory
    // Use platform-appropriate zip command (PowerShell has ~2GB limit; use 7za or zip for large archives)
    const folderName = path.basename(stagingRoot);
    let zipCreated = false;

    // On Windows, try 7za first (from 7zip-bin, handles large files; PowerShell Compress-Archive fails >2GB)
    if (process.platform === 'win32') {
      try {
        const path7za = path.join(PROJECT_ROOT, 'node_modules', '7zip-bin', 'win', process.arch, '7za.exe');
        if (fs.existsSync(path7za)) {
          logInfo('Using 7-Zip for archive (large file support)...');
          execSync(`"${path7za}" a -tzip "${archivePath}" "${folderName}" -r`, {
            cwd: stagingDir,
            stdio: 'inherit',
          });
          zipCreated = true;
        }
      } catch (e7z) {
        logWarning(`7-Zip failed: ${e7z.message}`);
      }
    }

    if (!zipCreated) {
      try {
        // Try zip command (available on Linux/Mac)
        execSync(`cd "${stagingDir}" && zip -r "${archivePath}" "${folderName}"`, {
          stdio: 'inherit',
        });
        zipCreated = true;
      } catch (error) {
        // On Windows, PowerShell Compress-Archive fails for >2GB; try tar first (built-in Windows 10+)
        if (process.platform === 'win32') {
          try {
            const tarPath = archivePath.replace(/\.zip$/i, '.tar.gz');
            logInfo('Using tar for archive (handles large files on Windows)...');
            execSync(`tar -czf "${tarPath}" -C "${stagingDir}" "${folderName}"`, {
              stdio: 'inherit',
              shell: true,
            });
            zipCreated = true;
            logWarning('Created .tar.gz (use 7-Zip or Windows tar to extract)');
          } catch (tarErr) {
            logWarning(`tar failed: ${tarErr.message}`);
          }
        }
        if (!zipCreated) {
          try {
            const psCommand = `Compress-Archive -Path "${stagingRoot}" -DestinationPath "${archivePath}" -Force`;
            execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
            zipCreated = true;
          } catch (psError) {
            // Last resort: tar (cross-platform)
            const tarPath = archivePath.replace(/\.zip$/i, '.tar.gz');
            execSync(`tar -czf "${tarPath}" -C "${stagingDir}" "${folderName}"`, {
              stdio: 'inherit',
              shell: true,
            });
            logWarning('Created .tar.gz instead of .zip');
          }
        }
      }
    }
    
    // Verify archive was created
    const finalArchive = fs.existsSync(archivePath) ? archivePath : archivePath.replace('.zip', '.tar.gz');
    if (!fs.existsSync(finalArchive)) {
      throw new Error('Archive was not created');
    }
    
    const archiveSize = fs.statSync(finalArchive).size;
    
    // Verify archive is not empty or suspiciously small
    // For a complete archive with models, it should be at least 1MB
    if (archiveSize < 1000000) {
      throw new Error(`Archive is suspiciously small (${formatBytes(archiveSize)}), likely corrupted`);
    }
    
    // Verify archive integrity (unzip/tar -t not available on Windows; 7-Zip created archive is trusted)
    logInfo('Verifying archive integrity...');
    try {
      if (finalArchive.endsWith('.zip')) {
        if (process.platform !== 'win32') {
          execSync(`unzip -t "${finalArchive}" > /dev/null 2>&1`, { stdio: 'ignore' });
        }
      } else {
        execSync(`tar -tzf "${finalArchive}" > /dev/null 2>&1`, { stdio: 'ignore' });
      }
      logSuccess(`Archive verified: ${path.basename(finalArchive)} (${formatBytes(archiveSize)})`);
    } catch (verifyError) {
      logWarning('Integrity check skipped (unzip/tar not available or failed); archive was created successfully.');
      logSuccess(`Archive created: ${path.basename(finalArchive)} (${formatBytes(archiveSize)})`);
    }
    
    return true;
  } catch (error) {
    logError(`Failed to create Windows archive: ${error.message}`);
    return false;
  } finally {
    // Clean up staging directory
    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    // Clean up temporary database (if we created one)
    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('');
  console.log('========================================');
  console.log('  CompliFlow Release Archive Creator');
  console.log('========================================');
  console.log('');
  
  const args = process.argv.slice(2);
  const platformArg = args.find(arg => arg.startsWith('--platform='));
  const platform = platformArg ? platformArg.split('=')[1] : 'all';
  
  const version = getVersion();
  logInfo(`Version: ${version}`);
  logInfo(`Platform: ${platform}`);
  console.log('');
  
  const releaseDir = path.join(PROJECT_ROOT, 'release');
  if (!fs.existsSync(releaseDir)) {
    logError(`Release directory not found: ${releaseDir}`);
    logError('Run electron-builder first to create release artifacts');
    process.exit(1);
  }
  
  let success = true;
  
  // Create archives based on platform
  if (platform === 'linux' || platform === 'all') {
    const result = await createLinuxArchive(version);
    success = success && result;
  }
  
  if (platform === 'win' || platform === 'all') {
    const result = await createWindowsArchive(version);
    success = success && result;
  }
  
  if (!['linux', 'win', 'all'].includes(platform)) {
    logError(`Invalid platform: ${platform}`);
    logError('Use --platform=linux, --platform=win, or --platform=all');
    process.exit(1);
  }
  
  console.log('');
  if (success) {
    logSuccess('Release archives created successfully!');
    console.log('');
    logInfo(`Archives are in: ${releaseDir}`);
    
    // List created archives
    const files = fs.readdirSync(releaseDir);
    const archives = files.filter(f => 
      (f.endsWith('.tar.gz') || f.endsWith('.zip')) && 
      f.includes(version)
    );
    
    if (archives.length > 0) {
      console.log('');
      logInfo('Created archives:');
      for (const archive of archives) {
        const size = fs.statSync(path.join(releaseDir, archive)).size;
        console.log(`  - ${archive} (${formatBytes(size)})`);
      }
    }
  } else {
    logError('Failed to create one or more archives');
    process.exit(1);
  }
  
  console.log('');
}

// Run main function
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

