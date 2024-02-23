import MenuCLI from "../MenuCLI.js";
import RequirementsMenu from "./RequirementsMenu.js";
import GCC from "./GCC.js";
import CUDA from "./CUDA.js";

const GCCMenu = () => ({
    title : `GCC Install
`,
options : [
    {
    name : 'Install',
    action : async () => {
      await GCC.Install()
      MenuCLI.displayMenu(GCCMenu)
    }
    },
    {
    name : 'Check',
    action : async () => {
       await GCC.Check()
       MenuCLI.displayMenu(GCCMenu)
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

const CUDAMenu = () => ({
    title : `GCC Install
`,
options : [
    {
    name : 'Install',
    action : async () => {
      await CUDA.Install()
      MenuCLI.displayMenu(CUDAMenu)
    }
    },
    {
    name : 'Check',
    action : async () => {
       await CUDA.Check()
       MenuCLI.displayMenu(CUDAMenu)
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
       MenuCLI.displayMenu(CUDAMenu)
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