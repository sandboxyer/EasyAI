import ServerMenu from "./ServerMenu.js";
import SetupMenu from "./MenuCLI.js";
import SandboxInit from "./Sandbox/SandboxInit.js";

const StartMenu = () => ({
    title : `⚙️ EasyAI
`,
options : [
    {
    name : '◆ EasyAI Server',
    action : () => {
        SetupMenu.displayMenu(ServerMenu)
    }
    },
    {
    name : '☕ Sandbox',
    action : () => {
        SetupMenu.displayMenu(SandboxInit)
        }
    }
     ]

})

export default StartMenu