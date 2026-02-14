import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import net from 'net';
import ConfigManager from '../ConfigManager.js';

class SyLOG {
    // File paths for different log types
    static logsDir = path.join(process.cwd(), 'logs');
    static historicalLogPath = path.join(this.logsDir, 'historical.log.json');
    static statusLogPath = path.join(this.logsDir, 'status.json');
    static tempLogPath = path.join(this.logsDir, 'temp.json');
    
    // Socket and HUD configuration
    static socketPath = process.platform === 'win32' ? '\\\\.\\pipe\\sylog' : '/tmp/sylog.sock';
    
    // Event emitter for real-time updates
    static eventEmitter = new EventEmitter();
    
    // Watch mode state
    static isWatching = false;
    static activeTypeFilter = null;
    static socket = null;
    
    // Status log cache for high-frequency updates
    static statusCache = new Map(); // type -> { entry, lastUpdate, updateCount }
    
    // Configuration
    static config = {
        maxStatusCacheSize: 1000,
        statusFlushInterval: 5000, // ms
        historicalLogRotation: 50 * 1024 * 1024, // 50MB
        maxConcurrentWrites: 10
    };
    
    // Write queue for managing concurrent operations
    static writeQueue = [];
    static isWriting = false;
    
    /**
     * Initialize SyLOG - creates necessary directories and starts maintenance tasks
     */
    static initialize() {
        // Ensure logs directory exists
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        // Ensure log files exist
        [this.historicalLogPath, this.statusLogPath].forEach(filePath => {
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, '[]', 'utf-8');
            }
        });
        
        // Start periodic status flush
        setInterval(() => this.flushStatusCache(), this.config.statusFlushInterval);
        
        // Handle process exit
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => {
            this.cleanup();
            process.exit();
        });
        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit();
        });
    }
    
    /**
     * Creates a log entry with enhanced status mode handling
     * @param {string} type - The type/category of the log
     * @param {*} eventContent - The content of the log event
     * @param {Object} [config] - Configuration options
     * @param {boolean} [config.statusMode=false] - If true, uses high-frequency status system
     * @param {boolean} [config.persistentStatus=false] - If true, status is saved to disk immediately
     * @param {number} [config.statusTTL] - Time-to-live for status in ms (auto-expires)
     */
    static Log(type, eventContent, config = {}) {
        const timestamp = Date.now();
        const date = new Date(timestamp).toLocaleString('pt-BR', {
            timeZone: 'UTC',
            hour12: false,
        });
    
        const logEntry = {
            id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            TimeStamp: timestamp,
            Date: date,
            Type: type,
            EventContent: eventContent,
            metadata: {
                statusMode: config.statusMode || false,
                persistent: config.persistentStatus || false
            }
        };
    
        // Always emit to socket for HUD
        this.emitToSocket(logEntry);
        
        // Check if logging is enabled
        const shouldLog = ConfigManager.getKey('log');
        if (!shouldLog) return;
    
        // Handle based on mode
        if (config.statusMode) {
            this.handleStatusLog(logEntry, config);
        } else {
            this.handleHistoricalLog(logEntry);
        }
    }
    
    /**
     * Handle status logs with caching for high-frequency updates
     */
    static handleStatusLog(logEntry, config) {
        const type = logEntry.Type;
        
        // Update cache
        const cached = this.statusCache.get(type) || {
            entry: null,
            lastUpdate: 0,
            updateCount: 0,
            history: []
        };
        
        cached.entry = logEntry;
        cached.lastUpdate = Date.now();
        cached.updateCount++;
        
        // Keep a small history for status changes (last 10 updates)
        cached.history.push({
            timestamp: logEntry.TimeStamp,
            content: logEntry.EventContent
        });
        
        if (cached.history.length > 10) {
            cached.history.shift();
        }
        
        this.statusCache.set(type, cached);
        
        // Emit event for real-time listeners
        this.eventEmitter.emit('status-update', {
            type,
            entry: logEntry,
            updateCount: cached.updateCount
        });
        
        // If persistent or cache is getting large, flush immediately
        if (config.persistentStatus || this.statusCache.size > this.config.maxStatusCacheSize) {
            this.flushStatusCache();
        }
    }
    
    /**
     * Handle historical logs with batching
     */
    static handleHistoricalLog(logEntry) {
        this.queueWrite('historical', logEntry);
    }
    
    /**
     * Queue write operations to prevent file system congestion
     */
    static queueWrite(type, data) {
        this.writeQueue.push({ type, data, timestamp: Date.now() });
        
        if (!this.isWriting) {
            this.processWriteQueue();
        }
    }
    
    /**
     * Process the write queue with concurrency control
     */
    static async processWriteQueue() {
        if (this.writeQueue.length === 0) {
            this.isWriting = false;
            return;
        }
        
        this.isWriting = true;
        
        // Group writes by type for efficiency
        const batches = {
            historical: [],
            status: []
        };
        
        // Take up to maxConcurrentWrites items from queue
        const batch = this.writeQueue.splice(0, this.config.maxConcurrentWrites);
        
        batch.forEach(item => {
            if (item.type === 'historical') {
                batches.historical.push(item.data);
            } else {
                batches.status.push(item.data);
            }
        });
        
        // Process batches
        const promises = [];
        
        if (batches.historical.length > 0) {
            promises.push(this.appendToHistoricalLog(batches.historical));
        }
        
        if (batches.status.length > 0) {
            promises.push(this.appendToStatusLog(batches.status));
        }
        
        await Promise.all(promises);
        
        // Continue processing queue
        setImmediate(() => this.processWriteQueue());
    }
    
    /**
     * Append multiple entries to historical log efficiently
     */
    static async appendToHistoricalLog(entries) {
        return new Promise((resolve, reject) => {
            try {
                let logs = [];
                if (fs.existsSync(this.historicalLogPath)) {
                    const content = fs.readFileSync(this.historicalLogPath, 'utf-8');
                    logs = content ? JSON.parse(content) : [];
                }
                
                logs.push(...entries);
                
                // Check if rotation is needed
                const contentSize = Buffer.byteLength(JSON.stringify(logs));
                if (contentSize > this.config.historicalLogRotation) {
                    this.rotateHistoricalLog(logs);
                } else {
                    fs.writeFileSync(this.historicalLogPath, JSON.stringify(logs, null, 2), 'utf-8');
                }
                
                resolve();
            } catch (error) {
                console.error('Error writing to historical log:', error);
                reject(error);
            }
        });
    }
    
    /**
     * Append to status log (for persistent status tracking)
     */
    static async appendToStatusLog(entries) {
        return new Promise((resolve, reject) => {
            try {
                let statusLogs = [];
                if (fs.existsSync(this.statusLogPath)) {
                    const content = fs.readFileSync(this.statusLogPath, 'utf-8');
                    statusLogs = content ? JSON.parse(content) : [];
                }
                
                // For status logs, we maintain a time-series of significant changes
                statusLogs.push(...entries);
                
                // Keep only last 1000 status changes to prevent unlimited growth
                if (statusLogs.length > 1000) {
                    statusLogs = statusLogs.slice(-1000);
                }
                
                fs.writeFileSync(this.statusLogPath, JSON.stringify(statusLogs, null, 2), 'utf-8');
                resolve();
            } catch (error) {
                console.error('Error writing to status log:', error);
                reject(error);
            }
        });
    }
    
    /**
     * Flush status cache to disk
     */
    static flushStatusCache() {
        if (this.statusCache.size === 0) return;
        
        const statusEntries = Array.from(this.statusCache.values())
            .map(cached => ({
                ...cached.entry,
                metadata: {
                    ...cached.entry.metadata,
                    updateCount: cached.updateCount,
                    lastUpdate: cached.lastUpdate
                }
            }));
        
        try {
            fs.writeFileSync(
                path.join(this.logsDir, 'status.current.json'),
                JSON.stringify(statusEntries, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Error flushing status cache:', error);
        }
    }
    
    /**
     * Rotate historical log when it gets too large
     */
    static rotateHistoricalLog(currentLogs) {
        const timestamp = Date.now();
        const archivePath = path.join(this.logsDir, `historical-${timestamp}.log.json`);
        
        // Archive current logs
        fs.renameSync(this.historicalLogPath, archivePath);
        
        // Start new log file with most recent entries (keep last 1000)
        const recentLogs = currentLogs.slice(-1000);
        fs.writeFileSync(this.historicalLogPath, JSON.stringify(recentLogs, null, 2), 'utf-8');
        
        console.log(`Historical log rotated: ${archivePath}`);
    }
    
    /**
     * Emit log entry to socket for HUD
     */
    static emitToSocket(logEntry) {
        if (!this.socket) return;
        
        const client = net.createConnection(this.socketPath, () => {
            client.write(JSON.stringify(logEntry));
            client.end();
        });
        
        client.on('error', () => {});
    }
    
    /**
     * Get logs with enhanced filtering options
     */
    static getLogs(options = {}) {
        const {
            type,
            search,
            limit,
            reverse = false,
            offset = 0,
            startDate,
            endDate,
            includeHistorical = true,
            includeStatus = true,
            statusOnly = false,
            historicalOnly = false
        } = options;
        
        let allLogs = [];
        
        // Get historical logs
        if (includeHistorical && !statusOnly) {
            try {
                if (fs.existsSync(this.historicalLogPath)) {
                    const historical = JSON.parse(fs.readFileSync(this.historicalLogPath, 'utf-8'));
                    allLogs.push(...historical);
                }
            } catch (error) {
                console.error('Error reading historical logs:', error);
            }
        }
        
        // Get status logs
        if (includeStatus && !historicalOnly) {
            try {
                // Get from cache first (current status)
                const cachedStatus = Array.from(this.statusCache.values())
                    .map(cached => cached.entry);
                allLogs.push(...cachedStatus);
                
                // Optionally include historical status changes
                if (options.includeStatusHistory && fs.existsSync(this.statusLogPath)) {
                    const statusHistory = JSON.parse(fs.readFileSync(this.statusLogPath, 'utf-8'));
                    allLogs.push(...statusHistory);
                }
            } catch (error) {
                console.error('Error reading status logs:', error);
            }
        }
        
        // Apply filters
        let filteredLogs = this.applyFilters(allLogs, { type, search, startDate, endDate });
        
        // Sort by timestamp
        filteredLogs.sort((a, b) => a.TimeStamp - b.TimeStamp);
        
        if (reverse) {
            filteredLogs.reverse();
        }
        
        return filteredLogs.slice(offset, offset + (limit || filteredLogs.length));
    }
    
    /**
     * Get current status for a specific type
     */
    static getStatus(type) {
        const cached = this.statusCache.get(type);
        return cached ? cached.entry : null;
    }
    
    /**
     * Get status history for a specific type
     */
    static getStatusHistory(type) {
        const cached = this.statusCache.get(type);
        return cached ? cached.history : [];
    }
    
    /**
     * Get all current statuses
     */
    static getAllStatuses() {
        return Array.from(this.statusCache.values()).map(cached => cached.entry);
    }
    
    /**
     * Clear a specific status
     */
    static clearStatus(type) {
        this.statusCache.delete(type);
        this.flushStatusCache();
    }
    
    /**
     * Clear all statuses
     */
    static clearAllStatuses() {
        this.statusCache.clear();
        this.flushStatusCache();
    }
    
    /**
     * Apply filters to logs
     */
    static applyFilters(logs, { type, search, startDate, endDate }) {
        return logs.filter(log => {
            let match = true;
            
            if (type) {
                match = match && log.Type === type;
            }
            
            if (search) {
                const searchTerm = search.toLowerCase();
                match = match && JSON.stringify(log).toLowerCase().includes(searchTerm);
            }
            
            if (startDate) {
                match = match && log.TimeStamp >= startDate.getTime();
            }
            
            if (endDate) {
                match = match && log.TimeStamp <= endDate.getTime();
            }
            
            return match;
        });
    }
    
    /**
     * Clean up resources
     */
    static cleanup() {
        this.flushStatusCache();
        
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
    }
    
    // ============= HUD and CLI Methods =============
    
    static startHUD() {
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
        
        const server = net.createServer((socket) => {
            this.socket = socket;
            socket.on('data', (data) => {
                const logEntry = JSON.parse(data.toString());
                if (this.isWatching) {
                    if (!this.activeTypeFilter || logEntry.Type === this.activeTypeFilter) {
                        this.displayLog(logEntry);
                    }
                }
            });
        });
        
        server.listen(this.socketPath, () => {
            console.log('SyLOG HUD started. Listening for logs...');
            this.displayHUDMenu();
        });
        
        server.on('error', (err) => {
            console.error('Failed to start HUD:', err);
        });
    }
    
    static enterWatchMode() {
        console.clear();
        console.log('Entering Watch Mode. Press "q" to return to menu.');
        
        this.isWatching = true;
        const handleKeyPress = (chunk) => {
            if (chunk.toString().trim() === 'q') {
                process.stdin.removeListener('data', handleKeyPress);
                this.isWatching = false;
                if (this.socket) {
                    this.socket.removeAllListeners('data');
                }
                this.displayHUDMenu();
            }
        };
        
        process.stdin.on('data', handleKeyPress);
    }
    
    static displayHUDMenu() {
        console.clear();
        console.log('╔════════════════════════════════════════════╗');
        console.log('║            SyLOG HUD Menu                  ║');
        console.log('╠════════════════════════════════════════════╣');
        console.log('║ 1. View all log types                      ║');
        console.log('║ 2. Search logs by term                     ║');
        console.log('║ 3. Set real-time filter by type            ║');
        console.log('║ 4. Clear real-time filter                  ║');
        console.log('║ 5. Enter Watch Mode                        ║');
        console.log('║ 6. Advanced log filtering                  ║');
        console.log('║ 7. View current statuses                   ║');
        console.log('║ 8. View status history                     ║');
        console.log('║ 9. Exit HUD                                ║');
        console.log('╚════════════════════════════════════════════╝');
        
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', (input) => this.handleMenuChoice(input.toString().trim()));
    }
    
    static handleMenuChoice(choice) {
        switch (choice) {
            case '1':
                this.displayLogTypes();
                break;
            case '2':
                this.promptSearchTerm();
                break;
            case '3':
                this.promptSetFilter();
                break;
            case '4':
                this.clearFilter();
                break;
            case '5':
                this.enterWatchMode();
                break;
            case '6':
                this.promptAdvancedFilters();
                break;
            case '7':
                this.displayCurrentStatuses();
                break;
            case '8':
                this.promptStatusHistory();
                break;
            case '9':
                process.exit();
                break;
            default:
                console.log('Invalid choice. Please select a valid option.');
                this.displayHUDMenu();
        }
    }
    
    static displayLogTypes() {
        const historicalLogs = this.getLogs({ includeStatus: false });
        const statusLogs = this.getAllStatuses();
        
        const types = new Set();
        historicalLogs.forEach(log => types.add(log.Type));
        statusLogs.forEach(log => types.add(log.Type));
        
        console.log('Available Log Types:');
        Array.from(types).forEach((type, index) => {
            const hasStatus = this.statusCache.has(type);
            console.log(`${index + 1}. ${type} ${hasStatus ? '(active status)' : ''}`);
        });
        
        console.log('Select a type by number to view logs or press Enter to return.');
        
        process.stdin.once('data', (input) => {
            const choice = parseInt(input.toString().trim(), 10);
            if (choice >= 1 && choice <= types.size) {
                const selectedType = Array.from(types)[choice - 1];
                const logs = this.getLogs({ type: selectedType });
                console.log(`\nLogs for type "${selectedType}":`);
                console.log(JSON.stringify(logs, null, 2));
            }
            
            console.log('\nPress any key to return to menu.');
            process.stdin.once('data', () => this.displayHUDMenu());
        });
    }
    
    static promptSearchTerm() {
        console.log('Enter a search term:');
        process.stdin.once('data', (input) => {
            const searchTerm = input.toString().trim();
            const logs = this.getLogs({ search: searchTerm });
            console.log(`\nFound ${logs.length} logs containing "${searchTerm}":`);
            console.log(JSON.stringify(logs, null, 2));
            
            console.log('\nPress any key to return to menu.');
            process.stdin.once('data', () => this.displayHUDMenu());
        });
    }
    
    static promptAdvancedFilters() {
        console.log('Advanced Filtering - Enter options as JSON:');
        console.log('Example: {"type": "error", "limit": 10, "reverse": true, "includeStatusHistory": true}');
        
        process.stdin.once('data', (input) => {
            try {
                const options = input.toString().trim() ? JSON.parse(input.toString().trim()) : {};
                const logs = this.getLogs(options);
                console.log(`\nFound ${logs.length} logs:`);
                console.log(JSON.stringify(logs, null, 2));
            } catch (error) {
                console.log('Invalid JSON format.');
            }
            
            console.log('\nPress any key to return to menu.');
            process.stdin.once('data', () => this.displayHUDMenu());
        });
    }
    
    static displayCurrentStatuses() {
        const statuses = this.getAllStatuses();
        
        if (statuses.length === 0) {
            console.log('No active statuses found.');
        } else {
            console.log('\nCurrent Statuses:');
            statuses.forEach(status => {
                console.log(`\nType: ${status.Type}`);
                console.log(`Last Update: ${status.Date}`);
                console.log(`Content: ${JSON.stringify(status.EventContent, null, 2)}`);
                console.log(`Update Count: ${this.statusCache.get(status.Type)?.updateCount || 1}`);
            });
        }
        
        console.log('\nPress any key to return to menu.');
        process.stdin.once('data', () => this.displayHUDMenu());
    }
    
    static promptStatusHistory() {
        console.log('Enter status type to view history:');
        
        process.stdin.once('data', (input) => {
            const type = input.toString().trim();
            const history = this.getStatusHistory(type);
            
            if (history.length === 0) {
                console.log(`No history found for type: ${type}`);
            } else {
                console.log(`\nStatus History for "${type}":`);
                history.forEach((entry, index) => {
                    console.log(`\n${index + 1}. ${new Date(entry.timestamp).toLocaleString()}`);
                    console.log(`   ${JSON.stringify(entry.content)}`);
                });
            }
            
            console.log('\nPress any key to return to menu.');
            process.stdin.once('data', () => this.displayHUDMenu());
        });
    }
    
    static promptSetFilter() {
        console.log('Enter type to filter by:');
        process.stdin.once('data', (input) => {
            this.activeTypeFilter = input.toString().trim();
            console.log(`Filter set to: ${this.activeTypeFilter}`);
            setTimeout(() => this.displayHUDMenu(), 1500);
        });
    }
    
    static clearFilter() {
        this.activeTypeFilter = null;
        console.log('Filter cleared.');
        setTimeout(() => this.displayHUDMenu(), 1500);
    }
    
    static displayLog(logEntry) {
        const boxLines = [
            '┌─────────────────────────────────────────────────────────────────┐',
            `│ [${logEntry.Date}] ${logEntry.Type.padEnd(52)} │`,
            '├─────────────────────────────────────────────────────────────────┤',
        ];
        
        const content = typeof logEntry.EventContent === 'object' 
            ? JSON.stringify(logEntry.EventContent, null, 2)
            : String(logEntry.EventContent);
        
        content.split('\n').forEach(line => {
            const truncated = line.slice(0, 63).padEnd(63);
            boxLines.push(`│ ${truncated} │`);
        });
        
        if (logEntry.metadata?.statusMode) {
            boxLines.push('├─────────────────────────────────────────────────────────────────┤');
            boxLines.push(`│ Status Mode | Updates: ${this.statusCache.get(logEntry.Type)?.updateCount || 1} │`);
        }
        
        boxLines.push('└─────────────────────────────────────────────────────────────────┘');
        console.log(boxLines.join('\n'));
    }
    
    // CLI Methods
    static async runCLI() {
        this.initialize();
        
        if (process.argv.length > 2) {
            const command = process.argv[2];
            
            switch (command) {
                case 'view':
                    await this.handleViewCommand();
                    break;
                case 'hud':
                    this.startHUD();
                    break;
                case 'status':
                    await this.handleStatusCommand();
                    break;
                case 'statuses':
                    this.displayCurrentStatuses();
                    break;
                case 'clear-status':
                    await this.handleClearStatus();
                    break;
                case 'help':
                default:
                    this.displayHelp();
            }
        } else {
            this.displayHelp();
        }
    }
    
    static async handleViewCommand() {
        const options = {};
        
        for (let i = 3; i < process.argv.length; i++) {
            const arg = process.argv[i];
            
            if (arg === '--type' && process.argv[i + 1]) {
                options.type = process.argv[++i];
            } else if (arg === '--search' && process.argv[i + 1]) {
                options.search = process.argv[++i];
            } else if (arg === '--limit' && process.argv[i + 1]) {
                options.limit = parseInt(process.argv[++i]);
            } else if (arg === '--reverse') {
                options.reverse = true;
            } else if (arg === '--status-only') {
                options.statusOnly = true;
            } else if (arg === '--historical-only') {
                options.historicalOnly = true;
            }
        }
        
        const logs = this.getLogs(options);
        console.log(JSON.stringify(logs, null, 2));
    }
    
    static async handleStatusCommand() {
        const type = process.argv[3];
        
        if (type) {
            const status = this.getStatus(type);
            if (status) {
                console.log(JSON.stringify(status, null, 2));
            } else {
                console.log(`No active status for type: ${type}`);
            }
        } else {
            this.displayCurrentStatuses();
        }
    }
    
    static async handleClearStatus() {
        const type = process.argv[3];
        
        if (type) {
            this.clearStatus(type);
            console.log(`Cleared status for type: ${type}`);
        } else {
            this.clearAllStatuses();
            console.log('Cleared all statuses');
        }
    }
    
    static displayHelp() {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     SyLOG - Systematic Logging              ║
╚══════════════════════════════════════════════════════════════╝

Commands:
  view [options]        - View logs with filters
  hud                   - Start the HUD interface
  status [type]         - View current status(es)
  statuses              - List all active statuses
  clear-status [type]   - Clear status(es)
  help                  - Show this help

View Options:
  --type <type>         - Filter by log type
  --search <term>       - Search in logs
  --limit <number>      - Limit results
  --reverse             - Newest first
  --status-only         - Only show status logs
  --historical-only     - Only show historical logs

Status Mode (in code):
  // High-frequency status updates
  SyLOG.Log('cpu', { usage: 45 }, { statusMode: true });
  
  // Persistent status with history
  SyLOG.Log('system', { state: 'running' }, { 
    statusMode: true, 
    persistentStatus: true 
  });
  
  // Regular logs
  SyLOG.Log('error', 'User not found');

Features:
  ✓ Separate handling for status and historical logs
  ✓ Status cache for high-frequency updates
  ✓ Status history tracking
  ✓ Automatic log rotation
  ✓ Concurrent write queue
  ✓ Real-time HUD with filtering
  ✓ Status persistence
        `);
    }
}

// Initialize on load
SyLOG.initialize();

// Export for use
export default SyLOG;