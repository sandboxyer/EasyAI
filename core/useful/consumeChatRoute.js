import http from 'http';
import https from 'https';

/**
 * Utility function to consume the /chat route of EasyAI Server
 * @param {Object} params - Function parameters
 * @param {string} params.serverUrl - Server URL or IP address
 * @param {number} params.port - Server port
 * @param {Array} params.messages - Array of chat messages
 * @param {string} params.token - Authentication token (optional)
 * @param {Object} params.config - Configuration object (optional)
 * @param {Function} params.onData - Callback for streaming data (optional)
 * @returns {Promise<Object>} - Promise resolving to the response data
 */

// verificação se é um IP
function isIpAddress(serverUrl) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(serverUrl);
}

function consumeChatRoute({
  serverUrl,
  port,
  messages,
  token = '',
  config = {},
  onData = () => {}
}) {
  return new Promise(async (resolve, reject) => {
    const maxRetryTime = 15000; // 15 seconds total retry time
    const retryDelay = 2000; // 2 seconds between retries
    const startTime = Date.now();
    
    let lastError = null;
    let activeRequest = null; // Track the active request to ensure only one at a time
    
    const cleanup = () => {
      activeRequest = null;
    };
    
    while (Date.now() - startTime < maxRetryTime) {
      try {
        // Ensure only one request is active at a time per function call
        activeRequest = attemptRequest({
          serverUrl,
          port,
          messages,
          token,
          config,
          onData
        });
        
        const result = await activeRequest;
        cleanup();
        resolve(result);
        return;
        
      } catch (error) {
        cleanup();
        lastError = error;
        
        // If it's not a connection error, don't retry
        if (!isConnectionError(error)) {
          resolve({ error: error.message });
          return;
        }
        
        // Wait before retrying (only if we haven't exceeded max time)
        if (Date.now() - startTime < maxRetryTime - retryDelay) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // If we exhausted all retries, return server offline error
    resolve({ error: "server offline" });
  });
}

function isConnectionError(error) {
  return error.code === 'ECONNREFUSED' || 
         error.code === 'ETIMEDOUT' || 
         error.code === 'ENOTFOUND' ||
         error.message.includes('connect') ||
         error.message.includes('connection');
}

function attemptRequest({
  serverUrl,
  port,
  messages,
  token = '',
  config = {},
  onData = () => {}
}) {
  return new Promise((resolve, reject) => {
    let isIp = undefined;

    if (serverUrl != 'localhost') {
      isIp = isIpAddress(serverUrl);
    } else {
      isIp = true;
    }

    const protocol = isIp ? http : https;

    if (isIp && !port) {
      port = 80;
    }

    if (!isIp) {
      port = 443;
    }

    const finalConfig = config;

    const requestData = {
      messages,
      ...(token && { token }),
      config: finalConfig
    };

    const postData = JSON.stringify(requestData);

    const options = {
      hostname: serverUrl,
      port,
      path: '/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000 // 30 second timeout for individual request
    };

    const req = protocol.request(options, (res) => {
      let finalData = '';
      let hasResolved = false;

      res.on('data', (chunk) => {
        const chunkData = chunk.toString();
        try {
          const parsedChunk = JSON.parse(chunkData);
          if (!config.stream || parsedChunk.generation_settings) {
            if (!hasResolved) {
              hasResolved = true;
              resolve(parsedChunk);
            }
          } else {
            onData(parsedChunk);
          }
        } catch (error) {
          finalData += chunkData;
        }
      });

      res.on('end', () => {
        if (!hasResolved) {
          try {
            resolve(JSON.parse(finalData));
          } catch (error) {
            resolve(finalData);
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

export default consumeChatRoute;