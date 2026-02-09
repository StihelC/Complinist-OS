import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type LoadingOperationType =
  | 'save'
  | 'export'
  | 'import'
  | 'load'
  | 'generate'
  | 'ai'
  | 'delete'
  | 'fetch'
  | 'custom';

export interface LoadingOperation {
  id: string;
  type: LoadingOperationType;
  message: string;
  progress?: number;
  startedAt: number;
}

interface LoadingContextValue {
  // State
  operations: LoadingOperation[];
  isLoading: boolean;
  currentOperation: LoadingOperation | null;

  // Actions
  startLoading: (type: LoadingOperationType, message: string, id?: string) => string;
  updateProgress: (id: string, progress: number, message?: string) => void;
  stopLoading: (id: string) => void;
  stopAllLoading: () => void;

  // Utilities
  isOperationLoading: (type: LoadingOperationType) => boolean;
  getOperationById: (id: string) => LoadingOperation | undefined;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [operations, setOperations] = useState<LoadingOperation[]>([]);

  const generateId = useCallback(() => {
    return `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const startLoading = useCallback((
    type: LoadingOperationType,
    message: string,
    id?: string
  ): string => {
    const operationId = id || generateId();
    const operation: LoadingOperation = {
      id: operationId,
      type,
      message,
      startedAt: Date.now(),
    };

    setOperations(prev => [...prev, operation]);
    return operationId;
  }, [generateId]);

  const updateProgress = useCallback((
    id: string,
    progress: number,
    message?: string
  ) => {
    setOperations(prev => prev.map(op =>
      op.id === id
        ? { ...op, progress, ...(message && { message }) }
        : op
    ));
  }, []);

  const stopLoading = useCallback((id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const stopAllLoading = useCallback(() => {
    setOperations([]);
  }, []);

  const isOperationLoading = useCallback((type: LoadingOperationType) => {
    return operations.some(op => op.type === type);
  }, [operations]);

  const getOperationById = useCallback((id: string) => {
    return operations.find(op => op.id === id);
  }, [operations]);

  const value: LoadingContextValue = {
    operations,
    isLoading: operations.length > 0,
    currentOperation: operations[operations.length - 1] || null,
    startLoading,
    updateProgress,
    stopLoading,
    stopAllLoading,
    isOperationLoading,
    getOperationById,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

// Hook for wrapping async operations with loading state
export function useAsyncOperation<T>(type: LoadingOperationType = 'custom') {
  const { startLoading, updateProgress, stopLoading } = useLoading();

  const execute = useCallback(async (
    operation: () => Promise<T>,
    message: string = 'Processing...'
  ): Promise<T> => {
    const id = startLoading(type, message);
    try {
      const result = await operation();
      return result;
    } finally {
      stopLoading(id);
    }
  }, [type, startLoading, stopLoading]);

  const executeWithProgress = useCallback(async (
    operation: (onProgress: (progress: number, message?: string) => void) => Promise<T>,
    message: string = 'Processing...'
  ): Promise<T> => {
    const id = startLoading(type, message);
    try {
      const result = await operation((progress, msg) => {
        updateProgress(id, progress, msg);
      });
      return result;
    } finally {
      stopLoading(id);
    }
  }, [type, startLoading, updateProgress, stopLoading]);

  return { execute, executeWithProgress };
}
