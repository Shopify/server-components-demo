/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';

import express from 'express';
import compress from 'compression';
import {readFileSync} from 'fs';

import {pipeToNodeWritable} from 'react-server-dom-esbuild/writer';
import path from 'path';
import React from 'react';
import ReactApp from '../src/App.server';

import * as simple from '../src/simple-notes-db';

const PORT = 4000;
const app = express();

app.use(compress());
app.use(express.json());

app.listen(PORT, () => {
  console.log('React Notes listening at 4000...');
});

function handleErrors(fn) {
  return async function (req, res, next) {
    try {
      return await fn(req, res);
    } catch (x) {
      next(x);
    }
  };
}

app.get(
  '/',
  handleErrors(async function (_req, res) {
    const html = readFileSync(
      path.resolve(__dirname, '../public/index.html'),
      'utf8'
    );
    // Note: this is sending an empty HTML shell, like a client-side-only app.
    // However, the intended solution (which isn't built out yet) is to read
    // from the Server endpoint and turn its response into an HTML stream.
    res.send(html);
  })
);

async function renderReactTree(res, props) {
  const manifest = readFileSync(
    path.resolve(__dirname, './react-client-manifest.json'),
    'utf8'
  );
  const moduleMap = JSON.parse(manifest);
  pipeToNodeWritable(React.createElement(ReactApp, props), res, moduleMap);
}

function sendResponse(req, res, redirectToId) {
  const location = JSON.parse(req.query.location);
  if (redirectToId) {
    location.selectedId = redirectToId;
  }
  res.set('X-Location', JSON.stringify(location));
  renderReactTree(res, {
    selectedId: location.selectedId,
    isEditing: location.isEditing,
    searchText: location.searchText,
  });
}

app.get('/react', function (req, res) {
  sendResponse(req, res, null);
});

app.post(
  '/notes',
  handleErrors(async function (req, res) {
    const {title, body} = req.body;
    const note = await simple.create({title, body});
    const insertedId = note.id;
    sendResponse(req, res, insertedId);
  })
);

app.put(
  '/notes/:id',
  handleErrors(async function (req, res) {
    const updatedId = Number(req.params.id);
    const {title, body} = req.body;
    await simple.update({title, body, id: updatedId});
    sendResponse(req, res, null);
  })
);

app.delete(
  '/notes/:id',
  handleErrors(async function (req, res) {
    await simple.del(Number(req.params.id));
    sendResponse(req, res, null);
  })
);

app.get(
  '/notes',
  handleErrors(async function (_req, res) {
    const rows = await simple.list();
    res.json(rows);
  })
);

app.get(
  '/notes/:id',
  handleErrors(async function (req, res) {
    const row = await simple.read(Number(req.params.id));
    res.json(row);
  })
);

app.get('/sleep/:ms', function (req, res) {
  setTimeout(() => {
    res.json({ok: true});
  }, req.params.ms);
});

app.use(express.static('dist'));
app.use(express.static('public'));

app.on('error', function (error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});
