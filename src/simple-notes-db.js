let NOTES = [
  {
    id: 5,
    created_at: '2021-03-24T03:36:36.381Z',
    updated_at: '2021-03-24T14:27:57.084Z',
    title: 'Add a new note',
    body: 'This was done on an esbuild server! Surprise surprise!',
  },
  {
    id: 4,
    created_at: '2021-03-20T09:18:41.808Z',
    updated_at: '2021-03-24T13:54:38.538Z',
    title: 'I wrote this note today',
    body: 'It was an excellent note!',
  },
  {
    id: 3,
    created_at: '2021-01-15T18:10:58.981Z',
    updated_at: '2021-03-24T03:36:19.404Z',
    title: 'Make a thing',
    body:
      "It's very easy to make some words **bold** and other words *italic* with\nMarkdown. You can even [link to React's website!](https://www.reactjs.org).",
  },
  {
    id: 2,
    created_at: '2021-01-15T20:51:36.095Z',
    updated_at: '2021-01-15T20:51:36.095Z',
    title:
      'A note with a very long title because sometimes you need more words',
    body:
      'You can write all kinds of [amazing](https://en.wikipedia.org/wiki/The_Amazing)\nnotes in this app! These note live on the server in the `notes` folder.\n\n![This app is powered by React](https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/React_Native_Logo.png/800px-React_Native_Logo.png)',
  },
  {
    id: 1,
    created_at: '2021-02-02T11:15:09.750Z',
    updated_at: '2021-02-02T11:15:09.750Z',
    title: 'Meeting Notes',
    body: 'This is an example note. It contains **Markdown**!',
  },
];

function sleep(n = Math.random()) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

let id = 5;

export async function create({title, body}) {
  await sleep();
  const now = new Date().toISOString();
  id++;
  const note = {
    created_at: now,
    updated_at: now,
    title,
    body,
    id,
  };
  NOTES.unshift(note);
  return note;
}

export async function read(id) {
  await sleep();
  return NOTES.find((x) => x.id === id);
}

export async function update({id, title, body}) {
  await sleep();
  const note = NOTES.find((x) => x.id === id);
  const now = new Date().toISOString();
  Object.assign(note, {title, body, updated_at: now});
}

export async function del(id) {
  NOTES = NOTES.filter((note) => note.id !== id);
  await sleep();
}

export async function list() {
  await sleep();
  return NOTES; // TODO: sort?
}

// eh, keep this simple for now
export function reactList() {
  return NOTES;
}

export function reactRead(id) {
  return NOTES.find((x) => x.id === id);
}
