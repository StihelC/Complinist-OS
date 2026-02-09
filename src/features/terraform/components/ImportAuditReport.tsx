/**
 * Import Audit Report
 *
 * Displays the integrity audit report after Terraform import,
 * including issues, warnings, and recommendations.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Check,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Info,
} from 'lucide-react';
import type { IntegrityAuditReport, AuditStatus, AuditIssue } from '@/lib/terraform/validation/types';
import {
  generateAuditReportMarkdown,
  generateAuditReportJSON,
  generateAuditReportHTML,
} from '@/lib/terraform/validation/auditReportGenerator';

interface ImportAuditReportProps {
  report: IntegrityAuditReport;
  onDismiss: () => void;
  onExport?: (format: 'markdown' | 'json' | 'html') => void;
}

export function ImportAuditReport({
  report,
  onDismiss,
  onExport,
}: ImportAuditReportProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const getStatusIcon = (status: AuditStatus) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'fail':
        return <XCircle className="w-6 h-6 text-red-600" />;
    }
  };

  const getStatusColor = (status: AuditStatus) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'fail':
        return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  const getStatusText = (status: AuditStatus) => {
    switch (status) {
      case 'pass':
        return 'Import Successful';
      case 'warning':
        return 'Import Completed with Warnings';
      case 'fail':
        return 'Import Has Issues';
    }
  };

  const handleExport = (format: 'markdown' | 'json' | 'html') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'markdown':
        content = generateAuditReportMarkdown(report);
        filename = `audit-report-${report.projectId}-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
      case 'json':
        content = generateAuditReportJSON(report);
        filename = `audit-report-${report.projectId}-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'html':
        content = generateAuditReportHTML(report);
        filename = `audit-report-${report.projectId}-${Date.now()}.html`;
        mimeType = 'text/html';
        break;
    }

    // Create and download blob
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportMenu(false);
    onExport?.(format);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderIssue = (issue: AuditIssue) => {
    const severityColors = {
      critical: 'border-red-200 bg-red-50',
      warning: 'border-yellow-200 bg-yellow-50',
      info: 'border-blue-200 bg-blue-50',
    };

    const severityIcons = {
      critical: <XCircle className="w-4 h-4 text-red-600" />,
      warning: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
      info: <Info className="w-4 h-4 text-blue-600" />,
    };

    return (
      <div
        key={issue.id}
        className={`p-3 rounded-lg border ${severityColors[issue.severity]}`}
      >
        <div className="flex items-start gap-2">
          {severityIcons[issue.severity]}
          <div className="flex-1">
            <div className="font-medium text-sm">{issue.message}</div>
            <div className="text-xs text-gray-600 mt-1">
              <span className="font-medium">Category:</span> {issue.category}
              {issue.autoFixable && (
                <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                  Auto-fixable
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              <span className="font-medium">Suggested:</span> {issue.suggestedAction}
            </div>
            {issue.affectedNodes.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Affected: {issue.affectedNodes.slice(0, 5).join(', ')}
                {issue.affectedNodes.length > 5 && ` (+${issue.affectedNodes.length - 5} more)`}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={`p-4 space-y-4 border-2 ${getStatusColor(report.overallStatus)}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon(report.overallStatus)}
          <div>
            <h3 className="font-medium text-lg">{getStatusText(report.overallStatus)}</h3>
            <p className="text-sm text-gray-600">
              {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border z-10">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => handleExport('markdown')}
                >
                  <FileText className="w-4 h-4" />
                  Markdown
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => handleExport('json')}
                >
                  <FileText className="w-4 h-4" />
                  JSON
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => handleExport('html')}
                >
                  <FileText className="w-4 h-4" />
                  HTML
                </button>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-lg border">
          <div className="text-2xl font-bold text-gray-700">
            {report.statistics.newDevicesImported}
          </div>
          <div className="text-xs text-gray-600">Devices Imported</div>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <div className="text-2xl font-bold text-gray-700">
            {report.statistics.newBoundariesImported}
          </div>
          <div className="text-xs text-gray-600">Boundaries Created</div>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <div className="text-2xl font-bold text-gray-700">
            {report.statistics.newEdgesImported}
          </div>
          <div className="text-xs text-gray-600">Connections Added</div>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <div className="text-2xl font-bold text-gray-700">
            {report.statistics.duplicatesSkipped}
          </div>
          <div className="text-xs text-gray-600">Duplicates Skipped</div>
        </div>
      </div>

      {/* Validation Checks */}
      <div className="space-y-2">
        <button
          className="w-full flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-50"
          onClick={() => toggleSection('checks')}
        >
          <span className="font-medium text-sm">Validation Checks</span>
          {expandedSection === 'checks' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {expandedSection === 'checks' && (
          <div className="p-3 bg-white rounded-lg border space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Duplicate Check</span>
              <span className={report.duplicateCheck.passed ? 'text-green-600' : 'text-red-600'}>
                {report.duplicateCheck.passed ? 'PASS' : `FAIL (${report.duplicateCheck.duplicateCount})`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Boundary Check</span>
              <span className={report.boundaryCheck.passed ? 'text-green-600' : 'text-yellow-600'}>
                {report.boundaryCheck.passed ? 'PASS' : `${report.boundaryCheck.orphanedDeviceCount} orphaned`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Connection Check</span>
              <span className={report.connectionCheck.passed ? 'text-green-600' : 'text-yellow-600'}>
                {report.connectionCheck.passed ? 'PASS' : `${report.connectionCheck.invalidEdgeCount} invalid`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Orphan Check</span>
              <span className={report.orphanCheck.passed ? 'text-green-600' : 'text-yellow-600'}>
                {report.orphanCheck.passed ? 'PASS' : `${report.orphanCheck.orphanCount} orphans`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Hierarchy Check</span>
              <span className={report.hierarchyCheck.passed ? 'text-green-600' : 'text-red-600'}>
                {report.hierarchyCheck.passed ? 'PASS' : `${report.hierarchyCheck.violationCount} violations`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Critical Issues */}
      {report.criticalIssues.length > 0 && (
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100"
            onClick={() => toggleSection('critical')}
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="font-medium text-sm text-red-800">
                Critical Issues ({report.criticalIssues.length})
              </span>
            </div>
            {expandedSection === 'critical' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSection === 'critical' && (
            <div className="space-y-2">
              {report.criticalIssues.map(renderIssue)}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100"
            onClick={() => toggleSection('warnings')}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-sm text-yellow-800">
                Warnings ({report.warnings.length})
              </span>
            </div>
            {expandedSection === 'warnings' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSection === 'warnings' && (
            <div className="space-y-2">
              {report.warnings.map(renderIssue)}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100"
            onClick={() => toggleSection('recommendations')}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm text-blue-800">
                Recommendations ({report.recommendations.length})
              </span>
            </div>
            {expandedSection === 'recommendations' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSection === 'recommendations' && (
            <div className="space-y-2">
              {report.recommendations.map((rec) => (
                <div
                  key={rec.priority}
                  className="p-3 bg-white rounded-lg border border-blue-100"
                >
                  <div className="font-medium text-sm">
                    {rec.priority}. {rec.title}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{rec.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dismiss Button */}
      <div className="flex justify-end pt-2 border-t">
        <Button onClick={onDismiss}>
          <Check className="w-4 h-4 mr-2" />
          Done
        </Button>
      </div>
    </Card>
  );
}
