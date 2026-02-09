import * as React from "react"
import { cn } from "@/lib/utils/utils"
import { Button, ButtonProps } from "./button"
import { Spinner } from "./spinner"
import { CheckCircle2, XCircle } from "lucide-react"

export interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean
  loadingText?: string
  successText?: string
  errorText?: string
  showSuccess?: boolean
  showError?: boolean
  successDuration?: number
  spinnerPosition?: "left" | "right"
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({
    className,
    children,
    isLoading = false,
    loadingText,
    successText,
    errorText,
    showSuccess = false,
    showError = false,
    successDuration = 2000,
    spinnerPosition = "left",
    disabled,
    ...props
  }, ref) => {
    const [internalShowSuccess, setInternalShowSuccess] = React.useState(false)
    const [internalShowError, setInternalShowError] = React.useState(false)

    // Handle success state display
    React.useEffect(() => {
      if (showSuccess && !isLoading) {
        setInternalShowSuccess(true)
        const timer = setTimeout(() => {
          setInternalShowSuccess(false)
        }, successDuration)
        return () => clearTimeout(timer)
      }
    }, [showSuccess, isLoading, successDuration])

    // Handle error state display
    React.useEffect(() => {
      if (showError && !isLoading) {
        setInternalShowError(true)
        const timer = setTimeout(() => {
          setInternalShowError(false)
        }, successDuration)
        return () => clearTimeout(timer)
      }
    }, [showError, isLoading, successDuration])

    const getContent = () => {
      if (isLoading) {
        return (
          <>
            {spinnerPosition === "left" && (
              <Spinner size="sm" variant="secondary" className="mr-2" />
            )}
            <span>{loadingText || children}</span>
            {spinnerPosition === "right" && (
              <Spinner size="sm" variant="secondary" className="ml-2" />
            )}
          </>
        )
      }

      if (internalShowSuccess) {
        return (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
            <span>{successText || "Done!"}</span>
          </>
        )
      }

      if (internalShowError) {
        return (
          <>
            <XCircle className="w-4 h-4 mr-2 text-red-500" />
            <span>{errorText || "Error"}</span>
          </>
        )
      }

      return children
    }

    return (
      <Button
        ref={ref}
        className={cn(
          "transition-all duration-200",
          isLoading && "cursor-wait",
          internalShowSuccess && "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
          internalShowError && "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {getContent()}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }
