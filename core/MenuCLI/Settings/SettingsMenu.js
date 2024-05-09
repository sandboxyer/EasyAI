import MenuCLI from "../MenuCLI.js"
import StartMenu from "../StartMenu.js"

const SettingsMenu = () => ({
    title : `⚙️ Centos Requirements
`,
options : [
    {
    name : 'Start w/CUDA',
    action : () => {
    }
    },
    {
    name : 'OpenAI Token',
    action : () => {
        }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})

export default SettingsMenu