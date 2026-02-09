/**
 * CompliFlow Web Server
 * Express-based backend replacing Electron IPC
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import routes
import databaseRoutes from './routes/database.js';
import aiRoutes from './routes/ai.js';
import exportRoutes from './routes/export.js';
import deviceTypesRoutes from './routes/device-types.js';
import documentsRoutes from './routes/documents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/db', databaseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/device-types', deviceTypesRoutes);
app.use('/api/documents', documentsRoutes);

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message });
});

// Initialize services and start server
async function start() {
  try {
    // Initialize database
    const { initDatabase } = await import('./services/database.js');
    await initDatabase();
    console.log('[Server] Database initialized');

    // Initialize AI services (optional - may take time)
    try {
      const { initAIServices } = await import('./services/ai-service.js');
      await initAIServices();
      console.log('[Server] AI services initialized');
    } catch (aiErr) {
      console.warn('[Server] AI services not available:', aiErr.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] CompliFlow running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
