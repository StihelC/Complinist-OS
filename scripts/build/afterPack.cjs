// afterPack hook to configure Linux sandbox workaround
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName === 'linux') {
    // Remove chrome-sandbox (not needed with --no-sandbox)
    const chromeSandboxPath = path.join(appOutDir, 'chrome-sandbox');
    if (fs.existsSync(chromeSandboxPath)) {
      console.log('[afterPack] Removing chrome-sandbox (using --no-sandbox instead)...');
      fs.unlinkSync(chromeSandboxPath);
      console.log('[afterPack] chrome-sandbox removed successfully');
    }

    // Create wrapper script to handle --no-sandbox for Ubuntu 23.10+ compatibility
    const binaryName = 'compliflow-desktop';
    const binaryPath = path.join(appOutDir, binaryName);
    const realBinaryPath = path.join(appOutDir, `${binaryName}.bin`);

    if (fs.existsSync(binaryPath)) {
      // Rename original binary
      fs.renameSync(binaryPath, realBinaryPath);
      console.log('[afterPack] Renamed binary to .bin');

      // Create wrapper script
      const wrapperScript = `#!/bin/bash
# CompliFlow wrapper - adds --no-sandbox for Linux compatibility
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
exec "$SCRIPT_DIR/${binaryName}.bin" --no-sandbox "$@"
`;
      fs.writeFileSync(binaryPath, wrapperScript, { mode: 0o755 });
      console.log('[afterPack] Created wrapper script with --no-sandbox');
    }
  }
};

