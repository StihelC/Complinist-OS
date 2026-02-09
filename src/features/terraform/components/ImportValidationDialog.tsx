/**
 * Import Validation Dialog
 *
 * Displays resource collisions detected during Terraform import and
 * allows users to resolve them before proceeding.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  Plus,
  SkipForward,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ResourceCollision, CollisionResolution } from '@/lib/terraform/validation/types';

interface ImportValidationDialogProps {
  collisions: ResourceCollision[];
  onResolve: (resolutions: Map<number, CollisionResolution>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ImportValidationDialog({
  collisions,
  onResolve,
  onCancel,
  loading = false,
}: ImportValidationDialogProps) {
  const [resolutions, setResolutions] = useState<Map<number, CollisionResolution>>(new Map());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const setResolution = (index: number, resolution: CollisionResolution) => {
    const newResolutions = new Map(resolutions);
    newResolutions.set(index, resolution);
    setResolutions(newResolutions);
  };

  const applyToAll = (resolution: CollisionResolution) => {
    const newResolutions = new Map<number, CollisionResolution>();
    collisions.forEach((_, index) => {
      newResolutions.set(index, resolution);
    });
    setResolutions(newResolutions);
  };

  const allResolved = collisions.every((_, index) => resolutions.has(index));

  const getCollisionTypeLabel = (type: ResourceCollision['collisionType']) => {
    switch (type) {
      case 'exact_match':
        return 'Exact Match';
      case 'same_address':
        return 'Same Address';
      case 'same_name':
        return 'Same Name';
      default:
        return type;
    }
  };

  const getCollisionTypeColor = (type: ResourceCollision['collisionType']) => {
    switch (type) {
      case 'exact_match':
        return 'text-red-600 bg-red-50';
      case 'same_address':
        return 'text-orange-600 bg-orange-50';
      case 'same_name':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleProceed = () => {
    onResolve(resolutions);
  };

  return (
    <Card className="p-4 space-y-4 border-yellow-200 bg-yellow-50/30">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <h3 className="font-medium text-lg">Resource Collisions Detected</h3>
      </div>

      <p className="text-sm text-gray-600">
        The following {collisions.length} resource(s) already exist in the topology.
        Choose how to handle each collision before proceeding.
      </p>

      {/* Batch Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyToAll('skip')}
        >
          <SkipForward className="w-3 h-3 mr-1" />
          Skip All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyToAll('replace')}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Replace All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyToAll('create_new')}
        >
          <Plus className="w-3 h-3 mr-1" />
          Create All As New
        </Button>
      </div>

      {/* Collision List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {collisions.map((collision, index) => (
          <div
            key={index}
            className="border rounded-lg bg-white overflow-hidden"
          >
            {/* Collision Header */}
            <div
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCollisionTypeColor(collision.collisionType)}`}>
                  {getCollisionTypeLabel(collision.collisionType)}
                </span>
                <span className="font-mono text-sm">
                  {collision.incomingResource.address}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {resolutions.has(index) && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    {resolutions.get(index)}
                  </span>
                )}
                {expandedIndex === index ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedIndex === index && (
              <div className="border-t p-3 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-700 mb-1">Incoming Resource</div>
                    <div className="font-mono text-xs bg-white p-2 rounded border">
                      <div><strong>Type:</strong> {collision.incomingResource.type}</div>
                      <div><strong>Name:</strong> {collision.incomingResource.name}</div>
                      <div><strong>Provider:</strong> {collision.incomingResource.provider_name}</div>
                      <div><strong>External ID:</strong> {collision.incomingExternalId.fullId}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700 mb-1">Existing Node</div>
                    <div className="font-mono text-xs bg-white p-2 rounded border">
                      <div><strong>ID:</strong> {collision.existingNode.id}</div>
                      <div><strong>Type:</strong> {collision.existingNode.type}</div>
                      {collision.existingExternalId && (
                        <div><strong>External ID:</strong> {collision.existingExternalId.fullId}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div className="flex gap-2">
                  <Button
                    variant={resolutions.get(index) === 'skip' ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResolution(index, 'skip');
                    }}
                  >
                    <SkipForward className="w-3 h-3 mr-1" />
                    Skip
                  </Button>
                  <Button
                    variant={resolutions.get(index) === 'replace' ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResolution(index, 'replace');
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Replace
                  </Button>
                  <Button
                    variant={resolutions.get(index) === 'create_new' ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setResolution(index, 'create_new');
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Create New
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resolution Summary */}
      <div className="text-sm text-gray-600">
        {resolutions.size} of {collisions.length} collisions resolved
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!allResolved || loading}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Proceed with Import
            </>
          )}
        </Button>
      </div>

      {!allResolved && (
        <p className="text-xs text-yellow-600">
          Please resolve all collisions before proceeding.
        </p>
      )}
    </Card>
  );
}
