/**
 * Hide UI elements before capture
 * Returns a function to restore them
 */
export function hideUIElements(flowContainer: HTMLElement): () => void {
  const hiddenElements: Array<{ 
    element: HTMLElement; 
    originalDisplay: string; 
    originalVisibility: string;
    originalOpacity: string;
  }> = [];
  
  // Comprehensive list of UI selectors to hide
  const uiSelectors = [
    // All absolute positioned elements (sidebars, panels, buttons)
    '.absolute',
    // React Flow UI controls
    '.react-flow__controls',
    '.react-flow__attribution', 
    '.react-flow__panel',
    '.react-flow__minimap',
    // Header and navigation
    'header',
    'nav',
    '[role="banner"]',
    // Specific panels by position
    '.left-4',
    '.right-4', 
    '.top-4',
    '.bottom-4',
    // z-index elements (buttons, overlays)
    '.z-10',
    '.z-20',
    '.z-30',
    '.z-40',
    '.z-50',
    // Radix UI components
    '[data-radix-popper-content-wrapper]',
    '[data-radix-portal]',
    '[data-radix-popover-content]',
    '[data-state="open"]',
    // Buttons outside nodes
    'button:not(.react-flow__node button):not(.react-flow__edge button)',
    // Any card components (likely UI panels)
    '[class*="card"]',
    // Specific to your app - device palette and properties panels
    '[class*="palette"]',
    '[class*="properties"]',
    '[class*="toolbar"]',
  ];
  
  // Hide elements matching any selector
  uiSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const htmlEl = el as HTMLElement;
        // Skip if it's inside a React Flow node or edge
        if (htmlEl.closest('.react-flow__node') || htmlEl.closest('.react-flow__edge')) {
          return;
        }
        // Skip if it's the flow container itself
        if (htmlEl === flowContainer || htmlEl.contains(flowContainer)) {
          return;
        }
        // Skip if already hidden
        if (hiddenElements.some(h => h.element === htmlEl)) {
          return;
        }
        
        hiddenElements.push({ 
          element: htmlEl, 
          originalDisplay: htmlEl.style.display,
          originalVisibility: htmlEl.style.visibility,
          originalOpacity: htmlEl.style.opacity
        });
        htmlEl.style.display = 'none';
        htmlEl.style.visibility = 'hidden';
        htmlEl.style.opacity = '0';
      });
    } catch (e) {
      console.warn('[PNG Export] Could not hide selector:', selector, e);
    }
  });
  
  // Remove any selection styling from boundaries and nodes
  const selectedElements = flowContainer.querySelectorAll('.selected, [data-selected="true"]');
  const removedSelections: Array<{ element: Element; className: string }> = [];
  selectedElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    removedSelections.push({ element: el, className: htmlEl.className });
    htmlEl.classList.remove('selected');
    htmlEl.removeAttribute('data-selected');
  });
  
  // Return restore function
  return () => {
    hiddenElements.forEach(({ element, originalDisplay, originalVisibility, originalOpacity }) => {
      element.style.display = originalDisplay;
      element.style.visibility = originalVisibility;
      element.style.opacity = originalOpacity;
    });
    removedSelections.forEach(({ element, className }) => {
      (element as HTMLElement).className = className;
    });
  };
}

