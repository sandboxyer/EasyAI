import fs from 'fs';
import path from 'path';

/**
 * A powerful utility class for searching and discovering GGUF model files across the filesystem.
 * Provides configurable search options including fast mode, duplicate filtering, and size-based ordering.
 * 
 * @class
 * @classdesc Search for GGUF model files with advanced configuration options
 * 
 * @example
 * // Basic usage
 * const models = ModelSearch.GGUF();
 * 
 * @example
 * // Advanced configuration
 * const models = ModelSearch.GGUF({
 *   log: true,
 *   unique: false,
 *   orderBySize: 'asc',
 *   fastMode: true,
 *   startPath: '/home/user/models',
 *   excludePaths: ['/home/user/temp', '/mnt/external-drive/cache']
 * });
 */
class ModelSearch {
    /**
     * Default configuration settings for the GGUF search operation
     * @static
     * @type {Object}
     * @property {boolean} log=false - Enable/disable console logging of search results and performance metrics
     * @property {boolean} unique=true - Return only unique model names (filter duplicates)
     * @property {string} orderBySize='desc' - Sort results by file size ('desc' for descending, 'asc' for ascending)
     * @property {boolean} fastMode=false - Enable fast mode to skip common user directories for improved performance
     * @property {string|null} startPath=null - Custom starting directory path for the search (null uses system root)
     * @property {Array<string>} excludePaths=[] - Array of absolute paths to exclude from search (entire directory trees will be skipped)
     */
    static config = {
        log: false,
        unique: true,
        orderBySize: 'desc', // 'desc' or 'asc'
        fastMode: false,
        startPath: null,
        excludePaths: []
    };

