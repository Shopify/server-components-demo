import ReactDOMServer from 'react-dom/server'
import { pipeToNodeWritable as rscPipeToWritable } from './react-server-dom-webpack/writer.node.server'
import Html from './Html'
import ReactApp from './App.server'

const STREAM_ABORT_TIMEOUT_MS = 3000;
const DEFAULT_STATE = {
  selectedId: null,
  isEditing: false,
  searchText: '',
};

const getLocation = (url) => {
  let location = DEFAULT_STATE;

  if (url instanceof  URL) {
    const query = url.searchParams;
    location = {
      ...location,
      ...JSON.parse(query.get('location'))
    }
  }
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
  {context, request, response, bundlerConfig}
) {
  response.socket.on('error', (error) => {
    console.error('Fatal', error);
  });

  let didError = false;

  const location = getLocation(request);

  const {startWriting, abort} = ReactDOMServer.pipeToNodeWritable(
    <Html>
      {/* <ReactApp
        {...{
          selectedId: location.selectedId,
          isEditing: location.isEditing,
          searchText: location.searchText,
        }}
      /> */}
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

export function hydrate (url, {context, request, response, bundlerConfig}) {
  const location = getLocation(url);

  console.log(location);

  response.socket.on('error', (error) => {
    console.error('Fatal', error);
  });

  let didError = false;

  rscPipeToWritable(
    <ReactApp
      {...{
        selectedId: location.selectedId,
        isEditing: location.isEditing,
        searchText: location.searchText,
      }}
    />,
    response,
    bundlerConfig,
    {
      /**
       * When hydrating, we have to wait until `onCompleteAll` to avoid having
       * `template` and `script` tags inserted and rendered as part of the hydration response.
       */
      onCompleteAll() {
        // Tell React to start writing to the writer
        // startWriting();

        // response.statusCode = didError ? 500 : 200;
        // response.end();
        // generateWireSyntaxFromRenderedHtml(response.toString())
      },
      onError(error) {
        didError = true;
        console.error(error);
      },
    }
  );

  // setTimeout(abort, STREAM_ABORT_TIMEOUT_MS);
};