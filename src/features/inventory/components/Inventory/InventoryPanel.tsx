import { useState, useMemo } from 'react';
import { X, Download, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { extractInventoryByCategory } from '@/lib/topology/inventoryExtractor';
import { exportDeviceMetadataToCSV } from '@/lib/export/csvExport';
import { AppNode, DeviceNodeData } from '@/lib/utils/types';
import { EditableDeviceMetadataTable } from './EditableDeviceMetadataTable';
import { EditableInventoryTable } from './EditableInventoryTable';
import { DeviceManagementTable } from './DeviceManagementTable';
import { DeviceEditorModal } from './DeviceEditorModal';

interface InventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export const InventoryPanel = ({ isOpen, onClose, inline = false }: InventoryPanelProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const updateNode = useFlowStore((state) => state.updateNode);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'hardware' | 'software'>('hardware');
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editedDevice, setEditedDevice] = useState<Partial<DeviceNodeData> | null>(null);
  const [editingSoftwareDeviceId, setEditingSoftwareDeviceId] = useState<string | null>(null);

  // Extract inventory from nodes
  const inventoryResult = useMemo(() => {
    return extractInventoryByCategory(nodes);
  }, [nodes]);

  // Filter inventory based on active tab and search
  const filteredItems = useMemo(() => {
    let items = inventoryResult.items;

    // Filter by active tab (Hardware or Software)
    if (activeTab === 'hardware') {
      items = items.filter(item => item.category === 'Hardware');
    } else {
      items = items.filter(item => item.category === 'Software');
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term) ||
        item.manufacturer.toLowerCase().includes(term) ||
        item.model.toLowerCase().includes(term) ||
        item.location.toLowerCase().includes(term) ||
        item.deviceId.toLowerCase().includes(term)
      );
    }

    return items;
  }, [inventoryResult, searchTerm, activeTab]);

  // Get device nodes (exclude boundaries)
  const deviceNodes = useMemo(() => {
    return nodes.filter(node => (node.type === 'device' || !node.type) && node.data) as AppNode[];
  }, [nodes]);

  const handleExportCSV = async () => {
    // Use device nodes directly (same as used for table display)
    // Saves directly to Downloads folder in Electron, or uses browser download otherwise
    await exportDeviceMetadataToCSV(deviceNodes);
  };

  // Filter devices by search
  const filteredDevices = useMemo(() => {
    if (!searchTerm.trim()) return deviceNodes;
    
    const term = searchTerm.toLowerCase();
    return deviceNodes.filter(node => {
      const data = node.data as DeviceNodeData;
      return (
        data.name?.toLowerCase().includes(term) ||
        data.deviceType?.toLowerCase().includes(term) ||
        data.manufacturer?.toLowerCase().includes(term) ||
        data.model?.toLowerCase().includes(term) ||
        data.ipAddress?.toLowerCase().includes(term) ||
        data.location?.toLowerCase().includes(term)
      );
    });
  }, [deviceNodes, searchTerm]);

  const handleStartEdit = (node: AppNode) => {
    setEditingDeviceId(node.id);
    setEditedDevice({ ...(node.data as DeviceNodeData) });
  };

  const handleCancelEdit = () => {
    setEditingDeviceId(null);
    setEditedDevice(null);
    setEditingSoftwareDeviceId(null);
  };

  const handleSaveEdit = () => {
    if (!editingDeviceId || !editedDevice) return;
    
    updateNode(editingDeviceId, editedDevice);
    setEditingDeviceId(null);
    setEditedDevice(null);
  };

  const handleFieldChange = (field: keyof DeviceNodeData, value: any) => {
    if (!editedDevice) return;
    setEditedDevice({ ...editedDevice, [field]: value });
  };

  const handleInlineFieldChange = (nodeId: string, field: keyof DeviceNodeData, value: any) => {
    updateNode(nodeId, { [field]: value });
  };

  const handleStartEditSoftware = (nodeId: string) => {
    setEditingSoftwareDeviceId(nodeId === '' ? null : nodeId);
  };

  const handleAddSoftwareInline = (nodeId: string, softwareName: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const data = node.data as DeviceNodeData;
    const currentSoftware = data.software || '';
    const updatedSoftware = currentSoftware 
      ? `${currentSoftware}\n${softwareName.trim()}`
      : softwareName.trim();
    updateNode(nodeId, { software: updatedSoftware });
  };

  const handleRemoveSoftwareInline = (nodeId: string, index: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const data = node.data as DeviceNodeData;
    const softwareList = (data.software || '').split('\n').filter(s => s.trim());
    const updatedList = softwareList.filter((_, i) => i !== index);
    updateNode(nodeId, { software: updatedList.join('\n') });
  };

  if (!isOpen) return null;

  const content = (
    <Card className={inline ? "w-full h-full flex flex-col" : "w-[90vw] h-[90vh] max-w-7xl flex flex-col"}>
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">HW/SW Inventory & Device Management</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              {!inline && (
                <Button onClick={onClose} variant="ghost" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
        </div>
      </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {/* Main Tabs: Hardware vs Software */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'hardware' | 'software')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mb-4">
              <TabsTrigger value="hardware">Hardware ({inventoryResult.stats.hardwareCount})</TabsTrigger>
              <TabsTrigger value="software">Software ({inventoryResult.stats.softwareCount})</TabsTrigger>
            </TabsList>

            {/* Hardware Tab */}
            <TabsContent value="hardware" className="flex-1 flex flex-col overflow-hidden m-0">
              {/* Search */}
              <div className="flex gap-4 mb-4 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search devices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Device Metadata Table - Shows ALL fields */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <EditableDeviceMetadataTable 
                  devices={filteredDevices} 
                  updateNode={updateNode} 
                />
              </div>
            </TabsContent>

            {/* Software Tab */}
            <TabsContent value="software" className="flex-1 flex flex-col overflow-hidden m-0">
              {/* Search */}
              <div className="flex gap-4 mb-4 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search software..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Inventory Table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <EditableInventoryTable items={filteredItems} nodes={nodes} updateNode={updateNode} />
              </div>
            </TabsContent>

            {/* Device Management Tab (keep for backward compatibility) */}
            <TabsContent value="devices" className="flex-1 flex flex-col overflow-hidden m-0">
              {/* Search */}
              <div className="flex gap-4 mb-4 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search devices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Device Management Table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <DeviceManagementTable
                  devices={filteredDevices}
                  editingDeviceId={editingDeviceId}
                  editedDevice={editedDevice}
                  editingSoftwareDeviceId={editingSoftwareDeviceId}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onFieldChange={handleFieldChange}
                  onInlineFieldChange={handleInlineFieldChange}
                  onStartEditSoftware={handleStartEditSoftware}
                  onAddSoftware={handleAddSoftwareInline}
                  onRemoveSoftware={handleRemoveSoftwareInline}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Device Editor Modal */}
          {editingDeviceId && editedDevice && (
            <DeviceEditorModal
              deviceId={editingDeviceId}
              deviceData={editedDevice}
              onFieldChange={handleFieldChange}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          )}
        </CardContent>
      </Card>
  );

  if (inline) {
    return <div className="w-full h-full p-4">{content}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {content}
    </div>
  );
};