    /**
     * Searches the filesystem for GGUF model files with configurable options
     * @static
     * @async
     * 
     * @param {Object} [userConfig={}] - User configuration to override default settings
     * @param {boolean} [userConfig.log=false] - Enable/disable console logging
     * @param {boolean} [userConfig.unique=true] - Filter duplicate model names
     * @param {string} [userConfig.orderBySize='desc'] - Sort order for results ('desc' or 'asc')
     * @param {boolean} [userConfig.fastMode=false] - Enable fast mode to skip user directories
     * @param {string|null} [userConfig.startPath=null] - Custom starting directory path
     * @param {Array<string>} [userConfig.excludePaths=[]] - Array of absolute paths to exclude from search
     * 
     * @returns {Array<Object>} Array of found GGUF model objects with metadata
     * @returns {string} return.model - The model name (without .gguf extension)
     * @returns {string} return.path - Full filesystem path to the model file
     * @returns {number} return.size - File size in gigabytes (GB) with 2 decimal precision
     * 
     * @throws {Error} May throw errors for filesystem access issues (handled internally)
     * 
     * @example
     * // Find all unique GGUF models, sorted by size descending
     * const results = ModelSearch.GGUF();
     * results.forEach(model => {
     *   console.log(`${model.model}: ${model.size}GB at ${model.path}`);
     * });
     * 
     * @example
     * // Search from specific directory with logging enabled and excluded paths
     * const results = ModelSearch.GGUF({
     *   startPath: '/home/user/llama-models',
     *   log: true,
     *   fastMode: true,
     *   excludePaths: ['/home/user/backups', '/mnt/external-drive/cache']
     * });
     */
    static GGUF(userConfig = {}) {
        // Merge user config with defaults
        const config = { ...this.config, ...userConfig };
        
        const startTime = Date.now();
        const results = [];
        const foundModels = new Set();

        // Common directories to skip for performance
        const defaultSkipDirs = new Set([
            'node_modules', '.git', '.vscode', '.idea', 'temp', 'tmp',
            'cache', 'logs', 'build', 'dist', 'out', 'bin', 'obj',
            'vendor', 'packages', 'Library', 'System', 'Applications',
            'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData'
        ]);

        // Additional directories to skip in fast mode
        const fastModeSkipDirs = new Set([
            'Downloads', 'Documents', 'Pictures', 'Music', 'Movies',
            'Videos', 'Desktop', 'Public', 'Dropbox', 'Google Drive',
            'OneDrive', 'iCloud', 'Backups', 'Time Machine.backup',
            '.Trash', 'Recycle Bin', '$Recycle.Bin', 'AppData',
            'Local Settings', 'Application Data'
        ]);

        // Normalize exclude paths for consistent comparison
        const normalizedExcludePaths = config.excludePaths.map(p => path.resolve(p));

        function shouldSkipDirectory(dirName, fullPath) {
            // Check if the current directory is in the exclude list
            const normalizedCurrentPath = path.resolve(fullPath);
            if (normalizedExcludePaths.some(excludePath => 
                normalizedCurrentPath.startsWith(excludePath + path.sep) || 
                normalizedCurrentPath === excludePath)) {
                return true;
            }
            
            if (defaultSkipDirs.has(dirName)) return true;
            if (config.fastMode && fastModeSkipDirs.has(dirName)) return true;
            
            // Skip hidden directories (except those starting with .config or similar)
            if (dirName.startsWith('.') && !['.config', '.local', '.cache'].includes(dirName)) {
                return true;
            }
            
            return false;
        }

        function searchDirectory(currentPath) {
            try {
                const items = fs.readdirSync(currentPath, { withFileTypes: true });
                
                for (const item of items) {
                    const fullPath = path.join(currentPath, item.name);
                    
                    if (item.isDirectory()) {
                        // Skip directories based on configuration
                        if (shouldSkipDirectory(item.name, fullPath)) {
                            continue;
                        }
                        
                        // Recursively search the directory
                        searchDirectory(fullPath);
                    } else if (item.isFile() && item.name.endsWith('.gguf')) {
                        const modelName = item.name.replace('.gguf', '');
                        
                        // Skip duplicates if unique is true
                        if (config.unique && foundModels.has(modelName)) {
                            continue;
                        }
                        
                        try {
                            const stats = fs.statSync(fullPath);
                            const sizeInGB = parseFloat((stats.size / (1024 * 1024 * 1024)).toFixed(2));
                            
                            results.push({
                                model: modelName,
                                path: fullPath,
                                size: sizeInGB
                            });
                            
                            foundModels.add(modelName);
                        } catch (error) {
                            // Skip files that can't be accessed
                            continue;
                        }
                    }
                }
            } catch (error) {
                // Skip directories that can't be accessed
                return;
            }
        }

        // Determine starting directory
        let startDir;
        if (config.startPath && fs.existsSync(config.startPath)) {
            startDir = path.resolve(config.startPath);
        } else {
            startDir = process.platform === 'win32' ? 'C:\\' : '/';
        }

        // Check if start directory itself is excluded
        const normalizedStartDir = path.resolve(startDir);
        if (normalizedExcludePaths.some(excludePath => 
            normalizedStartDir.startsWith(excludePath + path.sep) || 
            normalizedStartDir === excludePath)) {
            if (config.log) {
                console.log(`Start path "${startDir}" is excluded from search.`);
            }
            return [];
        }

        // Start search
        searchDirectory(startDir);

        // Sort results by size
        if (config.orderBySize === 'desc') {
            results.sort((a, b) => b.size - a.size);
        } else if (config.orderBySize === 'asc') {
            results.sort((a, b) => a.size - b.size);
        }

        if (config.log) {
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            console.log(`ModelSearch completed in ${executionTime}ms. Found ${results.length} models.`);
            console.log(`Search started from: ${startDir}`);
            console.log(`Fast mode: ${config.fastMode ? 'enabled' : 'disabled'}`);
            if (config.excludePaths.length > 0) {
                console.log(`Excluded paths: ${config.excludePaths.join(', ')}`);
            }
        }

        return results;
    }
}

export default ModelSearch