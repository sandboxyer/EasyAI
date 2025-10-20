/**
 * Generates a unique random alphanumeric code with configurable parameters and collision avoidance.
 * 
 * @function generateUniqueCode
 * @param {Object} [config={}] - Configuration object for code generation
 * @param {number} [config.length=8] - Length of the generated code (must be at least 1)
 * @param {string[]} [config.existingCodes=[]] - Array of existing code strings to avoid collisions with
 * @param {Object[]} [config.existingObjects=[]] - Array of objects containing code properties to avoid collisions with
 * @param {string} [config.codeProperty=null] - Property name within existingObjects that contains the code value (required when using existingObjects)
 * @param {string} [config.characters='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'] - Character set to use for code generation
 * @returns {string} A unique random alphanumeric code of specified length
 * @throws {Error} When length is less than 1
 * @throws {Error} When existingObjects is provided without codeProperty
 * @throws {Error} When unable to generate unique code after maximum attempts
 * 
 * @example
 * // Basic usage - 8 character code
 * generateUniqueCode();
 * 
 * @example
 * // Custom length with existing string codes
 * generateUniqueCode({
 *   length: 6,
 *   existingCodes: ['ABC123', 'DEF456']
 * });
 * 
 * @example
 * // With array of objects
 * generateUniqueCode({
 *   length: 8,
 *   existingObjects: [{ id: 1, code: 'EXISTING1' }],
 *   codeProperty: 'code'
 * });
 * 
 * @example
 * // Combined existing codes and objects
 * generateUniqueCode({
 *   length: 10,
 *   existingCodes: ['CODE1', 'CODE2'],
 *   existingObjects: [{ id: 1, ref: 'REF123' }],
 *   codeProperty: 'ref'
 * });
 * 
 * @example
 * // Custom character set (numbers only)
 * generateUniqueCode({
 *   characters: '0123456789',
 *   length: 6
 * });
 */
function generateUniqueCode(config = {}) {
    /**
     * @constant {Object} defaultConfig - Default configuration values
     * @property {number} length - Default code length
     * @property {string[]} existingCodes - Default empty array for existing codes
     * @property {Object[]} existingObjects - Default empty array for existing objects
     * @property {string|null} codeProperty - Default null for code property name
     * @property {string} characters - Default alphanumeric character set
     */
    const defaultConfig = {
        length: 8,
        existingCodes: [],
        existingObjects: [],
        codeProperty: null,
        characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    };

    /**
     * @constant {Object} mergedConfig - Configuration merged from user input and defaults
     * @property {number} length - Final code length to use
     * @property {string[]} existingCodes - Final existing codes array to use
     * @property {Object[]} existingObjects - Final existing objects array to use
     * @property {string|null} codeProperty - Final code property name to use
     * @property {string} characters - Final character set to use for generation
     */
    const mergedConfig = { ...defaultConfig, ...config };
    const { 
        length, 
        existingCodes, 
        existingObjects, 
        codeProperty, 
        characters 
    } = mergedConfig;

    /**
     * Validates the configuration parameters to ensure they meet requirements
     * @throws {Error} When validation fails
     */
    function validateConfig() {
        // Validate length parameter
        if (!Number.isInteger(length) || length < 1) {
            throw new Error('Length must be a positive integer of at least 1 character');
        }

        // Validate existingObjects requires codeProperty
        if (existingObjects && existingObjects.length > 0 && !codeProperty) {
            throw new Error('codeProperty is required when using existingObjects to specify which property contains the code value');
        }

        // Validate characters parameter
        if (typeof characters !== 'string' || characters.length === 0) {
            throw new Error('Characters must be a non-empty string');
        }

        // Validate existingCodes is an array if provided
        if (existingCodes && !Array.isArray(existingCodes)) {
            throw new Error('existingCodes must be an array when provided');
        }

        // Validate existingObjects is an array if provided
        if (existingObjects && !Array.isArray(existingObjects)) {
            throw new Error('existingObjects must be an array when provided');
        }
    }

    validateConfig();

    /**
     * @constant {Set} existingCodesSet - Set data structure for O(1) lookup performance
     * Contains all existing codes from both string arrays and object properties
     */
    const existingCodesSet = new Set();
    
    /**
     * Processes existing codes from string array and adds them to the lookup set
     * Only valid string values are added to the set
     */
    if (Array.isArray(existingCodes)) {
        existingCodes.forEach(code => {
            if (typeof code === 'string' && code.length > 0) {
                existingCodesSet.add(code);
            }
        });
    }

    /**
     * Processes existing codes from object array and adds them to the lookup set
     * Only valid objects with the specified codeProperty are processed
     */
    if (Array.isArray(existingObjects) && codeProperty) {
        existingObjects.forEach(obj => {
            if (obj && 
                typeof obj === 'object' && 
                obj[codeProperty] && 
                typeof obj[codeProperty] === 'string' && 
                obj[codeProperty].length > 0) {
                existingCodesSet.add(obj[codeProperty]);
            }
        });
    }

    /**
     * Generates a single random code using the configured character set
     * @returns {string} A randomly generated code of the specified length
     */
    function generateRandomCode() {
        let code = '';
        const charsLength = characters.length;
        
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charsLength);
            code += characters.charAt(randomIndex);
        }
        
        return code;
    }

    /**
     * @constant {number} maxAttempts - Maximum number of generation attempts to prevent infinite loops
     * This provides a safety mechanism in case of extremely high collision probability
     */
    const maxAttempts = 1000;
    let attempts = 0;
    
    /**
     * Generation loop that continues until a unique code is found or maximum attempts reached
     * Uses Set.has() for O(1) performance when checking for code uniqueness
     */
    while (attempts < maxAttempts) {
        const candidateCode = generateRandomCode();
        
        if (!existingCodesSet.has(candidateCode)) {
            return candidateCode;
        }
        
        attempts++;
    }

    /**
     * @throws {Error} When unique code cannot be generated within the maximum attempt limit
     * This typically indicates either extremely high collision probability or insufficient character set
     */
    throw new Error(
        `Failed to generate unique code after ${maxAttempts} attempts. ` +
        `Consider increasing code length, expanding character set, or reducing existing codes.`
    );
}

export default generateUniqueCode