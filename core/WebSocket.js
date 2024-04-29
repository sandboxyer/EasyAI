import http from 'http';
import crypto from 'crypto';

class WebSocket {
    constructor(port) {
        this.connections = [];
        this.server = http.createServer((req, res) => {
            res.writeHead(404);
            res.end();
        });

        this.server.on('upgrade', (req, socket, head) => {
            this.handleUpgrade(req, socket, head);
        });

        this.server.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });

        this.callbacks = { message: [] };
    }

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    trigger(event, ...args) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(...args));
        }
    }

    handleUpgrade(req, socket, head) {
        // existing code for handling WebSocket upgrade
    }

    handleMessage(socket, data) {
        const message = this.parseMessage(data);
        if (message) {
            this.trigger('message', socket, message); // Trigger message event with the parsed message
        } else {
            console.log('Invalid message');
        }
    }

    // existing code for sendMessage, generateAcceptValue, setupConnection, and parseMessage
}

export default WebSocket;
