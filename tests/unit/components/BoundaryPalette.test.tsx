import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoundaryPalette } from '@/features/topology/components/BoundaryPanel/BoundaryPalette';
import { useFlowStore } from '@/core/stores/useFlowStore';
import type { BoundaryType } from '@/core/types/topology.types';

// Mock the flow store
vi.mock('@/core/stores/useFlowStore', () => ({
  useFlowStore: vi.fn(),
}));

describe('BoundaryPalette', () => {
  const mockSetBoundaryDrawingMode = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementation
    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        setBoundaryDrawingMode: mockSetBoundaryDrawingMode,
      };
      return selector ? selector(state) : state;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <BoundaryPalette isOpen={false} onClose={mockOnClose} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByText('Add Boundary')).toBeInTheDocument();
    });

    it('should display drawing mode active indicator', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByText('🎨 Drawing Mode Active')).toBeInTheDocument();
      expect(
        screen.getByText('Click and drag on the canvas to create the boundary')
      ).toBeInTheDocument();
    });

    it('should display boundary name input', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);
      const input = screen.getByLabelText('Boundary Name');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('New Boundary');
    });

    it('should display visual style selector', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByLabelText(/Visual Style/i)).toBeInTheDocument();
    });

    it('should display preview section', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('should display ESC key hint', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);
      expect(
        screen.getByText('Press ESC or close this panel to cancel')
      ).toBeInTheDocument();
    });
  });

  describe('Auto-enable drawing mode', () => {
    it('should automatically enable drawing mode when palette opens', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith({
        type: 'custom',
        label: 'New Boundary',
        color: expect.any(String),
      });
    });

    it('should use default visual style (custom) on mount', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          label: 'New Boundary',
        })
      );
    });

    it('should disable drawing mode when palette closes', () => {
      const { rerender } = render(
        <BoundaryPalette isOpen={true} onClose={mockOnClose} />
      );

      // Reset mock to clear initial call
      mockSetBoundaryDrawingMode.mockClear();

      // Close the palette
      rerender(<BoundaryPalette isOpen={false} onClose={mockOnClose} />);

      expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(null);
    });
  });

  describe('Boundary name updates', () => {
    it('should update boundary name when input changes', async () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Boundary Name') as HTMLInputElement;

      // Clear initial calls
      mockSetBoundaryDrawingMode.mockClear();

      // Change the name
      fireEvent.change(input, { target: { value: 'Security Zone' } });

      await waitFor(() => {
        expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(
          expect.objectContaining({
            label: 'Security Zone',
          })
        );
      });
    });

    it('should update preview when boundary name changes', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Boundary Name');
      fireEvent.change(input, { target: { value: 'DMZ' } });

      // Check preview shows new name
      expect(screen.getByText('DMZ')).toBeInTheDocument();
    });

    it('should handle empty boundary name gracefully', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Boundary Name');
      fireEvent.change(input, { target: { value: '' } });

      // Should still show "New Boundary" in preview when empty
      expect(screen.getByText('New Boundary')).toBeInTheDocument();
    });
  });

  describe('Visual style selection', () => {
    it('should update visual style when selection changes', async () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const select = screen.getByLabelText(/Visual Style/i) as HTMLSelectElement;

      // Clear initial calls
      mockSetBoundaryDrawingMode.mockClear();

      // Change the style
      fireEvent.change(select, { target: { value: 'security_zone' } });

      await waitFor(() => {
        expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'security_zone',
          })
        );
      });
    });

    it('should have all visual style options available', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const select = screen.getByLabelText(/Visual Style/i) as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);

      expect(options).toContain('custom');
      expect(options).toContain('ato');
      expect(options).toContain('network_segment');
      expect(options).toContain('security_zone');
      expect(options).toContain('physical_location');
      expect(options).toContain('datacenter');
      expect(options).toContain('cloud_region');
      expect(options).toContain('office');
    });

    it('should update drawing mode with correct color when style changes', async () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const select = screen.getByLabelText(/Visual Style/i);

      mockSetBoundaryDrawingMode.mockClear();

      fireEvent.change(select, { target: { value: 'ato' } });

      await waitFor(() => {
        const lastCall = mockSetBoundaryDrawingMode.mock.calls[
          mockSetBoundaryDrawingMode.mock.calls.length - 1
        ][0];
        expect(lastCall.type).toBe('ato');
        expect(lastCall.color).toBeTruthy();
      });
    });
  });

  describe('Real-time updates', () => {
    it('should update drawing mode in real-time when both name and style change', async () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      mockSetBoundaryDrawingMode.mockClear();

      // Change name
      const input = screen.getByLabelText('Boundary Name');
      fireEvent.change(input, { target: { value: 'Production VPC' } });

      await waitFor(() => {
        expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(
          expect.objectContaining({
            label: 'Production VPC',
          })
        );
      });

      mockSetBoundaryDrawingMode.mockClear();

      // Change style
      const select = screen.getByLabelText(/Visual Style/i);
      fireEvent.change(select, { target: { value: 'cloud_region' } });

      await waitFor(() => {
        expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'cloud_region',
            label: 'Production VPC',
          })
        );
      });
    });
  });

  describe('Close button', () => {
    it('should call onClose when close button is clicked', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close boundary palette');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText('Close boundary palette')).toBeInTheDocument();
      expect(screen.getByLabelText('Boundary Name')).toBeInTheDocument();
    });

    it('should have proper input IDs for label associations', () => {
      render(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      const nameInput = screen.getByLabelText('Boundary Name');
      expect(nameInput).toHaveAttribute('id', 'boundary-name');

      const styleSelect = screen.getByLabelText(/Visual Style/i);
      expect(styleSelect).toHaveAttribute('id', 'visual-style');
    });
  });

  describe('Integration behavior', () => {
    it('should maintain state consistency across re-renders', () => {
      const { rerender } = render(
        <BoundaryPalette isOpen={true} onClose={mockOnClose} />
      );

      const input = screen.getByLabelText('Boundary Name');
      fireEvent.change(input, { target: { value: 'Test Boundary' } });

      expect(input).toHaveValue('Test Boundary');

      // Re-render should maintain state
      rerender(<BoundaryPalette isOpen={true} onClose={mockOnClose} />);

      expect(input).toHaveValue('Test Boundary');
    });

    it('should reset drawing mode to null only when closing', () => {
      const { rerender } = render(
        <BoundaryPalette isOpen={true} onClose={mockOnClose} />
      );

      mockSetBoundaryDrawingMode.mockClear();

      // Change some state while still open - should NOT set to null
      const input = screen.getByLabelText('Boundary Name');
      fireEvent.change(input, { target: { value: 'Another Name' } });

      expect(mockSetBoundaryDrawingMode).not.toHaveBeenCalledWith(null);

      // Close the palette - NOW should set to null
      rerender(<BoundaryPalette isOpen={false} onClose={mockOnClose} />);

      expect(mockSetBoundaryDrawingMode).toHaveBeenCalledWith(null);
    });
  });
});
