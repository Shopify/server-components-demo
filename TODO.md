- generate react-client-manifest.json correctly 

- do the "dev" experience; restart on edits, prod builds, etc etc  

- test the register mechanism 
- test the loader mechanism 
- test the full build mechanism 

- get this to work on cloudflare 

- what happens when there are *.server.js/*.client.js files inside node_modules

- types and stuff 

- I don't think it's picking up the right react-server package (since we're generating one based on a different host config). might have to add more conditions to exports. dunno. 

- routing 
- context 
- "ssr"/"ssg"

- instead of pipeToNodeWritable, if we can get a plain iterable, can avoid bubdling a bunch of stuff 

- need to do an esbuild version of the build/deploy script 


- /client 
  - index.html has to point to the deployed script 
  

- /worker 


misc
---

- snippet for listing all node builtins, via sindre 
// const external = (
//   require('module').builtinModules || Object.keys(process.binding('natives'))
// )
//   .filter(
//     (x) =>
//       !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && !['sys'].includes(x)
//   )
//   .filter((x) => !['path', 'url', 'punycode', 'querystring', 'fs'].includes(x))
//   .sort();


var global = self;
var process = {env:{}};
var require = undefined;
function setImmediate(fn){
  setTimeout(fn, 0)
}