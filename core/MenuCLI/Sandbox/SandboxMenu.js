import EasyAI from '../../../EasyAI.js'
import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import TerminalChat from '../../TerminalChat.js'
import ChatPrompt from './ChatPrompt.js'
import readline from 'readline';
import Chat from '../../ChatModule/Chat.js'
import TerminalGenerate from '../../TerminalGenerate.js'
import ColorText from '../../useful/ColorText.js'
import PM2 from '../../useful/PM2.js'
import FreePort from '../../useful/FreePort.js'

let webgpt_processname

process.on('exit',async () => {
    if(webgpt_processname){
        await PM2.Delete(webgpt_processname)
    }
})

const SandboxMenu = async (props) => ({
    title : `☕ Sandbox | ${
        props.openai_token ? `OpenAI ${props.openai_model ? `(${ColorText.cyan(props.openai_model)})` : ''}` : 
        props.deepinfra_token ? `DeepInfra ${props.deepinfra_model ? `(${ColorText.cyan(props.deepinfra_model)})` : ''}` : 
        `${props.server_url}${(props.server_port) ? `:${props.server_port}` : ''}`
    }`,
options : [
    {
    name : ColorText.brightBlue('Generate'),
    action : async () => {
        MenuCLI.close()
        console.clear()
        let ai = new EasyAI(props)
        new TerminalGenerate(async (input,display) => {
           let result = await ai.Generate(input, {
               tokenCallback : async (token) => {
                   await display(token.stream.content)
               },
               ...(props.openai_token ? {openai: true} : {}),
               ...(props.deepinfra_token ? {deepinfra: true} : {})
           })
        },{exitFunction : async () => {
            MenuCLI.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
              });
            await MenuCLI.displayMenu(SandboxMenu,{props : props})
        }})
    }
    },
    {
    name : ColorText.brightBlue('Chat'),
    action : async () => {
        MenuCLI.close()
        console.clear()
        let ai = new EasyAI(props)
        const chat = new Chat()
        new TerminalChat(async (input,displayToken) => {
            chat.NewMessage('User: ',input)
            let historical_prompt = ''
            chat.Historical.forEach(e => {
             historical_prompt = `${historical_prompt}${e.Sender}${e.Content} | `
            })
            
            let result
            
            if(props.openai_token && !props.deepinfra_token) {
                // Use OpenAI chat if only OpenAI is configured
                let messages = []
                chat.Historical.forEach(e => {
                    messages.push({
                        role: e.Sender === 'User: ' ? 'user' : 'assistant',
                        content: e.Content
                    })
                })
                result = await ai.Chat(messages, {
                    tokenCallback: async (token) => {
                        await displayToken(token.stream ? token.stream.content : token)
                    }
                })
            } else {
                // Use Generate with ChatPrompt for DeepInfra or server mode
                result = await ai.Generate(`${ChatPrompt}${historical_prompt}AI:`, {
                    tokenCallback : async (token) => {
                        await displayToken(token.stream.content)
                    },
                    stop : ['|'],
                    ...(props.deepinfra_token ? {deepinfra: true} : {}),
                    ...(props.openai_token ? {openai: true} : {})
                })
            }
            
            if(result && result.full_text) {
                chat.NewMessage('AI: ', result.full_text)
            }
        },{exitFunction : async () => {
            MenuCLI.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
              });
            await MenuCLI.displayMenu(SandboxMenu,{props : props})
        }})
        }
    },
    {
    name : ColorText.blue('Coder'),
    action : async () => {
        await MenuCLI.displayMenu(SandboxMenu,{props : props})
        }
    },
    {
    name : ColorText.blue('AgentFlow'),
    action : async () => {
        await MenuCLI.displayMenu(SandboxMenu,{props : props})
          }
    },
    {
        name : `${ColorText.brightBlue('WebGPT Server')} | ${(await PM2.Process(webgpt_processname)) ? ColorText.green('ON') : ColorText.red('OFF')}`,
        action : async () => {

            if(await PM2.Process(webgpt_processname)){
                await PM2.Delete(webgpt_processname)
                webgpt_processname = undefined
                MenuCLI.displayMenu(SandboxMenu,{props : props,alert_emoji : '✔️',alert : 'WebGPT PM2 Server finalizado'})
            } else {
                let port = await FreePort(3000)
                webgpt_processname = await EasyAI.WebGPT.PM2({
                    port : port,
                    easyai_url : props.server_url,
                    easyai_port : props.server_port,
                    openai_token : props.openai_token,
                    openai_model : props.openai_model,
                    deepinfra_token : props.deepinfra_token,
                    deepinfra_model : props.deepinfra_model
                })
                MenuCLI.displayMenu(SandboxMenu,{props : props,alert_emoji : '✔️',alert : 'WebGPT PM2 Server iniciado com sucesso !'})
            }
        }
    },
    {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})

export default SandboxMenu