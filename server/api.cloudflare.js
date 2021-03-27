'use strict';

import {Router} from 'itty-router';
import {pipeToNodeWritable} from 'react-server-dom-esbuild/cjs/react-server-dom-esbuild-writer.node.production.min.server.js';
import React from 'react';
import ReactApp from '../src/App.server';
import * as simple from '../src/simple-notes-db';

// import html from '../public/index.html';
import manifest from '../dist/react-client-manifest.json';
import {Transform} from 'stream';

// create a router
const app = Router(); // this is a Proxy, not a class

function handleErrors() {}

function sleep(n) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

// home page html
app.get('/', async () => {
  const html = await import('../public/index.html'); // can't wait for import assertions so this behaviour would be standardised
  // console.log(html);
  return new Response(html.default, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  });
});

async function sendResponse(req, redirectToId) {
  const location = JSON.parse(req.query.location);
  if (redirectToId) {
    location.selectedId = redirectToId;
  }

  const res = await new Promise((resolve) => {
    let acc = '';
    const transform = new Transform({
      transform(chunk, encoding, callback) {
        acc += chunk.toString();
        callback(null, chunk.toString());
      },
    });

    transform.on('finish', () => {
      resolve(acc);
    });
    pipeToNodeWritable(
      React.createElement(ReactApp, {
        selectedId: location.selectedId,
        isEditing: location.isEditing,
        searchText: location.searchText,
      }),
      transform,
      manifest
    );
  });

  return new Response(res, {
    status: 200,
    headers: {
      'X-Location': JSON.stringify(location),
      'content-type': 'text/html;charset=UTF-8',
    },
  });
}

app.get('/react', async (req) => {
  return await sendResponse(req, null);
});

app.post('/notes', async (req) => {
  const {title, body} = req.body;
  const note = await simple.create({title, body});
  const insertedId = note.id;
  return await sendResponse(insertedId);
});

app.put('/notes/:id', async (req) => {
  const now = new Date();
  const updatedId = Number(req.params.id);
  const {title, body} = req.body;
  await simple.update({title, body, id: updatedId});
  return await sendResponse(req, null);
});

app.delete('/notes/:id', async (req) => {
  await simple.del(Number(req.params.id));
  return await sendResponse(req, null);
});

app.get('/notes', async (req) => {
  const rows = await simple.list();
  return new Response(JSON.stringify(rows), {
    headers: {
      'content-type': 'application/json',
    },
  });
});

app.get('/notes/:id', async (req) => {
  const row = await simple.read(Number(req.params.id));
  return new Response(JSON.stringify(row), {
    headers: {
      'content-type': 'application/json',
    },
  });
});

app.get('/sleep/:ms', async function (req) {
  await new Promise((resolve) => setTimeout(resolve, req.params.ms));
  return new Response(JSON.stringify({ok: true}), {
    headers: {
      'content-type': 'application/json',
    },
  });
});

app.get('*', async (request) => {
  const url = new URL(request.url);
  const target = '6a70e5b1.server-components-demo.pages.dev';
  url.hostname = target;
  return await fetch(url.toString(), request);
});

// attach the router "handle" to the event handler
addEventListener('fetch', (event) =>
  event.respondWith(app.handle(event.request))
);
