/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';

import express from 'express';
import morgan from 'morgan';
import compress from 'compression';
import {promises, readFileSync} from 'fs';

import {pipeToNodeWritable} from 'react-server-dom-esbuild/writer';
import path from 'path';
import {Pool} from 'pg';
import React from 'react';
import ReactApp from '../src/App.server';

const {unlink, writeFile} = promises;

import credentials from '../credentials';

// Don't keep credentials in the source tree in a real app!
const pool = new Pool(credentials);

const PORT = 4000;
const app = express();
app.use(morgan('dev'))

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

const NOTES_PATH = path.resolve(__dirname, '../notes');

app.post(
  '/notes',
  handleErrors(async function (req, res) {
    const now = new Date();
    const result = await pool.query(
      'insert into notes (title, body, created_at, updated_at) values ($1, $2, $3, $3) returning id',
      [req.body.title, req.body.body, now]
    );
    const insertedId = result.rows[0].id;
    await writeFile(
      path.resolve(NOTES_PATH, `${insertedId}.md`),
      req.body.body,
      'utf8'
    );
    sendResponse(req, res, insertedId);
  })
);

app.put(
  '/notes/:id',
  handleErrors(async function (req, res) {
    const now = new Date();
    const updatedId = Number(req.params.id);
    await pool.query(
      'update notes set title = $1, body = $2, updated_at = $3 where id = $4',
      [req.body.title, req.body.body, now, updatedId]
    );
    await writeFile(
      path.resolve(NOTES_PATH, `${updatedId}.md`),
      req.body.body,
      'utf8'
    );
    sendResponse(req, res, null);
  })
);

app.delete(
  '/notes/:id',
  handleErrors(async function (req, res) {
    await pool.query('delete from notes where id = $1', [req.params.id]);
    await unlink(path.resolve(NOTES_PATH, `${req.params.id}.md`));
    sendResponse(req, res, null);
  })
);

app.get(
  '/notes',
  handleErrors(async function (_req, res) {
    const {rows} = await pool.query('select * from notes order by id desc');
    res.json(rows);
  })
);

app.get(
  '/notes/:id',
  handleErrors(async function (req, res) {
    const {rows} = await pool.query('select * from notes where id = $1', [
      req.params.id,
    ]);
    res.json(rows[0]);
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
