/**
 * tRPC Server Initialization
 * Provides type-safe RPC framework for Electron IPC communication
 */
import { initTRPC } from '@trpc/server';

/**
 * Initialize tRPC with context type
 */
const t = initTRPC.context().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Include original error message for debugging
        message: error.message,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

/**
 * Create a context factory for tRPC
 * Called for each request to create the context
 */
export function createContext() {
  return {};
}
