import * as React from "react"
import { cn } from "@/lib/utils/utils"
import { Loader2 } from "lucide-react"

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "primary" | "secondary" | "muted"
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
}

const variantClasses = {
  default: "text-foreground",
  primary: "text-primary",
  secondary: "text-secondary-foreground",
  muted: "text-muted-foreground",
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", variant = "primary", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center justify-center", className)}
        role="status"
        aria-label="Loading"
        {...props}
      >
        <Loader2
          className={cn(
            "animate-spin",
            sizeClasses[size],
            variantClasses[variant]
          )}
        />
        <span className="sr-only">Loading...</span>
      </div>
    )
  }
)
Spinner.displayName = "Spinner"

export { Spinner }
