/**
 * Device Types Routes
 * REST API endpoints for device type operations
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Load device types from static JSON (bundled with app)
let deviceTypes = null;

function loadDeviceTypes() {
  if (deviceTypes) return deviceTypes;

  const typesPath = path.join(__dirname, '..', '..', 'src', 'assets', 'device-types.json');
  if (fs.existsSync(typesPath)) {
    deviceTypes = JSON.parse(fs.readFileSync(typesPath, 'utf-8'));
  } else {
    // Default device types
    deviceTypes = [
      { id: 'server', name: 'Server', category: 'compute', icon: '/Icons/server.svg' },
      { id: 'workstation', name: 'Workstation', category: 'endpoint', icon: '/Icons/workstation.svg' },
      { id: 'router', name: 'Router', category: 'network', icon: '/Icons/router.svg' },
      { id: 'switch', name: 'Switch', category: 'network', icon: '/Icons/switch.svg' },
      { id: 'firewall', name: 'Firewall', category: 'security', icon: '/Icons/firewall.svg' },
      { id: 'database', name: 'Database', category: 'data', icon: '/Icons/database.svg' },
      { id: 'cloud', name: 'Cloud Service', category: 'cloud', icon: '/Icons/cloud.svg' },
      { id: 'storage', name: 'Storage', category: 'storage', icon: '/Icons/storage.svg' }
    ];
  }
  return deviceTypes;
}

// Get all device types
router.get('/get-all', (req, res) => {
  try {
    const types = loadDeviceTypes();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get device type by icon path
router.get('/get-by-icon', (req, res) => {
  try {
    const { iconPath } = req.query;
    const types = loadDeviceTypes();
    const deviceType = types.find(t => t.icon === iconPath);
    res.json(deviceType || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Find device type match
router.post('/find-match', (req, res) => {
  try {
    const { name, category, tags } = req.body;
    const types = loadDeviceTypes();

    // Simple matching logic
    let match = null;
    if (category) {
      match = types.find(t => t.category === category);
    }
    if (!match && name) {
      const nameLower = name.toLowerCase();
      match = types.find(t =>
        t.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(t.name.toLowerCase())
      );
    }

    res.json(match || types[0]); // Default to first type
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch find matches
router.post('/batch-find-match', (req, res) => {
  try {
    const { requests } = req.body;
    const types = loadDeviceTypes();

    const results = requests.map(({ name, category }) => {
      let match = null;
      if (category) {
        match = types.find(t => t.category === category);
      }
      if (!match && name) {
        const nameLower = name.toLowerCase();
        match = types.find(t =>
          t.name.toLowerCase().includes(nameLower) ||
          nameLower.includes(t.name.toLowerCase())
        );
      }
      return match || types[0];
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Migrate device types (no-op for web)
router.post('/migrate', (req, res) => {
  res.json({ success: true, migrated: 0 });
});

export default router;
