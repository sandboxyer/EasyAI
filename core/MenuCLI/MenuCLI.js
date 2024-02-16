#!/usr/bin/env node

import TerminalHUD from "../TerminalHUD.js";

const SetupMenu = new TerminalHUD()

const StartMenu = () => ({
        title : `⚙️ EasyAI
`,
    options : [
        {
        name : 'EasyAI Server',
        action : () => {

        }
        },
        {
        name : 'Sandbox',
        action : () => {

            }
        }
         ]

})


SetupMenu.displayMenu(StartMenu,true)