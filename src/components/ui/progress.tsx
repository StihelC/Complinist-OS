import * as React from "react"
import { cn } from "@/lib/utils/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  variant?: "default" | "success" | "warning" | "error"
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  indeterminate?: boolean
}

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

const variantClasses = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({
    className,
    value = 0,
    max = 100,
    variant = "default",
    size = "md",
    showLabel = false,
    indeterminate = false,
    ...props
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {showLabel && (
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-foreground">
              Progress
            </span>
            <span className="text-sm text-muted-foreground">
              {indeterminate ? "Loading..." : `${Math.round(percentage)}%`}
            </span>
          </div>
        )}
        <div
          className={cn(
            "w-full bg-secondary rounded-full overflow-hidden",
            sizeClasses[size]
          )}
          role="progressbar"
          aria-valuenow={indeterminate ? undefined : percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              variantClasses[variant],
              indeterminate && "animate-progress-indeterminate"
            )}
            style={{
              width: indeterminate ? "50%" : `${percentage}%`,
            }}
          />
        </div>
      </div>
    )
  }
)
Progress.displayName = "Progress"

// Circular progress indicator
export interface CircularProgressProps extends React.SVGAttributes<SVGSVGElement> {
  value?: number
  max?: number
  size?: number
  strokeWidth?: number
  variant?: "default" | "success" | "warning" | "error"
  showLabel?: boolean
  indeterminate?: boolean
}

const variantColors = {
  default: "stroke-primary",
  success: "stroke-green-500",
  warning: "stroke-yellow-500",
  error: "stroke-red-500",
}

const CircularProgress = React.forwardRef<SVGSVGElement, CircularProgressProps>(
  ({
    className,
    value = 0,
    max = 100,
    size = 48,
    strokeWidth = 4,
    variant = "default",
    showLabel = false,
    indeterminate = false,
    ...props
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg
          ref={ref}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={cn(
            indeterminate && "animate-spin",
            className
          )}
          {...props}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-secondary"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={cn(
              variantColors[variant],
              "transition-all duration-300 ease-out"
            )}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: indeterminate ? circumference * 0.75 : strokeDashoffset,
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
            }}
          />
        </svg>
        {showLabel && !indeterminate && (
          <span className="absolute text-xs font-medium text-foreground">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    )
  }
)
CircularProgress.displayName = "CircularProgress"

export { Progress, CircularProgress }
