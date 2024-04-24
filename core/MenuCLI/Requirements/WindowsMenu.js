import MenuCLI from "../MenuCLI.js";
import RequirementsMenu from "./RequirementsMenu.js";
import W64 from "./W64.js";

const WindowsMenu = () => ({
    title : `⚙️ Centos Requirements
`,
options : [
    {
    name : 'w64devkit',
    action : async () => {
        await W64.install()
        MenuCLI.displayMenu(WindowsMenu)
    }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(RequirementsMenu)
            }
        }
     ]

})

export default WindowsMenu