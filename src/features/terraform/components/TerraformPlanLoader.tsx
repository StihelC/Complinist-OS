import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FileJson, Loader2, Check, X, ChevronDown, ChevronUp, AlertTriangle, Shield } from 'lucide-react'
import { useTerraformStore } from '@/core/stores/useTerraformStore'
import { parseTerraformPlan } from '@/lib/terraform/planParser'
import { extractChangeSummary } from '@/lib/terraform/planParser'
import { analyzeDependencies } from '@/lib/terraform/dependencyAnalyzer'
import { convertTerraformPlanToNodesAsync } from '@/lib/terraform/stateConverter'
import type { TerraformPlan, ChangeSummary, ValidationReport } from '@/lib/terraform/terraformTypes'
import type { CollisionResolution } from '@/lib/terraform/validation/types'
import { ImportValidationDialog } from './ImportValidationDialog'
import { ImportAuditReport } from './ImportAuditReport'

interface PreviewData {
  jsonContent: string
  plan: TerraformPlan
  summary: ChangeSummary
  validation?: ValidationReport
}

export function TerraformPlanLoader() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planProgress, setPlanProgress] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [useValidation, setUseValidation] = useState(true) // New: toggle validation mode

  // Store state
  const loadPlan = useTerraformStore(state => state.loadTerraformPlan)
  const loadPlanWithValidation = useTerraformStore(state => state.loadTerraformPlanWithValidation)
  const resolveCollisionsAndImport = useTerraformStore(state => state.resolveCollisionsAndImport)
  const clearAuditReport = useTerraformStore(state => state.clearAuditReport)
  const pendingCollisions = useTerraformStore(state => state.pendingCollisions)
  const auditReport = useTerraformStore(state => state.auditReport)

  // Listen for Terraform plan progress events
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onTerraformPlanProgress) {
      const handleProgress = (data: { type: string; data: string }) => {
        setPlanProgress((prev) => prev + data.data)
      }

      (window as any).electronAPI.onTerraformPlanProgress(handleProgress)

      return () => {
        if ((window as any).electronAPI?.removeTerraformProgressListener) {
          (window as any).electronAPI.removeTerraformProgressListener()
        }
      }
    }
  }, [])

  const handleSelectJsonFile = async () => {
    if (!(window as any).electronAPI?.selectTerraformJsonFile) {
      setError('Electron API not available. Please use the HTML file input as fallback.')
      // Fallback to HTML input
      const input = document.getElementById('terraform-file-input') as HTMLInputElement
      if (input) {
        input.click()
      }
      return
    }

    setLoading(true)
    setError(null)
    setPlanProgress('')
    setSuccessMessage(null)
    setPreview(null)

    try {
      const result = await (window as any).electronAPI.selectTerraformJsonFile()

      if (result.canceled) {
        setLoading(false)
        return
      }

      if (!result.success) {
        setError(result.error || 'Failed to select file')
        setLoading(false)
        return
      }

      if (!result.content) {
        setError('File is empty')
        setLoading(false)
        return
      }

      // Parse and show preview instead of loading immediately
      try {
        const plan = parseTerraformPlan(result.content)
        const summary = extractChangeSummary(plan)

        // Pre-validate the plan to show warnings in preview
        const dependencies = analyzeDependencies(plan)
        const validationResult = await convertTerraformPlanToNodesAsync({
          plan,
          resourceMappings: new Map(),
          dependencies,
          layoutStrategy: 'auto',
        })

        setPreview({
          jsonContent: result.content,
          plan,
          summary,
          validation: validationResult.validation
        })
        setShowJsonPreview(false)
      } catch (parseError) {
        setError((parseError as Error).message)
      }
    } catch (err) {
      setError((err as Error).message)
      setSuccessMessage(null)
    } finally {
      setLoading(false)
    }
  }

  // Fallback HTML file input handler (for web version or as backup)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setPlanProgress('')
    setSuccessMessage(null)
    setPreview(null)

    try {
      const text = await file.text()

      // Parse and show preview instead of loading immediately
      try {
        const plan = parseTerraformPlan(text)
        const summary = extractChangeSummary(plan)

        // Pre-validate the plan to show warnings in preview
        const dependencies = analyzeDependencies(plan)
        const validationResult = await convertTerraformPlanToNodesAsync({
          plan,
          resourceMappings: new Map(),
          dependencies,
          layoutStrategy: 'auto',
        })

        setPreview({
          jsonContent: text,
          plan,
          summary,
          validation: validationResult.validation
        })
        setShowJsonPreview(false)
      } catch (parseError) {
        setError((parseError as Error).message)
      }
    } catch (err) {
      setError((err as Error).message)
      setSuccessMessage(null)
    } finally {
      setLoading(false)
      // Reset input so same file can be selected again
      e.target.value = ''
    }
  }

  const handleConfirmImport = async () => {
    if (!preview) return

    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (useValidation) {
        // Use new validation pipeline
        const result = await loadPlanWithValidation(preview.jsonContent)

        if (result.hasCollisions) {
          // Collisions detected - dialog will be shown via pendingCollisions state
          setLoading(false)
          return
        }
      } else {
        // Use original quick import
        await loadPlan(preview.jsonContent)
      }

      // Get the updated state directly from the store
      const updatedState = useTerraformStore.getState().afterState
      const nodeCount = updatedState?.nodes?.length || 0
      setSuccessMessage(`Successfully imported ${nodeCount} resource${nodeCount !== 1 ? 's' : ''}!`)
      setError(null)
      setPreview(null)
      setShowJsonPreview(false)
    } catch (err) {
      setError((err as Error).message)
      setSuccessMessage(null)
    } finally {
      setLoading(false)
    }
  }

  const handleResolveCollisions = async (resolutions: Map<number, CollisionResolution>) => {
    setLoading(true)
    setError(null)

    try {
      await resolveCollisionsAndImport(resolutions)

      const updatedState = useTerraformStore.getState().afterState
      const nodeCount = updatedState?.nodes?.length || 0
      setSuccessMessage(`Successfully imported ${nodeCount} resource${nodeCount !== 1 ? 's' : ''}!`)
      setPreview(null)
      setShowJsonPreview(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelCollisionDialog = () => {
    useTerraformStore.getState().clearValidationState()
    setPreview(null)
  }

  const handleCancelPreview = () => {
    setPreview(null)
    setShowJsonPreview(false)
    setError(null)
  }


  // Get resource type breakdown for summary
  const getResourceTypeBreakdown = () => {
    if (!preview) return {}
    const breakdown: Record<string, number> = {}
    preview.plan.resource_changes.forEach(change => {
      breakdown[change.type] = (breakdown[change.type] || 0) + 1
    })
    return breakdown
  }

  // Show collision resolution dialog if collisions pending
  if (pendingCollisions && pendingCollisions.length > 0) {
    return (
      <div className="space-y-4">
        <ImportValidationDialog
          collisions={pendingCollisions}
          onResolve={handleResolveCollisions}
          onCancel={handleCancelCollisionDialog}
          loading={loading}
        />
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // Show audit report if available
  if (auditReport) {
    return (
      <div className="space-y-4">
        <ImportAuditReport
          report={auditReport}
          onDismiss={clearAuditReport}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!preview ? (
        /* Upload JSON File */
        <div className="p-4 border-2 border-dashed rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-green-600" />
            <h3 className="font-medium">Upload Plan JSON</h3>
          </div>
          <p className="text-sm text-gray-600">
            Upload a pre-generated Terraform plan JSON file
          </p>

          {/* Validation Toggle */}
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <input
              type="checkbox"
              id="use-validation"
              checked={useValidation}
              onChange={(e) => setUseValidation(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="use-validation" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <Shield className="w-4 h-4 text-blue-600" />
              Enable duplicate detection & integrity validation
            </label>
          </div>

          <Button
            onClick={handleSelectJsonFile}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FileJson className="w-4 h-4 mr-2" />
                Select JSON File
              </>
            )}
          </Button>
          {/* Hidden HTML input as fallback */}
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
            id="terraform-file-input"
          />
        </div>
      ) : (
        /* Preview and Confirmation */
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-lg">Review Terraform Plan</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelPreview}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Plan Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{preview.summary.create}</div>
                <div className="text-xs text-blue-600">Create</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{preview.summary.update}</div>
                <div className="text-xs text-yellow-600">Update</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{preview.summary.delete}</div>
                <div className="text-xs text-red-600">Delete</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{preview.summary.total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>

            {/* Resource Types */}
            <div className="mt-3">
              <h5 className="text-xs font-medium text-gray-600 mb-2">Resource Types:</h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(getResourceTypeBreakdown()).map(([type, count]) => (
                  <span key={type} className="px-2 py-1 bg-gray-100 rounded text-xs">
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Mode Indicator */}
          {useValidation && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Validation enabled: Will check for duplicates and validate topology integrity
              </span>
            </div>
          )}

          {/* Validation Warnings */}
          {preview.validation && !preview.validation.isValid && (
            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <h4 className="font-medium text-sm text-yellow-800">Validation Warnings</h4>
              </div>

              {preview.validation.warnings.length > 0 && (
                <div className="text-xs text-yellow-700 space-y-1">
                  <div className="font-medium">Warnings ({preview.validation.warnings.length}):</div>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    {preview.validation.warnings.slice(0, 5).map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                    {preview.validation.warnings.length > 5 && (
                      <li className="italic">... and {preview.validation.warnings.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {preview.validation.missingEdges.length > 0 && (
                <div className="text-xs text-yellow-700 space-y-1">
                  <div className="font-medium">Missing Edges ({preview.validation.missingEdges.length}):</div>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    {preview.validation.missingEdges.slice(0, 3).map((edge, idx) => (
                      <li key={idx}>{edge.reason}</li>
                    ))}
                    {preview.validation.missingEdges.length > 3 && (
                      <li className="italic">... and {preview.validation.missingEdges.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              {preview.validation.orphanedResources.length > 0 && (
                <div className="text-xs text-yellow-700 space-y-1">
                  <div className="font-medium">Orphaned Resources ({preview.validation.orphanedResources.length}):</div>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    {preview.validation.orphanedResources.slice(0, 3).map((resource, idx) => (
                      <li key={idx}>{resource}</li>
                    ))}
                    {preview.validation.orphanedResources.length > 3 && (
                      <li className="italic">... and {preview.validation.orphanedResources.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="text-xs text-yellow-600 italic mt-2">
                You can proceed with import, but some connections may be missing.
              </div>
            </div>
          )}

          {/* JSON Preview (Collapsible) */}
          <div className="border rounded-lg">
            <button
              onClick={() => setShowJsonPreview(!showJsonPreview)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium">View JSON</span>
              {showJsonPreview ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showJsonPreview && (
              <div className="border-t p-3 bg-gray-50 max-h-96 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(preview.jsonContent), null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Confirmation Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleCancelPreview}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {useValidation ? 'Validating...' : 'Importing...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {useValidation ? 'Validate & Import' : 'Confirm & Import'}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Success/Error/Progress Display */}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {planProgress && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-mono text-blue-900 whitespace-pre-wrap">
            {planProgress}
          </p>
        </div>
      )}
    </div>
  )
}
