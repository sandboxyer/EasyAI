import http from 'http';
import fs from 'fs';
import WebSocket from './WebSocket.js';
import EasyAI from '../EasyAI.js'
import ChatPrompt from './MenuCLI/Sandbox/ChatPrompt.js';
import Chat from './ChatModule/Chat.js';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { writeFileSync, existsSync } from 'fs';
import PM2 from './useful/PM2.js'

function execAsync(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

/**
 * Constructs an instance of EasyAI_WebGPT, ensuring singleton pattern if an instance already exists.
 * 
 * @param {Object} config - Configuration options for the EasyAI_WebGPT instance.
 * @param {number} [config.port=3000] - The port number on which the HTTP server will listen.
 * @param {string} [config.openai_token] - OpenAI Token
 * @param {string} [config.openai_model] - OpenAI Model
 * @param {string} [config.easyai_url='localhost'] - The URL of the EasyAI server.
 * @param {number} [config.easyai_port] - The port number on which the EasyAI server is running.
 *   If not specified, defaults to 4000 if easyai_url is 'localhost', otherwise undefined.
 * @param {string} [config.htmlpath='./core/chat.html'] - Path to the HTML file to serve when accessing the root URL.
 */

class EasyAI_WebGPT {
    static instance = null;

    constructor(config = {}) {
        if (EasyAI_WebGPT.instance) {
            return EasyAI_WebGPT.instance;
        }

        this.Chat = new Chat()

        console.log(config)

        this.port = config.port || 3000;
        this.easyai_url = config.easyai_url || ((config.openai_token) ? undefined : 'localhost')
        this.easyai_port = config.easyai_port || 4000// || (this.easyai_url == 'localhost') ? 4000 : undefined
        this.AI = new EasyAI({server_url : this.easyai_url,server_port : this.easyai_port,openai_token : config.openai_token,openai_model : config.openai_model})
        this.processInputFunction = async (input,displayToken) => {
            this.Chat.NewMessage('User: ',input)
            let historical_prompt = ''
            this.Chat.Historical.forEach(e => {
             historical_prompt = `${historical_prompt}${e.Sender}${e.Content} | `
            })
            let result = await this.AI.Generate(`${ChatPrompt}${historical_prompt}AI:`,{tokenCallback : async (token) => {await displayToken(token.stream.content)},stop : ['|']})
            this.Chat.NewMessage('AI: ',result.full_text)
        }

        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                let filePath = config.htmlpath || './core/chat.html';
        
                if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
                    const currentModuleUrl = import.meta.url;
                    const currentModulePath = fileURLToPath(currentModuleUrl);
                    const currentModuleDir = path.dirname(currentModulePath);
                    filePath = path.join(currentModuleDir, 'chat.html');
                }
        
                fs.readFile(filePath, 'utf8', (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Server Error: Could not read file');
                        return;
                    }
        
                    // Replace the placeholder with the actual WebSocket port
                    const wsPort = Number(this.port)+Number(1); // Your dynamic WebSocket port
                    const modifiedContent = content.replace('{{WS_PORT}}',wsPort);
        
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(modifiedContent, 'utf-8');
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        const wsPort = Number(this.port)+Number(1); // Your dynamic WebSocket port
        const wsServer = new WebSocket(wsPort);
        wsServer.on('message', async (socket, message) => {
            if(message == '/reset'){
                this.Chat.Reset()
                console.log('Chat reseted')
            } else {
                await this.processInputFunction(message, (response) => {
                    wsServer.send(socket, JSON.stringify({type: 'token', token: response}));
                });
                wsServer.send(socket, JSON.stringify({ type: "end-of-response" }));
            }
        });

        this.server.on('upgrade', (req, socket, head) => {
            wsServer.handleUpgrade(req, socket, head);
        });

        this.server.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
            console.log(`WebSocket server is running on ws://localhost:${wsPort}`);
            console.log(`EasyAI Instance : ${this.easyai_url}:${this.easyai_port}`)
        });

        EasyAI_WebGPT.instance = this;
    }

    static async PM2(config) {
      async function findEasyAIServerPath() {
          let filePath = './EasyAI.js';
          if (!existsSync(path.resolve(process.cwd(), filePath))) {
              const currentModuleUrl = import.meta.url;
              const currentModulePath = fileURLToPath(currentModuleUrl);
              const currentModuleDir = path.dirname(currentModulePath);
              const parentDir = path.dirname(currentModuleDir);
              filePath = path.join(parentDir, 'EasyAI.js');
          }
          return pathToFileURL(filePath).href;
      }
  
      const timestamp = Date.now();
      const randomSuffix = Math.floor(100 + Math.random() * 900); // 3-digit random number
      const uniqueFileName = `pm2_webgpt_${timestamp}_${randomSuffix}.mjs`;
      const serverScriptPath = path.join('/tmp', uniqueFileName);
  
      const easyAIServerPath = await findEasyAIServerPath();
  
      const fileContent = `import EasyAI from '${easyAIServerPath}';
  const config = ${JSON.stringify(config)};
  const server = new EasyAI.WebGPT(config);`;
  
      writeFileSync(serverScriptPath, fileContent);
  
      if (!(await PM2.Check())) {
          await PM2.Install();
      }
  
      try {
          await execAsync(`pm2 start ${serverScriptPath}`);
          console.log("PM2 process successfully managed.");
          return true;
      } catch (error) {
          console.error(`PM2 process management error: ${error.message}`);
          return false;
      }
  }
  

}

export default EasyAI_WebGPT;