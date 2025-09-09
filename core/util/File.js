import fs from 'fs/promises';
import path from 'path';

/**
 * File - A utility class for file operations with copy and move functionality
 */
class File {
    /**
     * Creates a File instance
     * @param {string} filePath - The path to the file
     */
    constructor(filePath) {
        this.path = filePath;
        this.#validatePath(filePath);
    }

    /**
     * Validates the file path
     * @param {string} filePath - Path to validate
     * @private
     */
    #validatePath(filePath) {
        if (typeof filePath !== 'string' || filePath.trim() === '') {
            throw new Error('File path must be a non-empty string');
        }
    }

    /**
     * Ensures the directory exists, creating it recursively if needed
     * @param {string} directoryPath - Path to the directory
     * @private
     */
    async #ensureDirectoryExists(directoryPath) {
        try {
            await fs.access(directoryPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(directoryPath, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    /**
     * Handles and enhances file operation errors
     * @param {Error} error - Original error
     * @param {string} operation - Operation name
     * @param {string} targetPath - Target file path
     * @private
     */
    #handleError(error, operation, targetPath = '') {
        const errorPath = error.path || this.path;
        
        switch (error.code) {
            case 'ENOENT':
                if (errorPath === this.path) {
                    throw new Error(`Source file not found: ${this.path}`);
                }
                break;
            case 'EISDIR':
                throw new Error(`Cannot copy file to directory without specifying filename. Use: ${targetPath}/${path.basename(this.path)}`);
            case 'EPERM':
            case 'EACCES':
                throw new Error(`Permission denied: ${errorPath}`);
            case 'ENOSPC':
                throw new Error(`No space left on device for: ${targetPath}`);
            case 'EXDEV':
                throw new Error(`Cross-device move not supported: ${this.path} -> ${targetPath}`);
        }

        throw new Error(`Failed to ${operation} ${this.path}${targetPath ? ' to ' + targetPath : ''}: ${error.message}`);
    }

    /**
     * Verifies that a copy operation was successful
     * @param {string} targetPath - Target file path
     * @private
     */
    async #verifyCopySuccess(targetPath) {
        try {
            const [sourceStats, targetStats] = await Promise.all([
                fs.stat(this.path),
                fs.stat(targetPath)
            ]);

            if (sourceStats.size !== targetStats.size) {
                throw new Error(`Copy verification failed: file sizes don't match (source: ${sourceStats.size} bytes, target: ${targetStats.size} bytes)`);
            }
        } catch (error) {
            try {
                await fs.unlink(targetPath);
            } catch (unlinkError) {
                // Ignore unlink errors during cleanup
            }
            throw error;
        }
    }

    /**
     * Safely checks if a path exists and is a file
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>} True if it's a file
     * @private
     */
    async #isValidFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.isFile();
        } catch (error) {
            return false;
        }
    }

    /**
     * Safely checks if a path exists and is a directory
     * @param {string} dirPath - Path to check
     * @returns {Promise<boolean>} True if it's a directory
     * @private
     */
    async #isValidDirectory(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Resolves destination path - if destination is a directory, appends source filename
     * @param {string} destinationPath - Original destination path
     * @returns {Promise<string>} Resolved destination path
     * @private
     */
    async #resolveDestinationPath(destinationPath) {
        // Check if destination exists and is a directory
        const isDirectory = await this.#isValidDirectory(destinationPath);
        
        if (isDirectory) {
            // If destination is a directory, append the source filename
            return path.join(destinationPath, path.basename(this.path));
        }
        
        // Check if destination path ends with a separator (indicating it's meant to be a directory)
        if (destinationPath.endsWith('/') || destinationPath.endsWith('\\')) {
            return path.join(destinationPath, path.basename(this.path));
        }
        
        // Check if parent directory of destination exists
        const parentDir = path.dirname(destinationPath);
        try {
            const parentStats = await fs.stat(parentDir);
            if (parentStats.isDirectory()) {
                return destinationPath;
            }
        } catch (error) {
            // Parent directory doesn't exist, treat as file path
            return destinationPath;
        }
        
        return destinationPath;
    }

    /**
     * Asynchronously copies the file to another path
     * @param {string} destinationPath - Path to copy the file to
     * @param {Object} [options] - Copy options
     * @param {boolean} [options.forceOverwrite=false] - Whether to overwrite existing file
     * @param {boolean} [options.createDirectories=true] - Whether to create missing parent directories
     * @returns {Promise<boolean>} True if file was copied, false if destination exists and not forced
     */
    async copy(destinationPath, options = {}) {
        const {
            forceOverwrite = false,
            createDirectories = true
        } = options;

        try {
            console.log(`Copying: ${this.path} -> ${destinationPath}`);

            // Verify source exists and is a file
            const sourceIsFile = await this.#isValidFile(this.path);
            if (!sourceIsFile) {
                throw new Error(`Source path is not a file or doesn't exist: ${this.path}`);
            }

            // Resolve destination path (handle directory vs file)
            const resolvedDestination = await this.#resolveDestinationPath(destinationPath);
            console.log(`Resolved destination: ${resolvedDestination}`);

            // Check if destination exists and is a file
            const destExists = await this.#isValidFile(resolvedDestination);
            if (destExists && !forceOverwrite) {
                console.log(`Destination exists and forceOverwrite is false: ${resolvedDestination}`);
                return false;
            }

            // If destination exists and we're forcing overwrite, remove it first
            if (destExists && forceOverwrite) {
                try {
                    await fs.unlink(resolvedDestination);
                } catch (unlinkError) {
                    if (unlinkError.code !== 'ENOENT') {
                        throw unlinkError;
                    }
                }
            }

            // Create parent directories if needed
            if (createDirectories) {
                const destDir = path.dirname(resolvedDestination);
                await this.#ensureDirectoryExists(destDir);
            }

            // Perform the copy
            await fs.copyFile(this.path, resolvedDestination);
            
            // Verify copy was successful
            await this.#verifyCopySuccess(resolvedDestination);
            
            console.log(`Copy successful: ${resolvedDestination}`);
            return true;

        } catch (error) {
            console.error(`Copy error: ${error.code} - ${error.message}`);
            this.#handleError(error, 'copy', destinationPath);
        }
    }

    /**
     * Asynchronously moves the file to another path
     * @param {string} destinationPath - Path to move the file to
     * @param {Object} [options] - Move options
     * @param {boolean} [options.forceOverwrite=false] - Whether to overwrite existing file
     * @param {boolean} [options.createDirectories=true] - Whether to create missing parent directories
     * @param {boolean} [options.fallbackToCopy=false] - Whether to fallback to copy+delete if rename fails
     * @returns {Promise<boolean>} True if file was moved, false if destination exists and not forced
     */
    async move(destinationPath, options = {}) {
        const {
            forceOverwrite = false,
            createDirectories = true,
            fallbackToCopy = false
        } = options;

        try {
            console.log(`Moving: ${this.path} -> ${destinationPath}`);

            // Verify source exists and is a file
            const sourceIsFile = await this.#isValidFile(this.path);
            if (!sourceIsFile) {
                throw new Error(`Source path is not a file or doesn't exist: ${this.path}`);
            }

            // Resolve destination path (handle directory vs file)
            const resolvedDestination = await this.#resolveDestinationPath(destinationPath);
            console.log(`Resolved destination: ${resolvedDestination}`);

            // Check if destination exists and is a file
            const destExists = await this.#isValidFile(resolvedDestination);
            if (destExists && !forceOverwrite) {
                console.log(`Destination exists and forceOverwrite is false: ${resolvedDestination}`);
                return false;
            }

            // If destination exists and we're forcing overwrite, remove it first
            if (destExists && forceOverwrite) {
                try {
                    await fs.unlink(resolvedDestination);
                } catch (unlinkError) {
                    if (unlinkError.code !== 'ENOENT') {
                        throw unlinkError;
                    }
                }
            }

            // Create parent directories if needed
            if (createDirectories) {
                const destDir = path.dirname(resolvedDestination);
                await this.#ensureDirectoryExists(destDir);
            }

            // Try fast rename first
            try {
                await fs.rename(this.path, resolvedDestination);
                console.log(`Move successful (rename): ${resolvedDestination}`);
                return true;
            } catch (renameError) {
                // If rename fails and fallback is enabled, use copy+delete
                if (fallbackToCopy && renameError.code === 'EXDEV') {
                    console.log(`Rename failed, falling back to copy+delete: ${renameError.message}`);
                    await this.copy(resolvedDestination, { forceOverwrite: true, createDirectories });
                    await this.delete();
                    console.log(`Move successful (copy+delete): ${resolvedDestination}`);
                    return true;
                }
                throw renameError;
            }

        } catch (error) {
            console.error(`Move error: ${error.code} - ${error.message}`);
            this.#handleError(error, 'move', destinationPath);
        }
    }

    /**
     * Checks if the file exists and is a file
     * @returns {Promise<boolean>} True if file exists and is a file
     */
    async exists() {
        return await this.#isValidFile(this.path);
    }

    /**
     * Gets file information (stats)
     * @returns {Promise<fs.Stats>} File statistics
     */
    async getStats() {
        try {
            const stats = await fs.stat(this.path);
            if (!stats.isFile()) {
                throw new Error(`Path is a directory, not a file: ${this.path}`);
            }
            return stats;
        } catch (error) {
            this.#handleError(error, 'get stats');
        }
    }

    /**
     * Gets file size in bytes
     * @returns {Promise<number>} File size in bytes
     */
    async getSize() {
        const stats = await this.getStats();
        return stats.size;
    }

    /**
     * Gets file extension
     * @returns {string} File extension (including the dot)
     */
    getExtension() {
        return path.extname(this.path);
    }

    /**
     * Gets file name without extension
     * @returns {string} File base name
     */
    getBaseName() {
        return path.basename(this.path, this.getExtension());
    }

    /**
     * Gets directory name
     * @returns {string} Directory path
     */
    getDirectory() {
        return path.dirname(this.path);
    }

    /**
     * Deletes the file
     * @returns {Promise<boolean>} True if file was deleted, false if it didn't exist
     */
    async delete() {
        try {
            await fs.unlink(this.path);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }
}

// Create single instance (singleton pattern)
let fileInstance = null;

function getFileInstance(filePath) {
    if (!fileInstance) {
        fileInstance = new File(filePath);
    } else if (fileInstance.path !== filePath) {
        fileInstance = new File(filePath);
    }
    return fileInstance;
}

export default getFileInstance;