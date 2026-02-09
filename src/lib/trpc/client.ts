/**
 * tRPC Client for Renderer Process
 * Provides type-safe RPC calls to the main process via electron-trpc
 */
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import type { TRPCClient } from './types';

// Track if tRPC has been initialized
let trpcClient: TRPCClient | null = null;
let initializationAttempted = false;

/**
 * Initialize the tRPC client
 * This is called lazily on first access to avoid issues during SSR or testing
 */
function initializeClient(): TRPCClient | null {
  if (initializationAttempted) {
    return trpcClient;
  }

  initializationAttempted = true;

  try {
    // Check if we're in an Electron environment with electron-trpc exposed
    if (typeof window !== 'undefined' && 'electronTRPC' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trpcClient = createTRPCProxyClient<any>({
        links: [ipcLink()],
      }) as unknown as TRPCClient;
      console.log('[tRPC] Client initialized successfully');
    } else {
      console.warn('[tRPC] electron-trpc not available, using legacy IPC');
    }
  } catch (error) {
    console.warn('[tRPC] Failed to initialize client:', error);
  }

  return trpcClient;
}

/**
 * Get the tRPC client instance
 * Returns null if electron-trpc is not available
 */
export function getTRPCClient(): TRPCClient | null {
  return initializeClient();
}

/**
 * Type-safe tRPC client instance
 * Uses electron-trpc's ipcLink for communication with main process
 *
 * Usage:
 *   // Query (read operations)
 *   const projects = await trpc?.database.listProjects.query();
 *
 *   // Mutation (write operations)
 *   const project = await trpc?.database.createProject.mutate({ name: 'My Project' });
 *
 * Note: Use getTRPCClient() for null-safe access
 */
export const trpc: TRPCClient | null = typeof window !== 'undefined' ? initializeClient() : null;

/**
 * Re-export the types for use in components
 */
export type { TRPCClient };
export * from './types';
