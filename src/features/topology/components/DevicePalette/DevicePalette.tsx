import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useITCategories, useNetworkLayerCategories } from './DeviceCategories';
import { getDeviceIconMetadata, triggerMigrationAndReload, isCacheInitialized } from '@/lib/utils/deviceIconMapping';
import { getIconPath } from '@/lib/utils/iconPath';
import { cn } from '@/lib/utils/utils';
import { Search, X, Star, ChevronDown, ChevronRight } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';

interface DevicePaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevicePalette = ({ isOpen, onClose }: DevicePaletteProps) => {
  const placementMode = useFlowStore((state) => state.placementMode);
  const setPlacementMode = useFlowStore((state) => state.setPlacementMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]); // Store icon filenames
  const [activeProvider, setActiveProvider] = useState<'azure' | 'aws'>('azure');
  const [activeTab, setActiveTab] = useState('it-categories');
  // Categories expanded by default, device type groups collapsed by default
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Get categories reactively (updates when cache is ready)
  const allITCategories = useITCategories();
  const allNetworkLayerCategories = useNetworkLayerCategories();

  // Helper function to extract provider from icon path
  const getProviderFromIconPath = (iconPath: string): 'Azure' | 'AWS' | 'Other' => {
    if (!iconPath) return 'Other';
    // Normalize path - handle different formats: src/Icons/..., ./Icons/..., /src/Icons/...
    const normalizedPath = iconPath
      .replace(/^\.\/Icons\//, 'src/Icons/')
      .replace(/^\/src\/Icons\//, 'src/Icons/')
      .replace(/^\/Icons\//, 'src/Icons/');
    
    const pathParts = normalizedPath.split('/');
    // Find the Icons directory index - provider comes right after
    const iconsIndex = pathParts.findIndex(part => part === 'Icons');
    
    if (iconsIndex >= 0 && iconsIndex < pathParts.length - 1) {
      const provider = pathParts[iconsIndex + 1];
      // Handle case variations: Azure, Aws, AWS, etc.
      const providerLower = provider.toLowerCase();
      if (providerLower === 'azure') return 'Azure';
      if (providerLower === 'aws') return 'AWS';
    }
    return 'Other';
  };

  // Filter icons by provider
  const filterIconsByProvider = (iconFiles: string[], provider: 'azure' | 'aws'): string[] => {
    const targetProvider = provider === 'azure' ? 'Azure' : 'AWS';
    return iconFiles.filter(iconFile => getProviderFromIconPath(iconFile) === targetProvider);
  };

  // Filter icons - only include those with valid icon paths
  const hasValidIconPath = (iconPath: string): boolean => {
    if (!iconPath || iconPath.trim() === '') return false;
    // Must have a valid path structure - at minimum should contain Icons/ or have proper format
    if (!iconPath.includes('Icons/') && !iconPath.includes('iconpack/')) return false;
    // Should have an extension
    if (!iconPath.match(/\.(svg|png|jpg|jpeg|gif|webp)$/i)) return false;
    return true;
  };

  // Filter categories by provider and validate icons
  const itCategories = useMemo(() => {
    return allITCategories.map(category => {
      const providerFiltered = filterIconsByProvider(category.iconFiles, activeProvider);
      // Only include devices with valid icon paths
      const validIcons = providerFiltered.filter(iconFile => {
        if (!hasValidIconPath(iconFile)) return false;
        const metadata = getDeviceIconMetadata(iconFile);
        return metadata !== undefined;
      });
      return {
        ...category,
        iconFiles: validIcons,
      };
    }).filter(category => category.iconFiles.length > 0);
  }, [allITCategories, activeProvider]);

  const networkLayerCategories = useMemo(() => {
    return allNetworkLayerCategories.map(category => {
      const providerFiltered = filterIconsByProvider(category.iconFiles, activeProvider);
      // Only include devices with valid icon paths
      const validIcons = providerFiltered.filter(iconFile => {
        if (!hasValidIconPath(iconFile)) return false;
        const metadata = getDeviceIconMetadata(iconFile);
        return metadata !== undefined;
      });
      return {
        ...category,
        iconFiles: validIcons,
      };
    }).filter(category => category.iconFiles.length > 0);
  }, [allNetworkLayerCategories, activeProvider]);

  // Group devices by device type within a category
  const groupDevicesByType = (iconFiles: string[]): Map<string, string[]> => {
    const grouped = new Map<string, string[]>();
    
    iconFiles.forEach(iconFile => {
      const metadata = getDeviceIconMetadata(iconFile);
      if (!metadata) return;
      
      const deviceType = metadata.deviceType || 'Other';
      if (!grouped.has(deviceType)) {
        grouped.set(deviceType, []);
      }
      grouped.get(deviceType)!.push(iconFile);
    });
    
    return grouped;
  };

  // Expand all categories when provider or tab changes
  useEffect(() => {
    const allCategoryNames = [
      ...itCategories.map(c => c.name),
      ...networkLayerCategories.map(c => c.name),
    ];
    setExpandedCategories(new Set(allCategoryNames));
  }, [activeProvider, activeTab, itCategories, networkLayerCategories]);

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  // Load favorites from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('device-icon-favorites');
    if (stored) {
      setFavorites(JSON.parse(stored));
    }
  }, []);

  // Save favorites to localStorage
  const toggleFavorite = (iconFilename: string) => {
    const newFavorites = favorites.includes(iconFilename)
      ? favorites.filter(f => f !== iconFilename)
      : [...favorites, iconFilename];
    setFavorites(newFavorites);
    localStorage.setItem('device-icon-favorites', JSON.stringify(newFavorites));
  };

  // Filter icon files based on search term
  const filterIcons = (iconFiles: string[]) => {
    if (!searchTerm) return iconFiles;
    return iconFiles.filter(iconFile => {
      const metadata = getDeviceIconMetadata(iconFile);
      if (!metadata) return false;
      return (
        metadata.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        metadata.deviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (metadata.deviceSubtype && metadata.deviceSubtype.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  };

  // Filter favorites by provider and validate icons
  const filteredFavorites = useMemo(() => {
    return favorites.filter(fav => {
      if (!hasValidIconPath(fav)) return false;
      const provider = getProviderFromIconPath(fav);
      return activeProvider === 'azure' ? provider === 'Azure' : provider === 'AWS';
    });
  }, [favorites, activeProvider]);

  const handleDeviceClick = (iconFilename: string) => {
    const metadata = getDeviceIconMetadata(iconFilename);
    if (metadata) {
      setPlacementMode({
        deviceType: metadata.deviceType,
        iconFilename,
        displayName: metadata.displayName,
        deviceSubtype: metadata.deviceSubtype,
      });
    }
  };

  const handleDeviceDragStart = (
    event: React.DragEvent,
    iconFilename: string
  ) => {
    const metadata = getDeviceIconMetadata(iconFilename);
    if (metadata) {
      event.dataTransfer.setData('application/reactflow', iconFilename);
      event.dataTransfer.effectAllowed = 'move';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="topology-panel topology-panel-left">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Add Device</CardTitle>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Close device palette"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {/* Provider Tabs */}
          <Tabs value={activeProvider} onValueChange={(value) => setActiveProvider(value as 'azure' | 'aws')} className="mb-4">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="azure">Azure</TabsTrigger>
              <TabsTrigger value="aws">AWS</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Favorites Section */}
          {filteredFavorites.length > 0 && !searchTerm && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                ⭐ Favorites ({filteredFavorites.length})
              </h3>
              <div className="space-y-1">
                {filteredFavorites.map((iconFilename) => {
                  const metadata = getDeviceIconMetadata(iconFilename);
                  if (!metadata) return null;
                  return (
                    <DeviceIconButton
                      key={`fav-${iconFilename}`}
                      iconFilename={iconFilename}
                      metadata={metadata}
                      isFavorite={true}
                      placementMode={placementMode}
                      onClick={handleDeviceClick}
                      onDragStart={handleDeviceDragStart}
                      onToggleFavorite={toggleFavorite}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabbed Device Categories */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="it-categories">IT Categories</TabsTrigger>
              <TabsTrigger value="network-layers">Network Layers</TabsTrigger>
            </TabsList>

            <TabsContent value="it-categories">
              {itCategories.length === 0 && isCacheInitialized() && (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <p>No device types found</p>
                  <p className="text-xs">The database may be empty. Click below to scan icons and populate the database:</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await triggerMigrationAndReload();
                        // Force re-render
                        setActiveTab(activeTab === 'it-categories' ? 'network-layers' : 'it-categories');
                        setTimeout(() => setActiveTab('it-categories'), 100);
                      } catch (error) {
                        console.error('Migration failed:', error);
                        alert('Migration failed. Check console for details.');
                      }
                    }}
                  >
                    Scan Icons & Populate Database
                  </Button>
                </div>
              )}
              {itCategories.length === 0 && !isCacheInitialized() && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Loading device types...</p>
                </div>
              )}
              {itCategories.map((category) => {
                const filteredIcons = filterIcons(category.iconFiles);
                if (filteredIcons.length === 0) return null;

                const isExpanded = expandedCategories.has(category.name);
                const deviceTypeGroups = groupDevicesByType(filteredIcons);
                const totalCount = filteredIcons.length;

                return (
                  <div key={category.name} className="mb-4 border-b border-border/40 pb-3 last:border-b-0">
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className="flex items-center justify-between w-full mb-2 hover:bg-accent/50 rounded px-2 py-1 -mx-2 transition-colors"
                    >
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {category.icon} {category.name} <span className="text-xs font-normal opacity-70">({totalCount})</span>
                      </h3>
                    </button>
                    {isExpanded && (
                      <div className="ml-2 space-y-3 mt-2">
                        {Array.from(deviceTypeGroups.entries()).map(([deviceType, iconFiles], groupIndex) => {
                          const displayTypeName = deviceType.split('-').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ');

                          // Only show group header if there are multiple groups AND
                          // (multiple items in this group OR item name differs from group name)
                          const showGroupHeader = deviceTypeGroups.size > 1 && (
                            iconFiles.length > 1 ||
                            !iconFiles.some(f => {
                              const m = getDeviceIconMetadata(f);
                              return m && m.displayName.toLowerCase().replace(/\s+/g, '') === displayTypeName.toLowerCase().replace(/\s+/g, '');
                            })
                          );

                          return (
                            <div key={deviceType} className={groupIndex > 0 ? 'pt-2 border-t border-border/20' : ''}>
                              {showGroupHeader && (
                                <div className="text-xs font-medium text-muted-foreground/70 mb-1 px-2">
                                  {displayTypeName}
                                </div>
                              )}
                              <div className="space-y-1">
                                {iconFiles.map((iconFilename) => {
                                  const metadata = getDeviceIconMetadata(iconFilename);
                                  if (!metadata) return null;
                                  return (
                                    <DeviceIconButton
                                      key={iconFilename}
                                      iconFilename={iconFilename}
                                      metadata={metadata}
                                      isFavorite={favorites.includes(iconFilename)}
                                      placementMode={placementMode}
                                      onClick={handleDeviceClick}
                                      onDragStart={handleDeviceDragStart}
                                      onToggleFavorite={toggleFavorite}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="network-layers">
              {networkLayerCategories.length === 0 && isCacheInitialized() && (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <p>No device types found</p>
                  <p className="text-xs">The database may be empty. Click below to scan icons and populate the database:</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await triggerMigrationAndReload();
                        // Force re-render by updating state
                        setActiveTab(activeTab === 'network-layers' ? 'it-categories' : 'network-layers');
                        setTimeout(() => setActiveTab('network-layers'), 100);
                      } catch (error) {
                        console.error('Migration failed:', error);
                        alert('Migration failed. Check console for details.');
                      }
                    }}
                  >
                    Scan Icons & Populate Database
                  </Button>
                </div>
              )}
              {networkLayerCategories.length === 0 && !isCacheInitialized() && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Loading device types...</p>
                </div>
              )}
              {networkLayerCategories.map((category) => {
                const filteredIcons = filterIcons(category.iconFiles);
                if (filteredIcons.length === 0) return null;

                const isExpanded = expandedCategories.has(category.name);
                const deviceTypeGroups = groupDevicesByType(filteredIcons);
                const totalCount = filteredIcons.length;

                return (
                  <div key={category.name} className="mb-4 border-b border-border/40 pb-3 last:border-b-0">
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className="flex items-center justify-between w-full mb-2 hover:bg-accent/50 rounded px-2 py-1 -mx-2 transition-colors"
                    >
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {category.icon} {category.name} <span className="text-xs font-normal opacity-70">({totalCount})</span>
                      </h3>
                    </button>
                    {isExpanded && (
                      <div className="ml-2 space-y-3 mt-2">
                        {Array.from(deviceTypeGroups.entries()).map(([deviceType, iconFiles], groupIndex) => {
                          const displayTypeName = deviceType.split('-').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ');

                          // Only show group header if there are multiple groups AND
                          // (multiple items in this group OR item name differs from group name)
                          const showGroupHeader = deviceTypeGroups.size > 1 && (
                            iconFiles.length > 1 ||
                            !iconFiles.some(f => {
                              const m = getDeviceIconMetadata(f);
                              return m && m.displayName.toLowerCase().replace(/\s+/g, '') === displayTypeName.toLowerCase().replace(/\s+/g, '');
                            })
                          );

                          return (
                            <div key={deviceType} className={groupIndex > 0 ? 'pt-2 border-t border-border/20' : ''}>
                              {showGroupHeader && (
                                <div className="text-xs font-medium text-muted-foreground/70 mb-1 px-2">
                                  {displayTypeName}
                                </div>
                              )}
                              <div className="space-y-1">
                                {iconFiles.map((iconFilename) => {
                                  const metadata = getDeviceIconMetadata(iconFilename);
                                  if (!metadata) return null;
                                  return (
                                    <DeviceIconButton
                                      key={iconFilename}
                                      iconFilename={iconFilename}
                                      metadata={metadata}
                                      isFavorite={favorites.includes(iconFilename)}
                                      placementMode={placementMode}
                                      onClick={handleDeviceClick}
                                      onDragStart={handleDeviceDragStart}
                                      onToggleFavorite={toggleFavorite}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

interface DeviceIconButtonProps {
  iconFilename: string;
  metadata: {
    displayName: string;
    deviceType: string;
  };
  isFavorite: boolean;
  placementMode: { iconFilename: string } | null;
  onClick: (iconFilename: string) => void;
  onDragStart: (event: React.DragEvent, iconFilename: string) => void;
  onToggleFavorite: (iconFilename: string) => void;
}

const DeviceIconButton = ({
  iconFilename,
  metadata,
  isFavorite,
  placementMode,
  onClick,
  onDragStart,
  onToggleFavorite,
}: DeviceIconButtonProps) => {
  const iconPath = getIconPath(iconFilename);
  const isActive = placementMode?.iconFilename === iconFilename;
  
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 p-2 rounded cursor-grab hover:bg-accent transition-colors group',
        isActive && 'bg-blue-100 dark:bg-blue-900'
      )}
      draggable
      onDragStart={(e) => onDragStart(e, iconFilename)}
      onClick={() => onClick(iconFilename)}
      title={metadata.displayName}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
          <img
            src={iconPath}
            alt={metadata.displayName}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
        <span className="text-xs truncate">{metadata.displayName}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(iconFilename);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <Star
          className={cn(
            'w-4 h-4',
            isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
          )}
        />
      </button>
    </div>
  );
};

