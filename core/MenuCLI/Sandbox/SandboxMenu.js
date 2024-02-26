import EasyAI from '../../../EasyAI.js'
import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'

const SandboxMenu = (props) => ({
    title : `☕ Sandbox | ${props.server_url}${(props.server_port) ? `:${props.server_port}` : ''}
`,
options : [
    {
    name : 'Generate',
    action : async () => {
        let ai = new EasyAI(props)
        let prompt = ''
        while(prompt != 'exit' || prompt != 'sair'){
            prompt = await MenuCLI.ask('Prompt (sair/exit) : ')
            if(prompt == 'exit' || prompt == 'sair'){break}
            let result = await ai.Generate(prompt,{tokenCallback : (token) => {console.log(token)}})
            console.log(`Tempo total : ${(result.timings.predicted_ms+result.timings.prompt_ms).toFixed(2)} ms | Tokens/Seg : ${(result.timings.predicted_per_second).toFixed(2)}`)
        }
        MenuCLI.displayMenu(SandboxMenu,{props : props})
    }
    },
    {
    name : 'ChatGPT',
    action : () => {
        }
    },
    {
    name : 'Coder',
    action : () => {
            }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})



export default SandboxMenu