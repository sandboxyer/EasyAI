#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import TerminalGenerate from "../TerminalGenerate.js"
import PM2 from "../useful/PM2.js"

await EasyAI.Server.PM2()
let ai = new EasyAI({server_url : 'localhost',server_port : 4000})
console.clear()

        new TerminalGenerate(async (input,display) => {
           let result = await ai.Generate(input,{tokenCallback : async (token) =>{await display(token.stream.content)}})
        },{exitFunction : async () => {
            await PM2.Delete('pm2_easyai_server')
        }})