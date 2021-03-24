'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react-server-dom-esbuild-writer.browser.production.min.server.js');
} else {
  module.exports = require('./cjs/react-server-dom-esbuild-writer.browser.development.server.js');
}
