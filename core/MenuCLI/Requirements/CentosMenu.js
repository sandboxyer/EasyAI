import MenuCLI from "../MenuCLI.js";
import RequirementsMenu from "./RequirementsMenu.js";
import GCC from "./GCC.js";

const GCCMenu = () => ({
    title : `GCC Install
`,
options : [
    {
    name : 'Install',
    action : async () => {
      await GCC.Install()
    }
    },
    {
    name : 'Check',
    action : async () => {
       await GCC.Check()
        }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(CentosMenu)
            }
        }
     ]

})

const CentosMenu = () => ({
    title : `⚙️ Centos Requirements
`,
options : [
    {
    name : 'GCC',
    action : () => {
        MenuCLI.displayMenu(GCCMenu)
    }
    },
    {
    name : 'CUDA',
    action : () => {
       
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

export default CentosMenu