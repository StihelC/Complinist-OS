/**
 * Database Routes
 * REST API endpoints for database operations
 */

import { Router } from 'express';
import * as db from '../services/database.js';

const router = Router();

// Project operations
router.post('/create-project', (req, res) => {
  try {
    const { name, baseline } = req.body;
    const project = db.createProject(name, baseline);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list-projects', (req, res) => {
  try {
    const projects = db.listProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/delete-project/:projectId', (req, res) => {
  try {
    const result = db.deleteProject(req.params.projectId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/update-project-baseline', (req, res) => {
  try {
    const { projectId, baseline } = req.body;
    const result = db.updateProjectBaseline(projectId, baseline);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diagram operations
router.post('/save-diagram', (req, res) => {
  try {
    const { projectId, nodes, edges, viewport } = req.body;
    const result = db.saveDiagram(projectId, nodes, edges, viewport);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-diagram-delta', (req, res) => {
  try {
    // Delta saves use the same underlying function
    const { projectId, nodes, edges, viewport } = req.body;
    const result = db.saveDiagram(projectId, nodes, edges, viewport);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/load-diagram/:projectId', (req, res) => {
  try {
    const diagram = db.loadDiagram(req.params.projectId);
    res.json(diagram);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Control narrative operations
router.get('/load-control-narratives/:projectId', (req, res) => {
  try {
    const narratives = db.loadControlNarratives(req.params.projectId);
    res.json(narratives);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-control-narratives', (req, res) => {
  try {
    const { projectId, narratives } = req.body;
    const result = db.saveControlNarratives(projectId, narratives);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-single-control-narrative', (req, res) => {
  try {
    const { projectId, controlId, narrative, status } = req.body;
    const result = db.saveSingleControlNarrative(projectId, controlId, narrative, status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-control-narrative', (req, res) => {
  try {
    const { projectId, controlId } = req.body;
    const result = db.resetControlNarrative(projectId, controlId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSP Metadata operations
router.get('/get-ssp-metadata/:projectId', (req, res) => {
  try {
    const metadata = db.getSSPMetadata(req.params.projectId);
    res.json(metadata);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-ssp-metadata', (req, res) => {
  try {
    const { projectId, metadata } = req.body;
    const result = db.saveSSPMetadata(projectId, metadata);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
