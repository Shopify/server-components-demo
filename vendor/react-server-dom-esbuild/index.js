'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react-server-dom-esbuild.production.min.js');
} else {
  module.exports = require('./cjs/react-server-dom-esbuild.development.js');
}
