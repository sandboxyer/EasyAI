import fs from 'fs/promises';
import path from 'path';

async function ModelsList() {
    try {
        const modelsDir = path.join(process.cwd(), 'models');
        const files = await fs.readdir(modelsDir, { withFileTypes: true });
        const fileNames = files.filter(dirent => dirent.isFile()).map(dirent => dirent.name);
        return fileNames;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        } else {
            throw err;
        }
    }
}

export default ModelsList;
