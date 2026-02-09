/**
 * Base Repository Class
 *
 * Provides a foundation for all repository implementations with:
 * - Typed query building
 * - Consistent error handling
 * - Transaction support
 * - Common CRUD operations
 */

/**
 * @typedef {Object} QueryOptions
 * @property {Object} [filters] - Key-value pairs for WHERE conditions
 * @property {string} [orderBy] - Column to order by
 * @property {'ASC'|'DESC'} [orderDirection] - Sort direction
 * @property {number} [limit] - Maximum number of records
 * @property {number} [offset] - Number of records to skip
 */

/**
 * @typedef {Object} RepositoryResult
 * @property {boolean} success
 * @property {*} [data]
 * @property {string} [error]
 */

/**
 * Base Repository class providing common database operations
 * @template T - Entity type
 */
export class BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db - Database instance
   * @param {string} tableName - Name of the database table
   * @param {Object} [options] - Repository options
   * @param {string} [options.primaryKey='id'] - Primary key column name
   * @param {boolean} [options.hasTimestamps=true] - Whether table has created_at/updated_at
   */
  constructor(db, tableName, options = {}) {
    if (!db) {
      throw new Error('Database instance is required');
    }
    if (!tableName) {
      throw new Error('Table name is required');
    }

    this.db = db;
    this.tableName = tableName;
    this.primaryKey = options.primaryKey || 'id';
    this.hasTimestamps = options.hasTimestamps !== false;
  }

  /**
   * Get entity type name for logging
   * @returns {string}
   */
  get entityType() {
    return this.tableName;
  }

  // ==========================================================================
  // Query Builder Methods
  // ==========================================================================

  /**
   * Build a SELECT query with conditions
   * @param {string[]} [columns=['*']] - Columns to select
   * @param {QueryOptions} [options={}] - Query options
   * @returns {{ sql: string, params: any[] }}
   */
  buildSelectQuery(columns = ['*'], options = {}) {
    const { filters = {}, orderBy, orderDirection = 'ASC', limit, offset } = options;

    let sql = `SELECT ${columns.join(', ')} FROM ${this.tableName}`;
    const params = [];

    // Build WHERE clause
    const whereConditions = this.buildWhereConditions(filters, params);
    if (whereConditions) {
      sql += ` WHERE ${whereConditions}`;
    }

    // Add ORDER BY
    if (orderBy) {
      const direction = orderDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${this.sanitizeColumnName(orderBy)} ${direction}`;
    }

    // Add LIMIT and OFFSET
    if (limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    return { sql, params };
  }

  /**
   * Build WHERE conditions from filter object
   * @param {Object} filters - Filter conditions
   * @param {any[]} params - Array to push parameter values to
   * @returns {string|null} - WHERE clause without 'WHERE' keyword
   */
  buildWhereConditions(filters, params) {
    const conditions = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;

      // Handle special operators
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const ops = value;
        if (ops.$eq !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} = ?`);
          params.push(ops.$eq);
        }
        if (ops.$neq !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} != ?`);
          params.push(ops.$neq);
        }
        if (ops.$gt !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} > ?`);
          params.push(ops.$gt);
        }
        if (ops.$gte !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} >= ?`);
          params.push(ops.$gte);
        }
        if (ops.$lt !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} < ?`);
          params.push(ops.$lt);
        }
        if (ops.$lte !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} <= ?`);
          params.push(ops.$lte);
        }
        if (ops.$in !== undefined && Array.isArray(ops.$in)) {
          const placeholders = ops.$in.map(() => '?').join(', ');
          conditions.push(`${this.sanitizeColumnName(key)} IN (${placeholders})`);
          params.push(...ops.$in);
        }
        if (ops.$nin !== undefined && Array.isArray(ops.$nin)) {
          const placeholders = ops.$nin.map(() => '?').join(', ');
          conditions.push(`${this.sanitizeColumnName(key)} NOT IN (${placeholders})`);
          params.push(...ops.$nin);
        }
        if (ops.$like !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} LIKE ?`);
          params.push(ops.$like);
        }
        if (ops.$isNull !== undefined) {
          conditions.push(`${this.sanitizeColumnName(key)} IS ${ops.$isNull ? 'NULL' : 'NOT NULL'}`);
        }
      } else if (value === null) {
        conditions.push(`${this.sanitizeColumnName(key)} IS NULL`);
      } else if (Array.isArray(value)) {
        // Array means IN clause
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${this.sanitizeColumnName(key)} IN (${placeholders})`);
        params.push(...value);
      } else {
        // Simple equality
        conditions.push(`${this.sanitizeColumnName(key)} = ?`);
        params.push(value);
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : null;
  }

  /**
   * Sanitize column name to prevent SQL injection
   * @param {string} column - Column name
   * @returns {string}
   */
  sanitizeColumnName(column) {
    // Only allow alphanumeric characters and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    return column;
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Find a single record by ID
   * @param {string|number} id - Record ID
   * @returns {RepositoryResult}
   */
  findById(id) {
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`
      );
      const data = stmt.get(id);
      return { success: true, data: data || null };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error finding by ID:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find all records matching the query options
   * @param {QueryOptions} [options={}] - Query options
   * @returns {RepositoryResult}
   */
  findAll(options = {}) {
    try {
      const { sql, params } = this.buildSelectQuery(['*'], options);
      const stmt = this.db.prepare(sql);
      const data = stmt.all(...params);
      return { success: true, data };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error finding all:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find a single record matching the query options
   * @param {QueryOptions} options - Query options
   * @returns {RepositoryResult}
   */
  findOne(options) {
    try {
      const { sql, params } = this.buildSelectQuery(['*'], { ...options, limit: 1 });
      const stmt = this.db.prepare(sql);
      const data = stmt.get(...params);
      return { success: true, data: data || null };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error finding one:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Count records matching the query options
   * @param {QueryOptions} [options={}] - Query options
   * @returns {number}
   */
  count(options = {}) {
    try {
      const { sql, params } = this.buildSelectQuery(['COUNT(*) as count'], {
        filters: options.filters
      });
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params);
      return result ? result.count : 0;
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error counting:`, error);
      return 0;
    }
  }

  /**
   * Check if a record exists
   * @param {string|number} id - Record ID
   * @returns {boolean}
   */
  exists(id) {
    try {
      const stmt = this.db.prepare(
        `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = ? LIMIT 1`
      );
      return stmt.get(id) !== undefined;
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error checking existence:`, error);
      return false;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {RepositoryResult}
   */
  create(data) {
    try {
      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(data);

      const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...values);

      // Fetch the created record
      const created = this.findById(result.lastInsertRowid);
      return created;
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error creating:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing record
   * @param {string|number} id - Record ID
   * @param {Object} data - Data to update
   * @returns {RepositoryResult}
   */
  update(id, data) {
    try {
      // Add updated_at timestamp if the table has timestamps
      const updateData = this.hasTimestamps
        ? { ...data, updated_at: 'CURRENT_TIMESTAMP' }
        : data;

      const setClause = Object.keys(updateData)
        .map(key => {
          if (updateData[key] === 'CURRENT_TIMESTAMP') {
            return `${this.sanitizeColumnName(key)} = CURRENT_TIMESTAMP`;
          }
          return `${this.sanitizeColumnName(key)} = ?`;
        })
        .join(', ');

      const values = Object.entries(updateData)
        .filter(([, value]) => value !== 'CURRENT_TIMESTAMP')
        .map(([, value]) => value);

      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;
      const stmt = this.db.prepare(sql);
      stmt.run(...values, id);

      // Fetch the updated record
      return this.findById(id);
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error updating:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a record
   * @param {string|number} id - Record ID
   * @returns {RepositoryResult}
   */
  delete(id) {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`
      );
      const result = stmt.run(id);
      return { success: true, data: result.changes > 0 };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error deleting:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete multiple records by IDs
   * @param {(string|number)[]} ids - Record IDs
   * @returns {RepositoryResult}
   */
  deleteMany(ids) {
    try {
      if (!ids || ids.length === 0) {
        return { success: true, data: 0 };
      }

      const placeholders = ids.map(() => '?').join(', ');
      const stmt = this.db.prepare(
        `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} IN (${placeholders})`
      );
      const result = stmt.run(...ids);
      return { success: true, data: result.changes };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error deleting many:`, error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Transaction Support
  // ==========================================================================

  /**
   * Execute operations within a transaction
   * @template R
   * @param {() => R} fn - Function to execute in transaction
   * @returns {R}
   */
  transaction(fn) {
    return this.db.transaction(fn)();
  }

  /**
   * Get a prepared transaction function (for reuse)
   * @template R
   * @param {() => R} fn - Function to execute in transaction
   * @returns {() => R}
   */
  prepareTransaction(fn) {
    return this.db.transaction(fn);
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Create multiple records in a transaction
   * @param {Object[]} dataArray - Array of record data
   * @returns {RepositoryResult}
   */
  createMany(dataArray) {
    try {
      if (!dataArray || dataArray.length === 0) {
        return { success: true, data: [] };
      }

      const results = this.transaction(() => {
        return dataArray.map(data => {
          const result = this.create(data);
          if (!result.success) {
            throw new Error(result.error);
          }
          return result.data;
        });
      });

      return { success: true, data: results };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error creating many:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update multiple records by filter
   * @param {Object} filters - Filter conditions
   * @param {Object} data - Data to update
   * @returns {RepositoryResult}
   */
  updateWhere(filters, data) {
    try {
      const params = [];

      // Build SET clause
      const updateData = this.hasTimestamps
        ? { ...data, updated_at: 'CURRENT_TIMESTAMP' }
        : data;

      const setClause = Object.keys(updateData)
        .map(key => {
          if (updateData[key] === 'CURRENT_TIMESTAMP') {
            return `${this.sanitizeColumnName(key)} = CURRENT_TIMESTAMP`;
          }
          params.push(updateData[key]);
          return `${this.sanitizeColumnName(key)} = ?`;
        })
        .join(', ');

      // Build WHERE clause
      const whereConditions = this.buildWhereConditions(filters, params);

      let sql = `UPDATE ${this.tableName} SET ${setClause}`;
      if (whereConditions) {
        sql += ` WHERE ${whereConditions}`;
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { success: true, data: result.changes };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error updating where:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete multiple records by filter
   * @param {Object} filters - Filter conditions
   * @returns {RepositoryResult}
   */
  deleteWhere(filters) {
    try {
      const params = [];
      const whereConditions = this.buildWhereConditions(filters, params);

      let sql = `DELETE FROM ${this.tableName}`;
      if (whereConditions) {
        sql += ` WHERE ${whereConditions}`;
      } else {
        // Safety: require filters for delete
        return { success: false, error: 'Filters required for deleteWhere' };
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { success: true, data: result.changes };
    } catch (error) {
      console.error(`[${this.entityType}Repository] Error deleting where:`, error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Raw Query Support
  // ==========================================================================

  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL query
   * @param {...any} params - Query parameters
   * @returns {any[]}
   */
  rawQuery(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Execute a raw SQL query and get single result
   * @param {string} sql - SQL query
   * @param {...any} params - Query parameters
   * @returns {any}
   */
  rawQueryOne(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  /**
   * Execute a raw SQL statement (for INSERT/UPDATE/DELETE)
   * @param {string} sql - SQL statement
   * @param {...any} params - Statement parameters
   * @returns {import('better-sqlite3').RunResult}
   */
  rawExecute(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }
}

export default BaseRepository;
