/** @license React vundefined
 * react-server-dom-esbuild-plugin.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

'use strict';

// TODO: this needs types, ofc
function Client() {
  return {
    name: 'react-flight-client',
    setup: function (build) {
      build.onResolve({
        filter: /\.server$/
      }, function (args) {
        // just throw an error, it shouldn't never get here
        throw new Error("You imported a *.server.js fromn inside a client bundle, that's kinda weird");
      });
    }
  };
}
function Server(metafile) {
  return {
    name: 'react-flight-server',
    setup: function (build) {
      build.onLoad({
        filter: /\.client\.js$/
      }, async function (args) {
        var outputKey = Object.keys(metafile.outputs).find(function (chunkPath) {
          if (metafile.outputs[chunkPath].entryPoint) {
            return args.path === require.resolve('../' + metafile.outputs[chunkPath].entryPoint);
          }

          return false;
        });
        return {
          contents: "\n            const MODULE_REFERENCE = Symbol.for('react.module.reference');\n            export default {\n              $$typeof: MODULE_REFERENCE, \n              filepath: '" + outputKey.replace('dist.client', '') + "',\n              name: 'default'\n            }\n\n            ",
          loader: 'js'
        };
      });
    }
  };
}

exports.Client = Client;
exports.Server = Server;
