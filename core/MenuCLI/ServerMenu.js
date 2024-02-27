import EasyAI from '../../EasyAI.js'
import StartMenu from './StartMenu.js'
import MenuCLI from './MenuCLI.js'
import ServerSaves from './ServerSaves.js'

let easyai_config = {}
let easyai_port = 4000

const CustomServer = () => ({
    title : `• EasyAI Server | Configurar Server
`,
options : [
    {
    name : '⚡ Iniciar Servidor ⚡',
    action : () => {
        let server = new EasyAI.Server({port : easyai_port,EasyAI_Config : easyai_config})
        server.start()
    }
    },
    {
        name : `EasyAI PORT | ${easyai_port}`,
        action : async () => {
            let newport = await MenuCLI.ask('Digite a nova PORTA : ')
            easyai_port = newport
            MenuCLI.displayMenu(CustomServer)    
        }
        },
        {
            name : `LlamaCPP PORT | ${easyai_config.llama ? (easyai_config.llama.server_port ? easyai_config.llama.server_port : '8080') : '8080'}`,
            action : async () => {
                let newport = await MenuCLI.ask('Digite a nova PORTA : ')
                if(easyai_config.llama){
                    easyai_config.llama.server_port = newport
                } else {
                    easyai_config.llama = {}
                    easyai_config.llama.server_port = newport
                }
                MenuCLI.displayMenu(CustomServer) 
            }
            },
            {
                name : `Threads | ${easyai_config.llama ? (easyai_config.llama.threads ? easyai_config.llama.threads : 'MAX') : 'MAX'}`,
                action : async () => {
                    let newthreads = await MenuCLI.ask('Qntd. Threads : ')
                    if(easyai_config.llama){
                        easyai_config.llama.threads = Number(newthreads)
                    } else {
                        easyai_config.llama = {}
                        easyai_config.llama.threads = Number(newthreads)
                    }
                    MenuCLI.displayMenu(CustomServer) 
                }
                },
    {
    name : `CUDA | ${easyai_config.llama ? (easyai_config.llama.cuda ? 'ON' : 'OFF') : 'OFF'}`,
    action : () => {
                if(easyai_config.llama){
                    if(easyai_config.llama.cuda){
                        easyai_config.llama.cuda = false
                    } else {
                        easyai_config.llama.cuda = true
                    }
                } else {
                    easyai_config.llama = {}
                    easyai_config.llama.cuda = true
                }
                MenuCLI.displayMenu(CustomServer)
            }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(ServerMenu)
            }
        }
     ]

})

const ServerMenu = () => ({
    title : `• EasyAI Server •
`,
options : [
    {
    name : '⚡ Inicio Rápido',
    action : () => {
        let server = new EasyAI.Server()
        server.start()
    }
    },
    {
    name : '✏️ Inicio Personalizado',
    action : () => {
        easyai_config = {}
        easyai_port = 4000
        MenuCLI.displayMenu(CustomServer)
        }
    },
    {
        name : '📁 Saves',
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

export default ServerMenu