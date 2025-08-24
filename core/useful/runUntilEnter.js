import readline from 'readline'

async function runUntilEnter(fn) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    const enterPromise = new Promise((resolve) => {
        const onKeypress = (str, key) => {
            if (key.name === 'return') {
                process.stdin.removeListener('keypress', onKeypress);
                resolve();
            }
            
            if (key.ctrl && key.name === 'c') {
                process.exit();
            }
        };
        process.stdin.on('keypress', onKeypress);
    });

    try {
        await Promise.race([Promise.resolve(fn()), enterPromise]);
    } finally {
        rl.close();
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    }
}

export default runUntilEnter