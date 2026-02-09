/**
 * Error Boundary Component
 *
 * A React error boundary that catches JavaScript errors anywhere in the
 * child component tree, logs those errors, and displays a fallback UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, ErrorCode, createError } from '@/core/errors';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  component?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorFallbackProps {
  error: AppError | null;
  resetError: () => void;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Convert to AppError if needed
    const appError = error instanceof AppError
      ? error
      : createError.render(error.message, ErrorCode.RENDER_COMPONENT_FAILED, {
          originalError: error,
          stack: error.stack,
        });

    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Convert to AppError
    const appError = error instanceof AppError
      ? error
      : createError.render(error.message, ErrorCode.RENDER_COMPONENT_FAILED, {
          component: this.props.component,
          originalError: error,
          stack: error.stack,
        });

    // Log the error
    appError.log();

    // Update state with error info
    this.setState({ errorInfo });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // Log to console for development
    console.error('[ErrorBoundary] Caught error:', {
      message: appError.message,
      code: appError.code,
      component: this.props.component,
      componentStack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys have changed
    if (
      this.state.hasError &&
      prevProps.resetKeys &&
      this.props.resetKeys &&
      !this.arraysEqual(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetError();
    }
  }

  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback({
            error,
            resetError: this.resetError,
            errorInfo,
          });
        }
        return fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={error}
          resetError={this.resetError}
          errorInfo={errorInfo}
        />
      );
    }

    return children;
  }
}

/**
 * Default Error Fallback Component
 */
function DefaultErrorFallback({ error, resetError, errorInfo }: ErrorFallbackProps) {
  const isDev = import.meta.env?.DEV ?? false;

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-50 border border-red-200 rounded-lg m-4">
      <div className="text-red-600 mb-4">
        <svg
          className="w-16 h-16 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
      <p className="text-red-600 text-center mb-4 max-w-md">
        {error?.getUserMessage() || 'An unexpected error occurred. Please try again.'}
      </p>

      {isDev && error && (
        <div className="w-full max-w-2xl mb-4">
          <details className="text-sm">
            <summary className="cursor-pointer text-red-700 hover:text-red-900 font-medium">
              Technical Details
            </summary>
            <div className="mt-2 p-4 bg-white rounded border border-red-200 overflow-auto max-h-60">
              <p className="font-mono text-xs text-gray-700 mb-2">
                <strong>Error:</strong> {error.message}
              </p>
              <p className="font-mono text-xs text-gray-700 mb-2">
                <strong>Code:</strong> {error.code}
              </p>
              <p className="font-mono text-xs text-gray-700 mb-2">
                <strong>Category:</strong> {error.category}
              </p>
              {error.stack && (
                <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
              {errorInfo?.componentStack && (
                <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap mt-2">
                  <strong>Component Stack:</strong>
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          </details>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={resetError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps} component={displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Hook to trigger error boundary
 */
export function useErrorBoundary() {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

export { ErrorBoundary, DefaultErrorFallback };
export default ErrorBoundary;
