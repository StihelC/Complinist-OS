/**
 * Register console IPC handlers
 */
export function registerConsoleHandlers(ipcMain) {
  // Forward console logs from renderer to main process console
  ipcMain.on('console-log', (event, { level, args }) => {
    const message = args.join(' ');
    switch (level) {
      case 'log':
        console.log('[RENDERER]', message);
        break;
      case 'warn':
        console.warn('[RENDERER]', message);
        break;
      case 'error':
        console.error('[RENDERER]', message);
        break;
      case 'info':
        console.info('[RENDERER]', message);
        break;
      default:
        console.log('[RENDERER]', message);
    }
  });
}

