import https from 'https';

class DeepInfra {
    constructor(apiToken, config = {}) {
        this.apiToken = apiToken;
        this.config = config;
        this.model = config.model || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
        this.baseUrl = config.baseUrl || 'api.deepinfra.com';
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