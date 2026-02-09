/**
 * Error Dashboard IPC Handlers
 *
 * Provides IPC handlers for the error dashboard feature, enabling the renderer
 * process to access aggregated error data from all layers of the application.
 */

import { getDatabase } from '../modules/database-init.js';
import { getRecentErrors, getErrorStats, clearErrorLog } from '../error-reporter.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Ensure error_logs table exists
function ensureErrorLogsTable() {
  const db = getDatabase();
  if (!db) return;

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        message TEXT NOT NULL,
        code INTEGER DEFAULT 0,
        category TEXT DEFAULT 'unknown',
        severity TEXT DEFAULT 'error',
        source TEXT DEFAULT 'unknown',
        component TEXT,
        operation TEXT,
        stack TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
      CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
    `);
  } catch (error) {
    console.error('Failed to create error_logs table:', error);
  }
}

// Store an error in the database
function storeErrorInDb(errorInfo) {
  const db = getDatabase();
  if (!db) return;

  try {
    const stmt = db.prepare(`
      INSERT INTO error_logs (
        timestamp, message, code, category, severity, source, component, operation, stack, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      errorInfo.timestamp || new Date().toISOString(),
      errorInfo.message || 'Unknown error',
      errorInfo.code || 0,
      errorInfo.category || 'unknown',
      errorInfo.severity || 'error',
      errorInfo.source || 'unknown',
      errorInfo.component || null,
      errorInfo.operation || null,
      errorInfo.stack || null,
      errorInfo.metadata ? JSON.stringify(errorInfo.metadata) : null
    );

    // Clean up old errors (keep last 10,000)
    const count = db.prepare('SELECT COUNT(*) as count FROM error_logs').get();
    if (count && count.count > 10000) {
      db.prepare(`
        DELETE FROM error_logs WHERE id IN (
          SELECT id FROM error_logs ORDER BY timestamp ASC LIMIT ?
        )
      `).run(count.count - 10000);
    }
  } catch (error) {
    console.error('Failed to store error in database:', error);
  }
}

