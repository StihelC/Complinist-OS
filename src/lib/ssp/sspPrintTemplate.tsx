/**
 * SSP Print Template
 *
 * React component that renders a System Security Plan for PDF generation.
 * Uses Tailwind classes with print-specific CSS for optimal PDF output via Electron's printToPDF.
 * Uses standardized control name formatting for consistency.
 */

import React from 'react';
import { SSPDocument, NISTControl } from '@/lib/utils/types';
import { formatControlForSSP, getFamilyName } from '@/lib/controls/formatter';

interface SSPPrintTemplateProps {
  sspDoc: SSPDocument;
}

// getFamilyName is now imported from @/lib/controls/formatter

/**
 * Main SSP Print Template Component
 */
export const SSPPrintTemplate: React.FC<SSPPrintTemplateProps> = ({ sspDoc }) => {
  const { metadata, topology, inventory, controls } = sspDoc;

  // Group controls by family
  const controlsByFamily = new Map<string, NISTControl[]>();
  controls.forEach(control => {
    if (!controlsByFamily.has(control.family)) {
      controlsByFamily.set(control.family, []);
    }
    controlsByFamily.get(control.family)!.push(control);
  });

  return (
    <div className="ssp-print-document">
      <style>{`
        @page {
          size: letter;
          margin: 0.75in;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
          }

          .page-break {
            page-break-after: always;
          }

          .page-break-avoid {
            page-break-inside: avoid;
          }

          table {
            page-break-inside: avoid;
          }

          h1, h2, h3, h4 {
            page-break-after: avoid;
          }

          /* Remove backgrounds for print economy */
          .print-no-bg {
            background: none !important;
          }

          /* Ensure proper text color */
          * {
            color-adjust: exact;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        .ssp-print-document {
          font-family: 'Times New Roman', Times, serif;
          max-width: 100%;
        }

        .ssp-title {
          font-size: 28pt;
          font-weight: bold;
          text-align: center;
          color: #1e40af;
          margin-top: 100px;
          margin-bottom: 60px;
        }

        .ssp-system-name {
          font-size: 22pt;
          font-weight: bold;
          text-align: center;
          margin-bottom: 50px;
        }

        .ssp-metadata-line {
          font-size: 13pt;
          text-align: center;
          margin-bottom: 12px;
        }

        .section-title {
          font-size: 18pt;
          font-weight: bold;
          color: #1e40af;
          margin-top: 25px;
          margin-bottom: 20px;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 5px;
        }

        .subsection-title {
          font-size: 15pt;
          font-weight: bold;
          margin-top: 20px;
          margin-bottom: 12px;
        }

        .subsub-title {
          font-size: 13pt;
          font-weight: bold;
          margin-top: 15px;
          margin-bottom: 10px;
        }

        .body-text {
          font-size: 11pt;
          line-height: 1.5;
          margin-bottom: 15px;
        }

        .toc-item {
          font-size: 12pt;
          margin: 6px 0;
        }

        .toc-subitem {
          font-size: 11pt;
          margin: 4px 0 4px 20px;
          color: #4b5563;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 10pt;
        }

        th {
          background-color: #1e40af;
          color: white;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #ccc;
        }

        td {
          padding: 6px 8px;
          border: 1px solid #ccc;
        }

        tr:nth-child(even) {
          background-color: #f9fafb;
        }

        .control-title {
          font-size: 11pt;
          font-weight: bold;
          color: #1e40af;
          margin-top: 12px;
          margin-bottom: 6px;
        }

        .control-text {
          font-size: 10pt;
          line-height: 1.4;
          margin-left: 12px;
          margin-bottom: 10px;
        }

        .implementation-status {
          color: #059669;
          font-weight: bold;
        }

        ul {
          margin: 8px 0;
          padding-left: 30px;
        }

        li {
          margin: 4px 0;
        }
      `}</style>

      {/* Cover Page */}
      <div className="page-break-avoid">
        <div className="ssp-title">SYSTEM SECURITY PLAN</div>
        <div className="ssp-system-name">{metadata.system_name}</div>
        <div className="ssp-metadata-line">Organization: {metadata.organization_name}</div>
        <div className="ssp-metadata-line">Prepared By: {metadata.prepared_by}</div>
        <div className="ssp-metadata-line">Baseline: {metadata.baseline}</div>
        <div className="ssp-metadata-line">Date: {metadata.generatedDate}</div>
        <div style={{ textAlign: 'center', marginTop: '80px', fontSize: '11pt', fontStyle: 'italic', color: '#6b7280' }}>
          NIST SP 800-53 Rev 5
        </div>
      </div>
      <div className="page-break"></div>

      {/* Table of Contents */}
      <div className="page-break-avoid">
        <h1 className="section-title">TABLE OF CONTENTS</h1>
        <div className="toc-item">1. System Overview</div>
        <div className="toc-subitem">1.1 System Description</div>
        <div className="toc-subitem">1.2 System Information</div>
        <div className="toc-subitem">1.3 Security Impact Level (FIPS 199)</div>
        <div className="toc-subitem">1.4 Authorization Boundary</div>
        <div className="toc-subitem">1.5 System Status</div>
        <div className="toc-subitem">1.6 Responsible Parties</div>
        <div style={{ marginTop: '10px' }}></div>
        <div className="toc-item">2. System Architecture</div>
        <div className="toc-subitem">2.1 Network Topology</div>
        <div className="toc-subitem">2.2 Device Summary</div>
        <div className="toc-subitem">2.3 System Components and Inventory</div>
        <div style={{ marginTop: '10px' }}></div>
        <div className="toc-item">3. Security Controls</div>
        {metadata.custom_sections && metadata.custom_sections.length > 0 && (
          <>
            <div style={{ marginTop: '10px' }}></div>
            <div className="toc-item">4. Additional Sections</div>
            {metadata.custom_sections.map((section, index) => (
              <div key={index} className="toc-subitem">4.{index + 1} {section.title}</div>
            ))}
          </>
        )}
      </div>
      <div className="page-break"></div>

      {/* 1. System Overview */}
      <h1 className="section-title">1. SYSTEM OVERVIEW</h1>
      
      <h2 className="subsection-title">1.1 System Description</h2>
      <div className="body-text">
        The {metadata.system_name} is operated by {metadata.organization_name}.
        {metadata.system_description && ` ${metadata.system_description}`}
        {metadata.system_purpose && ` This system provides ${metadata.system_purpose} capabilities.`}
        {metadata.deployment_model && metadata.service_model && 
          ` It is deployed as a ${metadata.deployment_model.replace('-', ' ')} solution operating as ${metadata.service_model.toUpperCase()}.`}
        {metadata.physical_location && ` The system is physically located at ${metadata.physical_location}.`}
      </div>

      {(metadata.information_type_title || metadata.data_types_processed) && (
        <>
          <h2 className="subsection-title">1.2 System Information</h2>
          <div className="body-text">
            {metadata.information_type_title && metadata.information_type_description && 
              `This system maintains ${metadata.information_type_title}, which includes ${metadata.information_type_description}. `}
            {metadata.data_types_processed && `The data types processed include: ${metadata.data_types_processed}. `}
            {metadata.users_description && `The system is primarily accessed by ${metadata.users_description}.`}
          </div>
        </>
      )}

      <h2 className="subsection-title">1.3 Security Impact Level (FIPS 199)</h2>
      <div className="body-text">
        Based on FIPS 199 analysis, this system has been categorized with the following impact levels:
      </div>
      <ul>
        <li>Confidentiality: {metadata.confidentiality_impact?.toUpperCase() || 'MODERATE'}</li>
        <li>Integrity: {metadata.integrity_impact?.toUpperCase() || 'MODERATE'}</li>
        <li>Availability: {metadata.availability_impact?.toUpperCase() || 'MODERATE'}</li>
      </ul>

      {metadata.authorization_boundary_description && (
        <>
          <h2 className="subsection-title">1.4 Authorization Boundary</h2>
          <div className="body-text">{metadata.authorization_boundary_description}</div>
        </>
      )}

      <h2 className="subsection-title">{metadata.authorization_boundary_description ? '1.5' : '1.4'} System Status</h2>
      <div className="body-text">
        Current Status: {metadata.system_status?.replace('-', ' ').toUpperCase() || 'OPERATIONAL'}
      </div>

      <h2 className="subsection-title">{metadata.authorization_boundary_description ? '1.6' : '1.5'} Responsible Parties</h2>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Name</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>System Owner</td>
            <td>{metadata.system_owner || 'Not specified'}</td>
            <td>{metadata.system_owner_email || ''}</td>
          </tr>
          <tr>
            <td>Authorizing Official</td>
            <td>{metadata.authorizing_official || 'Not specified'}</td>
            <td>{metadata.authorizing_official_email || ''}</td>
          </tr>
          <tr>
            <td>Security Contact</td>
            <td>{metadata.security_contact || 'Not specified'}</td>
            <td>{metadata.security_contact_email || ''}</td>
          </tr>
          <tr>
            <td>Prepared By</td>
            <td>{metadata.prepared_by}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <h2 className="subsection-title">{metadata.authorization_boundary_description ? '1.7' : '1.6'} System Inventory Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Devices</td>
            <td>{topology.totalDevices}</td>
          </tr>
          <tr>
            <td>Total Connections</td>
            <td>{topology.totalConnections}</td>
          </tr>
          <tr>
            <td>Security Zones</td>
            <td>{topology.securityZones.length}</td>
          </tr>
        </tbody>
      </table>
      <div className="page-break"></div>

      {/* 2. System Architecture */}
      <h1 className="section-title">2. SYSTEM ARCHITECTURE</h1>
      
      <h2 className="subsection-title">2.1 Network Topology</h2>
      <div className="body-text">
        The following diagram illustrates the system architecture and network topology:
      </div>
      
      {topology.image ? (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <img 
            src={`data:image/svg+xml;base64,${topology.image.replace(/^data:image\/[a-z+]+;base64,/, '')}`} 
            alt="Network Topology" 
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#9ca3af', margin: '20px 0' }}>
          [No topology diagram provided]
        </div>
      )}

      <h2 className="subsection-title">2.2 Device Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Device Type</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(topology.devicesByType).map(([type, count]) => (
            <tr key={type}>
              <td>{type}</td>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {inventory && (inventory.hardware?.length > 0 || inventory.software?.length > 0) && (
        <>
          <h2 className="subsection-title">2.3 System Components and Inventory</h2>
          <div className="body-text">
            This section provides a detailed inventory of hardware and software components within the system boundary.
          </div>

          {inventory.hardware && inventory.hardware.length > 0 && (
            <>
              <h3 className="subsub-title">2.3.1 Hardware Components</h3>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.hardware.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name || 'N/A'}</td>
                      <td>{item.type || 'N/A'}</td>
                      <td>{item.manufacturer || 'N/A'}</td>
                      <td>{item.model || 'N/A'}</td>
                      <td>{item.location || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {inventory.software && inventory.software.length > 0 && (
            <>
              <h3 className="subsub-title">2.3.2 Software Components</h3>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Version</th>
                    <th>Location</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.software.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name || 'N/A'}</td>
                      <td>{item.type || 'N/A'}</td>
                      <td>{item.version || 'N/A'}</td>
                      <td>{item.location || 'N/A'}</td>
                      <td>{item.owner || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
      <div className="page-break"></div>

      {/* 3. Security Controls */}
      <h1 className="section-title">3. SECURITY CONTROLS</h1>
      <div className="body-text">
        This section documents the implementation of NIST SP 800-53 Rev 5 controls for the {metadata.baseline} baseline.
      </div>

      {Array.from(controlsByFamily.entries()).map(([family, familyControls], familyIndex) => (
        <div key={family} className="page-break-avoid">
          <h2 className="subsection-title">
            3.{familyIndex + 1} {family} - {getFamilyName(family)}
          </h2>

          {familyControls.map((control) => (
            <div key={control.id} className="page-break-avoid" style={{ marginBottom: '15px' }}>
              <div className="control-title">{formatControlForSSP(control.id, control.title)}</div>
              
              {control.implementation_status && (
                <div className="control-text">
                  <strong>Implementation Status:</strong>{' '}
                  <span className="implementation-status">{control.implementation_status}</span>
                </div>
              )}
              
              <div className="control-text">
                <strong>System Implementation:</strong><br />
                {control.narrative || (
                  <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                    Implementation details not yet documented.
                  </span>
                )}
              </div>

              {control.implementingDevices && control.implementingDevices.length > 0 && (
                <div className="control-text">
                  <strong>Implementing Devices:</strong>
                  <ul>
                    {control.implementingDevices.map((device, idx) => (
                      <li key={idx}>
                        {device.name}
                        {device.ipAddress && ` (${device.ipAddress})`}
                        {device.zone && ` - ${device.zone}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Custom Sections */}
      {metadata.custom_sections && metadata.custom_sections.length > 0 && (
        <>
          <div className="page-break"></div>
          <h1 className="section-title">4. ADDITIONAL SECTIONS</h1>
          {metadata.custom_sections.map((section, index) => (
            <div key={index} className="page-break-avoid">
              <h2 className="subsection-title">4.{index + 1} {section.title}</h2>
              <div className="body-text">{section.content || 'No content provided.'}</div>
            </div>
          ))}
        </>
      )}

      {/* Appendix */}
      <div className="page-break"></div>
      <h1 className="section-title">
        {metadata.custom_sections && metadata.custom_sections.length > 0 ? '5' : '4'}. APPENDIX: NIST CONTROL REFERENCE
      </h1>
      <div className="body-text">
        This appendix provides the official NIST SP 800-53 Rev 5 control objectives and descriptions 
        for all controls included in this System Security Plan.
      </div>

      {Array.from(controlsByFamily.entries()).map(([family, familyControls], familyIndex) => (
        <div key={`appendix-${family}`} className="page-break-avoid">
          <h2 className="subsection-title">
            {metadata.custom_sections && metadata.custom_sections.length > 0 ? '5' : '4'}.{familyIndex + 1} {family} - {getFamilyName(family)}
          </h2>
          {familyControls.map((control) => (
            <div key={`appendix-${control.id}`} style={{ marginBottom: '12px' }}>
              <div className="control-title">{formatControlForSSP(control.id, control.title)}</div>
              <div className="control-text" style={{ color: '#4b5563' }}>
                {control.objective}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

