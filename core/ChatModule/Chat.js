// In ChatModule.js or wherever your Chat class is defined
class Chat {
    constructor(name = 'New Chat', config = {}) {
        if (config.id) { this.ID = config.id }
        this.Name = name
        this.Historical = config.historical || []
    }

    NewMessage(sender, content, config = {}) {
        // Ensure content is a clean string, not an object
        const cleanContent = typeof content === 'string' 
            ? content 
            : JSON.stringify(content)  // But better to ensure it's always a string!
        
        const message = {
            role: sender === 'user' ? 'user' : 'assistant',
            content: cleanContent,
            timestamp: Date.now()
        }
        
        if (config.id) message.id = config.id
        if (config.time) message.time = new Date().toLocaleString()
        
        this.Historical.push(message)
    }

    Reset() {
        this.Historical = []
    }
}

export default Chat