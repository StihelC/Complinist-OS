/**
 * Project Store
 *
 * Manages project lifecycle including loading, saving, creating,
 * and deleting projects. Also handles export/import operations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  AppNode,
  AppEdge,
  Project,
  NistBaseline,
  DeviceNodeData,
  BoundaryNodeData,
  FullReport,
} from '@/lib/utils/types';
import { db } from '@/core/database/client';
import { useSSPMetadataStore } from '../sspMetadataStore';
import { useDeltaTrackingStore } from '../deltaTrackingStore';
import { getSampleProjectById } from '@/lib/samples/sampleProjects';
import {
  tidyDiagram as tidyDiagramAlgorithm,
  animateTidy,
  TidyOptions,
  TidyResult,
  DEFAULT_TIDY_OPTIONS,
} from '@/lib/topology/auto-tidy';
import { layoutLogger } from '@/lib/topology/layoutLogger';
import {
  useTopologyStore,
  sortNodesTopologically,
  validateAndCleanNodes,
} from './useTopologyStore';
import { useSettingsStore } from './useSettingsStore';

interface ProjectState {
  // Project state
  currentProject: Project | null;
  projects: Project[];
  newProjectName: string;
  newProjectBaseline: NistBaseline;

  // Project setters
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setNewProjectName: (name: string) => void;
  setNewProjectBaseline: (baseline: NistBaseline) => void;

  // Project operations
  loadProjects: () => Promise<void>;
  loadProject: (projectId: number) => Promise<void>;
  createNewProject: () => Promise<void>;
  createFromTemplate: (templateId: string, projectName: string) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;

  // Save operations
  saveCurrentDiagram: () => Promise<void>;

  // Export/Import
  exportFullReport: () => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
    canceled?: boolean;
  }>;
  importDiagramFromJSON: () => Promise<{ success: boolean; error?: string }>;

  // Sample network
  loadSampleNetwork: () => Promise<void>;

  // Auto-tidy operations
  tidyDiagram: (options?: Partial<TidyOptions>) => Promise<TidyResult | null>;
  smartTidy: (options?: Partial<TidyOptions>) => Promise<TidyResult | null>;

  // Control assignment
  assignControlsToDevice: (deviceId: string, controlIds: string[]) => void;

  // Initialize
  initialize: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentProject: null,
      projects: [],
      newProjectName: '',
      newProjectBaseline: 'MODERATE',

      // Setters
      setCurrentProject: (project) => set({ currentProject: project }),
      setProjects: (projects) => set({ projects }),
      setNewProjectName: (name) => set({ newProjectName: name }),
      setNewProjectBaseline: (baseline) => set({ newProjectBaseline: baseline }),

      // Load all projects
      loadProjects: async () => {
        const projectList = await db.listProjects();
        set({ projects: projectList });
        const { currentProject } = get();
        if (projectList.length > 0 && !currentProject) {
          await get().loadProject(projectList[0].id);
        }
      },

      // Load a specific project
      loadProject: async (projectId) => {
        const diagram = await db.loadDiagram(projectId);
        const { projects } = get();
        const project = projects.find((p) => p.id === projectId);

        // Filter out deprecated capture nodes
        const filteredNodes = diagram.nodes.filter(
          (node: AppNode) => node.type !== 'capture'
        );

        // Validate and clean nodes, then use topological sort
        const validatedNodes = validateAndCleanNodes(filteredNodes);
        const sortedNodes = sortNodesTopologically(validatedNodes);
        const safeEdges = Array.isArray(diagram.edges) ? diagram.edges : [];

        // Update topology store directly
        const topologyStore = useTopologyStore.getState();
        topologyStore.setNodes(sortedNodes);
        topologyStore.setEdges(safeEdges);

        set({ currentProject: project || null });

        // Initialize delta tracking with the loaded state
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.initialize(sortedNodes, diagram.edges);
        deltaStore.setProjectId(projectId);

        // Connect topology store to save callback
        topologyStore._setOnSaveNeeded(() => get().saveCurrentDiagram());
      },

      // Create a new empty project
      createNewProject: async () => {
        const { newProjectName, newProjectBaseline } = get();
        if (!newProjectName.trim()) return;

        const project = await db.createProject(newProjectName, newProjectBaseline);

        // Clear topology
        const topologyStore = useTopologyStore.getState();
        topologyStore.setNodes([]);
        topologyStore.setEdges([]);

        set({
          currentProject: project,
          newProjectName: '',
          newProjectBaseline: 'MODERATE',
        });

        await get().loadProjects();

        // Initialize delta tracking for new empty project
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.initialize([], []);
        deltaStore.setProjectId(project.id);

        // Connect topology store to save callback
        topologyStore._setOnSaveNeeded(() => get().saveCurrentDiagram());
      },

      // Create project from template
      createFromTemplate: async (templateId: string, projectName: string) => {
        const template = getSampleProjectById(templateId);
        if (!template) {
          console.error(`[ProjectStore] Template not found: ${templateId}`);
          return;
        }

        if (!projectName.trim()) {
          console.error('[ProjectStore] Project name is required');
          return;
        }

        const project = await db.createProject(projectName, template.baseline);

        // Generate unique IDs for all nodes and edges
        const timestamp = Date.now();
        const idMap = new Map<string, string>();

        template.nodes.forEach((node, index) => {
          const newId = `${node.id.replace('-sample-', '-')}-${timestamp}-${index}`;
          idMap.set(node.id, newId);
        });

        // Clone nodes with new IDs
        const clonedNodes: AppNode[] = template.nodes.map((node) => {
          const newId = idMap.get(node.id) || node.id;
          const newParentId = node.parentId ? idMap.get(node.parentId) : undefined;

          return {
            ...node,
            id: newId,
            parentId: newParentId,
            data: {
              ...node.data,
              id: newId,
            },
          } as AppNode;
        });

        // Clone edges with updated source/target IDs
        const clonedEdges: AppEdge[] = template.edges.map((edge, index) => {
          const newId = `edge-${timestamp}-${index}`;
          const newSource = idMap.get(edge.source) || edge.source;
          const newTarget = idMap.get(edge.target) || edge.target;

          return {
            ...edge,
            id: newId,
            source: newSource,
            target: newTarget,
          };
        });

        // Apply auto-tidy
        const globalSettings = useSettingsStore.getState().globalSettings;
        const tidyResult = await tidyDiagramAlgorithm(clonedNodes, clonedEdges, {
          spacingTier: 'comfortable',
          autoResize: true,
          animate: false,
          tidyPasses: 5,
          globalDeviceImageSize: globalSettings.globalDeviceImageSize,
          globalBoundaryLabelSize: globalSettings.globalBoundaryLabelSize,
          optimizeDeviceSize: true,
          targetDeviceIconSize: 90,
          edgeOptimization: {
            edgeLabelCollisionAvoidance: true,
            rankerAlgorithm: 'auto',
            minEdgeSeparationWithLabels: 10,
            labelRotation: false,
            calculateQualityMetrics: true,
            edgeRoutingType: 'smoothstep',
            minimizeOverlaps: true,
          },
        });

        // Validate and sort nodes
        const validatedNodes = validateAndCleanNodes(tidyResult.nodes);
        const sortedNodes = sortNodesTopologically(validatedNodes);

        // Update topology store
        const topologyStore = useTopologyStore.getState();
        topologyStore.setNodes(sortedNodes);
        topologyStore.setEdges(clonedEdges);

        set({
          currentProject: project,
          newProjectName: '',
          newProjectBaseline: 'MODERATE',
        });

        await get().loadProjects();
        await db.saveDiagram(project.id, sortedNodes, clonedEdges, null);

        // Save control narratives from template
        if (
          template.controlNarratives &&
          Object.keys(template.controlNarratives).length > 0
        ) {
          const narratives = Object.entries(template.controlNarratives).map(
            ([controlId, narrative]) => ({
              control_id: controlId,
              narrative: narrative,
              system_implementation: narrative,
              implementation_status: 'partially-implemented',
            })
          );
          await db.saveControlNarratives(project.id, narratives);
        }

        // Initialize delta tracking
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.initialize(sortedNodes, clonedEdges);
        deltaStore.setProjectId(project.id);

        // Connect topology store to save callback
        topologyStore._setOnSaveNeeded(() => get().saveCurrentDiagram());
      },

      // Delete a project
      deleteProject: async (projectId) => {
        await db.deleteProject(projectId);
        await get().loadProjects();
        const { currentProject } = get();
        if (currentProject?.id === projectId) {
          const topologyStore = useTopologyStore.getState();
          topologyStore.setNodes([]);
          topologyStore.setEdges([]);
          set({ currentProject: null });
        }
      },

      // Save current diagram
      saveCurrentDiagram: async () => {
        const { currentProject } = get();
        if (!currentProject) return;

        const topologyStore = useTopologyStore.getState();
        const { nodes, edges } = topologyStore;
        const deltaStore = useDeltaTrackingStore.getState();

        const shouldUseFullSave = deltaStore.shouldForceFullSave();

        if (shouldUseFullSave) {
          await db.saveDiagram(currentProject.id, nodes, edges, null);
          deltaStore.initialize(nodes, edges);
          deltaStore.setProjectId(currentProject.id);
        } else {
          const delta = deltaStore.getDelta();

          if (
            delta &&
            (delta.nodeChanges.length > 0 || delta.edgeChanges.length > 0)
          ) {
            const result = await db.saveDiagramDelta(delta);

            if (result.success) {
              deltaStore.clearPendingChanges();
            } else if (result.requiresFullSave) {
              console.warn(
                'Delta save rejected, falling back to full save:',
                result.error
              );
              await db.saveDiagram(currentProject.id, nodes, edges, null);
              deltaStore.initialize(nodes, edges);
              deltaStore.setProjectId(currentProject.id);
            }
          } else {
            deltaStore.updateLastSaveTimestamp();
          }
        }

        // Also save SSP metadata if modified
        try {
          const sspStore = useSSPMetadataStore.getState();
          if (sspStore.metadata && sspStore.isDirty) {
            await sspStore.saveMetadata(currentProject.id);
          }
        } catch (error) {
          console.warn('Failed to auto-save SSP metadata:', error);
        }
      },

      // Export full report
      exportFullReport: async () => {
        try {
          const exportUtilsModule = await import('@/lib/export/exportUtils');
          const { exportToJSON } = exportUtilsModule;

          const { currentProject } = get();
          const topologyStore = useTopologyStore.getState();
          const { nodes, edges } = topologyStore;

          if (!currentProject) {
            return { success: false, error: 'No project loaded' };
          }

          try {
            const result = await exportToJSON(
              nodes,
              edges,
              currentProject.name,
              currentProject.id
            );
            return result;
          } catch (error) {
            console.error('[EXPORT] Error exporting report:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        } catch (importError) {
          console.error('[EXPORT] Failed to load export module:', importError);
          throw importError;
        }
      },

      // Import diagram from JSON
      importDiagramFromJSON: async () => {
        try {
          const exportUtilsModule = await import('@/lib/export/exportUtils');
          const { importFromJSON } = exportUtilsModule;

          try {
            const result = await importFromJSON();

            if (!result.success || !result.data) {
              return { success: false, error: result.error || 'Import failed' };
            }

            const reportData = result.data as FullReport;

            // Match device types
            const { matchDeviceTypesForImport } = await import(
              '@/lib/utils/deviceTypeImportMatcher'
            );
            const matchedNodes = await matchDeviceTypesForImport(
              reportData.diagram.nodes
            );

            // Validate and sort
            const validatedNodes = validateAndCleanNodes(matchedNodes);
            const sortedNodes = sortNodesTopologically(validatedNodes);
            const safeEdges = Array.isArray(reportData.diagram.edges)
              ? reportData.diagram.edges
              : [];

            // Update topology store
            const topologyStore = useTopologyStore.getState();
            topologyStore.setNodes(sortedNodes);
            topologyStore.setEdges(safeEdges);

            // Auto-save if there's a current project
            const { currentProject } = get();
            if (currentProject) {
              await get().saveCurrentDiagram();
            }

            return { success: true };
          } catch (error) {
            console.error('Error importing diagram:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        } catch (importError) {
          console.error('[IMPORT] Failed to load import module:', importError);
          throw importError;
        }
      },

      // Load sample network
      loadSampleNetwork: async () => {
        const sampleNodes: AppNode[] = [
          // Security Boundary
          {
            id: 'boundary-security',
            type: 'boundary',
            position: { x: 50, y: 50 },
            width: 800,
            height: 500,
            data: {
              id: 'boundary-security',
              label: 'Security Zone',
              type: 'security_zone',
              color: '#dbeafe',
            } as BoundaryNodeData,
          },
          // DMZ Boundary (nested)
          {
            id: 'boundary-dmz',
            type: 'boundary',
            position: { x: 30, y: 60 },
            width: 350,
            height: 380,
            parentId: 'boundary-security',
            extent: 'parent',
            data: {
              id: 'boundary-dmz',
              label: 'DMZ',
              type: 'network_segment',
              color: '#fef9c3',
            } as BoundaryNodeData,
          },
          // Internal Boundary (nested)
          {
            id: 'boundary-internal',
            type: 'boundary',
            position: { x: 410, y: 60 },
            width: 350,
            height: 380,
            parentId: 'boundary-security',
            extent: 'parent',
            data: {
              id: 'boundary-internal',
              label: 'Internal Network',
              type: 'network_segment',
              color: '#dcfce7',
            } as BoundaryNodeData,
          },
          // Devices
          {
            id: 'device-firewall',
            type: 'device',
            position: { x: 110, y: 40 },
            parentId: 'boundary-dmz',
            extent: 'parent',
            data: {
              id: 'device-firewall',
              name: 'Edge Firewall',
              deviceType: 'firewalls',
              iconPath: 'src/Icons/Azure/Networking/Firewall.svg',
              securityZone: 'dmz',
              missionCritical: true,
            } as DeviceNodeData,
          },
          {
            id: 'device-webserver',
            type: 'device',
            position: { x: 110, y: 160 },
            parentId: 'boundary-dmz',
            extent: 'parent',
            data: {
              id: 'device-webserver',
              name: 'Web Server',
              deviceType: 'virtual-machine',
              iconPath: 'src/Icons/Azure/Compute/Virtual-Machine.svg',
              operatingSystem: 'Linux',
              securityZone: 'dmz',
            } as DeviceNodeData,
          },
          {
            id: 'device-loadbalancer',
            type: 'device',
            position: { x: 110, y: 280 },
            parentId: 'boundary-dmz',
            extent: 'parent',
            data: {
              id: 'device-loadbalancer',
              name: 'Load Balancer',
              deviceType: 'load-balancers',
              iconPath: 'src/Icons/Azure/Networking/Load-Balancer.svg',
              securityZone: 'dmz',
            } as DeviceNodeData,
          },
          {
            id: 'device-appserver',
            type: 'device',
            position: { x: 110, y: 40 },
            parentId: 'boundary-internal',
            extent: 'parent',
            data: {
              id: 'device-appserver',
              name: 'Application Server',
              deviceType: 'app-services',
              iconPath: 'src/Icons/Azure/Compute/App-Services.svg',
              operatingSystem: 'Linux',
              securityZone: 'internal',
            } as DeviceNodeData,
          },
          {
            id: 'device-database',
            type: 'device',
            position: { x: 110, y: 160 },
            parentId: 'boundary-internal',
            extent: 'parent',
            data: {
              id: 'device-database',
              name: 'Database Server',
              deviceType: 'sql-database',
              iconPath: 'src/Icons/Azure/Databases/SQL-Database.svg',
              dataClassification: 'Confidential',
              encryptionAtRest: true,
              securityZone: 'internal',
              missionCritical: true,
            } as DeviceNodeData,
          },
          {
            id: 'device-storage',
            type: 'device',
            position: { x: 110, y: 280 },
            parentId: 'boundary-internal',
            extent: 'parent',
            data: {
              id: 'device-storage',
              name: 'Blob Storage',
              deviceType: 'storage-accounts',
              iconPath: 'src/Icons/Azure/Storage/Storage-Accounts.svg',
              dataClassification: 'Internal',
              encryptionAtRest: true,
              securityZone: 'internal',
            } as DeviceNodeData,
          },
        ];

        const sampleEdges: AppEdge[] = [
          {
            id: 'edge-firewall-webserver',
            source: 'device-firewall',
            target: 'device-webserver',
            type: 'default',
          },
          {
            id: 'edge-webserver-loadbalancer',
            source: 'device-webserver',
            target: 'device-loadbalancer',
            type: 'default',
          },
          {
            id: 'edge-loadbalancer-appserver',
            source: 'device-loadbalancer',
            target: 'device-appserver',
            type: 'default',
          },
          {
            id: 'edge-appserver-database',
            source: 'device-appserver',
            target: 'device-database',
            type: 'default',
          },
          {
            id: 'edge-appserver-storage',
            source: 'device-appserver',
            target: 'device-storage',
            type: 'default',
          },
        ];

        // Validate and sort nodes
        const validatedNodes = validateAndCleanNodes(sampleNodes);
        const sortedNodes = sortNodesTopologically(validatedNodes);

        // Update topology store
        const topologyStore = useTopologyStore.getState();
        topologyStore.setNodes(sortedNodes);
        topologyStore.setEdges(sampleEdges);

        // Auto-save if there's a current project
        const { currentProject } = get();
        if (currentProject) {
          await get().saveCurrentDiagram();
        }
      },

      // Auto-tidy diagram
      tidyDiagram: async (options?: Partial<TidyOptions>) => {
        const settingsStore = useSettingsStore.getState();
        const topologyStore = useTopologyStore.getState();
        const { nodes, edges } = topologyStore;
        const { globalSettings, reactFlowInstance, isTidying } = settingsStore;

        if (isTidying) {
          console.warn('[TidyDiagram] Already tidying, ignoring request');
          return null;
        }

        if (nodes.length === 0) {
          console.log('[TidyDiagram] No nodes to tidy');
          return null;
        }

        settingsStore.setIsTidying(true);
        settingsStore.setTidyProgress(0);

        try {
          // Get viewport info
          let viewportInfo:
            | { width: number; height: number; zoom: number }
            | undefined;
          if (reactFlowInstance.getViewport) {
            const viewport = reactFlowInstance.getViewport();
            const viewportWidth =
              typeof window !== 'undefined' ? window.innerWidth - 300 : 1200;
            const viewportHeight =
              typeof window !== 'undefined' ? window.innerHeight - 100 : 800;

            viewportInfo = {
              width: viewportWidth / viewport.zoom,
              height: viewportHeight / viewport.zoom,
              zoom: viewport.zoom,
            };
          }

          // Use fixed layering configuration (devices on top, edges in middle, boundaries on bottom)
          const layeringConfig = {
            preset: 'default',
            baseZIndex: 1,
            layerSpacing: 5,
          };

          // Merge options - prefer explicit options over global settings
          const tidyOptions: Partial<TidyOptions> = {
            ...options,
            globalDeviceImageSize: globalSettings.globalDeviceImageSize,
            globalBoundaryLabelSize: globalSettings.globalBoundaryLabelSize,
            // Use options.boundaryPadding if provided (from LayoutPanel), otherwise fall back to globalSettings
            boundaryPadding: options?.boundaryPadding ?? globalSettings.boundaryPadding,
            viewportDimensions: viewportInfo,
            layeringConfig,
            optimizeDeviceSize: options?.optimizeDeviceSize ?? true,
            targetDeviceIconSize: options?.targetDeviceIconSize ?? 90,
            tidyPasses: options?.tidyPasses ?? 2,
          };

          // Debug logging (uses layoutLogger which respects layoutDebugMode setting)
          layoutLogger.debug('[TidyDiagram] Options received:', {
            'options.boundaryPadding': options?.boundaryPadding,
            'options.nestedBoundarySpacing': options?.nestedBoundarySpacing,
            'globalSettings.boundaryPadding': globalSettings.boundaryPadding,
            'final boundaryPadding': tidyOptions.boundaryPadding,
            'final nestedBoundarySpacing': tidyOptions.nestedBoundarySpacing,
          });

          // Run the tidy algorithm
          const result = await tidyDiagramAlgorithm(nodes, edges, tidyOptions);

          // Apply animation if enabled
          if (result.targetPositions && options?.animate !== false) {
            const duration =
              options?.animationDuration ||
              DEFAULT_TIDY_OPTIONS.animationDuration ||
              300;

            await new Promise<void>((resolve) => {
              animateTidy(
                nodes,
                result.targetPositions!,
                duration,
                (animatedNodes) => {
                  topologyStore.setNodes(animatedNodes);
                },
                () => {
                  topologyStore.setNodes(result.nodes);
                  if (result.edges) {
                    topologyStore.setEdges(result.edges);
                  }
                  settingsStore.setIsTidying(false);
                  settingsStore.setTidyProgress(100);
                  resolve();
                }
              );
            });
          } else {
            topologyStore.setNodes(result.nodes);
            if (result.edges) {
              topologyStore.setEdges(result.edges);
            }
            settingsStore.setIsTidying(false);
            settingsStore.setTidyProgress(100);
          }

          return result;
        } catch (error) {
          console.error('[TidyDiagram] Error:', error);
          settingsStore.setIsTidying(false);
          settingsStore.setTidyProgress(0);
          return null;
        }
      },

      // Smart tidy with graph analysis
      smartTidy: async (options?: Partial<TidyOptions>) => {
        const settingsStore = useSettingsStore.getState();
        const topologyStore = useTopologyStore.getState();
        const { nodes, edges } = topologyStore;
        const { isTidying } = settingsStore;

        if (isTidying) {
          console.warn('[SmartTidy] Already tidying, ignoring request');
          return null;
        }

        if (nodes.length === 0) {
          console.log('[SmartTidy] No nodes to tidy');
          return null;
        }

        settingsStore.setIsTidying(true);
        settingsStore.setTidyProgress(0);

        try {
          const { smartTidy: smartTidyFn } = await import(
            '@/lib/topology/layout-optimizer'
          );

          const {
            nodes: fixedNodes,
            options: optimizedOptions,
            metrics,
          } = await smartTidyFn(nodes, edges, options);

          layoutLogger.debug(
            '[SmartTidy] Graph Complexity:',
            metrics.complexityScore,
            '/100'
          );

          if (fixedNodes !== nodes) {
            topologyStore.setNodes(fixedNodes);
          }

          const result = await get().tidyDiagram(optimizedOptions);

          if (result) {
            layoutLogger.info('[SmartTidy] Layout optimization complete!', {
              nodeCount: result.nodes.length,
              boundaryCount: result.nodes.filter((n) => n.type === 'boundary')
                .length,
              stats: result.stats,
            });
          }

          return result;
        } catch (error) {
          layoutLogger.error('[SmartTidy] Error:', error);
          settingsStore.setIsTidying(false);
          settingsStore.setTidyProgress(0);
          return null;
        }
      },

      // Assign controls to device
      assignControlsToDevice: (deviceId, controlIds) => {
        const topologyStore = useTopologyStore.getState();
        const { nodes } = topologyStore;
        const node = nodes.find((n) => n.id === deviceId);
        if (!node || node.type !== 'device') return;

        const deviceData = node.data as DeviceNodeData;
        const existingControls = deviceData.assignedControls || [];
        const existingNotes = deviceData.controlNotes || {};

        // Merge new controls with existing
        const uniqueControls = Array.from(
          new Set([...existingControls, ...controlIds])
        );

        // Initialize empty notes for new controls
        const updatedNotes = { ...existingNotes };
        controlIds.forEach((controlId) => {
          if (!updatedNotes[controlId]) {
            updatedNotes[controlId] = '';
          }
        });

        topologyStore.updateNode(deviceId, {
          assignedControls: uniqueControls,
          controlNotes: updatedNotes,
        });
      },

      // Initialize
      initialize: async () => {
        await get().loadProjects();

        // Connect topology store to save callback
        const topologyStore = useTopologyStore.getState();
        topologyStore._setOnSaveNeeded(() => get().saveCurrentDiagram());

        // Listen for Electron menu events
        if (typeof window !== 'undefined' && window.electronAPI) {
          window.electronAPI.onMenuNewProject(() => {
            // Use canvas UI store for modal
            const { useCanvasUIStore } = require('./useCanvasUIStore');
            useCanvasUIStore.getState().setShowProjectDialog(true);
          });

          window.electronAPI.onMenuOpenProject(() => {
            const { useCanvasUIStore } = require('./useCanvasUIStore');
            useCanvasUIStore.getState().setShowProjectDialog(true);
          });

          window.electronAPI.onMenuSave(async () => {
            await get().saveCurrentDiagram();
          });

          window.electronAPI.onMenuExportSVG(() => {
            window.dispatchEvent(new CustomEvent('export-svg'));
          });

          window.electronAPI.onMenuExportJSON(async () => {
            await get().exportFullReport();
          });

          window.electronAPI.onMenuImportJSON(async () => {
            await get().importDiagramFromJSON();
          });
        }
      },
    }),
    { name: 'Project Store' }
  )
);
