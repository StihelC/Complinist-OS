import { TourStep } from './types';

/**
 * Defines the 3 steps of the guided tour:
 * 1. Create your first topology
 * 2. Select a NIST baseline
 * 3. Try the AI assistant
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CompliNist!',
    description: 'Let us show you around. This quick tour will help you understand the key features and get started with your first compliance project.',
    position: 'center',
  },
  {
    id: 'create-topology',
    title: 'Step 1: Create Your First Topology',
    description: 'Start by creating a project and designing your network topology. Add devices from our library of 600+ Azure service icons, create security boundaries, and map your system architecture.',
    position: 'center',
  },
  {
    id: 'select-baseline',
    title: 'Step 2: Select a NIST Baseline',
    description: 'Choose a NIST 800-53 baseline (LOW, MODERATE, or HIGH) for your project. This determines which security controls apply to your system and helps you track compliance requirements.',
    position: 'center',
  },
  {
    id: 'ai-assistant',
    title: 'Step 3: Try the AI Assistant',
    description: 'Use the built-in AI assistant to query NIST documentation, get control recommendations for your devices, and generate implementation narratives. The AI understands your topology and compliance requirements.',
    position: 'center',
  },
];

export const getTourStepById = (id: string): TourStep | undefined => {
  return TOUR_STEPS.find(step => step.id === id);
};
