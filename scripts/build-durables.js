// todo: lint rule preventing anyhing but .durable inside load(() => )

const fetch = require('node-fetch');

const rollup = require('rollup');
const path = require('path');
const rimraf = require('rimraf');
const hash = require('./hash');
const fs = require('fs');

const sh = require('shelljs');

const PREFIX = `\0durable:`;

const ACCOUNT_TAG = '1fc1df98cc4420fe00367c3ab68c1639';
const DURABLE_SCRIPT_NAME = 'counter-durable';
const CALLING_SCRIPT_NAME = 'counter-worker';
const API_TOKEN = 'ADD API TOKEN HERE';

let references = fs.existsSync('./durable.json')
  ? JSON.parse(fs.readFileSync('./durable.json'))
  : {};

async function buildWorker(input) {
  function durablePlugin() {
    return {
      name: '@durable',
      resolveId(source) {
        if (
          source.endsWith('.durable') ||
          source.endsWith('.durable.js') ||
          source.endsWith('.durable.ts') ||
          source.endsWith('.durable.mjs')
        ) {
          return PREFIX + source;
        }
        return null;
      },
      load(id) {
        if (id.startsWith(PREFIX)) {
          // todo: how would this work with third-party deps?
          // todo: how would this work with workspaces?
          // todo: how would this work with pnp?
          id = id.slice(PREFIX.length);

          const module = require.resolve(id);
          let name = path.basename(module);
          name = name.slice(0, name.indexOf('.durable'));
          name = name[0].toUpperCase() + name.slice(1).toLowerCase();

          // todo: this should probably be relative to the file that included it?
          const suffix = hash(
            path.relative(path.dirname(require.resolve(input)), module)
          );
          const namespace = `${name}_${suffix}`;
          if (references[id]) {
            console.log(id, 'already registered? nothing to do here.');
          } else {
            references[id] = {
              name,
              namespace,
            };
          }
          return `export default "${namespace}"`;
        }
        return null;
      },
    };
  }
  const inputOptions = {
    input,
    treeshake: {
      propertyReadSideEffects: false,
    },
    plugins: [durablePlugin()],
  };

  const outputOptions = {
    file: 'dist/worker.mjs',
    freeze: false,
    format: 'es',
    // sourcemap: true,
    // exports: "named",
    inlineDynamicImports: true,
  };

  const bundle = await rollup.rollup(inputOptions);
  await bundle.write(outputOptions);
}

async function buildDurable() {
  let script = '';
  for (let id of Object.keys(references)) {
    script += `export { default as ${references[id].namespace} } from "${id}";\n`;

    script += `
    
// we need to add this for *reasons*
export default {
  async fetch(request, env) {
      return new Response("ignore me");
  }
}
    `;
  }
  const input = './durable.input.js';
  fs.writeFileSync(input, script);

  const inputOptions = {
    input,
    treeshake: {
      propertyReadSideEffects: false,
    },
  };
  const outputOptions = {
    file: 'dist/durable.mjs',
    freeze: false,
    format: 'es',
    // sourcemap: true,
    // exports: "named",
    inlineDynamicImports: true,
  };
  const bundle = await rollup.rollup(inputOptions);
  await bundle.write(outputOptions);

  fs.unlinkSync(input);
}

async function deploy() {
  // step 1: uploading durable.mjs
  // durable-object-example.json
  // {
  //   "main_module": "durable-object-example.mjs"
  // }

  // curl -i
  // -H "Authorization: Bearer ${API_TOKEN}"
  // "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/scripts/${SCRIPT_NAME}"
  // -X PUT
  // -F "metadata=@durable-object-example.json;type=application/json"
  // -F "script=@durable-object-example.mjs;type=application/javascript+module"

  {
    console.log('step 1');
    fs.writeFileSync(
      './dist/durable-metadata.json',
      JSON.stringify({main_module: 'durable.mjs'})
    );

    sh.pushd('./dist');

    sh.exec(
      `curl -i -H "Authorization: Bearer ${API_TOKEN}" \
      "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/scripts/${DURABLE_SCRIPT_NAME}" \
      -X PUT \
      -F "metadata=@durable-metadata.json;type=application/json" \
      -F "script=@durable.mjs;type=application/javascript+module"`
    );
    sh.popd();
  }

  // step 2: getting namespace ids for each class
  // curl -i
  // -H "Authorization: Bearer ${API_TOKEN}"
  // "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/durable_objects/namespaces"
  // -X POST
  // --data "{\"name\": \"example-class\", \"script\": \"${SCRIPT_NAME}\", \"class\": \"DurableObjectExample\"}"
  //
  // repeat this for every class in the file. save the ids it returns, update durable.json.
  // (what the hell is "example-class"?)

  console.log('step 2');

  for (let key in references) {
    // TODO: could check if id is already available here before even checking
    const data = JSON.stringify({
      name: references[key].name,
      script: DURABLE_SCRIPT_NAME,
      class: references[key].namespace,
    });

    const checkResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/durable_objects/namespaces`,
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      }
    );
    const checkResult = await checkResponse.json();
    if (checkResult.success === true) {
      const record = checkResult.result.find(
        (x) => x.class === references[key].namespace
      );
      if (record) {
        references[key].id = record.id;
        console.log(`${key} already registered, skipping`);
      } else {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/durable_objects/namespaces`,
          {
            headers: {
              Authorization: `Bearer ${API_TOKEN}`,
            },
            method: 'POST',
            body: JSON.stringify({
              name: references[key].name,
              script: DURABLE_SCRIPT_NAME,
              class: references[key].namespace,
            }),
          }
        );
        const nsResponse = await response.json();
        if (nsResponse.success === true) {
          references[key].id = nsResponse.result.id;
        } else {
          console.error(`failed to register ${key}`);
          console.log(nsResponse);
          return;
        }
      }

      // set this anyway
    } else {
      console.error('failed to fetch registered namespace, bailing');
      return;
    }
  }

  // step 3: uploading worker.mjs and binding to namespaces
  // calling-worker.json
  // {
  //   "body_part": "script",
  //   "bindings": [
  //     {
  //       "type": "durable_object_namespace",
  //       "name": "EXAMPLE_CLASS",
  //       "namespace_id": <the namespace id from above>
  //     }
  //   ]
  // }
  //
  // curl -i
  // -H "Authorization: Bearer ${API_TOKEN}"
  // "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/scripts/${CALLING_SCRIPT_NAME}"
  // -X PUT
  // -F "metadata=@calling-worker.json;type=application/json"
  // -F "script=@calling-worker.js;type=application/javascript+module"

  {
    console.log('step 3');
    const metadata = JSON.stringify({
      main_module: 'worker.mjs',
      bindings: Object.keys(references).map((key) => ({
        type: 'durable_object_namespace',
        name: references[key].namespace,
        namespace_id: references[key].id,
      })),
    });

    fs.writeFileSync('./dist/calling-worker.json', metadata);
    sh.pushd('./dist');
    const bindingResponse = sh.exec(`
    curl -i \
    -H "Authorization: Bearer ${API_TOKEN}" \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_TAG}/workers/scripts/${CALLING_SCRIPT_NAME}" \
    -X PUT \
    -F "metadata=@calling-worker.json;type=application/json" \
    -F "script=@worker.mjs;type=application/javascript+module"
    `);
    sh.popd();
  }
}

async function run() {
  rimraf.sync('dist');

  await buildWorker('./counter.worker.js');

  await buildDurable();

  await deploy();

  // write the references to disk
  fs.writeFileSync('./durable.json', JSON.stringify(references, null, '  '));
}

run();
