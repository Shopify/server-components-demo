'use strict';

const esbuild = require('esbuild');
const rimraf = require('rimraf');
const child_process = require('child_process');
const {writeFile} = require('fs/promises');
const NodeModulesPolyfills = require('@esbuild-plugins/node-modules-polyfill');

rimraf.sync('dist');

const entryPoints = child_process
  .execSync('find src | grep .client.js')
  .toString()
  .split('\n')
  .filter(Boolean);

const environment = process.env.NODE_ENV || 'development';

async function run() {
  const client = await esbuild.build({
    entryPoints,
    platform: 'browser',
    sourcemap: true,
    sourcesContent: true,
    bundle: true,
    splitting: true,
    format: 'esm',
    metafile: true,
    outdir: 'dist',
    loader: {
      '.js': 'jsx',
    },
    inject: ['./src/react-shim.js'],
    minify: environment === 'production',
    define: {
      'process.env.NODE_ENV': `"${environment}"`,
    },
    nodePaths: ['vendor'],
    plugins: [
      {
        name: 'react-flight-client',
        setup(build) {
          build.onResolve({filter: /\.server$/}, (args) => {
            // just throw an error, it shouldn't ever get here
            throw new Error(
              "You imported a *.server.js from inside a client bundle, that's kinda weird"
            );
          });
        },
      },
      NodeModulesPolyfills.default(),
    ],
  });

  const {outputs} = client.metafile;

  const server = await esbuild.build({
    entryPoints: ['./server/api.server.js'],
    platform: 'node',
    sourcemap: true,
    sourcesContent: true,
    bundle: true,
    metafile: true,
    outdir: 'dist',
    loader: {
      '.js': 'jsx',
    },
    conditions: ['react-server'],
    inject: ['./src/react-shim.js'],
    minify: environment === 'production',
    define: {
      'process.env.NODE_ENV': `"${environment}"`,
    },
    nodePaths: ['vendor'],
    plugins: [
      {
        name: 'react-flight-server',
        setup(build) {
          build.onLoad({filter: /\.client\.js$/}, async (args) => {
            const outputKey = Object.keys(outputs).find((chunkPath) => {
              if (outputs[chunkPath].entryPoint) {
                return (
                  args.path ===
                  require.resolve('../' + outputs[chunkPath].entryPoint)
                );
              }
              return false;
            });

            return {
              contents: `
                const MODULE_REFERENCE = Symbol.for('react.module.reference');
                export default {
                  $$typeof: MODULE_REFERENCE, 
                  filepath: '${outputKey.replace('dist', '')}',
                  name: 'default'
                }

                `,
              loader: 'js',
            };
          });
        },
      },
      {
        name: 'make-all-packages-external',
        setup(build) {
          let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/; // Must not start with "/" or "./" or "../"
          build.onResolve({filter}, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });

  // this is bullshit, but works for now
  // TODO: actually parse out exports and stuff
  const manifest = {};
  for (const entryPoint of entryPoints) {
    const fullEntryPointPath = require.resolve('../' + entryPoint);
    // get content
    // get exports
    manifest['file://' + fullEntryPointPath] = {
      '': {
        id: `./${entryPoint}`,
        chunks: [],
        name: '',
      },
      '*': {
        id: `./${entryPoint}`,
        chunks: [],
        name: '*',
      },
      default: {
        id: `./${entryPoint}`,
        chunks: [],
        name: 'default',
      },
    };
  }

  await writeFile(
    './dist/react-client-manifest.json',
    JSON.stringify(manifest, null, '  ')
  );
}

run().then(
  () => {
    console.log('done!');
  },
  (error) => {
    console.error('oops!');
    console.error(error);
  }
);
