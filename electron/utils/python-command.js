/**
 * Platform-aware Python command resolution utility.
 *
 * On Windows, Python is typically available as `python` or `py` (the
 * Python Launcher), not `python3`. On Linux/macOS, `python3` is standard.
 * This utility tries candidates in platform-appropriate order and caches
 * the first one that works.
 */

import { execSync } from 'child_process';

let cachedPythonCommand = null;

/**
 * Get the Python command candidates in platform-appropriate order.
 * @returns {string[]} Ordered list of command candidates
 */
function getCandidates() {
  if (process.platform === 'win32') {
    return ['python', 'py', 'python3'];
  }
  return ['python3', 'python'];
}

/**
 * Detect and return the correct Python command for this platform.
 * Caches the result after first successful detection.
 *
 * @returns {string|null} The working Python command, or null if none found
 */
export function getPythonCommand() {
  if (cachedPythonCommand) {
    return cachedPythonCommand;
  }

  const candidates = getCandidates();

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore', timeout: 5000 });
      cachedPythonCommand = cmd;
      console.log(`[Python] Detected Python command: ${cmd}`);
      return cmd;
    } catch {
      // Try next candidate
    }
  }

  console.warn('[Python] No Python command found on this system');
  return null;
}

/**
 * Clear the cached Python command (useful for testing).
 */
export function clearPythonCache() {
  cachedPythonCommand = null;
}

export default { getPythonCommand, clearPythonCache };
