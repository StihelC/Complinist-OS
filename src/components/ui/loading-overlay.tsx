import * as React from "react"
import { cn } from "@/lib/utils/utils"
import { Spinner } from "./spinner"
import { Progress } from "./progress"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export type LoadingOverlayStatus = "loading" | "success" | "error" | "warning"

export interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  isVisible: boolean
  message?: string
  progress?: number
  status?: LoadingOverlayStatus
  showProgress?: boolean
  backdrop?: "dark" | "light" | "none"
  position?: "fullscreen" | "container" | "inline"
}

const statusIcons = {
  loading: null,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
}

const statusColors = {
  loading: "text-primary",
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-yellow-500",
}

const backdropClasses = {
  dark: "bg-black/50",
  light: "bg-white/80",
  none: "bg-transparent",
}

const positionClasses = {
  fullscreen: "fixed inset-0 z-[9999]",
  container: "absolute inset-0 z-50",
  inline: "relative",
}

const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({
    className,
    isVisible,
    message = "Loading...",
    progress,
    status = "loading",
    showProgress = false,
    backdrop = "dark",
    position = "container",
    ...props
  }, ref) => {
    if (!isVisible) return null

    const StatusIcon = statusIcons[status]

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center transition-opacity duration-200",
          positionClasses[position],
          backdropClasses[backdrop],
          className
        )}
        role="status"
        aria-live="polite"
        {...props}
      >
        <div className="bg-card rounded-xl shadow-lg p-6 min-w-[280px] max-w-sm mx-4">
          <div className="flex flex-col items-center gap-4">
            {/* Status Icon or Spinner */}
            {StatusIcon ? (
              <StatusIcon className={cn("w-10 h-10", statusColors[status])} />
            ) : (
              <Spinner size="xl" variant="primary" />
            )}

            {/* Message */}
            <div className="text-center">
              <p className="font-medium text-foreground">{message}</p>
              {showProgress && progress !== undefined && (
                <p className="text-sm text-muted-foreground mt-1">
                  {Math.round(progress)}% complete
                </p>
              )}
            </div>

            {/* Progress Bar */}
            {showProgress && progress !== undefined && (
              <Progress
                value={progress}
                className="w-full"
                size="md"
                variant={status === "error" ? "error" : status === "warning" ? "warning" : "default"}
              />
            )}
          </div>
        </div>
      </div>
    )
  }
)
LoadingOverlay.displayName = "LoadingOverlay"

// Toast-style loading indicator for quick operations
export interface LoadingToastProps extends React.HTMLAttributes<HTMLDivElement> {
  isVisible: boolean
  message: string
  status?: LoadingOverlayStatus
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center"
}

const toastPositionClasses = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
}

const LoadingToast = React.forwardRef<HTMLDivElement, LoadingToastProps>(
  ({
    className,
    isVisible,
    message,
    status = "loading",
    position = "top-right",
    ...props
  }, ref) => {
    if (!isVisible) return null

    const StatusIcon = statusIcons[status]

    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-[9999] animate-slide-in-from-top",
          toastPositionClasses[position],
          className
        )}
        role="status"
        aria-live="polite"
        {...props}
      >
        <div className="bg-card rounded-lg shadow-lg border px-4 py-3 flex items-center gap-3">
          {StatusIcon ? (
            <StatusIcon className={cn("w-5 h-5 flex-shrink-0", statusColors[status])} />
          ) : (
            <Spinner size="sm" variant="primary" />
          )}
          <span className="text-sm font-medium text-foreground">{message}</span>
        </div>
      </div>
    )
  }
)
LoadingToast.displayName = "LoadingToast"

export { LoadingOverlay, LoadingToast }
