import { cn } from "@/lib/utils/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog"
import { Progress } from "./progress"
import { Spinner } from "./spinner"
import { Button } from "./button"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export type ProgressDialogStatus = "loading" | "success" | "error" | "warning"

export interface ProgressDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  message?: string
  progress?: number
  status?: ProgressDialogStatus
  showProgress?: boolean
  canCancel?: boolean
  onCancel?: () => void
  cancelLabel?: string
  showClose?: boolean
  steps?: Array<{ label: string; completed: boolean; active?: boolean }>
}

const statusIcons = {
  loading: null,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
}

const statusColors = {
  loading: "",
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-yellow-500",
}

export function ProgressDialog({
  open,
  onOpenChange,
  title,
  message,
  progress,
  status = "loading",
  showProgress = true,
  canCancel = false,
  onCancel,
  cancelLabel = "Cancel",
  showClose = false,
  steps,
}: ProgressDialogProps) {
  const StatusIcon = statusIcons[status]
  const isComplete = status === "success" || status === "error" || status === "warning"

  return (
    <Dialog open={open} onOpenChange={isComplete && showClose ? onOpenChange : undefined}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent closing during loading
        onPointerDownOutside={(e) => !isComplete && e.preventDefault()}
        onEscapeKeyDown={(e) => !isComplete && !canCancel && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {StatusIcon && (
              <StatusIcon className={cn("w-5 h-5", statusColors[status])} />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {message || "Please wait while the operation completes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Icon or Spinner */}
          <div className="flex justify-center">
            {status === "loading" ? (
              <Spinner size="xl" variant="primary" />
            ) : (
              StatusIcon && (
                <StatusIcon className={cn("w-16 h-16", statusColors[status])} />
              )
            )}
          </div>

          {/* Progress Bar */}
          {showProgress && status === "loading" && (
            <div className="space-y-2">
              <Progress
                value={progress}
                indeterminate={progress === undefined}
                className="w-full"
                size="md"
              />
              {progress !== undefined && (
                <p className="text-center text-xs text-muted-foreground">
                  {Math.round(progress)}% complete
                </p>
              )}
            </div>
          )}

          {/* Steps */}
          {steps && steps.length > 0 && (
            <div className="space-y-2 pt-2">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    step.completed && "text-green-600",
                    step.active && !step.completed && "text-foreground font-medium",
                    !step.completed && !step.active && "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                      step.completed && "bg-green-100 text-green-600",
                      step.active && !step.completed && "bg-primary/10 text-primary",
                      !step.completed && !step.active && "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : step.active ? (
                      <Spinner size="sm" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cancel Button */}
          {canCancel && status === "loading" && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
            </div>
          )}

          {/* Close Button for completed states */}
          {isComplete && showClose && (
            <div className="flex justify-center pt-2">
              <Button
                variant={status === "success" ? "default" : "outline"}
                size="sm"
                onClick={() => onOpenChange?.(false)}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
