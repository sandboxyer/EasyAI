#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Configuration
const repoDir = process.cwd();
const folderName = path.basename(repoDir);
const installDir = path.join('/usr/local/etc', folderName); // Installation folder named after the current directory
const binDir = '/usr/local/bin';

// Commands to create symbolic links
const commands = [
  { src: 'core/Flash/WebGPTFlash.js', dest: 'webgpt' },
  { src: 'core/Flash/GenerateFlash.js', dest: 'generate' },
  { src: 'core/Flash/ChatFlash.js', dest: 'chat' },
  { src: 'core/MenuCLI/MenuCLI.js', dest: 'ai' },
];

// Function to prompt the user for input
const promptUser = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.toLowerCase());
    })
  );
};

// Function to copy files
const copyFiles = (srcDir, destDir) => {
  const gitignorePath = path.join(srcDir, '.gitignore');
  let ignorePatterns = [];

  if (fs.existsSync(gitignorePath)) {
    ignorePatterns = fs.readFileSync(gitignorePath, 'utf-8').split('\n').filter(Boolean);
  }

  const copyFile = (src, dest) => {
    if (fs.lstatSync(src).isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
      }
      fs.readdirSync(src).forEach((file) => {
        copyFile(path.join(src, file), path.join(dest, file));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };

  fs.readdirSync(srcDir).forEach((file) => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    if (!ignorePatterns.some((pattern) => srcPath.includes(pattern))) {
      copyFile(srcPath, destPath);
    }
  });
};

// Function to remove symbolic links
const removeLinks = () => {
  commands.forEach(({ dest }) => {
    const destPath = path.join(binDir, dest);
    if (fs.existsSync(destPath)) {
      console.log(`Removing symbolic link: ${destPath}`);
      fs.unlinkSync(destPath);
    } else {
      console.log(`Symbolic link not found: ${destPath}`);
    }
  });
};

// Main setup logic
(async () => {
  try {
    if (fs.existsSync(installDir)) {
      console.log(`The folder '${folderName}' already exists. Choose an option:`);
      console.log('1. Update (replace existing files)');
      console.log('2. Remove (delete the existing folder and symbolic links)');
      console.log('3. Exit (cancel setup)');

      const choice = await promptUser('Enter your choice (1/2/3): ');
      switch (choice) {
        case '1':
          console.log('Updating the existing installation...');
          removeLinks();
          execSync(`rm -rf ${installDir}`);
          break;
        case '2':
          console.log('Removing the existing folder and symbolic links...');
          removeLinks();
          execSync(`rm -rf ${installDir}`);
          console.log('Folder and symbolic links removed. Setup cancelled.');
          process.exit(0);
          break;
        case '3':
          console.log('Setup cancelled.');
          process.exit(0);
          break;
        default:
          console.log('Invalid choice. Setup cancelled.');
          process.exit(1);
      }
    }

    // Create the installation directory
    console.log('Creating installation directory...');
    fs.mkdirSync(installDir, { recursive: true });

    // Copy files to the installation directory
    console.log('Copying files...');
    copyFiles(repoDir, installDir);

    // Create symbolic links and make scripts executable
    commands.forEach(({ src, dest }) => {
      const srcPath = path.join(installDir, src);
      const destPath = path.join(binDir, dest);

      console.log(`Creating symbolic link for ${dest}...`);
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      fs.symlinkSync(srcPath, destPath);

      console.log(`Making ${src} executable...`);
      fs.chmodSync(srcPath, '755');
    });

    console.log('Setup complete. You can now use the commands globally.');
  } catch (error) {
    console.error('Error during setup:', error);
  }
})();
