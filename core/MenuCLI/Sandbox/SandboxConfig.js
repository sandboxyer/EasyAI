import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import SandboxMenu from './SandboxMenu.js'

let instance_config = {server_url : 'localhost'}

const SandboxConfig = () => ({
    title : `• Sandbox Config •

URL : ${instance_config.server_url}${(instance_config.server_port) ? `:${instance_config.server_port}` : ''}
`,
options : [
    {
        name : '✅ Conectar',
        action : () => {
            MenuCLI.displayMenu(SandboxMenu,{props : instance_config})
        }
        },
    {
    name : `Alterar URL`,
    action : async () => {
        let newurl = await MenuCLI.ask('Novo URL : ')
        instance_config.server_url = newurl
        MenuCLI.displayMenu(SandboxConfig)
    }
    },
    {
    name : 'Configurar Porta',
    action : async () => {
        let newport = await MenuCLI.ask('Nova Porta : ')
        instance_config.server_port = newport
        MenuCLI.displayMenu(SandboxConfig)
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



export default SandboxConfig