import path from 'path';
import {promises as fs} from 'fs';
import glob from 'fast-glob';
import {tagClientComponents, wrapClientComponents} from './server-components';

export default () => {
  let config;

  let clientManifest;

  return {
    name: 'vite-plugin-rsc-shim',

    enforce: 'pre',

    configResolved(_config) {
      config = _config;
      console.log(config);
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

      console.log('Client Components\n\n', clientComponents);

      // We only need to emit client files when building client bundles
      if (config.build.ssr || config.command !== 'build') return;

      clientComponents.forEach((id) => {
        this.emitFile({
          type: 'chunk',
          id,
          preserveSignature: 'strict',
        });
      });
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
        console.log('Vite transform', id)
        return {
          code: `
            export default function ClientComponentPlaceholder() {
              return (<span>${id}</span>);
            };
          `
        };
      }
    },

    async load(id, ssr) {
      if (!ssr) return null;

      /**
       * Client components being loaded from server components need to be
       * wrapped in a ClientMarker so we can serialize their props and
       * dynamically load them in the browser.
       */
      console.log(`Vite Plugin Load: ${id}`)
      // if (id.includes('?fromServer')) {
      //   return await wrapClientComponents({
      //     id,
      //     getManifestFile: getFileFromClientManifest,
      //     root: config.root,
      //     isBuild: config.command === 'build',
      //   });
      // }

      // if (/\.client\.(j|t)sx?/.test(id)) {
      //   return `
      //     export function ClientComponentPlaceholder() {
      //       return (<span>${id}</span>);
      //     };
      //   `;
      // }

      return null;
    },
  };

  async function getFileFromClientManifest(manifestId) {
    const manifest = await getClientManifest();

    const fileName = '/' + manifestId.split('/').pop();
    const matchingKey = Object.keys(manifest).find((key) =>
      key.endsWith(fileName)
    );

    if (!matchingKey) {
      throw new Error(
        `Could not find a matching entry in the manifest for: ${manifestId}`
      );
    }

    return manifest[matchingKey].file;
  }

  async function getClientManifest() {
    if (config.command !== 'build') {
      return {};
    }

    if (clientManifest) return clientManifest;

    try {
      const manifest = JSON.parse(
        await fs.readFile(
          path.resolve(config.root, './dist/client/manifest.json'),
          'utf-8'
        )
      );

      clientManifest = manifest;

      return manifest;
    } catch (e) {
      console.error(`Failed to load client manifest:`);
      console.error(e);
    }
  }
};
