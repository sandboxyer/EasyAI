import https from 'https';

class DeepInfra {
    constructor(apiToken, config = {}) {
        this.apiToken = apiToken;
        this.config = config;
        this.model = config.model || 'Qwen/Qwen3-235B-A22B-Instruct-2507';
        this.baseUrl = config.baseUrl || 'api.deepinfra.com';
    }

    /**
     * Formats messages into the DeepInfra input format
     * @private
     */
    _formatMessagesToInput(messages, systemPrompt = null) {
        let formatted = '';
        
        if (systemPrompt) {
            formatted += systemPrompt;
        }
        
        for (const msg of messages) {
            if (msg.role === 'user') {
                formatted += `<｜User｜>${msg.content}<｜Assistant｜>`;
            } else if (msg.role === 'assistant') {
                formatted += `${msg.content}<｜end▁of▁sentence｜>`;
            }
        }
        
        formatted += '</think>';
        return formatted;
    }

    /**
     * Generates text based on a given prompt using the DeepInfra API.
     * 
     * @param {string} [prompt='Once upon a time'] - The input prompt for text generation.
     * @param {Object} [config={}] - Configuration options for text generation.
     * @param {Function} [config.tokenCallback] - Optional. Callback function to receive streaming tokens.
     *                                          This function is called with an object containing the 
     *                                          'full_text' property and stream data for each chunk.
     * @param {number} [config.max_new_tokens] - Optional. Maximum number of new tokens to generate.
     * @param {number} [config.temperature] - Optional. Temperature for sampling (0-100, default 0.7).
     * @param {number} [config.top_p] - Optional. Top-p sampling parameter (0-1, default 0.9).
     * @param {number} [config.top_k] - Optional. Top-k sampling parameter (0-1000, default 0).
     * @param {number} [config.repetition_penalty] - Optional. Repetition penalty (0.01-5, default 1).
     * @param {string[]} [config.stop] - Optional. Up to 16 strings that will terminate generation.
     * @param {string} [config.system_prompt] - Optional. System prompt to prepend to the conversation.
     * 
     * @returns {Promise<Object>} A promise that resolves to an object containing the 'full_text' of 
     *                            the generated content.
     */
    async Generate(prompt = 'Once upon a time', config = {}) {
        const messages = [{ role: 'user', content: prompt }];
        return this.Chat(messages, {
            ...config,
            system_prompt: config.system_prompt || 'You are tasked with continuing the text based on the prompt provided. The AI operates purely on text generation, receiving and expanding upon the given prompt.'
        });
    }

    /**
     * Generates a chat-based response using the DeepInfra API.
     * 
     * @param {Object[]} [messages=[{role: 'user', content: 'Who won the world series in 2020?'}]] - Array of message objects.
     * @param {Object} [config={}] - Configuration options for chat generation.
     * @param {Function} [config.tokenCallback] - Optional. Callback function to receive streaming tokens.
     * @param {number} [config.max_new_tokens] - Optional. Maximum number of new tokens to generate.
     * @param {number} [config.temperature] - Optional. Temperature for sampling (0-100, default 0.7).
     * @param {number} [config.top_p] - Optional. Top-p sampling parameter (0-1, default 0.9).
     * @param {number} [config.top_k] - Optional. Top-k sampling parameter (0-1000, default 0).
     * @param {number} [config.min_p] - Optional. Minimum probability for token consideration (0-1, default 0).
     * @param {number} [config.repetition_penalty] - Optional. Repetition penalty (0.01-5, default 1).
     * @param {string[]} [config.stop] - Optional. Up to 16 strings that will terminate generation.
     * @param {number} [config.num_responses] - Optional. Number of output sequences to return (1-4).
     * @param {Object} [config.response_format] - Optional. Response format specification.
     * @param {number} [config.presence_penalty] - Optional. Presence penalty (-2 to 2, default 0).
     * @param {number} [config.frequency_penalty] - Optional. Frequency penalty (-2 to 2, default 0).
     * @param {string} [config.user] - Optional. User identifier for monitoring.
     * @param {number} [config.seed] - Optional. Seed for random number generation.
     * @param {string} [config.system_prompt] - Optional. System prompt to prepend to the conversation.
     * 
     * @returns {Promise<Object>} A promise that resolves to an object containing the 'full_text' of 
     *                            the generated content.
     */
    async Chat(messages = [{ role: 'user', content: 'Who won the world series in 2020?' }], config = {}) {
        config.model = config.model || this.model;
        
        // Format the input from messages
        const input = this._formatMessagesToInput(messages, config.system_prompt);

        return new Promise((resolve, reject) => {
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
                res.on('data', d => {
                    if (config.tokenCallback) {
                        // Handle streaming responses
                        buffer += d.toString();
                        let newlineIndex = buffer.indexOf('\n');
                        while (newlineIndex !== -1) {
                            let line = buffer.substring(0, newlineIndex);
                            buffer = buffer.substring(newlineIndex + 1);
                            newlineIndex = buffer.indexOf('\n');

                            if (line.startsWith('data: ')) {
                                line = line.replace(/^data: /, '');
                            }

                            if (line.trim()) {
                                try {
                                    const response = JSON.parse(line);
                                    
                                    // DeepInfra streaming format
                                    if (response.token && response.token.text) {
                                        const text = response.token.text;
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
                                    } else if (response.generated_text) {
                                        // Final message in stream might contain full text
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
                        // Accumulate data for non-streamed responses
                        fullResponse += d.toString();
                    }
                });

                res.on('end', () => {
                    if (!config.tokenCallback) {
                        // Parse and handle non-streamed response
                        try {
                            const parsedResponse = JSON.parse(fullResponse);
                            
                            // DeepInfra response format
                            if (parsedResponse.results && parsedResponse.results.length > 0) {
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
                                reject('Unexpected response format from DeepInfra');
                            }
                        } catch (error) {
                            reject(`Error parsing JSON: ${error.message}`);
                        }
                    } else {
                        // For streaming, fullResponse might contain the accumulated text
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
                reject(error);
            });

            req.write(JSON.stringify(data));
            req.end();
        });
    }
}

export default DeepInfra;