import path from 'path';
import {promises as fs} from 'fs';
import handleEvent from './handle-event';

export default () => {
  return {
    name: 'vite-plugin-ssr-rsc-middleware',

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

      server.fs = {
        allow: ['src']
      };

      // console.log(server);

      server.middlewares.use(
        hydrogenMiddleware({
          dev: true,
          indexTemplate: getIndexTemplate,
          getServerEntrypoint: async () =>
            await server.ssrLoadModule(resolve('./src/entry-server')),
          devServer: server,
        })
      );
    },
  };
};

function hydrogenMiddleware({
  dev,
  indexTemplate,
  getServerEntrypoint,
  devServer,
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