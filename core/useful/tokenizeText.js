function tokenizeText(text) {
    if (typeof text !== 'string') {
        throw new TypeError('Input must be a string');
    }
    const regex = /[\w]+|[^\s\w]|[\n]/g;
    return text.match(regex) || [];
}

export default tokenizeText