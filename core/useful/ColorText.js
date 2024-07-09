class ColorText {
    static red(text) {
        return `\x1b[31m${text}\x1b[0m`; // Red text
    }

    static green(text) {
        return `\x1b[38;5;82m${text}\x1b[0m` // Green text
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
}

export default ColorText