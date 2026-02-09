import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DeviceNodeData } from '@/lib/utils/types';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { getFieldsByCategory } from '@/lib/utils/propertyRegistry';

interface DeviceEditorModalProps {
  deviceId: string;
  deviceData: Partial<DeviceNodeData>;
  onFieldChange: (field: keyof DeviceNodeData, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const DeviceEditorModal = ({
  deviceData,
  onFieldChange,
  onSave,
  onCancel
}: DeviceEditorModalProps) => {
  const categories: Array<'Basic' | 'Network' | 'Hardware' | 'Security' | 'Compliance' | 'Ownership'> = [
    'Basic', 'Network', 'Hardware', 'Security', 'Compliance', 'Ownership'
  ];
  const [activeTab, setActiveTab] = useState<string>('properties');
  const [expandedCategory, setExpandedCategory] = useState<string>('Basic');
  const [newSoftware, setNewSoftware] = useState('');

  // Handle software field specially
  const softwareList = useMemo(() => {
    const software = deviceData.software || '';
    return software.split('\n').filter(s => s.trim());
  }, [deviceData.software]);

  const handleAddSoftware = () => {
    if (!newSoftware.trim()) return;
    const currentSoftware = deviceData.software || '';
    const updatedSoftware = currentSoftware 
      ? `${currentSoftware}\n${newSoftware.trim()}`
      : newSoftware.trim();
    onFieldChange('software', updatedSoftware);
    setNewSoftware('');
  };

  const handleRemoveSoftware = (index: number) => {
    const updatedList = softwareList.filter((_, i) => i !== index);
    onFieldChange('software', updatedList.join('\n'));
  };

  const renderField = (fieldName: string, fieldDef: any) => {
    const value = deviceData[fieldName as keyof DeviceNodeData];
    
    // Special handling for software field
    if (fieldName === 'software') {
      return (
        <div>
          <Label className="text-sm">{fieldDef.description}</Label>
          <div className="space-y-2 mt-1">
            {/* Software list */}
            {softwareList.length > 0 && (
              <div className="space-y-1">
                {softwareList.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                    <span className="flex-1 text-sm">{item}</span>
                    <Button
                      type="button"
                      onClick={() => handleRemoveSoftware(index)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Add software input */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter software name (e.g., Apache 2.4)"
                value={newSoftware}
                onChange={(e) => setNewSoftware(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSoftware();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddSoftware}
                size="sm"
                variant="outline"
                disabled={!newSoftware.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            {softwareList.length === 0 && (
              <p className="text-xs text-gray-500">No software added yet. Add software using the input above.</p>
            )}
          </div>
        </div>
      );
    }
    
    if (fieldDef.fieldType === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={fieldName}
            checked={value as boolean || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFieldChange(fieldName as keyof DeviceNodeData, e.target.checked)
            }
          />
          <Label htmlFor={fieldName} className="text-sm">{fieldDef.description}</Label>
        </div>
      );
    }

    if (fieldDef.fieldType === 'select' && fieldDef.options) {
      return (
        <div>
          <Label htmlFor={fieldName} className="text-sm">{fieldDef.description}</Label>
          <Select
            id={fieldName}
            value={String(value || '')}
            onChange={(e) => onFieldChange(fieldName as keyof DeviceNodeData, e.target.value)}
          >
            <option value="">Select...</option>
            {fieldDef.options.map((opt: { value: string; label: string }) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>
      );
    }

    if (fieldDef.fieldType === 'textarea') {
      return (
        <div>
          <Label htmlFor={fieldName} className="text-sm">{fieldDef.description}</Label>
          <Textarea
            id={fieldName}
            value={String(value || '')}
            onChange={(e) => onFieldChange(fieldName as keyof DeviceNodeData, e.target.value)}
            rows={3}
          />
        </div>
      );
    }

    if (fieldDef.fieldType === 'date') {
      return (
        <div>
          <Label htmlFor={fieldName} className="text-sm">{fieldDef.description}</Label>
          <Input
            id={fieldName}
            type="date"
            value={String(value || '')}
            onChange={(e) => onFieldChange(fieldName as keyof DeviceNodeData, e.target.value)}
          />
        </div>
      );
    }

    // Default: text input
    return (
      <div>
        <Label htmlFor={fieldName} className="text-sm">{fieldDef.description}</Label>
        <Input
          id={fieldName}
          type={fieldDef.fieldType === 'email' ? 'email' : 'text'}
          value={String(value || '')}
          onChange={(e) => onFieldChange(fieldName as keyof DeviceNodeData, e.target.value)}
          placeholder={fieldDef.description}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <Card className="w-[90vw] h-[90vh] max-w-6xl flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Edit Device: {deviceData.name || 'Unnamed Device'}</CardTitle>
            <Button onClick={onCancel} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mb-4">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="software">Software ({softwareList.length})</TabsTrigger>
            </TabsList>

            {/* Properties Tab */}
            <TabsContent value="properties" className="flex-1 overflow-y-auto m-0">
              <div className="space-y-4">
                {categories.map((category) => {
                  const fields = getFieldsByCategory(category);
                  if (fields.length === 0) return null;

                  return (
                    <div key={category} className="border rounded-lg">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === category ? '' : category)}
                        className="flex items-center justify-between w-full p-3 text-sm font-semibold hover:bg-accent transition-colors"
                      >
                        <span>{category} Properties</span>
                        <span>{expandedCategory === category ? '−' : '+'}</span>
                      </button>
                      {expandedCategory === category && (
                        <div className="p-4 border-t space-y-3">
                          {fields.map((fieldDef) => {
                            // Skip name and deviceType in Basic category as they're shown in header
                            if (category === 'Basic' && (fieldDef.fieldName === 'name' || fieldDef.fieldName === 'deviceType')) {
                              return null;
                            }
                            // Skip software field as it has its own tab
                            if (fieldDef.fieldName === 'software') {
                              return null;
                            }
                            return (
                              <div key={fieldDef.fieldName}>
                                {renderField(fieldDef.fieldName as string, fieldDef)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Software Tab */}
            <TabsContent value="software" className="flex-1 overflow-y-auto m-0">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Installed Software</h3>
                  
                  {/* Software list */}
                  {softwareList.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {softwareList.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                          <span className="flex-1 text-sm font-medium">{item}</span>
                          <Button
                            type="button"
                            onClick={() => handleRemoveSoftware(index)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="mb-2">No software added yet.</p>
                      <p className="text-sm">Use the form below to add software to this device.</p>
                    </div>
                  )}

                  {/* Add software form */}
                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium mb-2 block">Add Software</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter software name (e.g., Apache 2.4, MySQL 8.0, PHP 8.1)"
                        value={newSoftware}
                        onChange={(e) => setNewSoftware(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSoftware();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddSoftware}
                        size="default"
                        variant="default"
                        disabled={!newSoftware.trim()}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Software
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Press Enter or click "Add Software" to add the software to the list.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <div className="border-t p-4 flex justify-end gap-2">
          <Button onClick={onCancel} variant="outline">Cancel</Button>
          <Button onClick={onSave} variant="default">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
};

