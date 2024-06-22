import fs from 'fs';
import path from 'path';

const FixBuildInfo = (filePath = './llama.cpp/scripts/build-info.sh') => {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const fixedContent = fileContent.replace(/\r\n/g, '\n');
  fs.writeFileSync(filePath, fixedContent);
};

export default FixBuildInfo;