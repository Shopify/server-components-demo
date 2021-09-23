import path from 'path';
import {promises as fs} from 'fs';
import handleEvent from './handle-event';
import { Parser } from 'acorn'
import acornClassFields from 'acorn-class-fields'
import acornStaticClassFeatures from 'acorn-static-class-features'
import acornJsx from 'acorn-jsx'

let parser = Parser.extend(
  acornClassFields,
  acornStaticClassFeatures,
  acornJsx()
)

export default () => {
  let config;
  let devServer;
  let clientManifest = {};

  const resolve = (p) => path.resolve(devServer.config.root, p);

  return {
    name: 'vite-plugin-ssr-rsc-middleware',

    enforce: 'pre',

    configResolved(_config) {
      config = _config;
    },

    async buildStart() {
      console.log('Vite buildStart ...')

      /**
       * By default, it's assumed the path to Hydrogen components is adjacent to the config
       * in node_modules. However, in the case of the Yarn monorepo (or E2E tests), this
       * path needs to be customized. We use an environment variable in that case.
       */
      // const hydrogenComponentPath =
      //   process.env.HYDROGEN_PATH ?? './node_modules/@shopify/hydrogen';

      /**
       * Grab each of the client components in this project and emit them as chunks.
       * This allows us to dynamically import them later during partial hydration in production.
       */
      // const clientComponents = glob
      //   .sync(path.resolve(config.root, './src/**/*.client.(j|t)sx'))
      //   .concat(
      //     glob.sync(
      //       path.resolve(
      //         config.root,
      //         hydrogenComponentPath,
      //         'dist/esnext/**/*.client.js'
      //       )
      //     )
      //   );

      // console.log('SSR Client Components\n\n', clientComponents);

      // Building the client manifest on the fly - update this with vite's module resolve function
      // for (const entryPoint of clientComponents) {
      //   const fixedEntrypoint = entryPoint.substring(process.cwd().length)
      //   await devServer.ssrLoadModule(resolve(fixedEntrypoint))
        // const mod = await devServer.moduleGraph.ensureEntryFromUrl(fixedEntrypoint);

        // console.log(mod);
        
      //   clientManifest[fixedEntrypoint] = {
      //     default: {
      //       id: fixedEntrypoint,
      //       chunks: [fixedEntrypoint],
      //       name: 'default',
      //     },
      //   };
      // }
    },

    /**
     * By adding a middleware to the Vite dev server, we can handle SSR without needing
     * a custom node script. It works by handling any requests for `text/html` documents,
     * loading them in an SSR context, rendering them using the `entry-server` endpoint in the
     * user's project, and injecting the static HTML into the template.
     */
    configureServer(server) {
      console.log('Vite configureServer ...');
      devServer = server
      // server.fs = {
      //   allow: '__inspect'
      // }

      async function getIndexTemplate(url) {
        const indexHtml = await fs.readFile(resolve('index.html'), 'utf-8');
        return await server.transformIndexHtml(url, indexHtml);
      }

      server.middlewares.use(
        hydrogenMiddleware({
          dev: true,
          indexTemplate: getIndexTemplate,
          getServerEntrypoint: async () =>
            await server.ssrLoadModule(resolve('./src/entry-server')),
          devServer,
          getClientManifest: () => {
            return clientManifest;
          },
        })
      );
    },

    async resolveId(source, importer) {
      if (!importer) return null;

      /**
       * Throw errors when non-Server Components try to load Server Components.
       */
      if (
        /\.server(\.(j|t)sx?)?$/.test(source) &&
        !/\.server\.(j|t)sx?$/.test(importer) &&
        // Ignore entrypoints, index re-exports, ClientMarker, handle-worker-event
        !/(entry-server\.(j|t)sx?|index\.(html|js)|ClientMarker\.js|handle-worker-event\.js)$/.test(
          importer
        )
      ) {
        throw new Error(
          `Cannot import ${source} from "${importer}". ` +
            'By convention, Server Components can only be imported from other Server Component files. ' +
            'That way nobody accidentally sends these to the client by indirectly importing it.'
        );
      }

      /**
       * Throw errors when Client Components try to load Hydrogen components from the
       * server-only entrypoint.
       */
      if (
        /@shopify\/hydrogen$/.test(source) &&
        /\.client\.(j|t)sx?$/.test(importer)
      ) {
        throw new Error(
          `Cannot import @shopify/hydrogen from "${importer}". ` +
            'When using Hydrogen components within Client Components, use the `@shopify/hydrogen/client` entrypoint instead.'
        );
      }
    },

    transform(src, id, ssr) {
      if (!ssr) return null;

      if (/\.client\.(j|t)sx?$/.test(id)) {
        console.log('Vite transform', id.substring(process.cwd().length))

        // console.log(devServer.moduleGraph);
        const module = devServer.moduleGraph.idToModuleMap.get(id);

        if (!module.rscTransformResult) {

          // Get the parsed module
          let parsedModule;
          try {
            parsedModule = parser.parse(src, {
              sourceType: 'module',
              ecmaVersion: 'latest',
              locations: true
            });
          } catch (e) {
            console.log(chalk.red(`failed to parse ${module.url}`))
            throw e
          }
        
          // Build the React module reference file based on the file exports
          // For each exports we need to reconstruct the module references
          // For example:
          //
          // Original client module (/src/TestElement.jsx):
          //
          //   export default function TestElement() {
          //     return (<div>Test Element</div>)
          //   }
          //   export function TestElementAlt1() {
          //     return (<div>Test Element Alt 1</div>)
          //   }
          //   export function TestElementAlt2() {
          //     return (<div>Test Element Alt 2</div>)
          //   }
          //
          // We need to construct the following module reference that will be
          // parsed by RSC:
          //
          //   const MODULE_REFERENCE = Symbol.for('react.module.reference');
          //   export default {
          //     $$typeof: MODULE_REFERENCE, 
          //     filepath: '/src/TestElement.jsx',
          //     name: 'default'
          //   };
          //   const TestElementAlt1 = {
          //     $$typeof: MODULE_REFERENCE, 
          //     filepath: '/src/TestElement.jsx',
          //     name: 'TestElementAlt1'
          //   };
          //   const TestElementAlt2 = {
          //     $$typeof: MODULE_REFERENCE, 
          //     filepath: '/src/TestElement.jsx',
          //     name: 'TestElementAlt2'
          //   };
          //   export {
          //     TestElementAlt1,
          //     TestElementAlt2
          //   }
          //
          // We also need matching client manifest for this module:
          //
          // clientManifest['/src/TestElement.jsx'] = {
          //   'default': {
          //     id: '/src/TestElement.jsx',
          //     chunks: ['/src/TestElement.jsx'],
          //     name: 'default',
          //   },
          //   'TestElementAlt1': {
          //     id: '/src/TestElement.jsx',
          //     chunks: ['/src/TestElement.jsx'],
          //     name: 'TestElementAlt1',
          //   },
          //   'TestElementAlt2': {
          //     id: '/src/TestElement.jsx',
          //     chunks: ['/src/TestElement.jsx'],
          //     name: 'TestElementAlt2',
          //   },
          // }
          //
          // Note: This client manifest is in the data shape that react-server-dom-webpack expects

          const namedExports = {};
          let rscTransform = `const MODULE_REFERENCE = Symbol.for('react.module.reference');`;
          for (const node of parsedModule.body) {
            if (node.type === 'ExportDefaultDeclaration') {
              rscTransform += `
                export default {
                  $$typeof: MODULE_REFERENCE, 
                  filepath: '${module.url}',
                  name: 'default'
                };
              `;
              clientManifest[module.url] = {
                'default': {
                  id: module.url,
                  chunks: [module.url],
                  name: 'default',
                }
              }
            }

            if (node.type === 'ExportNamedDeclaration') {
              namedExports[node.declaration.id.name] = {
                id: module.url,
                chunks: [module.url],
                name: node.declaration.id.name,
              }
            }

            // register client imported modules
            if (node.type === 'ImportDeclaration') {
              console.log(node);
            }
          }

          // Build the react module reference for named exports
          const namedExportsKeys = Object.keys(namedExports);
          if (namedExportsKeys.length > 0) {
            rscTransform += `
              ${namedExportsKeys.map((key) => {
                return `
                  const ${key} = {
                    $$typeof: MODULE_REFERENCE, 
                    filepath: '${module.url}',
                    name: '${key}'
                  };
                `;
              }).join('')}
              export {
              ${namedExportsKeys.map((key) => {
                return `${key}`;
              }).join(',')}
              }
            `;
            clientManifest[module.url] = {
              ...clientManifest[module.url],
              ...namedExports
            };
          }
          module.rscTransformResult = rscTransform;
        }

        // console.log(module);
        
        // console.log('\n\n Map: \n', map)
        // const importers = fileModuleMap.importers;
        // for (let module of importers.values()) {
        //   console.log(module);
        // }
  
        return {
          code: module.rscTransformResult
        };
      }
    },
  };
};

