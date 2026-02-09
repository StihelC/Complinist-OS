import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BoundaryNodeData, BoundaryType } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { isDescendant, calculateNestingDepth } from '@/lib/utils/utils';
import { ChevronRight } from 'lucide-react';

export const BoundaryProperties = () => {
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const nodes = useFlowStore((state) => state.nodes);
  const updateNode = useFlowStore((state) => state.updateNode);
  const setNodes = useFlowStore((state) => state.setNodes);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const data = selectedNode?.data as BoundaryNodeData;

  // Get all boundary nodes for parent selection (excluding self and descendants)
  const availableParentBoundaries = useMemo(() => {
    if (!selectedNodeId) return [];

    return nodes
      .filter((n) => {
        // Must be a boundary node
        if (n.type !== 'boundary') return false;
        // Cannot be self
        if (n.id === selectedNodeId) return false;
        // Cannot be a descendant (prevents circular nesting)
        if (isDescendant(n.id, selectedNodeId, nodes)) return false;
        return true;
      })
      .map((n) => ({
        id: n.id,
        label: (n.data as BoundaryNodeData).label,
        depth: calculateNestingDepth(n.id, nodes),
      }))
      .sort((a, b) => a.depth - b.depth); // Sort by depth for visual hierarchy
  }, [nodes, selectedNodeId]);

  // Get nesting path for display
  const nestingPath = useMemo(() => {
    if (!selectedNode) return [];

    const path: Array<{ id: string; label: string }> = [];
    let currentNode: typeof selectedNode | undefined = selectedNode;

    while (currentNode?.parentId) {
      const parentNode = nodes.find((n) => n.id === currentNode!.parentId);
      if (parentNode && parentNode.type === 'boundary') {
        const parentData = parentNode.data as BoundaryNodeData;
        path.unshift({ id: parentNode.id, label: parentData.label });
      }
      currentNode = parentNode;
    }

    return path;
  }, [selectedNode, nodes]);

  // Current nesting level
  const nestingLevel = useMemo(() => {
    if (!selectedNodeId) return 0;
    return calculateNestingDepth(selectedNodeId, nodes);
  }, [selectedNodeId, nodes]);

  if (!data || !selectedNodeId) {
    return null;
  }

  const handleChange = (field: keyof BoundaryNodeData, value: unknown) => {
    updateNode(selectedNodeId, { [field]: value });
  };

  // Handle parent boundary change - updates both React Flow's parentId and our custom parentBoundaryId
  const handleParentChange = (newParentId: string) => {
    const currentNode = nodes.find((n) => n.id === selectedNodeId);
    if (!currentNode) return;

    // Update node with new parent
    const updatedNodes = nodes.map((n) => {
      if (n.id === selectedNodeId) {
        if (newParentId === '') {
          // Remove parent - clear both parentId and extent
          const { parentId, extent, ...rest } = n;
          return {
            ...rest,
            data: {
              ...n.data,
              parentBoundaryId: undefined,
            },
          };
        } else {
          // Set new parent
          const parentNode = nodes.find((p) => p.id === newParentId);
          if (!parentNode) return n;

          // Calculate relative position within new parent
          const newPosition = {
            x: Math.max(20, currentNode.position.x - (parentNode.position.x || 0)),
            y: Math.max(20, currentNode.position.y - (parentNode.position.y || 0)),
          };

          return {
            ...n,
            parentId: newParentId,
            extent: 'parent' as const,
            position: newPosition,
            data: {
              ...n.data,
              parentBoundaryId: newParentId,
            },
          };
        }
      }
      return n;
    });

    setNodes(updatedNodes);
  };

  // Boundary type display names
  const boundaryTypeOptions: Array<{ value: BoundaryType; label: string }> = [
    { value: 'ato', label: 'Authorization Boundary (ATO)' },
    { value: 'network_segment', label: 'Network Segment' },
    { value: 'security_zone', label: 'Security Zone' },
    { value: 'physical_location', label: 'Physical Location' },
    { value: 'datacenter', label: 'Datacenter' },
    { value: 'office', label: 'Office' },
    { value: 'cloud_region', label: 'Cloud Region' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">Boundary Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nesting Path Breadcrumb */}
        {nestingPath.length > 0 && (
          <div className="bg-gray-50 rounded-md p-2 text-sm">
            <Label className="text-xs text-gray-500 mb-1 block">Nesting Path</Label>
            <div className="flex items-center flex-wrap gap-1">
              {nestingPath.map((item) => (
                <span key={item.id} className="flex items-center">
                  <span className="text-blue-600 hover:underline cursor-pointer">
                    {item.label}
                  </span>
                  <ChevronRight className="w-3 h-3 mx-1 text-gray-400" />
                </span>
              ))}
              <span className="font-semibold">{data.label}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Level: {nestingLevel}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="label">Boundary Name</Label>
          <Input
            id="label"
            value={data.label}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Enter boundary name..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Tip: Double-click the label on the canvas to edit inline
          </p>
        </div>

        <div>
          <Label htmlFor="type">Visual Style</Label>
          <Select
            id="type"
            value={data.type}
            onChange={(e) => handleChange('type', e.target.value as BoundaryType)}
          >
            {boundaryTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Controls the visual appearance (color, border style)
          </p>
        </div>

        {/* Parent Boundary Selector */}
        <div>
          <Label htmlFor="parentBoundary">Parent Boundary</Label>
          <Select
            id="parentBoundary"
            value={selectedNode?.parentId || ''}
            onChange={(e) => handleParentChange(e.target.value)}
          >
            <option value="">None (Root Level)</option>
            {availableParentBoundaries.map((boundary) => (
              <option key={boundary.id} value={boundary.id}>
                {'  '.repeat(boundary.depth)}{boundary.depth > 0 ? '└ ' : ''}{boundary.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Nest this boundary inside another boundary
          </p>
        </div>

        <div>
          <Label htmlFor="securityLevel">Security Level</Label>
          <Select
            id="securityLevel"
            value={data.securityLevel || ''}
            onChange={(e) => handleChange('securityLevel', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="unclassified">Unclassified</option>
            <option value="confidential">Confidential</option>
            <option value="secret">Secret</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="zoneType">Zone Type</Label>
          <Select
            id="zoneType"
            value={data.zoneType || ''}
            onChange={(e) => handleChange('zoneType', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="untrusted">Untrusted</option>
            <option value="dmz">DMZ</option>
            <option value="trusted">Trusted</option>
            <option value="internal">Internal</option>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="requiresAuthentication"
            checked={data.requiresAuthentication || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange('requiresAuthentication', e.target.checked)
            }
          />
          <Label htmlFor="requiresAuthentication">Requires Authentication</Label>
        </div>

        <div>
          <Label htmlFor="dataTypesProcessed">Data Types Processed (comma-separated)</Label>
          <Input
            id="dataTypesProcessed"
            value={data.dataTypesProcessed?.join(', ') || ''}
            onChange={(e) =>
              handleChange(
                'dataTypesProcessed',
                e.target.value.split(',').map((s) => s.trim())
              )
            }
            placeholder="PII, PHI, Financial"
          />
        </div>
      </CardContent>
    </Card>
  );
};

