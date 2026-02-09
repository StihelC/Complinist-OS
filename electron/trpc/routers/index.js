/**
 * Root Router - Combines all tRPC routers
 * This is the single entry point for all tRPC procedures
 */
import { router } from '../trpc.js';
import { databaseRouter, initializeDatabaseRouter } from './database.js';

/**
 * Root router that combines all sub-routers
 * New routers can be added here as they are migrated
 */
export const appRouter = router({
  database: databaseRouter,
  // Future routers:
  // ai: aiRouter,
  // export: exportRouter,
  // terraform: terraformRouter,
  // license: licenseRouter,
});

/**
 * Re-export initialization function
 */
export { initializeDatabaseRouter };
