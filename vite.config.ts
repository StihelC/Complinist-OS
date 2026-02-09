import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, mkdirSync, readdirSync, existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import crypto from 'crypto'

// ============================================================================
// SMART CACHING AND INCREMENTAL BUILD CONFIGURATION
// ============================================================================
// This configuration provides:
// - esbuild-powered fast transpilation (built into Vite)
// - Smart code splitting for faster incremental rebuilds
// - Persistent build caching
// - Source map optimization for faster debugging
// - Module dependency tracking
// ============================================================================

const CACHE_DIR = path.resolve(__dirname, '.build-cache')
const VITE_CACHE_DIR = path.join(CACHE_DIR, 'vite')

// Initialize cache directories
function initCacheDirs() {
  const dirs = [CACHE_DIR, VITE_CACHE_DIR]
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

initCacheDirs()

// ============================================================================
// ICON COPY PLUGIN WITH SMART CACHING
// ============================================================================

// Hash a directory for change detection
function hashDirectory(dirPath: string): string {
  if (!existsSync(dirPath)) return ''

  const files: { path: string; mtime: number }[] = []

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else {
          const stat = statSync(fullPath)
          files.push({ path: fullPath, mtime: stat.mtimeMs })
        }
      }
    } catch (e) {
      // Ignore inaccessible directories
    }
  }

  walk(dirPath)

  const hashInput = files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(f => `${f.path}:${f.mtime}`)
    .join('|')

  return crypto.createHash('md5').update(hashInput).digest('hex')
}

