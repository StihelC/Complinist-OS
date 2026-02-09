import { ChevronDown, ChevronRight } from 'lucide-react';

interface PropertySectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const PropertySection = ({ title, expanded, onToggle, children }: PropertySectionProps) => {
  return (
    <div className="border rounded-lg">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-3 text-sm font-semibold hover:bg-accent transition-colors"
      >
        <span>{title}</span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {expanded && <div className="p-3 border-t">{children}</div>}
    </div>
  );
};