function hydrogenMiddleware({
  dev,
  indexTemplate,
  getServerEntrypoint,
  devServer,
  getClientManifest
}) {
  return async function (
    request,
    response,
    next
  ) {
    const url = new URL('http://' + request.headers.host + request.originalUrl);
    const isReactHydrationRequest = url.pathname === '/react';

    // Vite inspect plugin path
    if ( /\/__inspect/.test(url.pathname)) {
      return next();
    }

    /**
     * If it's a dev environment, it's assumed that Vite's dev server is handling
     * any static or JS requests, so we need to ensure that we don't try to handle them.
     *
     * If it's a product environment, it's assumed that the developer is handling
     * static requests with e.g. static middleware.
     */
    if (dev && !shouldInterceptRequest(request, isReactHydrationRequest)) {
      return next();
    }

    try {

      console.log(`Resolving ${url}`);

      /**
       * We're running in the Node.js runtime without access to `fetch`,
       * which is needed for proxy requests and server-side API requests.
       */
      if (!globalThis.fetch) {
        const fetch = await import('node-fetch');
        // @ts-ignore
        globalThis.fetch = fetch.default;
        // @ts-ignore
        globalThis.Request = fetch.Request;
        // @ts-ignore
        globalThis.Response = fetch.Response;
        // @ts-ignore
        globalThis.Headers = fetch.Headers;
      }

      /**
       * Dynamically import ServerComponentResponse after the `fetch`
       * polyfill has loaded above.
       */
      const {ServerComponentRequest} = await import(
        './ServerComponentRequest'
      );

      const eventResponse = await handleEvent(
        /**
         * Mimic a `FetchEvent`
         */
        {},
        {
          request: new ServerComponentRequest(request),
          entrypoint: await getServerEntrypoint(),
          indexTemplate,
          streamableResponse: response,
          clientManifest: getClientManifest()
        }
      );

      // console.log(devServer);

      /**
       * If a `Response` was returned, that means it was not streamed.
       * Convert the response into a proper Node.js response.
       */
      if (eventResponse) {
        eventResponse.headers.forEach((value, key) => {
          response.setHeader(key, value);
        });

        response.statusCode = eventResponse.status;
        response.end(eventResponse.body);
      }
    } catch (e) {
      if (dev && devServer) devServer.ssrFixStacktrace(e);
      console.log(e.stack);
      response.statusCode = 500;

      /**
       * Attempt to print the error stack within the template.
       * This allows the react-refresh plugin and other Vite runtime helpers
       * to display the error and auto-refresh when the error is fixed, instead
       * of a white screen that needs a manual refresh.
       */
      try {
        const template =
          typeof indexTemplate === 'function'
            ? await indexTemplate(url.toString())
            : indexTemplate;
        const html = template.replace(
          `<div id="root"></div>`,
          `<div id="root"><pre><code>${e.stack}</code></pre></div>`
        );

        response.write(html);
        next(e);
      } catch (_e) {
        // If template loading is the culprit, give up and just return the error stack.
        response.write(e.stack);
        next(e);
      }
    }
  };
}

function shouldInterceptRequest(
  request,
  isReactHydrationRequest
) {
  return (
    (request.headers['accept']?.includes('text/html') ||
      isReactHydrationRequest) &&
    request.method === 'GET' &&
    request.url !== '/favicon.ico'
  );
}