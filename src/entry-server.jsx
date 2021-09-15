import ReactDOMServer from 'react-dom/server'
import Html from './Html'
import ReactApp from './App.server'

const STREAM_ABORT_TIMEOUT_MS = 3000;
const DEFAULT_STATE = {
  selectedId: null,
  isEditing: false,
  searchText: '',
};

const getLocation = (req) => {
  let location = DEFAULT_STATE;
  location = {
    location,
    ...req.query
  };
  return location
}

export function render (
  url,
  {context, request, response, template}
) {
  const location = getLocation(request);
  if (context.redirectToId) {
    location.selectedId = redirectToId;
  }

  return ReactDOMServer.renderToString(
    <Html>
      <ReactApp
        {...{
          selectedId: location.selectedId,
          isEditing: location.isEditing,
          searchText: location.searchText,
        }}
      />
    </Html>
  );
}

export function stream (
  url,
  {context, request, response}
) {
  response.socket.on('error', (error) => {
    console.error('Fatal', error);
  });

  let didError = false;

  const location = getLocation(request);

  const {startWriting, abort} = ReactDOMServer.pipeToNodeWritable(
    <Html>
      <ReactApp
        {...{
          selectedId: location.selectedId,
          isEditing: location.isEditing,
          searchText: location.searchText,
        }}
      />
    </Html>,
    response,
    {
      onReadyToStream() {
        console.log('Stream onReadyToStream');

        response.statusCode = didError ? 500 : 200;
        response.setHeader('Content-type', 'text/html');
        response.write('<!DOCTYPE html>');
        startWriting();
      },
      onCompleteAll() {
        console.log('Stream onCompleteAll');
        // response.setHeader('Content-type', 'text/html');
        // response.write('<!DOCTYPE html>');
        // startWriting();
      },
      onError(error) {
        didError = true;
        console.error(error);
      },
    }
  );

  setTimeout(abort, STREAM_ABORT_TIMEOUT_MS);
};