import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from './WebSocket.js';

class EasyAI_WebGPT {
    static instance = null;

    constructor(config = {}) {
        if (EasyAI_WebGPT.instance) {
            return EasyAI_WebGPT.instance;
        }
        this.port = config.port || 2000;
        this.processInputFunction = config.inputFunction; // Add a callback function for input processing

        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                const filePath = config.htmlpath || './core/chat.html';
                fs.readFile(filePath, (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error occurred');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            }
        });

        this.server.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
        });

        const wsServer = new WebSocket(this.port + 1); // Initiate WebSocket server
        wsServer.on('message', this.processInputFunction); // Use the processing function when a message is received

        EasyAI_WebGPT.instance = this;
    }
}

export default EasyAI_WebGPT;
