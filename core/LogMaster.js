import fs from 'fs';
import path from 'path';
import readline from 'readline'

class LogMaster {
    static logFilePath = path.join(process.cwd(), 'log.json');
    static configFilePath = path.join(process.cwd(), 'logconfig.json');

    static ensureLogFileExists() {
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, '[]', 'utf-8');
        }
    }

    static ensureFilesExist() {
        this.ensureLogFileExists();
        if (fs.existsSync(this.configFilePath)) {
            const config = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
            if (!config || Object.keys(config).length === 0) {
                fs.unlinkSync(this.configFilePath);
            }
        }
    }

    static Log(type, eventContent) {
        this.ensureLogFileExists();

        const timestamp = Date.now();
        const date = new Date(timestamp).toLocaleString('pt-BR', {
            timeZone: 'UTC',
            hour12: false,
        });

        const logEntry = {
            TimeStamp: timestamp,
            Date: date,
            Type: type,
            EventContent: eventContent,
        };

        const logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));
        logs.push(logEntry);

        fs.writeFileSync(this.logFilePath, JSON.stringify(logs, null, 4), 'utf-8');
    }

    static filterLogs({ type, search }) {
        this.ensureLogFileExists();
        const logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));

        return logs.filter(log => {
            const matchesType = !type || log.Type === type;
            const matchesSearch = !search ||
                JSON.stringify(log.EventContent).toLowerCase().includes(search.toLowerCase());
            return matchesType && matchesSearch;
        });
    }

    static simplifyContent(content) {
        if (typeof content === 'object' && content !== null) {
            if (Array.isArray(content)) {
                return '[ARRAY]';
            }
            return Object.keys(content).reduce((acc, key) => {
                acc[key] = typeof content[key] === 'object' ?
                    (Array.isArray(content[key]) ? '[ARRAY]' : '[OBJECT]') : content[key];
                return acc;
            }, {});
        }
        return content;
    }

    static watchLogs() {
        this.ensureLogFileExists();
        console.log('Watching logs...');

        fs.watchFile(this.logFilePath, { interval: 1000 }, () => {
            const logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));
            const latestLog = logs[logs.length - 1];

            if (latestLog) {
                const simplifiedContent = this.simplifyContent(latestLog.EventContent);

                const boxLines = [
                    '┌────────────────────────────────────────────────────────┐',
                    `│ Date: ${latestLog.Date.padEnd(47)} │`,
                    `│ Type: ${latestLog.Type.padEnd(47)} │`,
                    '├────────────────────────────────────────────────────────┤'
                ];

                Object.entries(simplifiedContent).forEach(([key, value]) => {
                    const line = `│ ${key}: ${String(value).slice(0, 40).padEnd(40)} │`;
                    boxLines.push(line);
                });

                boxLines.push('└────────────────────────────────────────────────────────┘');

                console.log(boxLines.join('\n'));
            }
        });
    }

    static startHUD() {
        this.ensureLogFileExists();
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const displayMenu = () => {
            console.clear();
            console.log('LogMaster HUD');
            console.log('1. View logs by type');
            console.log('2. Search logs');
            console.log('3. Exit');

            rl.question('Choose an option: ', choice => {
                switch (choice) {
                    case '1':
                        rl.question('Enter log type: ', type => {
                            const logs = this.filterLogs({ type });
                            console.log(logs);
                            rl.question('Press Enter to return to menu...', () => displayMenu());
                        });
                        break;
                    case '2':
                        rl.question('Enter search term: ', search => {
                            const logs = this.filterLogs({ search });
                            console.log(logs);
                            rl.question('Press Enter to return to menu...', () => displayMenu());
                        });
                        break;
                    case '3':
                        rl.close();
                        break;
                    default:
                        displayMenu();
                }
            });
        };

        displayMenu();
    }

    static updateConfig(key, value) {
        const config = fs.existsSync(this.configFilePath)
            ? JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'))
            : {};

        config[key] = value;

        fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 4), 'utf-8');
    }

    static getConfig(key) {
        if (!fs.existsSync(this.configFilePath)) {
            return undefined;
        }

        const config = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
        return config[key];
    }

    static removeConfig(key) {
        if (fs.existsSync(this.configFilePath)) {
            const config = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
            delete config[key];

            if (Object.keys(config).length === 0) {
                fs.unlinkSync(this.configFilePath);
            } else {
                fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 4), 'utf-8');
            }
        }
    }
}

export default LogMaster;

LogMaster.startHUD()