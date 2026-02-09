/**
 * Virtualized Control List Component
 * Uses react-window 2.x to render only visible controls for optimal performance
 * with large catalogs (1000+ controls)
 */

import { useMemo, CSSProperties, ReactElement } from 'react';
import { List } from 'react-window';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Circle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface ControlItem {
  control_id: string;
  title: string;
  family: string;
}

interface ControlFamily {
  code: string;
  name: string;
  controls: ControlItem[];
}

type FamilyStatus = 'complete' | 'partial' | 'none';

// Row types for the virtualized list
type VirtualRow =
  | { type: 'family-header'; family: ControlFamily; status: FamilyStatus; selectedCount: number; totalCount: number; isExpanded: boolean }
  | { type: 'toggle-all'; familyCode: string }
  | { type: 'control'; control: ControlItem; familyCode: string; isLastInFamily: boolean };

interface VirtualizedControlListProps {
  families: ControlFamily[];
  expandedFamilies: Set<string>;
  selectedControlIds: string[];
  onToggleFamily: (familyCode: string) => void;
  onToggleControl: (controlId: string, selected: boolean) => void;
  onToggleAllInFamily: (familyCode: string) => void;
  getFamilyStatus: (familyCode: string) => FamilyStatus;
  height?: number;
}

// Row props passed to the row component
interface RowProps {
  rows: VirtualRow[];
  selectedIdsSet: Set<string>;
  onToggleFamily: (familyCode: string) => void;
  onToggleControl: (controlId: string, selected: boolean) => void;
  onToggleAllInFamily: (familyCode: string) => void;
}

// Row component for react-window 2.x
const RowComponent = ({
  index,
  style,
  rows,
  selectedIdsSet,
  onToggleFamily,
  onToggleControl,
  onToggleAllInFamily,
}: {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
} & RowProps): ReactElement => {
  const row = rows[index];
  if (!row) return <div style={style} />;

  switch (row.type) {
    case 'family-header': {
      const { family, status, selectedCount, totalCount, isExpanded } = row;
      return (
        <div style={style} className="px-4 pt-2">
          <div className="border rounded-lg bg-white transition-all hover:shadow-md">
            <div
              className="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between transition-colors"
              onClick={() => onToggleFamily(family.code)}
            >
              <div className="flex items-center gap-2">
                {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {status === 'partial' && <Circle className="w-4 h-4 text-yellow-600" />}
                {status === 'none' && <MinusCircle className="w-4 h-4 text-gray-400" />}
                <span className="text-sm font-semibold">
                  {family.code} - {family.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  status === 'complete' ? 'bg-green-100 text-green-700' :
                  status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {selectedCount}/{totalCount}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'toggle-all': {
      return (
        <div style={style} className="px-4">
          <div className="border-x bg-white px-2 pt-2">
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => onToggleAllInFamily(row.familyCode)}
              type="button"
            >
              Toggle All
            </button>
          </div>
        </div>
      );
    }

    case 'control': {
      const { control, isLastInFamily } = row;
      const isSelected = selectedIdsSet.has(control.control_id);

      return (
        <div style={style} className="px-4">
          <div className={`border-x bg-white px-2 ${isLastInFamily ? 'border-b rounded-b-lg pb-2' : ''}`}>
            <label
              className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onToggleControl(control.control_id, !!checked)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium">{control.control_id}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{control.title}</p>
              </div>
            </label>
          </div>
        </div>
      );
    }

    default:
      return <div style={style} />;
  }
};

// Average row height for the list
const AVERAGE_ROW_HEIGHT = 52;

export const VirtualizedControlList: React.FC<VirtualizedControlListProps> = ({
  families,
  expandedFamilies,
  selectedControlIds,
  onToggleFamily,
  onToggleControl,
  onToggleAllInFamily,
  getFamilyStatus,
  height = 384, // Default matches max-h-96 (384px)
}) => {
  const selectedIdsSet = useMemo(() => new Set(selectedControlIds), [selectedControlIds]);

  // Flatten the hierarchical data into a flat list for virtualization
  const flattenedRows: VirtualRow[] = useMemo(() => {
    const rows: VirtualRow[] = [];

    families.forEach((family) => {
      const status = getFamilyStatus(family.code);
      const selectedInFamily = family.controls.filter(c => selectedIdsSet.has(c.control_id)).length;
      const isExpanded = expandedFamilies.has(family.code);

      // Add family header
      rows.push({
        type: 'family-header',
        family,
        status,
        selectedCount: selectedInFamily,
        totalCount: family.controls.length,
        isExpanded,
      });

      // Add controls if expanded
      if (isExpanded) {
        // Add toggle all button
        rows.push({
          type: 'toggle-all',
          familyCode: family.code,
        });

        // Add each control
        family.controls.forEach((control, idx) => {
          const isLastInFamily = idx === family.controls.length - 1;
          rows.push({
            type: 'control',
            control,
            familyCode: family.code,
            isLastInFamily,
          });
        });
      }
    });

    return rows;
  }, [families, expandedFamilies, getFamilyStatus, selectedIdsSet]);

  // Row props to pass to each row
  const rowProps: RowProps = useMemo(() => ({
    rows: flattenedRows,
    selectedIdsSet,
    onToggleFamily,
    onToggleControl,
    onToggleAllInFamily,
  }), [flattenedRows, selectedIdsSet, onToggleFamily, onToggleControl, onToggleAllInFamily]);

  if (flattenedRows.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No controls found
      </div>
    );
  }

  return (
    <List
      rowComponent={RowComponent}
      rowCount={flattenedRows.length}
      rowHeight={AVERAGE_ROW_HEIGHT}
      rowProps={rowProps}
      overscanCount={5}
      style={{ height }}
      className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
    />
  );
};

export default VirtualizedControlList;
