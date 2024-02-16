#!/usr/bin/env node

import TerminalHUD from "../TerminalHUD.js";
import StartMenu from "./StartMenu.js";

const SetupMenu = new TerminalHUD()

export default SetupMenu

SetupMenu.displayMenu(StartMenu)