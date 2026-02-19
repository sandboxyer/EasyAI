#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import Chat from "../ChatModule/Chat.js"
import TerminalChat from "../TerminalChat.js"
import PM2 from "../useful/PM2.js"
import ServerSaves from "../MenuCLI/ServerSaves.js"
import ConfigManager from "../ConfigManager.js"
import ColorText from '../useful/ColorText.js'
import TerminalHUD from "../TerminalHUD.js"
import ModelsList from '../MenuCLI/ModelsList.js'
import FreePort from "../useful/FreePort.js"
import readline from 'readline';

let ai
let process_name
let port

process.on('exit',async () => {
    if(process_name){
        await PM2.Delete(process_name)
    }
})

const StartChat = (ai, process_name) => {
    const chat = new Chat()
    console.clear()
    
    new TerminalChat(async (input, displayToken) => {
        // Add user message to chat history (ensure it's clean)
        chat.NewMessage('user', input)
        
        // Store the complete response as we build it
        let fullResponse = ''
        
        try {
            const result = await ai.Chat(chat.Historical, {
                tokenCallback: async (token) => {
                    // Handle token in various formats
                    let content = ''
                    if (typeof token === 'string') {
                        content = token
                    } else if (token?.stream?.content) {
                        content = token.stream.content
                    } else if (token?.content) {
                        content = token.content
                    }
                    
                    if (content) {
                        fullResponse += content
                        await displayToken(content)
                    }
                },
                stream: true
            })
            
            // Add ONLY the clean text response to chat history
            if (fullResponse && fullResponse.trim()) {
                chat.NewMessage('assistant', fullResponse.trim())
            } else if (result?.full_text && typeof result.full_text === 'string') {
                chat.NewMessage('assistant', result.full_text.trim())
            }
            
        } catch (error) {
            console.error('\n❌ Chat error:', error.message)
            await displayToken('\n[Error occurred. Please try again.]')
            chat.NewMessage('assistant', '[Error occurred. Please try again.]')
        }
        
    }, {
        exitFunction: async () => {
            if (process_name) {
                await PM2.Delete(process_name)
            }
            console.clear()
            process.exit(0)
        }
    })
}

let models_options = async () => {
    let final_array = []
    let saves_array = await ModelsList()
    saves_array.forEach(e => {
        final_array.push({
            name : `${e.name} | ${e.size} GB`,
            action : async () => {
                let model = `./models/${e.name}`
                port = await FreePort(4000)
                process_name = await EasyAI.Server.PM2({
                    handle_port: false,
                    port: port,
                    EasyAI_Config: {
                        llama: {
                            llama_model: model
                        }
                    }
                })
                ai = new EasyAI({
                    server_url: 'localhost',
                    server_port: port
                })
                StartChat(ai, process_name)
            }
        })
    })
    final_array.push({
        name : 'Exit',
        action : () => {
            console.clear()
            process.exit()
        }
    })
    return final_array
}

const FastModel = async () => ({
    options: await models_options()
})

const args = process.argv.slice(2);

if (args.length > 0 || ConfigManager.getKey('defaultchatsave')){
    let toload = (args.length > 0) ? args[0] : ConfigManager.getKey('defaultchatsave')
    
    if(toload.toLowerCase() == 'openai' || toload.toLowerCase() == 'deepinfra'){
        if((ConfigManager.getKey('openai') && toload.toLowerCase() == 'openai') || 
           (ConfigManager.getKey('deepinfra') && toload.toLowerCase() == 'deepinfra')){
            
            if(toload.toLowerCase() == 'openai' && ConfigManager.getKey('openai')){
                let openai_info = ConfigManager.getKey('openai')
                ai = new EasyAI({
                    openai_token: openai_info.token, 
                    openai_model: openai_info.model
                })
                StartChat(ai)
                
            } else if (toload.toLowerCase() == 'deepinfra' && ConfigManager.getKey('deepinfra')) {
                let deepinfra_info = ConfigManager.getKey('deepinfra')
                ai = new EasyAI({
                    deepinfra_token: deepinfra_info.token, 
                    deepinfra_model: deepinfra_info.model
                })
                StartChat(ai)
            }
        } else {
            // Handle case where config doesn't exist
            let cli = new TerminalHUD()
            let final_object = {}

            if(toload.toLowerCase() == 'openai'){
                final_object.token = await cli.ask('OpenAI Token: ')
                final_object.model = await cli.ask('Select the model', {
                    options: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo-instruct']
                })
                let save = await cli.ask('Save the OpenAI config? ', {
                    options: ['yes', 'no']
                })
                if(save == 'yes'){
                    ConfigManager.setKey('openai', final_object)
                }
                cli.close()
                console.clear()
                ai = new EasyAI({
                    openai_token: final_object.token, 
                    openai_model: final_object.model
                })
                StartChat(ai)
                
            } else if(toload.toLowerCase() == 'deepinfra'){
                final_object.token = await cli.ask('DeepInfra Token: ')
                final_object.model = await cli.ask('Select the model', {
                    options: [
                        'deepseek-ai/DeepSeek-V3.2',
                        'meta-llama/Meta-Llama-3.1-8B-Instruct',
                        'Qwen/Qwen3-235B-A22B-Instruct-2507',
                        'zai-org/GLM-4.7-Flash'
                    ]
                })
                let save = await cli.ask('Save the DeepInfra config? ', {
                    options: ['yes', 'no']
                })
                if(save == 'yes'){
                    ConfigManager.setKey('deepinfra', final_object)
                }
                cli.close()
                console.clear()
                ai = new EasyAI({
                    deepinfra_token: final_object.token, 
                    deepinfra_model: final_object.model
                })
                StartChat(ai)
            }
        }
    } else {
        // Handle saved server configuration
        try {
            const save = await ServerSaves.Load(toload)
            
            process_name = await EasyAI.Server.PM2({
                handle_port: false,
                token: save.Token,
                port: save.Port,
                EasyAI_Config: save.EasyAI_Config
            })
            console.log('✔️ PM2 Server iniciado com sucesso!')
            ai = new EasyAI({
                server_url: 'localhost',
                server_port: save.Port
            })
            StartChat(ai, process_name)
            
        } catch(e) {
            // Handle special cases or fallback
            if(args[0] == "models"){
                let cli = new TerminalHUD()
                await cli.displayMenu(FastModel)
                cli.close()
                // The ai is created inside the menu action
            } else {
                console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
                port = await FreePort(4000)
                process_name = await EasyAI.Server.PM2({
                    handle_port: false,
                    port: port
                })
                ai = new EasyAI({
                    server_url: 'localhost',
                    server_port: port
                })
                StartChat(ai, process_name)
            }
        }
    }
   
} else {
    // Default case: start local server
    port = await FreePort(4000)
    process_name = await EasyAI.Server.PM2({
        handle_port: false,
        port: port
    })
    ai = new EasyAI({
        server_url: 'localhost',
        server_port: port
    })
    StartChat(ai, process_name)
}