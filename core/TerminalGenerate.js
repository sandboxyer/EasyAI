import process from 'process';

class TerminalGenerate {
  constructor(generateFunction, config = {}) {
    this.generateFunction = generateFunction;
    this.config = config;
    this.inputBuffer = '';
    this.currentColorIndex = 0;
    this.colors = [
      '\x1b[31m', // Red
      '\x1b[34m'  // Blue
    ];

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    this.initGenerate();
  }

  initGenerate() {
    process.stdout.write('Prompt: ');

    process.stdin.on('data', (key) => {
      if (key === '\u000D') { // Enter key
        this.processInput(this.inputBuffer);
        this.inputBuffer = '';
      } else if (key === '\u0003') { // Ctrl+C to exit
        this.exit();
      } else if (key === '\u007F') { // Handle backspace (delete character to the left)
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        // Reprint the current input line
        process.stdout.clearLine(); // Clear the current line
        process.stdout.cursorTo(0); // Move cursor to the beginning of the line
        process.stdout.write('Prompt: ' + this.inputBuffer);
      } else {
        this.inputBuffer += key;
        process.stdout.write(key);
      }
    });
  }

  async processInput(input) {
    await this.generateFunction(input, this.displayToken.bind(this));
    process.stdout.write('\x1b[0m\nPrompt: '); // Reset color and prepare for new input
  }

  async displayToken(token, changeColor = false) {
    if (changeColor) {
      this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
    }
    const color = this.colors[this.currentColorIndex];
    process.stdout.write(color + token + '\x1b[0m');
  }

  exit() {
    process.stdout.write('\x1b[0m\n'); // Reset color before exiting
  
    // Clean-up: Ensure no more input is processed by this instance
    process.stdin.removeAllListeners('data'); // Remove data listeners
    process.stdin.setRawMode(false);
    process.stdin.pause(); // Optionally pause stdin to halt input temporarily
  
    if (typeof this.config.exitFunction === 'function') {
      // Asynchronously transition to readline or other input handling
      process.nextTick(() => {
        this.config.exitFunction();
      });
    } else {
      console.log('Generate ended.');
      process.exit();
    }
  }
  
}

export default TerminalGenerate;
