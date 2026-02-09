import { useEffect, useState, useRef } from 'react';
// ReactFlowProvider moved to LazyTopologyCanvas for deferred loading
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { useAIServiceStore } from '@/core/stores/useAIServiceStore';
import { useAINarrativesStore } from '@/core/stores/useAINarrativesStore';
import { useNISTQueryStore } from '@/core/stores/useNISTQueryStore';
import {
  useShallow,
  selectAppState,
  selectAppActions,
  selectAppAIStatus,
  selectAppAIActions,
} from '@/core/stores/selectors';
import { exportDiagramAsSVG, exportDiagramAsPNGFromSVG } from '@/lib/export/modernExport';
import { exportDeviceMetadataToCSV } from '@/lib/export/csvExport';
import { Upload, Trash2, Loader2, Compass, Sparkles, Plus, FolderOpen } from 'lucide-react';
import { ControlSuggestionModal } from '@/features/controls/components/ControlSuggestions/ControlSuggestionModal';
import { LicenseTokenDialog } from '@/shared/components/Dialogs/LicenseTokenDialog';
import { TourModal, useTourStore } from '@/features/tour';
import { AppHeader } from '@/components/AppHeader';
import { ViewRouter } from './ViewRouter';
import { initializeDeviceIconCache } from '@/lib/utils/deviceIconMapping';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { NotificationContainer } from '@/shared/components/ErrorNotification';
import { initializeGlobalErrorHandlers } from '@/core/errors';
import { LoadingProvider } from '@/core/context/LoadingContext';
import { GlobalLoadingIndicator } from '@/components/GlobalLoadingIndicator';
import { SampleProjectsSection } from '@/features/projects';
import { initializeDebugShortcut } from '@/core/debug/snapshot';

interface LoadingPhase {
  name: string;
  completed: boolean;
}