// Recursively copy directory
function copyRecursive(src: string, dest: string) {
  const entries = readdirSync(src, { withFileTypes: true })

  mkdirSync(dest, { recursive: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

// Icons copy plugin with caching - only copies when source changes
const iconsHashFile = path.join(VITE_CACHE_DIR, 'icons-hash.txt')

const copyIconsPlugin = () => {
  return {
    name: 'copy-icons-cached',
    closeBundle() {
      const srcDir = path.resolve(__dirname, 'src/Icons')
      const destDir = path.resolve(__dirname, 'dist/Icons')

      try {
        if (!existsSync(srcDir) || !readdirSync(srcDir).length) return

        // Check if icons have changed
        const currentHash = hashDirectory(srcDir)
        let previousHash = ''

        try {
          if (existsSync(iconsHashFile)) {
            previousHash = readFileSync(iconsHashFile, 'utf-8').trim()
          }
        } catch (e) {
          // Ignore
        }

        if (currentHash === previousHash && existsSync(destDir)) {
          console.log('\x1b[36m%s\x1b[0m', '  Icons: Using cached version (no changes)')
          return
        }

        copyRecursive(srcDir, destDir)

        // Save hash for next build
        writeFileSync(iconsHashFile, currentHash)

        console.log('\x1b[32m%s\x1b[0m', '  Icons: Copied to dist (changes detected)')
      } catch (error) {
        console.warn('Failed to copy Icons:', error)
      }
    },
  }
}

// ============================================================================
// BUILD TIMING PLUGIN
// ============================================================================

const buildTimingPlugin = () => {
  let startTime: number
  let moduleCount = 0

  return {
    name: 'build-timing',
    buildStart() {
      startTime = Date.now()
      moduleCount = 0
      console.log('\x1b[36m%s\x1b[0m', '\n  Build started with smart caching enabled...')
    },
    transform() {
      moduleCount++
      return null
    },
    buildEnd() {
      const duration = Date.now() - startTime
      const durationSec = (duration / 1000).toFixed(2)
      console.log('\x1b[32m%s\x1b[0m', `  Transformed ${moduleCount} modules in ${durationSec}s`)
    },
    closeBundle() {
      const totalDuration = Date.now() - startTime
      const totalSec = (totalDuration / 1000).toFixed(2)
      console.log('\x1b[32m%s\x1b[0m', `  Total build time: ${totalSec}s\n`)
    }
  }
}

// ============================================================================
// REMOVE CROSSORIGIN PLUGIN (For Electron file:// protocol)
// ============================================================================
// Removes crossorigin attribute from script and link tags in the built HTML
// This is necessary because crossorigin on ES modules can cause failures when
// loading from file:// protocol in Electron, even with webSecurity disabled
// The crossorigin attribute causes CORS issues even with webSecurity disabled
// ============================================================================

const removeCrossoriginPlugin = () => {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html: string) {
      // Remove crossorigin attribute from script and link tags
      // This fixes ES module loading issues with file:// protocol
      return html
        .replace(/<script([^>]*)\scrossorigin="[^"]*"([^>]*)>/gi, '<script$1$2>')
        .replace(/<link([^>]*)\scrossorigin="[^"]*"([^>]*)>/gi, '<link$1$2>')
        .replace(/<script([^>]*)\scrossorigin([^>]*)>/gi, '<script$1$2>')
        .replace(/<link([^>]*)\scrossorigin([^>]*)>/gi, '<link$1$2>')
    }
  }
}

// ============================================================================
// VITE CONFIGURATION
// ============================================================================

const enableSourceMaps = process.env.SOURCEMAPS !== 'false'

export default defineConfig(({ mode }): UserConfig => {
  const isProd = mode === 'production'

  return {
    plugins: [
      react({
        // Use fast refresh for development
        fastRefresh: !isProd,
      }),
      buildTimingPlugin(),
      copyIconsPlugin(),
      removeCrossoriginPlugin(), // Remove crossorigin for Electron file:// loading
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/lib': path.resolve(__dirname, './src/lib'),
        '@/core': path.resolve(__dirname, './src/core'),
        '@/stores': path.resolve(__dirname, './src/core/stores'),
        '@/features': path.resolve(__dirname, './src/features'),
        '@/shared': path.resolve(__dirname, './src/shared'),
        '@/assets': path.resolve(__dirname, './src/assets'),
        '@/types': path.resolve(__dirname, './src/lib/utils/types'),
        '@/Icons': path.resolve(__dirname, './src/Icons'),
      },
    },

    base: './',

    // ========================================================================
    // ESBUILD CONFIGURATION (Fast Transpilation)
    // ========================================================================
    // Vite uses esbuild internally for transpilation which is 10-100x faster
    // than webpack/babel. These options optimize the esbuild usage.
    // ========================================================================
    esbuild: {
      // Target modern browsers for faster builds
      target: isProd ? 'es2020' : 'esnext',
      // Enable JSX transform
      jsx: 'automatic',
      // Drop console in production
      drop: isProd ? ['console', 'debugger'] : [],
      // Minify identifiers in production
      minifyIdentifiers: isProd,
      minifySyntax: isProd,
      minifyWhitespace: isProd,
      // Keep names in development for easier debugging
      keepNames: !isProd,
      // Legal comments handling
      legalComments: isProd ? 'none' : 'inline',
    },

    // ========================================================================
    // BUILD CONFIGURATION
    // ========================================================================
    build: {
      outDir: 'dist',

      // Source maps configuration
      // - 'hidden' for production (smaller bundles, maps separate)
      // - true for development (inline for faster debugging)
      sourcemap: enableSourceMaps ? (isProd ? 'hidden' : true) : false,

      // Target ES2020 for modern output
      target: 'es2020',

      // Use esbuild for minification (faster than terser)
      minify: isProd ? 'esbuild' : false,

      // CSS code splitting
      cssCodeSplit: true,

      // Chunk size warning limit
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        input: path.resolve(__dirname, './index.html'),

        output: {
          // ================================================================
          // SMART CODE SPLITTING
          // ================================================================
          // This configuration splits the bundle into logical chunks that
          // can be cached independently, enabling faster incremental rebuilds.
          // ================================================================
          manualChunks: (id) => {
            // Node modules chunking
            if (id.includes('node_modules')) {
              // For file:// protocol compatibility, bundle React with main vendor chunk
              // This prevents module loading order issues where vendor code expects React
              // but React is in a separate chunk that hasn't loaded yet
              
              // React ecosystem - include in main vendor bundle for file:// compatibility
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                // Include React in vendor bundle instead of separate chunk
                // This ensures React is always available when vendor code runs
                return 'vendor'
              }
              // UI components (Radix) - depends on React, can be in vendor or separate
              if (id.includes('@radix-ui')) {
                return 'vendor-radix'
              }
              // Flow/diagram libraries (@dagrejs/dagre includes graphlib internally)
              if (id.includes('@xyflow') || id.includes('@dagrejs')) {
                return 'vendor-flow'
              }
              // Form libraries - depends on React, can be in vendor or separate
              if (id.includes('@rjsf')) {
                return 'vendor-forms'
              }
              // Utility libraries - should not depend on React
              if (id.includes('zustand') || id.includes('zod') || id.includes('clsx') || id.includes('class-variance')) {
                return 'vendor-utils'
              }
              // Other vendor code - bundle with React to ensure availability
              return 'vendor'
            }

            // Feature-based splitting for application code
            if (id.includes('/src/features/')) {
              const match = id.match(/\/src\/features\/([^/]+)/)
              if (match) {
                return `feature-${match[1]}`
              }
            }

            // Core application code
            if (id.includes('/src/core/')) {
              return 'core'
            }

            // Lib utilities
            if (id.includes('/src/lib/')) {
              return 'lib'
            }
          },

          // Optimize chunk file names for caching
          chunkFileNames: isProd
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',

          entryFileNames: isProd
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',

          assetFileNames: isProd
            ? 'assets/[name]-[hash][extname]'
            : 'assets/[name][extname]',
        },
      },

      // Report compressed size
      reportCompressedSize: isProd,

      // Enable/disable CSS minification
      cssMinify: isProd ? 'esbuild' : false,
    },

    // ========================================================================
    // CACHE CONFIGURATION
    // ========================================================================
    cacheDir: VITE_CACHE_DIR,

    // ========================================================================
    // DEVELOPMENT SERVER OPTIMIZATION
    // ========================================================================
    server: {
      // Dev server configuration for Electron HMR
      port: 5173,
      strictPort: true,
      host: 'localhost',
      // Enable HMR with WebSocket
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      },
      // Watch configuration
      watch: {
        usePolling: false,
      },
      // Pre-bundle dependencies for faster dev startup
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/app/App.tsx',
          './src/app/ViewRouter.tsx',
        ],
      },
    },

    // ========================================================================
    // DEPENDENCY OPTIMIZATION
    // ========================================================================
    optimizeDeps: {
      // Include dependencies that need to be pre-bundled
      include: [
        'react',
        'react-dom',
        'zustand',
        'zod',
        'clsx',
        'lucide-react',
        '@radix-ui/react-dialog',
        '@radix-ui/react-select',
        '@radix-ui/react-tabs',
        '@radix-ui/react-popover',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-label',
        '@xyflow/react',
        '@dagrejs/dagre',
        'papaparse',
        'file-saver',
      ],
      // Exclude dependencies that shouldn't be pre-bundled
      exclude: [
        'better-sqlite3',
        'electron',
      ],
      // Force optimization of certain packages
      force: false,
    },

    // ========================================================================
    // PREVIEW SERVER (for testing builds)
    // ========================================================================
    preview: {
      port: 4173,
      strictPort: true,
    },
  }
})
