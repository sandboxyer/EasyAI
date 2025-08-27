import fs from 'fs/promises'
import { performance } from 'perf_hooks';
import ColorText from '../../../useful/ColorText.js'
import runUntilEnter from '../../../useful/runUntilEnter.js';
import tokenizeText from '../../../useful/tokenizeText.js'


class Dict {

    static loadedDict = null

    static Get = (config = {dict_path : '',force_reload : false}) => {
        
    return null
    }


    static async Level1(config = {dict_path: '', logMode: 'overlay'}) {
        await runUntilEnter(async () => {
            await this.#EnhancedRunLevel1(config);
        });
        process.exit(0);
    }

    static async #EnhancedRunLevel1(config = {dict_path: '', logMode: 'overlay'}) {
        function average(arr) {
            return arr.reduce((sum, num) => sum + num, 0) / arr.length;
        }
        
        let final_filter = 'ed';
        const dict = JSON.parse(await fs.readFile(config.dict_path));
        let filt = [];
        
        Object.keys(dict).forEach((k, i) => {
            let final = k.slice(k.length - final_filter.length, k.length);
            if (final == final_filter) {
                filt.push({key: k, explain: dict[k]});
            }
        });
        
        let runtimes = [];
        const logMode = config.logMode || 'overlay';
        
        for (const [i, v] of filt.entries()) {
            let start = performance.now();
            let tokenized_explain = tokenizeText(v.explain);
            let matchs = 0;
            
            tokenized_explain.forEach((vd) => {
                Object.keys(dict).forEach((vdict) => {
                    if (vd == vdict) {
                        matchs++;
                    }
                });
            });
            
            let finish = performance.now();
            runtimes.push(Number((finish - start).toFixed(2)));
            
            const progress = `${i + 1}/${filt.length}`;
            const percentage = `${(matchs/tokenized_explain.length*100).toFixed(2)}%`;
            const time = Number(`${(finish-start).toFixed(2)}`);
            const avgTime = `${average(runtimes).toFixed(2)}`;
            
            if (logMode === 'overlay') {
                // Overlay mode - clear line and write new content
                process.stdout.write(`\r\x1b[K${progress} | ${v.key} : ${percentage} | ${time} | time avg : ${avgTime}`);
            } else {
                // Multi-line mode
                console.log(`${progress} | ${v.key} : ${percentage} | ${(time > avgTime) ? ColorText.red(time) : ColorText.green(time)} ms | time avg : ${avgTime}`);
            }
            
            // Allow event loop to process keypresses
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Final cleanup for overlay mode
        if (logMode === 'overlay') {
            console.log(''); // Move to next line after completion
        }
        
        console.log(`\nCompleted processing ${filt.length} items`);
    }
}

// Usage examples:
// Default (overlay mode): await Dict.Level1();
// Multi-line mode: await Dict.Level1({logMode: 'multiline'});

export default Dict