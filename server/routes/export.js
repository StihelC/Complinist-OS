/**
 * Export Routes
 * REST API endpoints for export operations
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Export JSON
router.post('/json', (req, res) => {
  try {
    const { data, filename } = req.body;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.json'}"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import JSON (receive uploaded file)
router.post('/import-json', (req, res) => {
  try {
    const { data } = req.body;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export CSV
router.post('/csv', (req, res) => {
  try {
    const { data, filename } = req.body;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.csv'}"`);
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export SVG
router.post('/svg', (req, res) => {
  try {
    const { svgContent, filename } = req.body;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.svg'}"`);
    res.send(svgContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export PNG (from SVG)
router.post('/png-from-svg', async (req, res) => {
  try {
    const { svgContent, width, height, filename } = req.body;
    // For web version, return SVG and let client convert
    // Or use sharp/canvas on server
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.svg'}"`);
    res.send(svgContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export PDF (SSP)
router.post('/pdf', async (req, res) => {
  try {
    const { html, filename } = req.body;
    // For web version, return HTML for client-side PDF generation
    // Or integrate puppeteer/playwright for server-side PDF
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save file (generic)
router.post('/save-file', (req, res) => {
  try {
    const { content, filename, mimeType } = req.body;
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
