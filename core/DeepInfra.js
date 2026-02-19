import https from 'https';

const brasilDateTime = () => new Date().toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'});

class ColorText {
    static red(text) {
        return `\x1b[31m${text}\x1b[0m`; // Red text
    }

    static green(text) {
        return `\x1b[38;5;82m${text}\x1b[0m`; // Green text
    }

    static yellow(text) {
        return `\x1b[33m${text}\x1b[0m`; // Yellow text
    }

    static blue(text) {
        return `\x1b[34m${text}\x1b[0m`; // Blue text
    }

    static magenta(text) {
        return `\x1b[35m${text}\x1b[0m`; // Magenta text
    }

    static cyan(text) {
        return `\x1b[36m${text}\x1b[0m`; // Cyan text
    }

    static white(text) {
        return `\x1b[37m${text}\x1b[0m`; // White text
    }

    static orange(text) {
        return `\x1b[38;5;208m${text}\x1b[0m`; // Orange text
    }

    // Additional colors
    static black(text) {
        return `\x1b[30m${text}\x1b[0m`; // Black text
    }

    static brightRed(text) {
        return `\x1b[91m${text}\x1b[0m`; // Bright red text
    }

    static brightGreen(text) {
        return `\x1b[92m${text}\x1b[0m`; // Bright green text
    }

    static brightYellow(text) {
        return `\x1b[93m${text}\x1b[0m`; // Bright yellow text
    }

    static brightBlue(text) {
        return `\x1b[94m${text}\x1b[0m`; // Bright blue text
    }

    static brightMagenta(text) {
        return `\x1b[95m${text}\x1b[0m`; // Bright magenta text
    }

    static brightCyan(text) {
        return `\x1b[96m${text}\x1b[0m`; // Bright cyan text
    }

    static brightWhite(text) {
        return `\x1b[97m${text}\x1b[0m`; // Bright white text
    }

    static gray(text) {
        return `\x1b[90m${text}\x1b[0m`; // Gray text
    }

    static lightGray(text) {
        return `\x1b[37m${text}\x1b[0m`; // Light gray text (same as white)
    }

    static darkGray(text) {
        return `\x1b[90m${text}\x1b[0m`; // Dark gray text (same as gray)
    }

    static custom(text, colorCode) {
        return `\x1b[38;5;${colorCode}m${text}\x1b[0m`; // Custom color text
    }
}

class DeepInfra {
    constructor(apiToken, config = {}) {
        this.apiToken = apiToken;
        this.config = config;
        this.model = config.model || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
        this.baseUrl = config.baseUrl || 'api.deepinfra.com';
        this.Log = config.log || false
    }

    /**
     * Handles fallback streaming when API fails
     * @private
     */
    _handleFallbackStream(config) {
        const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
        const fullText = "Sorry, I'm unable to respond at the moment.";
        
        return new Promise((resolve) => {
            if (config.tokenCallback && config.stream !== false) {
                let i = 0;
                const streamNext = () => {
                    if (i < tokens.length) {
                        config.tokenCallback({ 
                            full_text: fullText.substring(0, fullText.indexOf(tokens[i]) + tokens[i].length),
                            stream: { content: tokens[i] } 
                        });
                        i++;
                        setTimeout(streamNext, 45);
                    } else {
                        resolve({ 
                            full_text: fullText, 
                            metadata: { streamed: true, fallback: true } 
                        });
                    }
                };
                streamNext();
            } else {
                resolve({ 
                    full_text: fullText, 
                    metadata: { fallback: true } 
                });
            }
        });
    }

    _formatMessagesToInput(messages, systemPrompt = null) {
        let formatted = '';
        
        if (systemPrompt) {
            formatted += systemPrompt;
        }
        
        for (const msg of messages) {
            if (msg.role === 'user') {
                formatted += `<｜User｜>${msg.content}<｜Assistant｜>`;
            } else if (msg.role === 'assistant') {
                formatted += `${msg.content}`;
            }
        }
        
        formatted += '</think>';
        return formatted;
    }

    async Generate(prompt = 'Once upon a time', config = {}) {
        const messages = [{ role: 'user', content: prompt }];
        return this.Chat(messages, {
            ...config,
            system_prompt: config.system_prompt || 'You are tasked with continuing the text based on the prompt provided. The AI operates purely on text generation, receiving and expanding upon the given prompt.'
        });
    }