function AppContent() {
  // Use shallow selectors for optimized re-renders
  const {
    currentProject,
    projects,
    showProjectDialog,
    newProjectName,
    newProjectBaseline,
    nodes,
    edges,
    globalSettings,
    reactFlowInstance,
    showControlSuggestionModal,
    suggestionModalData,
  } = useFlowStore(useShallow(selectAppState));

  const {
    setShowProjectDialog,
    setNewProjectName,
    setNewProjectBaseline,
    loadProject,
    createNewProject,
    createFromTemplate,
    deleteProject,
    importDiagramFromJSON,
    initialize,
    setShowControlSuggestionModal,
    assignControlsToDevice,
  } = useFlowStore(useShallow(selectAppActions));

  const { initialize: initializeAuth, isAuthenticated } = useAuthStore();
  const { status: aiStatus } = useAIServiceStore(useShallow(selectAppAIStatus));
  const { checkHealth: checkAIHealth } = useAIServiceStore(useShallow(selectAppAIActions));
  const clearAIChat = useAINarrativesStore((state) => state.clearChatHistory);
  const clearNISTHistory = useNISTQueryStore((state) => state.clearHistory);

  // Tour store for guided onboarding
  const { isActive: isTourActive, startTour, shouldShowTour } = useTourStore();

  // Use ref to store latest isAuthenticated value for menu handlers
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'topology' | 'inventory' | 'ssp' | 'narratives' | 'ai'>('topology');
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [projectDialogView, setProjectDialogView] = useState<'main' | 'templates'>('main');

  // Loading screen state
  const [loadingPhases, setLoadingPhases] = useState<LoadingPhase[]>([
    { name: 'Database ready', completed: false },
    { name: 'Loading projects', completed: false },
    { name: 'Validating license', completed: false },
  ]);
  const [currentPhase, setCurrentPhase] = useState('Initializing...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);


  const handleExportPNG = async () => {
    setIsExporting(true);
    setExportType('PNG');
    try {
      // Use the new PNG export (SVG-based)
      const result = await exportDiagramAsPNGFromSVG(
        currentProject?.name || 'diagram',
        nodes,
        edges,
        reactFlowInstance?.getNodesBounds || undefined,
        {
          globalDeviceImageSize: globalSettings.globalDeviceImageSize,
          globalBoundaryLabelSize: globalSettings.globalBoundaryLabelSize,
          globalDeviceLabelSize: globalSettings.globalDeviceLabelSize,
          globalConnectionLabelSize: globalSettings.globalConnectionLabelSize,
        },
        {
          width: 2400,
          height: 1800,
          backgroundColor: '#ffffff',
        }
      );
      
      if (result.success) {
        setStatusMessage(`Exported to: ${result.filePath}`);
      } else if (!result.canceled) {
        setStatusMessage(result.error || 'PNG export failed');
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('PNG export error:', error);
      setStatusMessage('Error exporting PNG');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = async () => {
    setIsExporting(true);
    setExportType('SVG');
    try {
      // Use the new SVG export
      const result = await exportDiagramAsSVG(
        currentProject?.name || 'diagram',
        nodes,
        edges,
        reactFlowInstance?.getNodesBounds || undefined,
        {
          globalDeviceImageSize: globalSettings.globalDeviceImageSize,
          globalBoundaryLabelSize: globalSettings.globalBoundaryLabelSize,
          globalDeviceLabelSize: globalSettings.globalDeviceLabelSize,
          globalConnectionLabelSize: globalSettings.globalConnectionLabelSize,
        },
        {
          width: 1600,
          height: 1200,
          backgroundColor: '#ffffff',
        }
      );
      
      if (result.success) {
        setStatusMessage(`Exported to: ${result.filePath}`);
      } else if (!result.canceled) {
        setStatusMessage(result.error || 'SVG export failed');
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('SVG export error:', error);
      setStatusMessage('Error exporting SVG');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    setExportType('JSON');
    try {
      const { exportFullReport } = useFlowStore.getState();
      const result = await exportFullReport();
      if (result.success) {
        setStatusMessage(`Exported to: ${result.filePath}`);
      } else {
        setStatusMessage(result.error || 'JSON export failed');
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('JSON export error:', error);
      setStatusMessage('Error exporting JSON');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportInventoryCSV = async () => {
    setIsExporting(true);
    setExportType('CSV');
    try {
      // Get device nodes (exclude boundaries)
      const deviceNodes = nodes.filter(node => (node.type === 'device' || !node.type) && node.data);
      await exportDeviceMetadataToCSV(deviceNodes);
      setStatusMessage('Inventory exported successfully');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('CSV export error:', error);
      setStatusMessage('Error exporting inventory');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSSP = () => {
    // Navigate to SSP view - user can generate from there
    setActiveView('ssp');
    setStatusMessage('Navigate to SSP tab to generate PDF');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { saveCurrentDiagram } = useFlowStore.getState();
      await saveCurrentDiagram();
      setStatusMessage('Saved successfully');
      setTimeout(() => {
        setStatusMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Save error:', error);
      setStatusMessage('Error saving');
      setTimeout(() => setStatusMessage(null), 2000);
    } finally {
      setIsSaving(false);
    }
  };


  const handleImportJSON = async () => {
    setIsImporting(true);
    try {
      const result = await importDiagramFromJSON();
      if (result.success) {
        setStatusMessage('Imported successfully!');
        setShowProjectDialog(false);
      } else {
        setStatusMessage('Import failed');
      }
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (_error) {
      setStatusMessage('Error importing');
      setTimeout(() => setStatusMessage(null), 2000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteProject = async (projectId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      setIsDeletingProject(true);
      try {
        await deleteProject(projectId);
        setStatusMessage('Project deleted');
        setTimeout(() => setStatusMessage(null), 2000);
      } finally {
        setIsDeletingProject(false);
      }
    }
  };

  const handleLoadProject = async (projectId: number) => {
    setIsLoadingProject(true);
    try {
      await loadProject(projectId);
      setShowProjectDialog(false);
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleCreateNewProject = async () => {
    setIsCreatingProject(true);
    try {
      await createNewProject();
      setProjectDialogView('main');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleCreateFromTemplate = async (templateId: string, projectName: string) => {
    setIsCreatingProject(true);
    try {
      await createFromTemplate(templateId, projectName);
      setProjectDialogView('main');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Initialize on mount with progress tracking
  useEffect(() => {
    let mounted = true;

    const runInitialization = async () => {
      try {
        console.log('[App] Starting initialization...');
        // Phase 1: Database ready (assumed ready from Electron main process)
        if (!mounted) return;
        console.log('[App] Phase 1: Database ready');
        setLoadingProgress(25);
        setCurrentPhase('Database ready');
        setLoadingPhases((prev) => prev.map((p) =>
          p.name === 'Database ready' ? { ...p, completed: true } : p
        ));

        // Phase 2: FlowStore initialization (loads projects)
        if (!mounted) return;
        console.log('[App] Phase 2: Loading projects...');
        setLoadingProgress(50);
        setCurrentPhase('Loading projects');
        await initialize();
        console.log('[App] Phase 2 complete');
        if (!mounted) return;
        setLoadingPhases((prev) => prev.map((p) =>
          p.name === 'Loading projects' ? { ...p, completed: true } : p
        ));

        // Phase 3: AuthStore initialization (validates license)
        if (!mounted) return;
        console.log('[App] Phase 3: Validating license...');
        setLoadingProgress(75);
        setCurrentPhase('Validating license');
        await initializeAuth();
        console.log('[App] Phase 3 complete');
        if (!mounted) return;
        setLoadingPhases((prev) => prev.map((p) =>
          p.name === 'Validating license' ? { ...p, completed: true } : p
        ));

        // Phase 4: Complete (critical initialization done)
        if (!mounted) return;
        console.log('[App] Phase 4: Marking as complete...');
        setLoadingProgress(100);
        setCurrentPhase('Ready');
        setIsLoadingComplete(true);
        console.log('[App] Initialization complete! isLoadingComplete set to true');

        // Initialize device icon cache in background (non-blocking)
        initializeDeviceIconCache().catch((error) => {
          console.error('Failed to initialize device icon cache:', error);
        });

        // Initialize debug snapshot keyboard shortcut (Ctrl+Shift+D / Cmd+Shift+D)
        const cleanupDebug = initializeDebugShortcut();

        // Store cleanup function for later
        return cleanupDebug;
      } catch (error) {
        console.error('Initialization error:', error);
        // Still show app even if initialization had errors
        setCurrentPhase('Ready (with errors)');
        setIsLoadingComplete(true);
        setLoadingProgress(100);
      }
    };

    runInitialization();

    return () => {
      mounted = false;
    };
  }, [initialize, initializeAuth]);

  // Auto-start tour on first launch (when loading is complete and no projects exist)
  useEffect(() => {
    if (isLoadingComplete && projects.length === 0 && shouldShowTour()) {
      // Small delay to let the UI settle before showing the tour
      const timer = setTimeout(() => {
        startTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoadingComplete, projects.length, shouldShowTour, startTour]);

  // Listen for menu events
  useEffect(() => {
    if (!window.electronAPI) return;

    // File menu events
    window.electronAPI.onMenuExportPNG(() => {
      handleExportPNG();
    });

    // Views menu events
    window.electronAPI.onMenuViewTopology(() => {
      setActiveView('topology');
    });

    window.electronAPI.onMenuViewInventory(() => {
      // Always navigate directly - RequireAuth will handle license overlay
      setActiveView('inventory');
    });

    window.electronAPI.onMenuViewSSP(() => {
      // Always navigate directly - RequireAuth will handle license overlay
      setActiveView('ssp');
    });

    window.electronAPI.onMenuViewNarratives(() => {
      // Always navigate directly - RequireAuth will handle license overlay
      if (!currentProject) {
        setStatusMessage('Please create or open a project first');
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setActiveView('narratives');
      }
    });

    window.electronAPI.onMenuViewAI(() => {
      // Always navigate directly - RequireAuth will handle license overlay
      setActiveView('ai');
    });

    // Topology menu events
    window.electronAPI.onMenuTopologyAddDevice(() => {
      if (activeView !== 'topology') setActiveView('topology');
      window.dispatchEvent(new CustomEvent('topology-add-device'));
    });

    window.electronAPI.onMenuTopologyAddBoundary(() => {
      if (activeView !== 'topology') setActiveView('topology');
      window.dispatchEvent(new CustomEvent('topology-add-boundary'));
    });

    window.electronAPI.onMenuTopologyShowPalette(() => {
      if (activeView !== 'topology') setActiveView('topology');
      window.dispatchEvent(new CustomEvent('topology-show-palette'));
    });

    window.electronAPI.onMenuTopologyShowAlignment(() => {
      if (activeView !== 'topology') setActiveView('topology');
      window.dispatchEvent(new CustomEvent('topology-show-alignment'));
    });

    // Inventory menu events (free feature - no auth required)
    window.electronAPI.onMenuInventoryAddDevice(() => {
      if (activeView !== 'inventory') setActiveView('inventory');
      window.dispatchEvent(new CustomEvent('inventory-add-device'));
    });

    window.electronAPI.onMenuInventoryImport(() => {
      if (activeView !== 'inventory') setActiveView('inventory');
      window.dispatchEvent(new CustomEvent('inventory-import'));
    });

    window.electronAPI.onMenuInventoryExport(() => {
      if (activeView !== 'inventory') setActiveView('inventory');
      window.dispatchEvent(new CustomEvent('inventory-export'));
    });

    window.electronAPI.onMenuInventorySearch(() => {
      if (activeView !== 'inventory') setActiveView('inventory');
      window.dispatchEvent(new CustomEvent('inventory-search'));
    });

    // SSP menu events
    window.electronAPI.onMenuSSPGeneratePDF(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (activeView !== 'ssp') setActiveView('ssp');
      window.dispatchEvent(new CustomEvent('ssp-generate-pdf'));
    });

    window.electronAPI.onMenuSSPPreview(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (activeView !== 'ssp') setActiveView('ssp');
      window.dispatchEvent(new CustomEvent('ssp-preview'));
    });

    window.electronAPI.onMenuSSPSettings(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (activeView !== 'ssp') setActiveView('ssp');
      window.dispatchEvent(new CustomEvent('ssp-settings'));
    });

    // Narratives menu events
    window.electronAPI.onMenuNarrativesNew(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (!currentProject) {
        setStatusMessage('Please create or open a project first');
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }
      if (activeView !== 'narratives') setActiveView('narratives');
      window.dispatchEvent(new CustomEvent('narratives-new'));
    });

    window.electronAPI.onMenuNarrativesExport(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (!currentProject) {
        setStatusMessage('Please create or open a project first');
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }
      if (activeView !== 'narratives') setActiveView('narratives');
      window.dispatchEvent(new CustomEvent('narratives-export'));
    });

    window.electronAPI.onMenuNarrativesImport(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (!currentProject) {
        setStatusMessage('Please create or open a project first');
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }
      if (activeView !== 'narratives') setActiveView('narratives');
      window.dispatchEvent(new CustomEvent('narratives-import'));
    });

    window.electronAPI.onMenuNarrativesReset(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (!currentProject) {
        setStatusMessage('Please create or open a project first');
        setTimeout(() => setStatusMessage(null), 3000);
        return;
      }
      if (confirm('Are you sure you want to reset all control narratives? This cannot be undone.')) {
        if (activeView !== 'narratives') setActiveView('narratives');
        window.dispatchEvent(new CustomEvent('narratives-reset'));
      }
    });

    // AI Assistant menu events
    window.electronAPI.onMenuAIClearChat(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (confirm('Are you sure you want to clear all chat history?')) {
        clearAIChat();
        clearNISTHistory();
        setStatusMessage('Chat history cleared');
        setTimeout(() => setStatusMessage(null), 2000);
      }
    });

    window.electronAPI.onMenuAIExportChat(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (activeView !== 'ai') setActiveView('ai');
      window.dispatchEvent(new CustomEvent('ai-export-chat'));
    });

    window.electronAPI.onMenuAISettings(() => {
      if (!isAuthenticatedRef.current) {
        setShowLicenseDialog(true);
        return;
      }
      if (activeView !== 'ai') setActiveView('ai');
      window.dispatchEvent(new CustomEvent('ai-settings'));
    });

    // Tools menu events
    window.electronAPI.onMenuProjects(() => {
      setShowProjectDialog(true);
    });

    window.electronAPI.onMenuAIStatus(() => {
      setShowAIDialog(true);
    });

    // License menu events
    window.electronAPI.onMenuEnterLicense(() => {
      setShowLicenseDialog(true);
    });

    window.electronAPI.onMenuLicenseStatus(() => {
      setShowLicenseDialog(true);
    });

    window.electronAPI.onMenuLicenseInfo(() => {
      setShowLicenseDialog(true);
    });
  }, [currentProject, activeView, clearAIChat, clearNISTHistory]);

  // Listen for SSP screenshot completion to switch back
  useEffect(() => {
    const handleSwitchToSSP = () => {
      setActiveView('ssp');
    };
    
    const handleSwitchToNarratives = () => {
      setActiveView('narratives');
    };
    
    const handleExportSVGEvent = () => {
      handleExportSVG();
    };
    
    window.addEventListener('switch-to-ssp', handleSwitchToSSP);
    window.addEventListener('switch-to-narratives', handleSwitchToNarratives);
    window.addEventListener('export-svg', handleExportSVGEvent);
    
    return () => {
      window.removeEventListener('switch-to-ssp', handleSwitchToSSP);
      window.removeEventListener('switch-to-narratives', handleSwitchToNarratives);
      window.removeEventListener('export-svg', handleExportSVGEvent);
    };
  }, [handleExportSVG]);

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50">
      {/* Loading Screen */}
      {!isLoadingComplete && (
        <LoadingScreen
          phases={loadingPhases}
          currentPhase={currentPhase}
          progress={loadingProgress}
          isComplete={isLoadingComplete}
        />
      )}

      {/* App Header */}
      <AppHeader
        currentProject={currentProject}
        isSaving={isSaving}
        isExporting={isExporting}
        activeView={activeView}
        onSave={handleSave}
        onExportJSON={handleExportJSON}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onExportInventoryCSV={handleExportInventoryCSV}
        onExportSSP={handleExportSSP}
        onShowProjects={() => setShowProjectDialog(true)}
        onViewChange={setActiveView}
      />

      {/* Status Message Toast - Enhanced */}
      {statusMessage && activeView !== 'narratives' && (
        <div className="fixed top-20 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50 animate-slide-in-from-top">
          {statusMessage}
        </div>
      )}

      {/* Export Loading Overlay */}
      {isExporting && (
        <div className="fixed top-16 right-4 z-[9999] animate-slide-in-from-top">
          <div className="bg-card rounded-lg shadow-lg border px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">
              Exporting {exportType}...
            </span>
          </div>
        </div>
      )}

      {/* Save Loading Indicator */}
      {isSaving && (
        <div className="fixed top-16 right-4 z-[9999] animate-slide-in-from-top">
          <div className="bg-card rounded-lg shadow-lg border px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">
              Saving...
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 relative">
        <ViewRouter
          activeView={activeView}
          onSwitchToTopology={() => setActiveView('topology')}
        />
      </div>

      {/* Project Dialog */}
      {showProjectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[480px] max-h-[85vh] overflow-hidden relative" data-testid="project-dialog">
            {/* Loading overlay for project operations */}
            {(isLoadingProject || isCreatingProject || isDeletingProject) && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {isLoadingProject ? 'Loading project...' :
                     isCreatingProject ? 'Creating project...' :
                     'Deleting project...'}
                  </span>
                </div>
              </div>
            )}
            <CardHeader className="pb-2">
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto max-h-[calc(85vh-120px)]">
              {projectDialogView === 'templates' ? (
                // Sample Projects View
                <SampleProjectsSection
                  onCreateFromTemplate={handleCreateFromTemplate}
                  onBack={() => setProjectDialogView('main')}
                />
              ) : (
                // Main View
                <>
                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => setProjectDialogView('templates')}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-1"
                      data-testid="start-from-template-button"
                    >
                      <Sparkles className="w-5 h-5 text-yellow-500" />
                      <span className="text-xs font-medium">Start from Template</span>
                    </Button>
                    <Button
                      onClick={handleImportJSON}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-1"
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-blue-500" />
                      )}
                      <span className="text-xs font-medium">
                        {isImporting ? 'Importing...' : 'Import JSON'}
                      </span>
                    </Button>
                  </div>

                  {/* Create New Project */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Create New Project</h3>
                    </div>
                    <Input
                      id="new-project-name"
                      placeholder="Enter project name..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newProjectName.trim()) handleCreateNewProject();
                      }}
                      disabled={isCreatingProject}
                      data-testid="new-project-name-input"
                    />
                    <div className="flex gap-2">
                      <Select
                        id="new-project-baseline"
                        value={newProjectBaseline}
                        onChange={(e) => setNewProjectBaseline(e.target.value as 'LOW' | 'MODERATE' | 'HIGH')}
                        disabled={isCreatingProject}
                        className="flex-1"
                      >
                        <option value="LOW">LOW Baseline</option>
                        <option value="MODERATE">MODERATE Baseline</option>
                        <option value="HIGH">HIGH Baseline</option>
                      </Select>
                      <Button
                        onClick={handleCreateNewProject}
                        disabled={!newProjectName.trim() || isCreatingProject}
                        data-testid="create-project-button"
                      >
                        {isCreatingProject ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Create'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Existing Projects */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Existing Projects</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {projects.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded space-y-3">
                          <p>No projects yet.</p>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setProjectDialogView('templates')}
                              className="gap-2"
                            >
                              <Sparkles className="w-4 h-4 text-yellow-500" />
                              Start from a template
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowProjectDialog(false);
                                setProjectDialogView('main');
                                startTour();
                              }}
                              className="gap-2"
                            >
                              <Compass className="w-4 h-4" />
                              Show me around
                            </Button>
                          </div>
                        </div>
                      ) : (
                        projects.map((project: { id: number; name: string; updated_at: string }) => (
                          <div
                            key={project.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors group"
                          >
                            <button
                              onClick={() => handleLoadProject(project.id)}
                              className="flex-1 text-left"
                              disabled={isLoadingProject}
                            >
                              <div className="font-medium">{project.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Updated: {new Date(project.updated_at).toLocaleDateString()}
                              </div>
                            </button>
                            <Button
                              onClick={(e) => handleDeleteProject(project.id, e)}
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={isDeletingProject}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setShowProjectDialog(false);
                      setProjectDialogView('main');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Close
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}


      {/* Control Suggestion Modal - Premium feature, requires license */}
      {suggestionModalData && isAuthenticated && (
        <ControlSuggestionModal
          isOpen={showControlSuggestionModal}
          deviceId={suggestionModalData.deviceId}
          deviceName={suggestionModalData.deviceName}
          deviceType={suggestionModalData.deviceType}
          suggestions={suggestionModalData.suggestions}
          baseline={currentProject?.baseline ?? 'MODERATE'}
          onAssignControls={assignControlsToDevice}
          onClose={() => setShowControlSuggestionModal(false)}
        />
      )}

      {/* License Dialog */}
      <LicenseTokenDialog
        open={showLicenseDialog}
        onOpenChange={setShowLicenseDialog}
      />

      {/* AI Status Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI Service Status</DialogTitle>
            <DialogDescription>
              View the current status of AI services and components.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Overall Status:</span>
                <span className={`font-medium ${
                  aiStatus.status === 'ready' ? 'text-green-600' :
                  aiStatus.status === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {aiStatus.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>LLM:</span>
                <span className={`font-medium ${
                  aiStatus.llmStatus === 'ready' ? 'text-green-600' :
                  aiStatus.llmStatus === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {aiStatus.llmStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Embeddings:</span>
                <span className={`font-medium ${
                  aiStatus.embeddingStatus === 'ready' ? 'text-green-600' :
                  aiStatus.embeddingStatus === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {aiStatus.embeddingStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ChromaDB:</span>
                <span className={`font-medium ${
                  aiStatus.chromaDbStatus === 'connected' ? 'text-green-600' :
                  aiStatus.chromaDbStatus === 'error' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {aiStatus.chromaDbStatus}
                </span>
              </div>
            </div>

            {aiStatus.modelInfo && (
              <div className="text-sm">
                <h4 className="font-semibold mb-2">Models</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>LLM: {aiStatus.modelInfo.llmModel}</div>
                  <div>Embedding: {aiStatus.modelInfo.embeddingModel}</div>
                  <div>Context Window: {aiStatus.modelInfo.contextWindow} tokens</div>
                </div>
              </div>
            )}

            {aiStatus.status === 'error' && aiStatus.error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {aiStatus.error}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={checkAIHealth}
            >
              Refresh Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guided Tour Modal */}
      {isTourActive && <TourModal />}

    </div>
  );
}

function App() {  // Initialize global error handlers on mount
  useEffect(() => {
    initializeGlobalErrorHandlers();  }, []);

  return (
    <ErrorBoundary component="App">
      <LoadingProvider>
        {/* ReactFlowProvider is now lazy-loaded with topology components in LazyTopologyCanvas */}
        <AppContent />
        {/* Global loading indicator */}
        <GlobalLoadingIndicator />
        {/* Global notification container for error notifications */}
        <NotificationContainer />
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export default App;
