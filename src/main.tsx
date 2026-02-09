// Import browser API adapter FIRST, before anything else checks for window.electronAPI
import './lib/browser-api-adapter';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.tsx'
import './styles/globals.css'

// Suppress RJSF TextareaWidget defaultProps warning (library issue)
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args.map(arg => String(arg || '')).join(' ');
  if (message.includes('TextareaWidget') && message.includes('defaultProps')) {
    return;
  }
  originalWarn.apply(console, args);
};

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  console.error('[MAIN.TSX] Failed to render app:', error);
  throw error;
}

