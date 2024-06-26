import readline from 'readline';

/**
 * TerminalHUD class
 */
class TerminalHUD {
  /**
   * Constructor
   */
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.loading = false;
  }

  /**
   * Start loading animation
   */
  startLoading() {
    this.loading = true;
    let i = 0;
    this.loadingInterval = setInterval(() => {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`⏳ Loading${'.'.repeat(i)}`);
      i = (i + 1) % 4;
    }, 500);
  }

  /**
   * Stop loading animation
   */
  stopLoading() {
    this.loading = false;
    clearInterval(this.loadingInterval);
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
  }

  /**
   * Ask a question to the user
   * @param {string} question - The question to ask
   * @param {object} config - Optional configuration
   * @returns {Promise<string>} - The user's answer
   */
  async ask(question, config = {}) {
    if (config.options) {
      return this.displayMenuFromOptions(question, config.options);
    } else {
      return new Promise(resolve => {
        this.rl.question(`\n${question}`, answer => {
          resolve(answer);
        });
      });
    }
  }

/**
 * Display a menu from options
 * @param {string} question - The question to ask
 * @param {array} options - The options to display
 * @param {object} config - Optional configuration
 * @returns {Promise<string|void>} - The user's choice or void if an action is executed
 */
async displayMenuFromOptions(question, options, config = { clear: false }) {
  if (config.clear == true) {
    console.clear();
  }
  console.log(`\n${question}\n`);
  let optionIndex = 1;
  const optionMap = {};
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (Array.isArray(option)) {
      let line = '';
      for (let subIndex = 0; subIndex < option.length; subIndex++) {
        const subOption = option[subIndex];
        if (typeof subOption === 'string') {
          line += `${optionIndex}. ${subOption} `;
          optionMap[optionIndex] = subOption;
          optionIndex++;
        } else {
          line += `${optionIndex}. ${subOption.name} `;
          optionMap[optionIndex] = subOption;
          optionIndex++;
        }
      }
      console.log(line.trim());
    } else if (typeof option === 'string') {
      console.log(`${optionIndex}. ${option}`);
      optionMap[optionIndex] = option;
      optionIndex++;
    } else {
      console.log(`${optionIndex}. ${option.name}`);
      optionMap[optionIndex] = option;
      optionIndex++;
    }
  }

  const choice = parseInt(await this.ask('Choose an option: '));
  const chosenOption = optionMap[choice];
  if (chosenOption) {
    if (typeof chosenOption === 'string') {
      return chosenOption;
    } else if (chosenOption.action) {
      await chosenOption.action();
    } else {
      return chosenOption.name;
    }
  } else {
    console.log('Invalid option, try again.');
    await this.displayMenuFromOptions(question, options, config);
  }
}

  /**
 * Display a menu
 * @param {function} menuGenerator - A function that generates the menu
 * @param {object} config - Optional configuration
 * @returns {Promise<void>} - The user's choice
 */
async displayMenu(menuGenerator, config = { props: {}, clearScreen: true, alert: undefined, alert_emoji: '⚠️' }) {
  if (config.clearScreen == undefined) {
    config.clearScreen = true;
  }
  if (config.props == undefined) {
    config.props = {};
  }

  if (config.clearScreen == true) {
    console.clear();
  }

  this.startLoading();
  const menu = await menuGenerator(config.props);
  this.stopLoading();

  if (config.alert) {
    console.log(`${config.alert_emoji || '⚠️'}  ${config.alert}\n`);
  }
  console.log(await menu.title);

  let optionIndex = 1;
  const optionMap = {};
  for (let index = 0; index < menu.options.length; index++) {
    const option = menu.options[index];
    if (option.type === 'options') {
      if (Array.isArray(option.value)) {
        let line = '';
        for (let subIndex = 0; subIndex < option.value.length; subIndex++) {
          const subOption = option.value[subIndex];
          line += `${optionIndex}. ${subOption.name} `;
          optionMap[optionIndex] = subOption;
          optionIndex++;
        }
        console.log(line.trim());
      }
    } else if (option.type === 'text') {
      if (option.value) {
        console.log(option.value);
      }
    } else {
      if (option.name) {
        console.log(`${optionIndex}. ${option.name}`);
        optionMap[optionIndex] = option;
        optionIndex++;
      }
    }
  }

  const choice = parseInt(await this.ask('\nChoose an option: '));
  const chosenOption = optionMap[choice];
  if (chosenOption) {
    if (chosenOption.action) {
      await chosenOption.action();
    } else {
      console.log('Invalid option, try again.');
      await this.displayMenu(menuGenerator, config);
    }
  } else {
    console.log('Invalid option, try again.');
    await this.displayMenu(menuGenerator, config);
  }
}

  /**
   * Wait for the user to press a key
   * @returns {Promise<void>} - Resolves when the user presses a key
   */
  pressWait() {
    return new Promise(resolve => {
      console.log('\nPress any key to continue...');
      const onKeyPress = () => {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeyPress);
        resolve();
      };
      process.stdin.setRawMode(true);
      process.stdin.once('data', onKeyPress);
    });
  }

  /**
   * Close the readline interface
   */
  close() {
    this.rl.close();
  }
}

export default TerminalHUD;