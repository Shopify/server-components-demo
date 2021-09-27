export default function Html({
  children,
}) {
  return (
    <html lang="en">
      <head>
        <script type="module" src="/@vite/client"></script>
        <meta charSet="utf-8" />
        <link
          rel="shortcut icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🕹</text></svg>"
        />
        <meta name="description" content="React with Server Components demo" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="style.css" />
        <title>React Notes</title>
      </head>
      <body>
        <div id="root">{children}</div>
        <script dangerouslySetInnerHTML={{
          __html: `
            global = window;
    
            global.__vite__module_map__ = new Map();

            // we just use webpack's function names to avoid forking react
            global.__webpack_chunk_load__ = async function(moduleId) {
              console.log(moduleId);
              const mod = await import(moduleId.replace('./src', '/'));
              global.__vite__module_map__.set(moduleId, mod);
              return mod;
            };

            global.__webpack_require__ = function(moduleId) {
              return global.__vite__module_map__.get(moduleId);
            };
          `
        }}></script>
        <script src="src/index.client.jsx" type="module" />
      </body>
    </html>
  );
}
