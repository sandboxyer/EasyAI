#!/usr/bin/env node

import TerminalHUD from "../TerminalHUD.js";
import StartMenu from "./StartMenu.js";
import ServerSaves from "./ServerSaves.js";
import ColorText from "../useful/ColorText.js";
import EasyAI from "../../EasyAI.js";

const MenuCLI = new TerminalHUD()

export default MenuCLI

const args = process.argv.slice(2);

if (args.length > 0) {
    
    await ServerSaves.Load(args[0])
    .then(async (save) => {
        if(save.PM2){
            await EasyAI.Server.PM2({token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
            console.log('✔️ PM2 Server iniciado com sucesso !')
            process.exit()
        } else {
            let server = new EasyAI.Server({token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
            server.start()
        }
        
        
    }).catch(e => {
        console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
        process.exit()
    })

} else {
    MenuCLI.displayMenu(StartMenu);
}