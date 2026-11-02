import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
const root=resolve(new URL('../dist/',import.meta.url).pathname);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let path=resolve(root,'.'+name);if(!path.startsWith(root+'/')&&path!==root)throw Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(root+'/404.html'));}}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`ScrollCadence: http://127.0.0.1:${process.env.PORT||4173}`));
