/**
 * Error Filters Panel
 *
 * Provides filter controls for the error dashboard.
 */

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';
import type { ErrorFilters } from '@/core/stores/useErrorDashboardStore';

interface ErrorFiltersPanelProps {
  filters: ErrorFilters;
  onFilterChange: <K extends keyof ErrorFilters>(key: K, value: ErrorFilters[K]) => void;
  onReset: () => void;
}

export function ErrorFiltersPanel({ filters, onFilterChange, onReset }: ErrorFiltersPanelProps) {
  return (
    <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-4 flex-wrap">
      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Category:</label>
        <Select
          value={filters.category}
          onChange={(e) => onFilterChange('category', e.target.value)}
          className="w-40"
        >
          <option value="all">All Categories</option>
          <option value="database">Database</option>
          <option value="network">Network</option>
          <option value="ipc">IPC</option>
          <option value="validation">Validation</option>
          <option value="file">File</option>
          <option value="ai">AI</option>
          <option value="auth">Auth</option>
          <option value="export">Export</option>
          <option value="import">Import</option>
          <option value="render">Render</option>
          <option value="unknown">Unknown</option>
        </Select>
      </div>

      {/* Severity Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Severity:</label>
        <Select
          value={filters.severity}
          onChange={(e) => onFilterChange('severity', e.target.value)}
          className="w-36"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </Select>
      </div>

      {/* Source Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Source:</label>
        <Select
          value={filters.source}
          onChange={(e) => onFilterChange('source', e.target.value)}
          className="w-36"
        >
          <option value="all">All Sources</option>
          <option value="main">Main Process</option>
          <option value="renderer">Renderer</option>
          <option value="unknown">Unknown</option>
        </Select>
      </div>

      <div className="flex-1" />

      {/* Reset Button */}
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset Filters
      </Button>
    </div>
  );
}
