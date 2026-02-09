/**
 * Audit Report Generator
 *
 * Generates human-readable and machine-readable reports from
 * integrity audit results.
 */

import type {
  IntegrityAuditReport,
  AuditStatus,
  AuditIssue,
  AuditRecommendation,
} from './types';

/**
 * Get status badge/emoji for audit status
 */
function getStatusBadge(status: AuditStatus): string {
  switch (status) {
    case 'pass':
      return 'PASSED';
    case 'warning':
      return 'WARNING';
    case 'fail':
      return 'FAILED';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '[CRITICAL]';
    case 'warning':
      return '[WARNING]';
    case 'info':
      return '[INFO]';
    default:
      return '';
  }
}

/**
 * Format issues list for markdown
 */
function formatIssues(issues: AuditIssue[]): string {
  if (issues.length === 0) {
    return '_No issues found_\n';
  }

  const lines: string[] = [];
  for (const issue of issues) {
    lines.push(`### ${getSeverityIcon(issue.severity)} ${issue.message}`);
    lines.push('');
    lines.push(`- **Category:** ${issue.category}`);
    lines.push(`- **Auto-fixable:** ${issue.autoFixable ? 'Yes' : 'No'}`);
    lines.push(`- **Suggested Action:** ${issue.suggestedAction}`);

    if (issue.affectedNodes.length > 0) {
      lines.push(`- **Affected Nodes:** ${issue.affectedNodes.slice(0, 10).join(', ')}${issue.affectedNodes.length > 10 ? ` (and ${issue.affectedNodes.length - 10} more)` : ''}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format recommendations list for markdown
 */
function formatRecommendations(recommendations: AuditRecommendation[]): string {
  if (recommendations.length === 0) {
    return '_No recommendations_\n';
  }

  const lines: string[] = [];
  for (const rec of recommendations) {
    lines.push(`### ${rec.priority}. ${rec.title}`);
    lines.push('');
    lines.push(rec.description);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate markdown audit report
 */
export function generateAuditReportMarkdown(report: IntegrityAuditReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# CompliNIST Import Audit Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`**Project:** ${report.projectName} (ID: ${report.projectId})`);
  lines.push(`**Import Source:** ${report.importSource}`);
  lines.push(`**Status:** ${getStatusBadge(report.overallStatus)}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Nodes | ${report.totalNodes} |`);
  lines.push(`| Total Devices | ${report.totalDevices} |`);
  lines.push(`| Total Boundaries | ${report.totalBoundaries} |`);
  lines.push(`| Total Connections | ${report.totalEdges} |`);
  lines.push(`| Critical Issues | ${report.criticalIssues.length} |`);
  lines.push(`| Warnings | ${report.warnings.length} |`);
  lines.push('');

  // Import Statistics
  lines.push('## Import Statistics');
  lines.push('');
  lines.push(`- **New devices imported:** ${report.statistics.newDevicesImported}`);
  lines.push(`- **New boundaries imported:** ${report.statistics.newBoundariesImported}`);
  lines.push(`- **New edges imported:** ${report.statistics.newEdgesImported}`);
  lines.push(`- **Duplicates skipped:** ${report.statistics.duplicatesSkipped}`);
  lines.push(`- **Auto-repaired issues:** ${report.statistics.autoRepairedIssues}`);
  lines.push(`- **Manual intervention required:** ${report.statistics.manualInterventionRequired}`);
  lines.push('');

  // Validation Results
  lines.push('## Validation Results');
  lines.push('');
  lines.push('| Check | Status | Details |');
  lines.push('|-------|--------|---------|');
  lines.push(`| Duplicates | ${report.duplicateCheck.passed ? 'PASS' : 'FAIL'} | ${report.duplicateCheck.duplicateCount} duplicate(s) |`);
  lines.push(`| Boundaries | ${report.boundaryCheck.passed ? 'PASS' : 'FAIL'} | ${report.boundaryCheck.orphanedDeviceCount} orphaned, ${report.boundaryCheck.hierarchyViolations} violations |`);
  lines.push(`| Connections | ${report.connectionCheck.passed ? 'PASS' : 'FAIL'} | ${report.connectionCheck.invalidEdgeCount} invalid, ${report.connectionCheck.repairedEdgeCount} repaired |`);
  lines.push(`| Orphans | ${report.orphanCheck.passed ? 'PASS' : 'FAIL'} | ${report.orphanCheck.orphanCount} orphan(s) |`);
  lines.push(`| Hierarchy | ${report.hierarchyCheck.passed ? 'PASS' : 'FAIL'} | ${report.hierarchyCheck.violationCount} violation(s) |`);
  lines.push('');

  // Critical Issues
  lines.push('## Critical Issues');
  lines.push('');
  lines.push(formatIssues(report.criticalIssues));

  // Warnings
  lines.push('## Warnings');
  lines.push('');
  lines.push(formatIssues(report.warnings));

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  lines.push(formatRecommendations(report.recommendations));

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('_Generated by CompliNIST Terraform Import Validation System_');

  return lines.join('\n');
}

/**
 * Generate JSON audit report
 */
export function generateAuditReportJSON(report: IntegrityAuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generate a brief summary for UI display
 */
export function generateAuditSummary(report: IntegrityAuditReport): {
  status: AuditStatus;
  statusText: string;
  summary: string;
  criticalCount: number;
  warningCount: number;
} {
  let summary: string;

  if (report.overallStatus === 'pass') {
    summary = `Import successful: ${report.statistics.newDevicesImported} devices and ${report.statistics.newBoundariesImported} boundaries imported.`;
  } else if (report.overallStatus === 'warning') {
    summary = `Import completed with warnings: ${report.warnings.length} issue(s) require attention.`;
  } else {
    summary = `Import has critical issues: ${report.criticalIssues.length} problem(s) must be resolved.`;
  }

  return {
    status: report.overallStatus,
    statusText: getStatusBadge(report.overallStatus),
    summary,
    criticalCount: report.criticalIssues.length,
    warningCount: report.warnings.length,
  };
}

/**
 * Generate HTML audit report (for export)
 */
export function generateAuditReportHTML(report: IntegrityAuditReport): string {
  const statusColor = {
    pass: '#22c55e',
    warning: '#f59e0b',
    fail: '#ef4444',
  }[report.overallStatus];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CompliNIST Import Audit Report - ${report.projectName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; color: white; background: ${statusColor}; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .issue { background: #fff5f5; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .recommendation { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 10px; margin: 10px 0; }
    .meta { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>CompliNIST Import Audit Report</h1>

  <p class="meta">
    Generated: ${new Date(report.timestamp).toLocaleString()}<br>
    Project: ${report.projectName} (ID: ${report.projectId})<br>
    Import Source: ${report.importSource}
  </p>

  <p>Status: <span class="status">${getStatusBadge(report.overallStatus)}</span></p>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Count</th></tr>
    <tr><td>Total Nodes</td><td>${report.totalNodes}</td></tr>
    <tr><td>Total Devices</td><td>${report.totalDevices}</td></tr>
    <tr><td>Total Boundaries</td><td>${report.totalBoundaries}</td></tr>
    <tr><td>Total Connections</td><td>${report.totalEdges}</td></tr>
    <tr><td>Critical Issues</td><td>${report.criticalIssues.length}</td></tr>
    <tr><td>Warnings</td><td>${report.warnings.length}</td></tr>
  </table>

  <h2>Import Statistics</h2>
  <ul>
    <li>New devices imported: ${report.statistics.newDevicesImported}</li>
    <li>New boundaries imported: ${report.statistics.newBoundariesImported}</li>
    <li>New edges imported: ${report.statistics.newEdgesImported}</li>
    <li>Duplicates skipped: ${report.statistics.duplicatesSkipped}</li>
    <li>Auto-repaired issues: ${report.statistics.autoRepairedIssues}</li>
  </ul>

  ${report.criticalIssues.length > 0 ? `
  <h2>Critical Issues</h2>
  ${report.criticalIssues.map(issue => `
    <div class="issue">
      <strong>[${issue.category.toUpperCase()}]</strong> ${issue.message}<br>
      <small>Suggested: ${issue.suggestedAction}</small>
    </div>
  `).join('')}
  ` : ''}

  ${report.warnings.length > 0 ? `
  <h2>Warnings</h2>
  ${report.warnings.map(issue => `
    <div class="issue warning">
      <strong>[${issue.category.toUpperCase()}]</strong> ${issue.message}<br>
      <small>Suggested: ${issue.suggestedAction}</small>
    </div>
  `).join('')}
  ` : ''}

  ${report.recommendations.length > 0 ? `
  <h2>Recommendations</h2>
  ${report.recommendations.map(rec => `
    <div class="recommendation">
      <strong>${rec.priority}. ${rec.title}</strong><br>
      ${rec.description}
    </div>
  `).join('')}
  ` : ''}

  <hr>
  <p class="meta">Generated by CompliNIST Terraform Import Validation System</p>
</body>
</html>
`;
}
