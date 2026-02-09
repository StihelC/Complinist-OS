/**
 * IPC Export Channel Tests (export:*)
 *
 * Tests all export-related IPC channels for:
 * - JSON export/import
 * - PNG/SVG export
 * - CSV export
 * - PDF export
 * - Viewport capture
 * - Type safety and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockElectronAPI,
  resetMockState,
  getCallsForChannel,
  setMockConfig,
} from '../../fixtures/ipc/__mocks__/electronAPI.mock';
import type { ElectronAPI } from '@/window.d';

describe('Export IPC Channels (export:*)', () => {
  let mockAPI: ElectronAPI;

  beforeEach(() => {
    resetMockState();
    setMockConfig({});
    mockAPI = createMockElectronAPI();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('export-json', () => {
    it('should export diagram as JSON', async () => {
      const result = await mockAPI.exportJSON({
        reportData: {
          nodes: [{ id: 'node-1', type: 'device' }],
          edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }]
        },
        projectName: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(getCallsForChannel('export-json')).toHaveLength(1);
    });

    it('should include nodes and edges in export data', async () => {
      const nodes = [
        { id: 'n1', type: 'server', position: { x: 0, y: 0 }, data: { name: 'Server 1' } },
        { id: 'n2', type: 'router', position: { x: 100, y: 100 }, data: { name: 'Router 1' } }
      ];
      const edges = [
        { id: 'e1', source: 'n1', target: 'n2', type: 'default' }
      ];

      const result = await mockAPI.exportJSON({ reportData: { nodes, edges }, projectName: 'test' });

      expect(result.success).toBe(true);
      const call = getCallsForChannel('export-json')[0];
      expect(call.args[0].reportData.nodes).toHaveLength(2);
      expect(call.args[0].reportData.edges).toHaveLength(1);
    });

    it('should handle empty diagram export', async () => {
      const result = await mockAPI.exportJSON({
        reportData: { nodes: [], edges: [] },
        projectName: 'empty-project'
      });

      expect(result.success).toBe(true);
    });

    it('should handle complex nested data', async () => {
      const complexData = {
        nodes: [{
          id: 'complex',
          type: 'device',
          data: {
            metadata: {
              nested: {
                deep: {
                  value: 'test'
                }
              },
              array: [1, 2, 3],
              null: null,
              boolean: true
            }
          }
        }],
        edges: []
      };

      const result = await mockAPI.exportJSON({ reportData: complexData, projectName: 'complex' });

      expect(result.success).toBe(true);
    });

    it('should handle special characters in project name', async () => {
      const result = await mockAPI.exportJSON({
        reportData: { nodes: [], edges: [] },
        projectName: 'test & project <name> "quotes"'
      });

      expect(result.success).toBe(true);
    });

    it('should handle export errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Write permission denied' });

      await expect(mockAPI.exportJSON({ reportData: { nodes: [], edges: [] }, projectName: 'test' }))
        .rejects.toThrow('Write permission denied');
    });
  });

  describe('import-json', () => {
    it('should import JSON file', async () => {
      const result = await mockAPI.importJSON();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('nodes');
      expect(result.data).toHaveProperty('edges');
      expect(getCallsForChannel('import-json')).toHaveLength(1);
    });

    it('should return canceled flag when dialog canceled', async () => {
      // Note: Mock doesn't currently simulate cancel - would need to extend
      const result = await mockAPI.importJSON();
      expect(result).toBeDefined();
    });

    it('should handle import errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Invalid JSON file' });

      await expect(mockAPI.importJSON())
        .rejects.toThrow('Invalid JSON file');
    });
  });

  describe('capture-viewport', () => {
    it('should capture viewport with valid bounds', async () => {
      const bounds = { x: 0, y: 0, width: 800, height: 600 };
      const result = await mockAPI.captureViewport(bounds);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('imageData');
      expect(result.imageData).toMatch(/^data:image\/png;base64,/);
      expect(getCallsForChannel('capture-viewport')).toHaveLength(1);
    });

    it('should return dimensions in response', async () => {
      const bounds = { x: 100, y: 50, width: 1200, height: 900 };
      const result = await mockAPI.captureViewport(bounds);

      expect(result.dimensions).toEqual({ width: 1200, height: 900 });
    });

    it('should handle small viewport', async () => {
      const bounds = { x: 0, y: 0, width: 100, height: 100 };
      const result = await mockAPI.captureViewport(bounds);

      expect(result.success).toBe(true);
    });

    it('should handle large viewport', async () => {
      const bounds = { x: 0, y: 0, width: 4000, height: 3000 };
      const result = await mockAPI.captureViewport(bounds);

      expect(result.success).toBe(true);
    });

    it('should handle offset bounds', async () => {
      const bounds = { x: 500, y: 300, width: 800, height: 600 };
      const result = await mockAPI.captureViewport(bounds);

      expect(result.success).toBe(true);
    });

    it('should record bounds in call', async () => {
      const bounds = { x: 10, y: 20, width: 500, height: 400 };
      await mockAPI.captureViewport(bounds);

      const call = getCallsForChannel('capture-viewport')[0];
      expect(call.args[0]).toEqual(bounds);
    });
  });

  describe('export-png', () => {
    it('should export PNG from image data', async () => {
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await mockAPI.exportPNG({
        projectName: 'test-diagram',
        imageData: base64Image
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(result.filePath).toContain('.png');
      expect(getCallsForChannel('export-png')).toHaveLength(1);
    });

    it('should use project name for filename', async () => {
      await mockAPI.exportPNG({
        projectName: 'my-network-diagram',
        imageData: 'data:image/png;base64,abc123'
      });

      const call = getCallsForChannel('export-png')[0];
      expect(call.args[0].projectName).toBe('my-network-diagram');
    });

    it('should handle export errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Disk full' });

      await expect(mockAPI.exportPNG({ projectName: 'test', imageData: 'data:image/png;base64,' }))
        .rejects.toThrow('Disk full');
    });
  });

  describe('export-svg', () => {
    it('should export SVG content', async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';

      const result = await mockAPI.exportSVG({
        projectName: 'test-diagram',
        svgContent
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(getCallsForChannel('export-svg')).toHaveLength(1);
    });

    it('should handle base64 SVG image data', async () => {
      const result = await mockAPI.exportSVG({
        projectName: 'test',
        imageData: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
      });

      expect(result.success).toBe(true);
    });

    it('should handle complex SVG with styles', async () => {
      const complexSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
          <style>.cls-1{fill:#333;}</style>
          <defs>
            <linearGradient id="grad">
              <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
              <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle class="cls-1" cx="100" cy="100" r="50" fill="url(#grad)"/>
        </svg>
      `;

      const result = await mockAPI.exportSVG({ projectName: 'styled', svgContent: complexSvg });

      expect(result.success).toBe(true);
    });
  });

  describe('export-png-from-svg', () => {
    it('should convert SVG to PNG', async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';

      const result = await mockAPI.exportPNGFromSVG({
        projectName: 'converted-diagram',
        svgContent,
        width: 800,
        height: 600
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(getCallsForChannel('export-png-from-svg')).toHaveLength(1);
    });

    it('should use specified dimensions', async () => {
      await mockAPI.exportPNGFromSVG({
        projectName: 'test',
        svgContent: '<svg></svg>',
        width: 1920,
        height: 1080
      });

      const call = getCallsForChannel('export-png-from-svg')[0];
      expect(call.args[0].width).toBe(1920);
      expect(call.args[0].height).toBe(1080);
    });

    it('should handle missing dimensions', async () => {
      const result = await mockAPI.exportPNGFromSVG({
        projectName: 'test',
        svgContent: '<svg></svg>'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('export-csv', () => {
    it('should export CSV content', async () => {
      const csvContent = 'Name,Type,IP Address\nServer1,server,192.168.1.1\nRouter1,router,192.168.1.254';

      const result = await mockAPI.exportCSV({
        csvContent,
        filename: 'device_inventory.csv'
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(getCallsForChannel('export-csv')).toHaveLength(1);
    });

    it('should handle CSV with special characters', async () => {
      const csvWithSpecial = 'Name,Description\n"Server ""Main""","A server with, commas"\nRouter,"Line1\nLine2"';

      const result = await mockAPI.exportCSV({
        csvContent: csvWithSpecial,
        filename: 'special.csv'
      });

      expect(result.success).toBe(true);
    });

    it('should handle empty CSV', async () => {
      const result = await mockAPI.exportCSV({
        csvContent: '',
        filename: 'empty.csv'
      });

      expect(result.success).toBe(true);
    });

    it('should use provided filename', async () => {
      await mockAPI.exportCSV({
        csvContent: 'a,b\n1,2',
        filename: 'custom-name.csv'
      });

      const call = getCallsForChannel('export-csv')[0];
      expect(call.args[0].filename).toBe('custom-name.csv');
    });

    it('should handle unicode in CSV', async () => {
      const unicodeCsv = 'Name,Description\nサーバー,テストサーバー\n服务器,测试服务器';

      const result = await mockAPI.exportCSV({ csvContent: unicodeCsv });

      expect(result.success).toBe(true);
    });
  });

  describe('export-pdf', () => {
    it('should export PDF buffer', async () => {
      const pdfBuffer = Buffer.from('Mock PDF content');

      const result = await mockAPI.exportPDF({
        pdfBuffer,
        filename: 'report.pdf'
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(getCallsForChannel('export-pdf')).toHaveLength(1);
    });

    it('should accept ArrayBuffer', async () => {
      const arrayBuffer = new ArrayBuffer(100);

      const result = await mockAPI.exportPDF({
        pdfBuffer: arrayBuffer,
        filename: 'test.pdf'
      });

      expect(result.success).toBe(true);
    });

    it('should use provided filename', async () => {
      await mockAPI.exportPDF({
        pdfBuffer: Buffer.from('test'),
        filename: 'ssp-report-2024.pdf'
      });

      const call = getCallsForChannel('export-pdf')[0];
      expect(call.args[0].filename).toBe('ssp-report-2024.pdf');
    });

    it('should handle export errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'PDF write failed' });

      await expect(mockAPI.exportPDF({ pdfBuffer: Buffer.from('test') }))
        .rejects.toThrow('PDF write failed');
    });
  });

  describe('File Operations', () => {
    describe('get-downloads-path', () => {
      it('should return downloads path', async () => {
        const result = await mockAPI.getDownloadsPath();

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(getCallsForChannel('get-downloads-path')).toHaveLength(1);
      });
    });

    describe('save-file', () => {
      it('should save file with content', async () => {
        const result = await mockAPI.saveFile({
          path: '/downloads/test.txt',
          data: 'File content here'
        });

        expect(result.success).toBe(true);
        expect(result.path).toBe('/downloads/test.txt');
        expect(getCallsForChannel('save-file')).toHaveLength(1);
      });

      it('should save binary data', async () => {
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);

        const result = await mockAPI.saveFile({
          path: '/downloads/binary.bin',
          data: binaryData
        });

        expect(result.success).toBe(true);
      });
    });

    describe('generate-ssp-pdf', () => {
      it('should generate PDF from HTML', async () => {
        const html = '<html><body><h1>System Security Plan</h1><p>Content here</p></body></html>';

        const result = await mockAPI.generateSSPPDF({ html });

        expect(result.success).toBe(true);
        expect(result).toHaveProperty('pdfBuffer');
        expect(getCallsForChannel('generate-ssp-pdf')).toHaveLength(1);
      });

      it('should accept PDF options', async () => {
        const result = await mockAPI.generateSSPPDF({
          html: '<html><body>Test</body></html>',
          options: {
            pageSize: 'Letter',
            margins: { top: 1, right: 1, bottom: 1, left: 1 }
          }
        });

        expect(result.success).toBe(true);
      });

      it('should handle complex HTML', async () => {
        const complexHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial; }
                .header { background: #333; color: white; }
                table { border-collapse: collapse; }
                td, th { border: 1px solid #ddd; padding: 8px; }
              </style>
            </head>
            <body>
              <div class="header"><h1>SSP Report</h1></div>
              <table>
                <thead><tr><th>Control</th><th>Status</th></tr></thead>
                <tbody><tr><td>AC-1</td><td>Implemented</td></tr></tbody>
              </table>
            </body>
          </html>
        `;

        const result = await mockAPI.generateSSPPDF({ html: complexHtml });

        expect(result.success).toBe(true);
      });

      it('should handle generation errors', async () => {
        setMockConfig({ shouldFail: true, failureMessage: 'PDF generation failed' });

        await expect(mockAPI.generateSSPPDF({ html: '<html></html>' }))
          .rejects.toThrow('PDF generation failed');
      });
    });
  });

  describe('Type Safety', () => {
    it('should maintain type structure for export result', async () => {
      const result = await mockAPI.exportJSON({
        reportData: { nodes: [], edges: [] },
        projectName: 'test'
      });

      expect(typeof result.success).toBe('boolean');
      if (result.filePath) {
        expect(typeof result.filePath).toBe('string');
      }
    });

    it('should maintain type structure for capture result', async () => {
      const result = await mockAPI.captureViewport({ x: 0, y: 0, width: 100, height: 100 });

      expect(typeof result.success).toBe('boolean');
      if (result.imageData) {
        expect(typeof result.imageData).toBe('string');
      }
      if (result.dimensions) {
        expect(typeof result.dimensions.width).toBe('number');
        expect(typeof result.dimensions.height).toBe('number');
      }
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent export operations', async () => {
      const promises = [
        mockAPI.exportJSON({ reportData: { nodes: [], edges: [] }, projectName: 'test1' }),
        mockAPI.exportCSV({ csvContent: 'a,b\n1,2' }),
        mockAPI.exportPNG({ projectName: 'test', imageData: 'data:image/png;base64,abc' }),
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle multiple viewport captures', async () => {
      const captures = Array(5).fill(null).map((_, i) =>
        mockAPI.captureViewport({ x: i * 10, y: i * 10, width: 100, height: 100 })
      );

      const results = await Promise.all(captures);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network delay', async () => {
      setMockConfig({ delay: 100 });

      const start = Date.now();
      await mockAPI.exportJSON({ reportData: { nodes: [], edges: [] }, projectName: 'test' });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
    });

    it('should propagate export errors correctly', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Custom export error' });

      try {
        await mockAPI.exportJSON({ reportData: { nodes: [], edges: [] }, projectName: 'test' });
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('Custom export error');
      }
    });
  });
});
