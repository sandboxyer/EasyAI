import EasyAI from '../../EasyAI.js'
import StartMenu from './StartMenu.js'
import SetupMenu from './MenuCLI.js'

const ServerMenu = () => ({
    title : `• EasyAI Server •
`,
options : [
    {
    name : '⚡ Inicio Rápido',
    action : () => {

    }
    },
    {
    name : '✏️ Inicio Personalizado',
    action : () => {

        }
    },
    {
        name : '← Voltar',
        action : () => {
            SetupMenu.displayMenu(StartMenu)
            }
        }
     ]

})

export default ServerMenu