'use strict';

const esbuild = require('esbuild');
const rimraf = require('rimraf');
const child_process = require('child_process');
const {writeFileSync, readdirSync, fstat, copyFileSync} = require('fs');
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
      '.html': 'text',
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

  writeFileSync(
    './dist/react-client-manifest.json',
    JSON.stringify(manifest, null, '  ')
  );

  // copy everything from public into dist
  readdirSync('./public').forEach((file) => {
    copyFileSync('./public/' + file, './dist/' + file);
  });

  console.log('built client');

  const {outputs} = client.metafile;

  const server = await esbuild.build({
    entryPoints: ['./server/api.cloudflare.js'],
    platform: 'node',
    format: 'iife',
    sourcemap: true,
    sourcesContent: true,
    bundle: true,
    metafile: true,
    outdir: 'dist_server',
    loader: {
      '.js': 'jsx',
      '.html': 'text',
    },
    conditions: ['react-server'],
    inject: ['./src/react-shim.js', './scripts/Buffer.js'],
    minify: environment === 'production',
    define: {
      'process.env.NODE_ENV': `"${environment}"`,
    },
    nodePaths: ['vendor', 'node_modules'],
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
                }`,
              loader: 'js',
            };
          });
        },
      },
      NodeModulesPolyfills.default(),
      // {
      //   name: 'make-all-packages-external',
      //   setup(build) {
      //     let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/; // Must not start with "/" or "./" or "../"
      //     build.onResolve({filter}, (args) => ({
      //       path: args.path,
      //       external: true,
      //     }));
      //   },
      // },
    ],
  });
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