    async Chat(messages = [{ role: 'user', content: 'Who won the world series in 2020?' }], config = {}) {
        config.model = config.model || this.model;
        const input = this._formatMessagesToInput(messages, config.system_prompt);

        return new Promise((resolve) => {
            const data = {
                input: input,
                stream: !!config.tokenCallback,
                ...(config.max_new_tokens !== undefined && { max_new_tokens: config.max_new_tokens }),
                ...(config.temperature !== undefined && { temperature: config.temperature }),
                ...(config.top_p !== undefined && { top_p: config.top_p }),
                ...(config.top_k !== undefined && { top_k: config.top_k }),
                ...(config.min_p !== undefined && { min_p: config.min_p }),
                ...(config.repetition_penalty !== undefined && { repetition_penalty: config.repetition_penalty }),
                ...(config.stop && { stop: config.stop }),
                ...(config.num_responses !== undefined && { num_responses: config.num_responses }),
                ...(config.response_format && { response_format: config.response_format }),
                ...(config.presence_penalty !== undefined && { presence_penalty: config.presence_penalty }),
                ...(config.frequency_penalty !== undefined && { frequency_penalty: config.frequency_penalty }),
                ...(config.user && { user: config.user }),
                ...(config.seed !== undefined && { seed: config.seed })
            };

            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: `/v1/inference/${config.model}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                }
            };

            let fullResponse = '';
            let buffer = '';

            const req = https.request(options, res => {
                // Handle authentication errors (401, 403, etc.)
                if (res.statusCode === 401 || res.statusCode === 403) {
                    this._handleFallbackStream(config).then(resolve);
                    return;
                }

                res.on('data', d => {
                    if (config.tokenCallback) {
                        buffer += d.toString();
                        let newlineIndex = buffer.indexOf('\n');
                        while (newlineIndex !== -1) {
                            let line = buffer.substring(0, newlineIndex);
                            buffer = buffer.substring(newlineIndex + 1);
                            newlineIndex = buffer.indexOf('\n');

                            if (line.startsWith('data: ')) {
                                line = line.replace(/^data: /, '');
                            }

                            if (line.trim() && line !== '[DONE]') {
                                try {
                                    const response = JSON.parse(line);
                                    
                                    if (response.error) {
                                        // Handle error in response
                                        continue;
                                    }
                                    
                                    if (response.token && response.token.text) {
                                        const text = response.token.text;
                                        if (text) {
                                            fullResponse += text;
                                            config.tokenCallback({ 
                                                full_text: fullResponse,
                                                stream: { 
                                                    content: text,
                                                    token: response.token,
                                                    details: response.details,
                                                    num_output_tokens: response.num_output_tokens,
                                                    num_input_tokens: response.num_input_tokens
                                                }
                                            });
                                        }
                                    } else if (response.generated_text) {
                                        fullResponse = response.generated_text;
                                        config.tokenCallback({ 
                                            full_text: fullResponse,
                                            stream: {
                                                content: '',
                                                details: response.details,
                                                num_output_tokens: response.num_output_tokens,
                                                num_input_tokens: response.num_input_tokens
                                            }
                                        });
                                    }
                                } catch (error) {
                                    // Ignore parsing errors for streamed responses
                                }
                            }
                        }
                    } else {
                        fullResponse += d.toString();
                    }
                });

                res.on('end', () => {
                    if (!config.tokenCallback) {
                        try {
                            const parsedResponse = JSON.parse(fullResponse);
                            
                            // Check for error in response
                            if (parsedResponse.error) {
                                this._handleFallbackStream(config).then(resolve);
                            } else if (parsedResponse.results && parsedResponse.results.length > 0) {
                                const fullText = parsedResponse.results[0].generated_text;
                                
                                if(parsedResponse.inference_status && this.Log){
                                    if(parsedResponse.inference_status.cost && parsedResponse.inference_status.tokens_generated && parsedResponse.inference_status.tokens_input){
                                        console.log(`${ColorText.green(`[${brasilDateTime()}] ${this.model}(DeepInfra)`)} |${ColorText.red(` Cost : $${parsedResponse.inference_status.cost.toFixed(8)}`)} | Input Tokens : ${ColorText.yellow(parsedResponse.inference_status.tokens_input)} | Output Tokens : ${ColorText.yellow(parsedResponse.inference_status.tokens_generated)}`)
                                    }
                                }
                                resolve({ 
                                    full_text: fullText,
                                    metadata: {
                                        num_tokens: parsedResponse.num_tokens,
                                        num_input_tokens: parsedResponse.num_input_tokens,
                                        request_id: parsedResponse.request_id,
                                        inference_status: parsedResponse.inference_status
                                    }
                                });
                            } else {
                                this._handleFallbackStream(config).then(resolve);
                            }
                        } catch (error) {
                            this._handleFallbackStream(config).then(resolve);
                        }
                    } else {
                        resolve({ 
                            full_text: fullResponse,
                            metadata: {
                                streamed: true
                            }
                        });
                    }
                });
            });

            req.on('error', error => {
                this._handleFallbackStream(config).then(resolve);
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }
}

export default DeepInfra;