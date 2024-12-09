# EasyAI 
🔧 ```bash install.sh```

‎🌎 ```ai```

# Getting Started
```
import EasyAI from 'path/to/EasyAI.js'

const AI = new EasyAI()

await AI.PrintGenerate('The text below is cake recipe.')
```
# CLI

|  |‎🌎|💬| 💡 | 🌐 | 📟 
| --- | --- | --- | --- | --- | --- 
| ⚡ | `ai` | `chat` | `generate` | `webgpt`| `do` 
| 👑| `ai phi` |`chat phi` | `generate phi` | `webgpt phi` | `do-phi`
| 🦙| `ai llama` | `chat llama` | `generate llama` | `webgpt llama` | `do-llama` 
| 🐋| `ai deepseek` | `chat deepseek` | `generate deepseek` | `webgpt deepseek` | `do-deepseek` 
| 🏎️| `ai groq` |`chat groq` | `generate groq` | `webgpt groq` | `do-groq`
| 📡| `ai openai` |`chat openai` | `generate openai` | `webgpt openai` | `do-openai` 
| 💾| `ai <save>` |`chat <save>` | `generate <save>` | `webgpt <save>` | `do-<save>` 

---
<details>
<summary>⚙️ Manual Setup</summary>
<details>
  <summary>🐧 Linux</summary>

   ### Ubuntu

  1. Install packages:
     <pre>
     sudo apt install -y gcc make cmake g++ nodejs npm
     </pre>

  ### CentOS7.x

  1. Install scl repo:
     <pre>
     sudo yum install -y centos-release-scl
     </pre>

  2. Install devtoolset 11 and default packages:
     <pre>
     sudo yum install -y devtoolset-11 nodejs npm
     </pre>

  3. Enable GCC version:
     <pre>
     source /opt/rh/devtoolset-11/enable
     </pre>
     Add the above line in `~/.bashrc` and refresh:
     <pre>
     source ~/.bashrc
     </pre>
  
</details>


<details>
  <summary>🖥️ Windows</summary>

1. Download the latest fortran version of [w64devkit](https://github.com/skeeto/w64devkit/releases)

2. Extract and add the bin to PATH global variable:
   <pre>
   setx path "%path%;C:\path\to\w64devkit\bin"
   </pre>
   Replace `C:\path\to\w64devkit\bin` with the actual path where you extracted w64devkit.

3. Download and install the NodeJS:
   <pre>
   https://nodejs.org/en/download/prebuilt-installer
   </pre>

</details>
</details>
⠀⠀

[Full Doc](https://doc.easyai.com.br)
