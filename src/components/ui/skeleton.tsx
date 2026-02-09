import * as React from "react"
import { cn } from "@/lib/utils/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "rectangular" | "text"
  animation?: "pulse" | "wave" | "none"
  width?: string | number
  height?: string | number
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({
    className,
    variant = "default",
    animation = "pulse",
    width,
    height,
    style,
    ...props
  }, ref) => {
    const variantClasses = {
      default: "rounded-md",
      circular: "rounded-full",
      rectangular: "rounded-none",
      text: "rounded h-4 w-full",
    }

    const animationClasses = {
      pulse: "animate-pulse",
      wave: "animate-shimmer",
      none: "",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-muted",
          variantClasses[variant],
          animationClasses[animation],
          className
        )}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        aria-hidden="true"
        {...props}
      />
    )
  }
)
Skeleton.displayName = "Skeleton"

// Skeleton wrapper for common patterns
interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
  lastLineWidth?: string
}

const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ className, lines = 3, lastLineWidth = "60%", ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            style={{
              width: i === lines - 1 ? lastLineWidth : "100%",
            }}
          />
        ))}
      </div>
    )
  }
)
SkeletonText.displayName = "SkeletonText"

// Skeleton for table rows
interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number
  columns?: number
}

const SkeletonTable = React.forwardRef<HTMLDivElement, SkeletonTableProps>(
  ({ className, rows = 5, columns = 4, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-3", className)} {...props}>
        {/* Header */}
        <div className="flex gap-4 pb-2 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 py-2">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    )
  }
)
SkeletonTable.displayName = "SkeletonTable"

// Skeleton for cards
interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hasImage?: boolean
  imageHeight?: number
}

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, hasImage = true, imageHeight = 200, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("rounded-lg border bg-card p-4 space-y-4", className)}
        {...props}
      >
        {hasImage && (
          <Skeleton
            variant="rectangular"
            className="w-full rounded-md"
            height={imageHeight}
          />
        )}
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }
)
SkeletonCard.displayName = "SkeletonCard"

export { Skeleton, SkeletonText, SkeletonTable, SkeletonCard }
