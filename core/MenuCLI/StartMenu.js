import ServerMenu from "./ServerMenu.js";
import SetupMenu from "./MenuCLI.js";

const StartMenu = () => ({
    title : `⚙️ EasyAI
`,
options : [
    {
    name : 'EasyAI Server',
    action : () => {
        SetupMenu.displayMenu(ServerMenu)
    }
    },
    {
    name : 'Sandbox',
    action : () => {

        }
    }
     ]

})

export default StartMenu