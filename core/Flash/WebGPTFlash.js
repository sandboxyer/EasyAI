#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import PM2 from "../useful/PM2.js"
import TerminalHUD from "../TerminalHUD.js"
import ServerSaves from "../MenuCLI/ServerSaves.js"
import ColorText from '../useful/ColorText.js'
import ConfigManager from "../ConfigManager.js"


if(await PM2.Process('pm2_webgpt')){
    let cli = new TerminalHUD()

    let menu = () => ({
        title : 'Flash WebGPT',
        options : [
            {
            name : '❌ Finalizar WebGPT',
            action : async () =>{
                console.clear()
                await PM2.Delete('pm2_webgpt pm2_easyai_server')
                process.exit()
            }
            },
            {
            name : 'Sair',
            action : () => {
                console.clear()
                process.exit()
                }
            }

        ]
    })

    cli.displayMenu(menu)

} else {

const args = process.argv.slice(2);

if (args.length > 0 || ConfigManager.getKey('defaultwebgptsave')) {
    let toload = (args.length > 0) ? args[0] : ConfigManager.getKey('defaultwebgptsave')
    if(toload.toLowerCase() == 'openai'){
        if(ConfigManager.getKey('openai')){
            let openai_info = ConfigManager.getKey('openai')
            await EasyAI.WebGPT.PM2({openai_token : openai_info.token, openai_model : openai_info.model})
        } else {
            let cli = new TerminalHUD()
            let final_object = {}
            final_object.token = await cli.ask('OpenAI Token : ')
            final_object.model = await cli.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
            let save = await cli.ask('Save the OpenAI config? ',{options : ['yes','no']})
            if(save == 'yes'){ConfigManager.setKey('openai',final_object)}
            cli.close(
            console.clear()
            )
            await EasyAI.WebGPT.PM2({openai_token : final_object.token, openai_model : final_object.model})
        }
    } else {
    await ServerSaves.Load(toload)
    .then(async (save) => {

            await EasyAI.Server.PM2({token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
            console.log('✔️ PM2 Server iniciado com sucesso !')
            await EasyAI.WebGPT.PM2()

    }).catch(async e => {

        console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
        await EasyAI.Server.PM2()
        await EasyAI.WebGPT.PM2()
   
    })
}
} else {
    await EasyAI.Server.PM2()
    await EasyAI.WebGPT.PM2()
    process.exit()
}


}