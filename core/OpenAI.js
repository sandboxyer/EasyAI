import https from 'https';

class OpenAI {
    constructor(apiToken, config = {}) {
        this.apiToken = apiToken;
        this.config = config;
        this.model = config.model || undefined;
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
                        resolve({ full_text: fullText, metadata: { streamed: true, fallback: true } });
                    }
                };
                streamNext();
            } else {
                resolve({ full_text: fullText, metadata: { fallback: true } });
            }
        });
    }

    async Generate(prompt = 'Once upon a time', config = {}) {
        config.max_tokens = config.max_tokens || 500;
        config.model = config.model || this.model ? this.model : 'gpt-3.5-turbo-instruct';
        
        if (config.model == 'gpt-3.5-turbo-instruct') {
            return new Promise((resolve) => {
                const data = {
                    model: config.model,
                    prompt: prompt,
                    stream: !!config.tokenCallback,
                    ...(config.max_tokens && { max_tokens: config.max_tokens }),
                    ...(config.stop && { stop: config.stop })
                };

                const options = {
                    hostname: 'api.openai.com',
                    port: 443,
                    path: '/v1/completions',
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

                                line = line.replace(/^data: /, '');

                                if (line.trim() && line !== '[DONE]') {
                                    try {
                                        const response = JSON.parse(line);
                                        if (response.choices && response.choices.length > 0) {
                                            const text = response.choices[0].text || '';
                                            if (text) {
                                                fullResponse += text;
                                                config.tokenCallback({ 
                                                    full_text: fullResponse,
                                                    stream: { content: text }
                                                });
                                            }
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
                                if (parsedResponse.error) {
                                    this._handleFallbackStream(config).then(resolve);
                                } else {
                                    const fullText = parsedResponse.choices.map(choice => choice.text).join('');
                                    resolve({ full_text: fullText });
                                }
                            } catch (error) {
                                this._handleFallbackStream(config).then(resolve);
                            }
                        } else {
                            resolve({ full_text: fullResponse });
                        }
                    });
                });

                req.on('error', error => {
                    this._handleFallbackStream(config).then(resolve);
                });

                req.write(JSON.stringify(data));
                req.end();
            });
        } else {
            let instruction = `You are tasked with continuing the text based on the prompt provided. The AI operates purely on text generation, receiving and expanding upon the given prompt.

Prompt: ${prompt}`;
            return await this.Chat([{ role: 'user', content: instruction }], config);
        }
    }

    async Chat(messages = [{ role: 'user', content: 'Who won the world series in 2020?' }], config = {}) {
        config.max_tokens = config.max_tokens || 500;
        config.model = config.model || this.model ? this.model : 'gpt-3.5-turbo';
        
        return new Promise((resolve) => {
            const data = {
                model: config.model,
                messages: messages,
                stream: !!config.tokenCallback,
                ...(config.max_tokens && { max_tokens: config.max_tokens }),
                ...(config.stop && { stop: config.stop })
            };

            const options = {
                hostname: 'api.openai.com',
                port: 443,
                path: '/v1/chat/completions',
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

                            line = line.replace(/^data: /, '');

                            if (line.trim() && line !== '[DONE]') {
                                try {
                                    const response = JSON.parse(line);
                                    if (response.choices && response.choices.length > 0) {
                                        const text = response.choices[0].delta?.content;
                                        if (text) {
                                            fullResponse += text;
                                            config.tokenCallback({ 
                                                full_text: fullResponse,
                                                stream: { content: text }
                                            });
                                        }
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
                            if (parsedResponse.error) {
                                this._handleFallbackStream(config).then(resolve);
                            } else {
                                const fullText = parsedResponse.choices[0]?.message?.content || '';
                                resolve({ full_text: fullText });
                            }
                        } catch (error) {
                            this._handleFallbackStream(config).then(resolve);
                        }
                    } else {
                        resolve({ full_text: fullResponse });
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

export default OpenAI;