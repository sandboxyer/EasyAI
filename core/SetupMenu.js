import TerminalHUD from "./core/TerminalHUD.js";

const SetupMenu = new TerminalHUD()

const StartMenu = () => ({
        title : `⚙️ EasyAI Setup

Deseja iniciar no modo Nativo ou se conectar a uma API?
`,
    options : [
        {
        name : 'Nativo',
        action : () => {

        }
        },
        {
        name : 'API',
        action : () => {

            }
        }
         ]

})


SetupMenu.displayMenu(StartMenu,true)