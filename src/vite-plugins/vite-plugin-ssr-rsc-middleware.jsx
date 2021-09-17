import path from 'path';
import {promises as fs} from 'fs';
import handleEvent from './handle-event';
import glob from 'fast-glob';

export default () => {
  let config;
  let clientManifest = {};

  return {
    name: 'vite-plugin-ssr-rsc-middleware',

    enforce: 'pre',

    configResolved(_config) {
      config = _config;
    },

    buildStart() {
      console.log('\n\nVite buildStart\n\n')

      /**
       * By default, it's assumed the path to Hydrogen components is adjacent to the config
       * in node_modules. However, in the case of the Yarn monorepo (or E2E tests), this
       * path needs to be customized. We use an environment variable in that case.
       */
      const hydrogenComponentPath =
        process.env.HYDROGEN_PATH ?? './node_modules/@shopify/hydrogen';

      /**
       * Grab each of the client components in this project and emit them as chunks.
       * This allows us to dynamically import them later during partial hydration in production.
       */
      const clientComponents = glob
        .sync(path.resolve(config.root, './src/**/*.client.(j|t)sx'))
        .concat(
          glob.sync(
            path.resolve(
              config.root,
              hydrogenComponentPath,
              'dist/esnext/**/*.client.js'
            )
          )
        );

      console.log('SSR Client Components\n\n', clientComponents);

      // Building the client manifest on the fly - update this with vite's module resolve function
      for (const entryPoint of clientComponents) {
        const fixedEntrypoint = entryPoint.substring(process.cwd().length)
        clientManifest[fixedEntrypoint] = {
          '': {
            id: fixedEntrypoint,
            chunks: [fixedEntrypoint],
            name: '',
          },
          '*': {
            id: fixedEntrypoint,
            chunks: [fixedEntrypoint],
            name: '*',
          },
          default: {
            id: fixedEntrypoint,
            chunks: [fixedEntrypoint],
            name: 'default',
          },
        };
      }
    },

    /**
     * By adding a middleware to the Vite dev server, we can handle SSR without needing
     * a custom node script. It works by handling any requests for `text/html` documents,
     * loading them in an SSR context, rendering them using the `entry-server` endpoint in the
     * user's project, and injecting the static HTML into the template.
     */
    configureServer(server) {
      const resolve = (p) => path.resolve(server.config.root, p);
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
          devServer: server,
          clientManifest,
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

      /**
       * When a server component imports a client component, tag a `?fromServer`
       * identifier at the end of the import to indicate that we should transform
       * it with a ClientMarker (below).
       *
       * We are manually passing `@shopify/hydrogen/client` as an additional "from"
       * identifier to allow local Server Components to import them as tagged Client Components.
       * We should also accept this as a plugin argument for other third-party packages.
       */
      // if (/\.server\.(j|t)sx?$/.test(id)) {
      //   return tagClientComponents(src);
      // }

      if (/\.client\.(j|t)sx?$/.test(id)) {
        console.log('Vite transform', id.substring(process.cwd().length))
  
        return {
          code: `
            const MODULE_REFERENCE = Symbol.for('react.module.reference');
            export default {
              $$typeof: MODULE_REFERENCE, 
              filepath: '${id.substring(process.cwd().length)}',
              name: 'default'
            }
          `
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
  clientManifest
}) {
  return async function (
    request,
    response,
    next
  ) {
    const url = new URL('http://' + request.headers.host + request.originalUrl);
    const isReactHydrationRequest = url.pathname === '/react';

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
          clientManifest
        }
      );

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