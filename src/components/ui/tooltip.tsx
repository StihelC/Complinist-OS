import * as React from "react"
import { cn } from "@/lib/utils/utils"

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string
  children: React.ReactNode
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ className, content, children, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    return (
      <div
        ref={ref}
        className="relative inline-block"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        {...props}
      >
        {children}
        {isVisible && (
          <div
            className={cn(
              "absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg",
              "bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2",
              "whitespace-nowrap max-w-xs",
              "fade-in",
              className
            )}
          >
            {content}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
Tooltip.displayName = "Tooltip"

export { Tooltip }































