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
            console.log(`WebSocket server listening on port ${port}`);
        });

        this.callbacks = { message: [] };
    }

    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    trigger(event, ...args) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(...args));
        }
    }

    handleUpgrade(req, socket, head) {
        const key = req.headers['sec-websocket-key'];
        const acceptValue = this.generateAcceptValue(key);
        const headers = [
            'HTTP/1.1 101 Web Socket Protocol Handshake',
            'Upgrade: WebSocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${acceptValue}`,
            '\r\n'
        ];
        socket.write(headers.join('\r\n'));
        this.setupConnection(socket);
    }

    generateAcceptValue(key) {
        return crypto.createHash('sha1')
                     .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
                     .digest('base64');
    }

    setupConnection(socket) {
        socket.on('data', buffer => {
            this.handleFrame(socket, buffer);
        });
        this.connections.push(socket);
        socket.on('close', () => {
            this.connections = this.connections.filter(conn => conn !== socket);
        });
    }

    handleFrame(socket, buffer) {
        // Handling frame parsing manually for simple text frames
        const isFinalFrame = buffer[0] & 0x80;
        const isTextFrame = buffer[0] & 0x1;
        const payloadLength = buffer[1] & 0x7F;
        const mask = buffer.slice(2, 6);
        const payload = buffer.slice(6, 6 + payloadLength);

        let unmaskedPayload = Buffer.alloc(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
            unmaskedPayload[i] = payload[i] ^ mask[i % 4];
        }

        if (isTextFrame) {
            const message = unmaskedPayload.toString('utf8');
            this.trigger('message', socket, message);
        }
    }

    send(socket, message) {
        const buffer = Buffer.from(message, 'utf8');
        const length = buffer.length;
        const frame = Buffer.alloc(length + 2);
        frame[0] = 0x81; // FIN bit true, opcode 0x1 for text
        frame[1] = length; // Assuming no masking from server to client and length < 126
        buffer.copy(frame, 2);
        socket.write(frame);
    }
}

export default WebSocket;