// Get error history with pagination and filtering
function getErrorHistory(options = {}) {
  const db = getDatabase();
  if (!db) return { errors: [], total: 0 };

  try {
    const {
      limit = 50,
      offset = 0,
      category,
      severity,
      source,
      startDate,
      endDate,
      searchTerm
    } = options;

    let whereClause = '1=1';
    const params = [];

    if (category && category !== 'all') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (severity && severity !== 'all') {
      whereClause += ' AND severity = ?';
      params.push(severity);
    }

    if (source && source !== 'all') {
      whereClause += ' AND source = ?';
      params.push(source);
    }

    if (startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(endDate);
    }

    if (searchTerm) {
      whereClause += ' AND (message LIKE ? OR component LIKE ? OR operation LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM error_logs WHERE ${whereClause}`);
    const countResult = countStmt.get(...params);
    const total = countResult?.count || 0;

    // Get paginated results
    const stmt = db.prepare(`
      SELECT * FROM error_logs
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const errors = stmt.all(...params, limit, offset).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return { errors, total };
  } catch (error) {
    console.error('Failed to get error history:', error);
    return { errors: [], total: 0 };
  }
}

// Get error trends (hourly/daily aggregation)
function getErrorTrends(options = {}) {
  const db = getDatabase();
  if (!db) return [];

  try {
    const {
      interval = 'hour',
      startDate,
      endDate,
      category,
      severity
    } = options;

    // Default to last 24 hours for hourly, last 30 days for daily
    const defaultStart = interval === 'hour'
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const start = startDate || defaultStart;
    const end = endDate || new Date().toISOString();

    let groupByClause;
    if (interval === 'hour') {
      groupByClause = "strftime('%Y-%m-%d %H:00:00', timestamp)";
    } else if (interval === 'day') {
      groupByClause = "strftime('%Y-%m-%d', timestamp)";
    } else {
      groupByClause = "strftime('%Y-%m', timestamp)";
    }

    let whereClause = 'timestamp >= ? AND timestamp <= ?';
    const params = [start, end];

    if (category && category !== 'all') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (severity && severity !== 'all') {
      whereClause += ' AND severity = ?';
      params.push(severity);
    }

    const stmt = db.prepare(`
      SELECT
        ${groupByClause} as time_bucket,
        COUNT(*) as count,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info_count
      FROM error_logs
      WHERE ${whereClause}
      GROUP BY ${groupByClause}
      ORDER BY time_bucket ASC
    `);

    return stmt.all(...params);
  } catch (error) {
    console.error('Failed to get error trends:', error);
    return [];
  }
}

// Get aggregated statistics
function getAggregatedStats(options = {}) {
  const db = getDatabase();
  if (!db) return null;

  try {
    const { startDate, endDate } = options;

    let whereClause = '1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(endDate);
    }

    // Total errors
    const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM error_logs WHERE ${whereClause}`);
    const totalResult = totalStmt.get(...params);

    // By category
    const byCategoryStmt = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM error_logs
      WHERE ${whereClause}
      GROUP BY category
    `);
    const byCategory = byCategoryStmt.all(...params);

    // By severity
    const bySeverityStmt = db.prepare(`
      SELECT severity, COUNT(*) as count
      FROM error_logs
      WHERE ${whereClause}
      GROUP BY severity
    `);
    const bySeverity = bySeverityStmt.all(...params);

    // By source
    const bySourceStmt = db.prepare(`
      SELECT source, COUNT(*) as count
      FROM error_logs
      WHERE ${whereClause}
      GROUP BY source
    `);
    const bySource = bySourceStmt.all(...params);

    // Top components with errors
    const topComponentsStmt = db.prepare(`
      SELECT component, COUNT(*) as count
      FROM error_logs
      WHERE ${whereClause} AND component IS NOT NULL
      GROUP BY component
      ORDER BY count DESC
      LIMIT 10
    `);
    const topComponents = topComponentsStmt.all(...params);

    // Top operations with errors
    const topOperationsStmt = db.prepare(`
      SELECT operation, COUNT(*) as count
      FROM error_logs
      WHERE ${whereClause} AND operation IS NOT NULL
      GROUP BY operation
      ORDER BY count DESC
      LIMIT 10
    `);
    const topOperations = topOperationsStmt.all(...params);

    // Recent errors (last 10)
    const recentStmt = db.prepare(`
      SELECT * FROM error_logs
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    const recent = recentStmt.all(...params).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    // Error rate over time (last hour, last day)
    const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const lastHourCount = db.prepare(`
      SELECT COUNT(*) as count FROM error_logs WHERE timestamp >= ?
    `).get(lastHour);

    const lastDayCount = db.prepare(`
      SELECT COUNT(*) as count FROM error_logs WHERE timestamp >= ?
    `).get(lastDay);

    return {
      total: totalResult?.total || 0,
      byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
      bySeverity: Object.fromEntries(bySeverity.map(r => [r.severity, r.count])),
      bySource: Object.fromEntries(bySource.map(r => [r.source, r.count])),
      topComponents,
      topOperations,
      recent,
      lastHourCount: lastHourCount?.count || 0,
      lastDayCount: lastDayCount?.count || 0
    };
  } catch (error) {
    console.error('Failed to get aggregated stats:', error);
    return null;
  }
}

// Export errors to JSON
function exportErrorsToJSON() {
  const db = getDatabase();
  if (!db) return null;

  try {
    const errors = db.prepare(`
      SELECT * FROM error_logs ORDER BY timestamp DESC
    `).all().map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return {
      exportDate: new Date().toISOString(),
      totalErrors: errors.length,
      errors
    };
  } catch (error) {
    console.error('Failed to export errors:', error);
    return null;
  }
}

// Clear all errors from database
function clearAllErrors() {
  const db = getDatabase();
  if (!db) return false;

  try {
    db.prepare('DELETE FROM error_logs').run();
    clearErrorLog(); // Also clear in-memory log
    return true;
  } catch (error) {
    console.error('Failed to clear errors:', error);
    return false;
  }
}

/**
 * Register error dashboard IPC handlers
 */
export function registerErrorDashboardHandlers(ipcMain) {
  // Ensure table exists on registration
  ensureErrorLogsTable();

  // Log error from renderer process
  ipcMain.handle('error-dashboard:log-error', async (event, errorInfo) => {
    try {
      storeErrorInDb({
        ...errorInfo,
        source: errorInfo.source || 'renderer'
      });
      return { success: true };
    } catch (error) {
      console.error('Error logging error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get combined statistics from all sources
  ipcMain.handle('error-dashboard:get-stats', async (event, options = {}) => {
    try {
      const dbStats = getAggregatedStats(options);
      const memoryStats = getErrorStats();

      return {
        success: true,
        data: {
          database: dbStats,
          memory: memoryStats,
          combined: {
            total: (dbStats?.total || 0) + (memoryStats?.total || 0),
            byCategory: { ...dbStats?.byCategory, ...memoryStats?.byCategory },
            bySeverity: { ...dbStats?.bySeverity, ...memoryStats?.bySeverity }
          }
        }
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Get error history with filtering/pagination
  ipcMain.handle('error-dashboard:get-history', async (event, options = {}) => {
    try {
      const result = getErrorHistory(options);
      return { success: true, ...result };
    } catch (error) {
      console.error('Error getting history:', error);
      return { success: false, error: error.message };
    }
  });

  // Get error trends
  ipcMain.handle('error-dashboard:get-trends', async (event, options = {}) => {
    try {
      const trends = getErrorTrends(options);
      return { success: true, data: trends };
    } catch (error) {
      console.error('Error getting trends:', error);
      return { success: false, error: error.message };
    }
  });

  // Export errors to JSON
  ipcMain.handle('error-dashboard:export', async () => {
    try {
      const exportData = exportErrorsToJSON();
      return { success: true, data: exportData };
    } catch (error) {
      console.error('Error exporting errors:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear all errors
  ipcMain.handle('error-dashboard:clear', async () => {
    try {
      const result = clearAllErrors();
      return { success: result };
    } catch (error) {
      console.error('Error clearing errors:', error);
      return { success: false, error: error.message };
    }
  });

  // Get main process recent errors (from memory)
  ipcMain.handle('error-dashboard:get-main-process-errors', async (event, count = 50) => {
    try {
      const errors = getRecentErrors(count);
      return { success: true, data: errors };
    } catch (error) {
      console.error('Error getting main process errors:', error);
      return { success: false, error: error.message };
    }
  });

  // Read error log file
  ipcMain.handle('error-dashboard:get-log-file', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const logPath = path.join(userDataPath, 'error.log');

      if (!fs.existsSync(logPath)) {
        return { success: true, data: [] };
      }

      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const errors = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: new Date().toISOString() };
        }
      });

      return { success: true, data: errors };
    } catch (error) {
      console.error('Error reading log file:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[ERROR DASHBOARD] IPC handlers registered');
}

// Export for use by error reporter to store errors
export { storeErrorInDb, ensureErrorLogsTable };
