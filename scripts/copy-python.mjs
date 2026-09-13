import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/python',{recursive:true});
for(const file of ['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']) copyFileSync(`node_modules/pyodide/${file}`,`public/python/${file}`);
