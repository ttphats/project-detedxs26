import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const outputPath = path.resolve(rootDir, 'deploy-package.zip');

const zip = new AdmZip();

const excludeDirs = ['node_modules', '.next', 'dist', '.git', 'coverage', '.vercel', '.pnp', '.yarn'];

function addDirectory(dirPath, zipPath) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    if (excludeDirs.includes(item)) continue;
    
    const fullPath = path.join(dirPath, item);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    
    if (stat.isDirectory()) {
      addDirectory(fullPath, path.join(zipPath, item));
    } else {
      // Don't include the zip file itself or dev envs
      if (item === 'deploy-package.zip' || item.includes('.env.local') || item.includes('env (')) continue;
      
      const content = fs.readFileSync(fullPath);
      zip.addFile(path.join(zipPath, item).replace(/\\/g, '/'), content);
    }
  }
}

console.log('Packaging project... This may take a moment.');
addDirectory(rootDir, '');
zip.writeZip(outputPath);
console.log(`✅ Project packaged successfully to: deploy-package.zip`);
