import { dialog } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { validateDirectoryPath, validateDialogPath, PathSecurityError } from '../utils/path-security.js';
import { getMainWindow } from '../modules/window-manager.js';

/**
 * Register Terraform IPC handlers
 */
export function registerTerraformHandlers(ipcMain, mainWindow) {
  /**
   * Select Terraform directory
   */
  ipcMain.handle('terraform:select-directory', async () => {
    // Get the current main window instead of using closure
    const currentMainWindow = getMainWindow();
    try {
      if (!currentMainWindow || currentMainWindow.isDestroyed()) {
        return { success: false, error: 'Main window is not available' };
      }

      const result = await dialog.showOpenDialog(currentMainWindow, {
        title: 'Select Terraform Directory',
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path (basic sanitization)
      let dirPath;
      try {
        dirPath = validateDialogPath(result.filePaths[0]);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[Terraform] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      // Check if .terraform directory exists (indicates terraform init was run)
      const terraformDir = path.join(dirPath, '.terraform');
      const hasTerraformInit = fs.existsSync(terraformDir);

      // Also check for terraform files (.tf, .tfvars)
      const terraformFiles = fs.readdirSync(dirPath).filter(file => 
        file.endsWith('.tf') || file.endsWith('.tfvars') || file === 'terraform.tfstate'
      );
      const hasTerraformFiles = terraformFiles.length > 0;

      return {
        success: true,
        directory: dirPath,
        hasTerraformInit,
        hasTerraformFiles,
      };
    } catch (error) {
      console.error('[Terraform] Error selecting directory:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Run terraform plan in a directory
   */
  ipcMain.handle('terraform:run-plan', async (event, { directory, options = {} }) => {
    return new Promise((resolve) => {
      try {
        // Validate directory path to prevent directory traversal attacks
        let validatedDirectory;
        try {
          validatedDirectory = validateDirectoryPath(directory);
        } catch (securityError) {
          if (securityError instanceof PathSecurityError) {
            console.error('[Terraform] Path security violation:', securityError.message);
            resolve({
              success: false,
              error: `Security error: ${securityError.message}`,
              code: securityError.code
            });
            return;
          }
          throw securityError;
        }

        console.log('[Terraform] Validated directory:', validatedDirectory);

        // Check if terraform is available
        const terraformCmd = process.platform === 'win32' ? 'terraform.exe' : 'terraform';

        const planFile = path.join(validatedDirectory, 'plan.tfplan');
        const args = ['plan', '-out=plan.tfplan', '-no-color'];
        
        // Add any additional options
        if (options.refresh === false) {
          args.push('-refresh=false');
        }
        
        console.log(`[Terraform] Running: ${terraformCmd} ${args.join(' ')} in ${validatedDirectory}`);

        const terraformProcess = spawn(terraformCmd, args, {
          cwd: validatedDirectory,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        terraformProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          // Send progress updates to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terraform:plan-progress', {
              type: 'stdout',
              data: output,
            });
          }
        });

        terraformProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          // Send progress updates to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terraform:plan-progress', {
              type: 'stderr',
              data: output,
            });
          }
        });

        terraformProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error(`[Terraform] Plan exited with code ${code}`);
            console.error(`[Terraform] stderr: ${stderr}`);
            resolve({
              success: false,
              error: stderr || `Terraform plan failed with exit code ${code}`,
              stdout,
              stderr,
            });
            return;
          }

          // Plan succeeded, now convert to JSON
          try {
            const jsonResult = await convertPlanToJSON(validatedDirectory, planFile);
            resolve(jsonResult);
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to convert plan to JSON: ${error.message}`,
              stdout,
              stderr,
            });
          }
        });

        terraformProcess.on('error', (error) => {
          console.error('[Terraform] Failed to start terraform:', error);
          resolve({
            success: false,
            error: `Terraform not found. Please ensure Terraform is installed and in your PATH. ${error.message}`,
          });
        });
      } catch (error) {
        console.error('[Terraform] Error running plan:', error);
        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  });

  /**
   * Select Terraform plan JSON file
   */
  ipcMain.handle('terraform:select-json-file', async () => {
    // Get the current main window instead of using closure
    const currentMainWindow = getMainWindow();
    try {
      if (!currentMainWindow || currentMainWindow.isDestroyed()) {
        return { success: false, error: 'Main window is not available' };
      }

      const result = await dialog.showOpenDialog(currentMainWindow, {
        title: 'Select Terraform Plan JSON File',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path (basic sanitization)
      let filePath;
      try {
        filePath = validateDialogPath(result.filePaths[0]);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[Terraform] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      // Read the file content
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log('[Terraform] JSON file read successfully:', filePath);

        return {
          success: true,
          content: fileContent,
          filePath: filePath
        };
      } catch (readError) {
        console.error('[Terraform] Error reading JSON file:', readError);
        return {
          success: false,
          error: `Failed to read file: ${readError.message}`
        };
      }
    } catch (error) {
      console.error('[Terraform] Error selecting JSON file:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Convert terraform plan file to JSON
   */
  async function convertPlanToJSON(directory, planFile) {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(planFile)) {
          resolve({
            success: false,
            error: 'Plan file not found. terraform plan may have failed.',
          });
          return;
        }

        const terraformCmd = process.platform === 'win32' ? 'terraform.exe' : 'terraform';
        const args = ['show', '-json', planFile];

        console.log(`[Terraform] Converting plan to JSON: ${terraformCmd} ${args.join(' ')}`);

        const terraformProcess = spawn(terraformCmd, args, {
          cwd: directory,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        terraformProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        terraformProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        terraformProcess.on('close', (code) => {
          if (code !== 0) {
            console.error(`[Terraform] Show exited with code ${code}`);
            console.error(`[Terraform] stderr: ${stderr}`);
            resolve({
              success: false,
              error: stderr || `Failed to convert plan to JSON. Exit code: ${code}`,
            });
            return;
          }

          try {
            const planJson = JSON.parse(stdout);
            resolve({
              success: true,
              planJson: stdout, // Return as string for consistency
              planData: planJson,
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse Terraform plan JSON: ${parseError.message}`,
            });
          }
        });

        terraformProcess.on('error', (error) => {
          console.error('[Terraform] Failed to start terraform show:', error);
          resolve({
            success: false,
            error: `Terraform not found: ${error.message}`,
          });
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
        });
      }
    });
  }
}

