import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

class PM2 {

  static async Check(config = { printExecutionTime: false }) {
    const startTime = Date.now();
    try {
      // Custom installation path
      const customInstallPath = '/usr/local/etc/EasyAI/core/Hot/pm2/bin/pm2';

      // Check if pm2 exists in the custom installation path
      if (fs.existsSync(customInstallPath)) {
        if (config.printExecutionTime) {
          const endTime = Date.now();
          console.log(`Execution time: ${endTime - startTime} ms`);
        }
        return true;
      }

      // Fallback to default global installation path
      let globalNodeModules;
      switch (os.platform()) {
        case 'win32':
          // On Windows, global packages are stored in %AppData%\npm\node_modules
          globalNodeModules = path.join(process.env.APPDATA, 'npm', 'node_modules');
          break;
        default:
          // On Unix-like systems, get the global node_modules path dynamically using npm -g root
          const { stdout } = await execAsync('npm -g root');
          globalNodeModules = stdout.trim();
      }

      const result = fs.existsSync(path.join(globalNodeModules, 'pm2'));
      if (config.printExecutionTime) {
        const endTime = Date.now();
        console.log(`Execution time: ${endTime - startTime} ms`);
      }
      return result;
    } catch (error) {
      if (config.printExecutionTime) {
        const endTime = Date.now();
        console.log(`Execution time: ${endTime - startTime} ms`);
      }
      return false; // Error occurred, likely PM2 is not installed
    }
  }

  static async Install() {
    try {
      console.log('Installing PM2 globally...');
      const { stdout } = await execAsync('npm install -g pm2');
      console.log(stdout);
      console.log('PM2 has been installed successfully.');
    } catch (error) {
      console.error('Failed to install PM2:', error);
    }
  }

  static async Process(name) {
    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return false;
    }
  
    const trimmedName = name.trim();
    
    try {
      // Use pm2 jlist for JSON output which is more reliable
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);
      
      for (let process of processes) {
        const processName = process.name || process.pm2_env?.name;
        
        if (!processName) continue;
        
        // Exact match
        if (processName === trimmedName) {
          return true;
        }
        
        // Handle namespaced processes (app:namespace)
        if (processName.includes(':')) {
          const [baseName] = processName.split(':');
          if (baseName === trimmedName) {
            return true;
          }
        }
      }
      
      return false;
      
    } catch (error) {
      // Fallback to the table format if JSON fails
      try {
        const { stdout } = await execAsync('pm2 list');
        const lines = stdout.split('\n');
        
        for (let line of lines) {
          // Look for lines that contain process entries
          if (line.startsWith('│') && line.includes('│')) {
            const columns = line.split('│').map(col => col.trim()).filter(col => col.length > 0);
            
            if (columns.length >= 2) {
              const processName = columns[1];
              
              if (processName === trimmedName) {
                return true;
              }
              
              // Handle namespaced processes
              if (processName.includes(':')) {
                const [baseName] = processName.split(':');
                if (baseName === trimmedName) {
                  return true;
                }
              }
            }
          }
        }
        
        return false;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  static async Delete(name) {
    try {
      console.log(`Deleting the process ${name}...`);
      const { stdout } = await execAsync(`pm2 delete ${name}`);
      console.log(stdout);
      console.log(`The process ${name} has been deleted successfully.`);
    } catch (error) {
      console.error(`Failed to delete the process ${name}:`, error);
    }
  }

}

export default PM2;
