- generate react-client-manifest.json correctly 

- do the "dev" experience; restart on edits, prod builds, etc etc  

- test the register mechanism 
- test the loader mechanism 
- test the full build mechanism 

- get this to work on cloudflare 

- what happens when there are *.server.js/*.client.js files inside node_modules

- types and stuff 


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
