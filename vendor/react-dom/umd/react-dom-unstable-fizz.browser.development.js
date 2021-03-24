/** @license React vundefined
 * react-dom-unstable-fizz.browser.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = global || self, factory(global.ReactDOMFizzServer = {}, global.React));
}(this, (function (exports, React) { 'use strict';

  var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

  function error(format) {
    {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      printWarning('error', format, args);
    }
  }

  function printWarning(level, format, args) {
    // When changing this logic, you might want to also
    // update consoleWithStackDev.www.js as well.
    {
      var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
      var stack = ReactDebugCurrentFrame.getStackAddendum();

      if (stack !== '') {
        format += '%s';
        args = args.concat([stack]);
      }

      var argsWithFormat = args.map(function (item) {
        return '' + item;
      }); // Careful: RN currently depends on this prefix

      argsWithFormat.unshift('Warning: ' + format); // We intentionally don't use spread (or .apply) directly because it
      // breaks IE9: https://github.com/facebook/react/issues/13610
      // eslint-disable-next-line react-internal/no-production-logging

      Function.prototype.apply.call(console[level], console, argsWithFormat);
    }
  }

  function scheduleWork(callback) {
    callback();
  }
  function beginWriting(destination) {}
  function writeChunk(destination, chunk) {
    destination.enqueue(chunk);
    return destination.desiredSize > 0;
  }
  function completeWriting(destination) {}
  function close(destination) {
    destination.close();
  }
  var textEncoder = new TextEncoder();
  function stringToChunk(content) {
    return textEncoder.encode(content);
  }
  function stringToPrecomputedChunk(content) {
    return textEncoder.encode(content);
  }
  function closeWithError(destination, error) {
    if (typeof destination.error === 'function') {
      // $FlowFixMe: This is an Error object or the destination accepts other types.
      destination.error(error);
    } else {
      // Earlier implementations doesn't support this method. In that environment you're
      // supposed to throw from a promise returned but we don't return a promise in our
      // approach. We could fork this implementation but this is environment is an edge
      // case to begin with. It's even less common to run this in an older environment.
      // Even then, this is not where errors are supposed to happen and they get reported
      // to a global callback in addition to this anyway. So it's fine just to close this.
      destination.close();
    }
  }

  // code copied and modified from escape-html

  /**
   * Module variables.
   * @private
   */
  var matchHtmlRegExp = /["'&<>]/;
  /**
   * Escapes special characters and HTML entities in a given html string.
   *
   * @param  {string} string HTML string to escape for later insertion
   * @return {string}
   * @public
   */

  function escapeHtml(string) {
    var str = '' + string;
    var match = matchHtmlRegExp.exec(str);

    if (!match) {
      return str;
    }

    var escape;
    var html = '';
    var index;
    var lastIndex = 0;

    for (index = match.index; index < str.length; index++) {
      switch (str.charCodeAt(index)) {
        case 34:
          // "
          escape = '&quot;';
          break;

        case 38:
          // &
          escape = '&amp;';
          break;

        case 39:
          // '
          escape = '&#x27;'; // modified from escape-html; used to be '&#39'

          break;

        case 60:
          // <
          escape = '&lt;';
          break;

        case 62:
          // >
          escape = '&gt;';
          break;

        default:
          continue;
      }

      if (lastIndex !== index) {
        html += str.substring(lastIndex, index);
      }

      lastIndex = index + 1;
      html += escape;
    }

    return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
  } // end code copied and modified from escape-html

  /**
   * Escapes text to prevent scripting attacks.
   *
   * @param {*} text Text value to escape.
   * @return {string} An escaped string.
   */


  function escapeTextForBrowser(text) {
    if (typeof text === 'boolean' || typeof text === 'number') {
      // this shortcircuit helps perf for types that we know will never have
      // special characters, especially given that this function is used often
      // for numeric dom ids.
      return '' + text;
    }

    return escapeHtml(text);
  }

  // Allows us to keep track of what we've already written so we can refer back to it.
  function createResponseState() {
    var identifierPrefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    return {
      placeholderPrefix: stringToPrecomputedChunk(identifierPrefix + 'P:'),
      segmentPrefix: stringToPrecomputedChunk(identifierPrefix + 'S:'),
      boundaryPrefix: identifierPrefix + 'B:',
      opaqueIdentifierPrefix: stringToPrecomputedChunk(identifierPrefix + 'R:'),
      nextSuspenseID: 0,
      sentCompleteSegmentFunction: false,
      sentCompleteBoundaryFunction: false,
      sentClientRenderFunction: false
    };
  } // This object is used to lazily reuse the ID of the first generated node, or assign one.
  // We can't assign an ID up front because the node we're attaching it to might already
  // have one. So we need to lazily use that if it's available.

  function createSuspenseBoundaryID(responseState) {
    return {
      formattedID: null
    };
  }

  function encodeHTMLIDAttribute(value) {
    return escapeTextForBrowser(value);
  }

  function encodeHTMLTextNode(text) {
    return escapeTextForBrowser(text);
  }

  function assignAnID(responseState, id) {
    // TODO: This approach doesn't yield deterministic results since this is assigned during render.
    var generatedID = responseState.nextSuspenseID++;
    return id.formattedID = stringToPrecomputedChunk(responseState.boundaryPrefix + generatedID.toString(16));
  }

  var dummyNode1 = stringToPrecomputedChunk('<span hidden id="');
  var dummyNode2 = stringToPrecomputedChunk('"></span>');

  function pushDummyNodeWithID(target, responseState, assignID) {
    var id = assignAnID(responseState, assignID);
    target.push(dummyNode1, id, dummyNode2);
  }

  function pushEmpty(target, responseState, assignID) {
    if (assignID !== null) {
      pushDummyNodeWithID(target, responseState, assignID);
    }
  }
  function pushTextInstance(target, text, responseState, assignID) {
    if (assignID !== null) {
      pushDummyNodeWithID(target, responseState, assignID);
    }

    target.push(stringToChunk(encodeHTMLTextNode(text)));
  }
  var startTag1 = stringToPrecomputedChunk('<');
  var startTag2 = stringToPrecomputedChunk('>');
  var idAttr = stringToPrecomputedChunk(' id="');
  var attrEnd = stringToPrecomputedChunk('"');
  function pushStartInstance(target, type, props, responseState, assignID) {
    // TODO: Figure out if it's self closing and everything else.
    if (assignID !== null) {
      var encodedID;

      if (typeof props.id === 'string') {
        // We can reuse the existing ID for our purposes.
        encodedID = assignID.formattedID = stringToPrecomputedChunk(encodeHTMLIDAttribute(props.id));
      } else {
        encodedID = assignAnID(responseState, assignID);
      }

      target.push(startTag1, stringToChunk(type), idAttr, encodedID, attrEnd, startTag2);
    } else {
      target.push(startTag1, stringToChunk(type), startTag2);
    }
  }
  var endTag1 = stringToPrecomputedChunk('</');
  var endTag2 = stringToPrecomputedChunk('>');
  function pushEndInstance(target, type, props) {
    // TODO: Figure out if it was self closing.
    target.push(endTag1, stringToChunk(type), endTag2);
  } // Structural Nodes
  // A placeholder is a node inside a hidden partial tree that can be filled in later, but before
  // display. It's never visible to users.

  var placeholder1 = stringToPrecomputedChunk('<span id="');
  var placeholder2 = stringToPrecomputedChunk('"></span>');
  function writePlaceholder(destination, responseState, id) {
    // TODO: This needs to be contextually aware and switch tag since not all parents allow for spans like
    // <select> or <tbody>. E.g. suspending a component that renders a table row.
    writeChunk(destination, placeholder1);
    writeChunk(destination, responseState.placeholderPrefix);
    var formattedID = stringToChunk(id.toString(16));
    writeChunk(destination, formattedID);
    return writeChunk(destination, placeholder2);
  } // Suspense boundaries are encoded as comments.

  var startCompletedSuspenseBoundary = stringToPrecomputedChunk('<!--$-->');
  var startPendingSuspenseBoundary = stringToPrecomputedChunk('<!--$?-->');
  var startClientRenderedSuspenseBoundary = stringToPrecomputedChunk('<!--$!-->');
  var endSuspenseBoundary = stringToPrecomputedChunk('<!--/$-->');
  function writeStartCompletedSuspenseBoundary(destination, id) {
    return writeChunk(destination, startCompletedSuspenseBoundary);
  }
  function writeStartPendingSuspenseBoundary(destination, id) {
    return writeChunk(destination, startPendingSuspenseBoundary);
  }
  function writeStartClientRenderedSuspenseBoundary(destination, id) {
    return writeChunk(destination, startClientRenderedSuspenseBoundary);
  }
  function writeEndSuspenseBoundary(destination) {
    return writeChunk(destination, endSuspenseBoundary);
  }
  var startSegment = stringToPrecomputedChunk('<div hidden id="');
  var startSegment2 = stringToPrecomputedChunk('">');
  var endSegment = stringToPrecomputedChunk('</div>');
  function writeStartSegment(destination, responseState, id) {
    // TODO: What happens with special children like <tr> if they're inserted in a div? Maybe needs contextually aware containers.
    writeChunk(destination, startSegment);
    writeChunk(destination, responseState.segmentPrefix);
    var formattedID = stringToChunk(id.toString(16));
    writeChunk(destination, formattedID);
    return writeChunk(destination, startSegment2);
  }
  function writeEndSegment(destination) {
    return writeChunk(destination, endSegment);
  } // Instruction Set
  // The following code is the source scripts that we then minify and inline below,
  // with renamed function names that we hope don't collide:
  // const COMMENT_NODE = 8;
  // const SUSPENSE_START_DATA = '$';
  // const SUSPENSE_END_DATA = '/$';
  // const SUSPENSE_PENDING_START_DATA = '$?';
  // const SUSPENSE_FALLBACK_START_DATA = '$!';
  //
  // function clientRenderBoundary(suspenseBoundaryID) {
  //   // Find the fallback's first element.
  //   let suspenseNode = document.getElementById(suspenseBoundaryID);
  //   if (!suspenseNode) {
  //     // The user must have already navigated away from this tree.
  //     // E.g. because the parent was hydrated.
  //     return;
  //   }
  //   // Find the boundary around the fallback. This might include text nodes.
  //   do {
  //     suspenseNode = suspenseNode.previousSibling;
  //   } while (
  //     suspenseNode.nodeType !== COMMENT_NODE ||
  //     suspenseNode.data !== SUSPENSE_PENDING_START_DATA
  //   );
  //   // Tag it to be client rendered.
  //   suspenseNode.data = SUSPENSE_FALLBACK_START_DATA;
  //   // Tell React to retry it if the parent already hydrated.
  //   if (suspenseNode._reactRetry) {
  //     suspenseNode._reactRetry();
  //   }
  // }
  //
  // function completeBoundary(suspenseBoundaryID, contentID) {
  //   // Find the fallback's first element.
  //   let suspenseNode = document.getElementById(suspenseBoundaryID);
  //   const contentNode = document.getElementById(contentID);
  //   // We'll detach the content node so that regardless of what happens next we don't leave in the tree.
  //   // This might also help by not causing recalcing each time we move a child from here to the target.
  //   contentNode.parentNode.removeChild(contentNode);
  //   if (!suspenseNode) {
  //     // The user must have already navigated away from this tree.
  //     // E.g. because the parent was hydrated. That's fine there's nothing to do
  //     // but we have to make sure that we already deleted the container node.
  //     return;
  //   }
  //   // Find the boundary around the fallback. This might include text nodes.
  //   do {
  //     suspenseNode = suspenseNode.previousSibling;
  //   } while (
  //     suspenseNode.nodeType !== COMMENT_NODE ||
  //     suspenseNode.data !== SUSPENSE_PENDING_START_DATA
  //   );
  //
  //   // Clear all the existing children. This is complicated because
  //   // there can be embedded Suspense boundaries in the fallback.
  //   // This is similar to clearSuspenseBoundary in ReactDOMHostConfig.
  //   // TOOD: We could avoid this if we never emitted suspense boundaries in fallback trees.
  //   // They never hydrate anyway. However, currently we support incrementally loading the fallback.
  //   const parentInstance = suspenseNode.parentNode;
  //   let node = suspenseNode.nextSibling;
  //   let depth = 0;
  //   do {
  //     if (node && node.nodeType === COMMENT_NODE) {
  //       const data = node.data;
  //       if (data === SUSPENSE_END_DATA) {
  //         if (depth === 0) {
  //           break;
  //         } else {
  //           depth--;
  //         }
  //       } else if (
  //         data === SUSPENSE_START_DATA ||
  //         data === SUSPENSE_PENDING_START_DATA ||
  //         data === SUSPENSE_FALLBACK_START_DATA
  //       ) {
  //         depth++;
  //       }
  //     }
  //
  //     const nextNode = node.nextSibling;
  //     parentInstance.removeChild(node);
  //     node = nextNode;
  //   } while (node);
  //
  //   const endOfBoundary = node;
  //
  //   // Insert all the children from the contentNode between the start and end of suspense boundary.
  //   while (contentNode.firstChild) {
  //     parentInstance.insertBefore(contentNode.firstChild, endOfBoundary);
  //   }
  //   suspenseNode.data = SUSPENSE_START_DATA;
  //   if (suspenseNode._reactRetry) {
  //     suspenseNode._reactRetry();
  //   }
  // }
  //
  // function completeSegment(containerID, placeholderID) {
  //   const segmentContainer = document.getElementById(containerID);
  //   const placeholderNode = document.getElementById(placeholderID);
  //   // We always expect both nodes to exist here because, while we might
  //   // have navigated away from the main tree, we still expect the detached
  //   // tree to exist.
  //   segmentContainer.parentNode.removeChild(segmentContainer);
  //   while (segmentContainer.firstChild) {
  //     placeholderNode.parentNode.insertBefore(
  //       segmentContainer.firstChild,
  //       placeholderNode,
  //     );
  //   }
  //   placeholderNode.parentNode.removeChild(placeholderNode);
  // }

  var completeSegmentFunction = 'function $RS(b,f){var a=document.getElementById(b),c=document.getElementById(f);for(a.parentNode.removeChild(a);a.firstChild;)c.parentNode.insertBefore(a.firstChild,c);c.parentNode.removeChild(c)}';
  var completeBoundaryFunction = 'function $RC(b,f){var a=document.getElementById(b),c=document.getElementById(f);c.parentNode.removeChild(c);if(a){do a=a.previousSibling;while(8!==a.nodeType||"$?"!==a.data);var h=a.parentNode,d=a.nextSibling,g=0;do{if(d&&8===d.nodeType){var e=d.data;if("/$"===e)if(0===g)break;else g--;else"$"!==e&&"$?"!==e&&"$!"!==e||g++}e=d.nextSibling;h.removeChild(d);d=e}while(d);for(;c.firstChild;)h.insertBefore(c.firstChild,d);a.data="$";a._reactRetry&&a._reactRetry()}}';
  var clientRenderFunction = 'function $RX(b){if(b=document.getElementById(b)){do b=b.previousSibling;while(8!==b.nodeType||"$?"!==b.data);b.data="$!";b._reactRetry&&b._reactRetry()}}';
  var completeSegmentScript1Full = stringToPrecomputedChunk('<script>' + completeSegmentFunction + ';$RS("');
  var completeSegmentScript1Partial = stringToPrecomputedChunk('<script>$RS("');
  var completeSegmentScript2 = stringToPrecomputedChunk('","');
  var completeSegmentScript3 = stringToPrecomputedChunk('")</script>');
  function writeCompletedSegmentInstruction(destination, responseState, contentSegmentID) {
    if (!responseState.sentCompleteSegmentFunction) {
      // The first time we write this, we'll need to include the full implementation.
      responseState.sentCompleteSegmentFunction = true;
      writeChunk(destination, completeSegmentScript1Full);
    } else {
      // Future calls can just reuse the same function.
      writeChunk(destination, completeSegmentScript1Partial);
    }

    writeChunk(destination, responseState.segmentPrefix);
    var formattedID = stringToChunk(contentSegmentID.toString(16));
    writeChunk(destination, formattedID);
    writeChunk(destination, completeSegmentScript2);
    writeChunk(destination, responseState.placeholderPrefix);
    writeChunk(destination, formattedID);
    return writeChunk(destination, completeSegmentScript3);
  }
  var completeBoundaryScript1Full = stringToPrecomputedChunk('<script>' + completeBoundaryFunction + ';$RC("');
  var completeBoundaryScript1Partial = stringToPrecomputedChunk('<script>$RC("');
  var completeBoundaryScript2 = stringToPrecomputedChunk('","');
  var completeBoundaryScript3 = stringToPrecomputedChunk('")</script>');
  function writeCompletedBoundaryInstruction(destination, responseState, boundaryID, contentSegmentID) {
    if (!responseState.sentCompleteBoundaryFunction) {
      // The first time we write this, we'll need to include the full implementation.
      responseState.sentCompleteBoundaryFunction = true;
      writeChunk(destination, completeBoundaryScript1Full);
    } else {
      // Future calls can just reuse the same function.
      writeChunk(destination, completeBoundaryScript1Partial);
    }

    var formattedBoundaryID = boundaryID.formattedID;

    if (!(formattedBoundaryID !== null)) {
      {
        throw Error( "An ID must have been assigned before we can complete the boundary." );
      }
    }

    var formattedContentID = stringToChunk(contentSegmentID.toString(16));
    writeChunk(destination, formattedBoundaryID);
    writeChunk(destination, completeBoundaryScript2);
    writeChunk(destination, responseState.segmentPrefix);
    writeChunk(destination, formattedContentID);
    return writeChunk(destination, completeBoundaryScript3);
  }
  var clientRenderScript1Full = stringToPrecomputedChunk('<script>' + clientRenderFunction + ';$RX("');
  var clientRenderScript1Partial = stringToPrecomputedChunk('<script>$RX("');
  var clientRenderScript2 = stringToPrecomputedChunk('")</script>');
  function writeClientRenderBoundaryInstruction(destination, responseState, boundaryID) {
    if (!responseState.sentClientRenderFunction) {
      // The first time we write this, we'll need to include the full implementation.
      responseState.sentClientRenderFunction = true;
      writeChunk(destination, clientRenderScript1Full);
    } else {
      // Future calls can just reuse the same function.
      writeChunk(destination, clientRenderScript1Partial);
    }

    var formattedBoundaryID = boundaryID.formattedID;

    if (!(formattedBoundaryID !== null)) {
      {
        throw Error( "An ID must have been assigned before we can complete the boundary." );
      }
    }

    writeChunk(destination, formattedBoundaryID);
    return writeChunk(destination, clientRenderScript2);
  }

  // ATTENTION
  // When adding new symbols to this file,
  // Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
  // The Symbol used to tag the ReactElement-like types. If there is no native Symbol
  // nor polyfill, then a plain number is used for performance.
  var REACT_ELEMENT_TYPE = 0xeac7;
  var REACT_PORTAL_TYPE = 0xeaca;
  var REACT_FRAGMENT_TYPE = 0xeacb;
  var REACT_STRICT_MODE_TYPE = 0xeacc;
  var REACT_PROFILER_TYPE = 0xead2;
  var REACT_PROVIDER_TYPE = 0xeacd;
  var REACT_CONTEXT_TYPE = 0xeace;
  var REACT_FORWARD_REF_TYPE = 0xead0;
  var REACT_SUSPENSE_TYPE = 0xead1;
  var REACT_SUSPENSE_LIST_TYPE = 0xead8;
  var REACT_MEMO_TYPE = 0xead3;
  var REACT_LAZY_TYPE = 0xead4;
  var REACT_SCOPE_TYPE = 0xead7;
  var REACT_OPAQUE_ID_TYPE = 0xeae0;
  var REACT_DEBUG_TRACING_MODE_TYPE = 0xeae1;
  var REACT_OFFSCREEN_TYPE = 0xeae2;
  var REACT_LEGACY_HIDDEN_TYPE = 0xeae3;
  var REACT_CACHE_TYPE = 0xeae4;

  if (typeof Symbol === 'function' && Symbol.for) {
    var symbolFor = Symbol.for;
    REACT_ELEMENT_TYPE = symbolFor('react.element');
    REACT_PORTAL_TYPE = symbolFor('react.portal');
    REACT_FRAGMENT_TYPE = symbolFor('react.fragment');
    REACT_STRICT_MODE_TYPE = symbolFor('react.strict_mode');
    REACT_PROFILER_TYPE = symbolFor('react.profiler');
    REACT_PROVIDER_TYPE = symbolFor('react.provider');
    REACT_CONTEXT_TYPE = symbolFor('react.context');
    REACT_FORWARD_REF_TYPE = symbolFor('react.forward_ref');
    REACT_SUSPENSE_TYPE = symbolFor('react.suspense');
    REACT_SUSPENSE_LIST_TYPE = symbolFor('react.suspense_list');
    REACT_MEMO_TYPE = symbolFor('react.memo');
    REACT_LAZY_TYPE = symbolFor('react.lazy');
    REACT_SCOPE_TYPE = symbolFor('react.scope');
    REACT_OPAQUE_ID_TYPE = symbolFor('react.opaque.id');
    REACT_DEBUG_TRACING_MODE_TYPE = symbolFor('react.debug_trace_mode');
    REACT_OFFSCREEN_TYPE = symbolFor('react.offscreen');
    REACT_LEGACY_HIDDEN_TYPE = symbolFor('react.legacy_hidden');
    REACT_CACHE_TYPE = symbolFor('react.cache');
  }

  var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
  var PENDING = 0;
  var COMPLETED = 1;
  var FLUSHED = 2;
  var ABORTED = 3;
  var ERRORED = 4;
  var BUFFERING = 0;
  var FLOWING = 1;
  var CLOSED = 2;
  // This is a default heuristic for how to split up the HTML content into progressive
  // loading. Our goal is to be able to display additional new content about every 500ms.
  // Faster than that is unnecessary and should be throttled on the client. It also
  // adds unnecessary overhead to do more splits. We don't know if it's a higher or lower
  // end device but higher end suffer less from the overhead than lower end does from
  // not getting small enough pieces. We error on the side of low end.
  // We base this on low end 3G speeds which is about 500kbits per second. We assume
  // that there can be a reasonable drop off from max bandwidth which leaves you with
  // as little as 80%. We can receive half of that each 500ms - at best. In practice,
  // a little bandwidth is lost to processing and contention - e.g. CSS and images that
  // are downloaded along with the main content. So we estimate about half of that to be
  // the lower end throughput. In other words, we expect that you can at least show
  // about 12.5kb of content per 500ms. Not counting starting latency for the first
  // paint.
  // 500 * 1024 / 8 * .8 * 0.5 / 2
  var DEFAULT_PROGRESSIVE_CHUNK_SIZE = 12800;
  function createRequest(children, destination, responseState) {
    var progressiveChunkSize = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : DEFAULT_PROGRESSIVE_CHUNK_SIZE;
    var onError = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : noop;
    var onCompleteAll = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : noop;
    var onReadyToStream = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : noop;
    var pingedWork = [];
    var abortSet = new Set();
    var request = {
      destination: destination,
      responseState: responseState,
      progressiveChunkSize: progressiveChunkSize,
      status: BUFFERING,
      nextSegmentId: 0,
      allPendingWork: 0,
      pendingRootWork: 0,
      completedRootSegment: null,
      abortableWork: abortSet,
      pingedWork: pingedWork,
      clientRenderedBoundaries: [],
      completedBoundaries: [],
      partialBoundaries: [],
      onError: onError,
      onCompleteAll: onCompleteAll,
      onReadyToStream: onReadyToStream
    }; // This segment represents the root fallback.

    var rootSegment = createPendingSegment(request, 0, null); // There is no parent so conceptually, we're unblocked to flush this segment.

    rootSegment.parentFlushed = true;
    var rootWork = createSuspendedWork(request, children, null, rootSegment, abortSet, null);
    pingedWork.push(rootWork);
    return request;
  }

  function pingSuspendedWork(request, work) {
    var pingedWork = request.pingedWork;
    pingedWork.push(work);

    if (pingedWork.length === 1) {
      scheduleWork(function () {
        return performWork(request);
      });
    }
  }

  function createSuspenseBoundary(request, fallbackAbortableWork) {
    return {
      id: createSuspenseBoundaryID(request.responseState),
      rootSegmentID: -1,
      parentFlushed: false,
      pendingWork: 0,
      forceClientRender: false,
      completedSegments: [],
      byteSize: 0,
      fallbackAbortableWork: fallbackAbortableWork
    };
  }

  function createSuspendedWork(request, node, blockedBoundary, blockedSegment, abortSet, assignID) {
    request.allPendingWork++;

    if (blockedBoundary === null) {
      request.pendingRootWork++;
    } else {
      blockedBoundary.pendingWork++;
    }

    var work = {
      node: node,
      ping: function () {
        return pingSuspendedWork(request, work);
      },
      blockedBoundary: blockedBoundary,
      blockedSegment: blockedSegment,
      abortSet: abortSet,
      assignID: assignID
    };
    abortSet.add(work);
    return work;
  }

  function createPendingSegment(request, index, boundary) {
    return {
      status: PENDING,
      id: -1,
      // lazily assigned later
      index: index,
      parentFlushed: false,
      chunks: [],
      children: [],
      boundary: boundary
    };
  }

  function reportError(request, error) {
    // If this callback errors, we intentionally let that error bubble up to become a fatal error
    // so that someone fixes the error reporting instead of hiding it.
    request.onError(error);
  }

  function fatalError(request, error) {
    // This is called outside error handling code such as if the root errors outside
    // a suspense boundary or if the root suspense boundary's fallback errors.
    // It's also called if React itself or its host configs errors.
    request.status = CLOSED;
    closeWithError(request.destination, error);
  }

  function renderNode(request, parentBoundary, segment, node, abortSet, assignID) {
    if (typeof node === 'string') {
      pushTextInstance(segment.chunks, node, request.responseState, assignID);
      return;
    }

    if (Array.isArray(node)) {
      if (node.length > 0) {
        // Only the first node gets assigned an ID.
        renderNode(request, parentBoundary, segment, node[0], abortSet, assignID);

        for (var i = 1; i < node.length; i++) {
          renderNode(request, parentBoundary, segment, node[i], abortSet, null);
        }
      } else {
        pushEmpty(segment.chunks, request.responseState, assignID);
      }

      return;
    }

    if (typeof node !== 'object' || !node || node.$$typeof !== REACT_ELEMENT_TYPE) {
      throw new Error('Not yet implemented node type.');
    }

    var element = node;
    var type = element.type;
    var props = element.props;

    if (typeof type === 'function') {
      try {
        var result = type(props);
        renderNode(request, parentBoundary, segment, result, abortSet, assignID);
      } catch (x) {
        if (typeof x === 'object' && x !== null && typeof x.then === 'function') {
          // Something suspended, we'll need to create a new segment and resolve it later.
          var insertionIndex = segment.chunks.length;
          var newSegment = createPendingSegment(request, insertionIndex, null);
          segment.children.push(newSegment);
          var suspendedWork = createSuspendedWork(request, node, parentBoundary, newSegment, abortSet, assignID);
          var ping = suspendedWork.ping;
          x.then(ping, ping); // TODO: Emit place holder
        } else {
          // We can rethrow to terminate the rest of this tree.
          throw x;
        }
      }
    } else if (typeof type === 'string') {
      pushStartInstance(segment.chunks, type, props, request.responseState, assignID);
      renderNode(request, parentBoundary, segment, props.children, abortSet, null);
      pushEndInstance(segment.chunks, type);
    } else if (type === REACT_SUSPENSE_TYPE) {
      // We need to push an "empty" thing here to identify the parent suspense boundary.
      pushEmpty(segment.chunks, request.responseState, assignID); // Each time we enter a suspense boundary, we split out into a new segment for
      // the fallback so that we can later replace that segment with the content.
      // This also lets us split out the main content even if it doesn't suspend,
      // in case it ends up generating a large subtree of content.

      var fallback = props.fallback;
      var content = props.children;
      var fallbackAbortSet = new Set();
      var newBoundary = createSuspenseBoundary(request, fallbackAbortSet);
      var _insertionIndex = segment.chunks.length; // The children of the boundary segment is actually the fallback.

      var boundarySegment = createPendingSegment(request, _insertionIndex, newBoundary);
      segment.children.push(boundarySegment); // We create suspended work for the fallback because we don't want to actually work
      // on it yet in case we finish the main content, so we queue for later.

      var suspendedFallbackWork = createSuspendedWork(request, fallback, parentBoundary, boundarySegment, fallbackAbortSet, newBoundary.id // This is the ID we want to give this fallback so we can replace it later.
      ); // TODO: This should be queued at a separate lower priority queue so that we only work
      // on preparing fallbacks if we don't have any more main content to work on.

      request.pingedWork.push(suspendedFallbackWork); // This segment is the actual child content. We can start rendering that immediately.

      var contentRootSegment = createPendingSegment(request, 0, null); // We mark the root segment as having its parent flushed. It's not really flushed but there is
      // no parent segment so there's nothing to wait on.

      contentRootSegment.parentFlushed = true; // TODO: Currently this is running synchronously. We could instead schedule this to pingedWork.
      // I suspect that there might be some efficiency benefits from not creating the suspended work
      // and instead just using the stack if possible. Particularly when we add contexts.

      var contentWork = createSuspendedWork(request, content, newBoundary, contentRootSegment, abortSet, null);
      retryWork(request, contentWork);
    } else {
      throw new Error('Not yet implemented element type.');
    }
  }

  function erroredWork(request, boundary, segment, error) {
    // Report the error to a global handler.
    reportError(request, error);

    if (boundary === null) {
      fatalError(request, error);
    } else {
      boundary.pendingWork--;

      if (!boundary.forceClientRender) {
        boundary.forceClientRender = true; // Regardless of what happens next, this boundary won't be displayed,
        // so we can flush it, if the parent already flushed.

        if (boundary.parentFlushed) {
          // We don't have a preference where in the queue this goes since it's likely
          // to error on the client anyway. However, intentionally client-rendered
          // boundaries should be flushed earlier so that they can start on the client.
          // We reuse the same queue for errors.
          request.clientRenderedBoundaries.push(boundary);
        }
      }
    }

    request.allPendingWork--;

    if (request.allPendingWork === 0) {
      request.onCompleteAll();
    }
  }

  function abortWorkSoft(suspendedWork) {
    // This aborts work without aborting the parent boundary that it blocks.
    // It's used for when we didn't need this work to complete the tree.
    // If work was needed, then it should use abortWork instead.
    var request = this;
    var boundary = suspendedWork.blockedBoundary;
    var segment = suspendedWork.blockedSegment;
    segment.status = ABORTED;
    finishedWork(request, boundary, segment);
  }

  function abortWork(suspendedWork) {
    // This aborts the work and aborts the parent that it blocks, putting it into
    // client rendered mode.
    var request = this;
    var boundary = suspendedWork.blockedBoundary;
    var segment = suspendedWork.blockedSegment;
    segment.status = ABORTED;
    request.allPendingWork--;

    if (boundary === null) {
      // We didn't complete the root so we have nothing to show. We can close
      // the request;
      if (request.status !== CLOSED) {
        request.status = CLOSED;
        close(request.destination);
      }
    } else {
      boundary.pendingWork--; // If this boundary was still pending then we haven't already cancelled its fallbacks.
      // We'll need to abort the fallbacks, which will also error that parent boundary.

      boundary.fallbackAbortableWork.forEach(abortWork, request);
      boundary.fallbackAbortableWork.clear();

      if (!boundary.forceClientRender) {
        boundary.forceClientRender = true;

        if (boundary.parentFlushed) {
          request.clientRenderedBoundaries.push(boundary);
        }
      }

      if (request.allPendingWork === 0) {
        request.onCompleteAll();
      }
    }
  }

  function finishedWork(request, boundary, segment) {
    if (boundary === null) {
      if (segment.parentFlushed) {
        if (!(request.completedRootSegment === null)) {
          {
            throw Error( "There can only be one root segment. This is a bug in React." );
          }
        }

        request.completedRootSegment = segment;
      }

      request.pendingRootWork--;

      if (request.pendingRootWork === 0) {
        request.onReadyToStream();
      }
    } else {
      boundary.pendingWork--;

      if (boundary.forceClientRender) ; else if (boundary.pendingWork === 0) {
        // This must have been the last segment we were waiting on. This boundary is now complete.
        // We can now cancel any pending work on the fallback since we won't need to show it anymore.
        boundary.fallbackAbortableWork.forEach(abortWorkSoft, request);
        boundary.fallbackAbortableWork.clear();

        if (segment.parentFlushed) {
          // Our parent segment already flushed, so we need to schedule this segment to be emitted.
          boundary.completedSegments.push(segment);
        }

        if (boundary.parentFlushed) {
          // The segment might be part of a segment that didn't flush yet, but if the boundary's
          // parent flushed, we need to schedule the boundary to be emitted.
          request.completedBoundaries.push(boundary);
        }
      } else {
        if (segment.parentFlushed) {
          // Our parent already flushed, so we need to schedule this segment to be emitted.
          var completedSegments = boundary.completedSegments;
          completedSegments.push(segment);

          if (completedSegments.length === 1) {
            // This is the first time since we last flushed that we completed anything.
            // We can schedule this boundary to emit its partially completed segments early
            // in case the parent has already been flushed.
            if (boundary.parentFlushed) {
              request.partialBoundaries.push(boundary);
            }
          }
        }
      }
    }

    request.allPendingWork--;

    if (request.allPendingWork === 0) {
      // This needs to be called at the very end so that we can synchronously write the result
      // in the callback if needed.
      request.onCompleteAll();
    }
  }

  function retryWork(request, work) {
    var segment = work.blockedSegment;

    if (segment.status !== PENDING) {
      // We completed this by other means before we had a chance to retry it.
      return;
    }

    var boundary = work.blockedBoundary;
    var abortSet = work.abortSet;

    try {
      var node = work.node;

      while (typeof node === 'object' && node !== null && node.$$typeof === REACT_ELEMENT_TYPE && typeof node.type === 'function') {
        // Doing this here lets us reuse this same Segment if the next component
        // also suspends.
        var element = node;
        work.node = node; // TODO: Classes and legacy context etc.

        node = element.type(element.props);
      }

      renderNode(request, boundary, segment, node, abortSet, work.assignID);
      abortSet.delete(work);
      segment.status = COMPLETED;
      finishedWork(request, boundary, segment);
    } catch (x) {
      if (typeof x === 'object' && x !== null && typeof x.then === 'function') {
        // Something suspended again, let's pick it back up later.
        var ping = work.ping;
        x.then(ping, ping);
      } else {
        abortSet.delete(work);
        segment.status = ERRORED;
        erroredWork(request, boundary, segment, x);
      }
    }
  }

  function performWork(request) {
    if (request.status === CLOSED) {
      return;
    }

    var prevDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = Dispatcher;

    try {
      var pingedWork = request.pingedWork;
      var i;

      for (i = 0; i < pingedWork.length; i++) {
        var work = pingedWork[i];
        retryWork(request, work);
      }

      pingedWork.splice(0, i);

      if (request.status === FLOWING) {
        flushCompletedQueues(request);
      }
    } catch (error) {
      reportError(request, error);
      fatalError(request, error);
    } finally {
      ReactCurrentDispatcher.current = prevDispatcher;
    }
  }

  function flushSubtree(request, destination, segment) {
    segment.parentFlushed = true;

    switch (segment.status) {
      case PENDING:
        {
          // We're emitting a placeholder for this segment to be filled in later.
          // Therefore we'll need to assign it an ID - to refer to it by.
          var segmentID = segment.id = request.nextSegmentId++;
          return writePlaceholder(destination, request.responseState, segmentID);
        }

      case COMPLETED:
        {
          segment.status = FLUSHED;
          var r = true;
          var chunks = segment.chunks;
          var chunkIdx = 0;
          var children = segment.children;

          for (var childIdx = 0; childIdx < children.length; childIdx++) {
            var nextChild = children[childIdx]; // Write all the chunks up until the next child.

            for (; chunkIdx < nextChild.index; chunkIdx++) {
              writeChunk(destination, chunks[chunkIdx]);
            }

            r = flushSegment(request, destination, nextChild);
          } // Finally just write all the remaining chunks


          for (; chunkIdx < chunks.length; chunkIdx++) {
            r = writeChunk(destination, chunks[chunkIdx]);
          }

          return r;
        }

      default:
        {
          {
            {
              throw Error( "Errored or already flushed boundaries should not be flushed again. This is a bug in React." );
            }
          }
        }
    }
  }

  function flushSegment(request, destination, segment) {
    var boundary = segment.boundary;

    if (boundary === null) {
      // Not a suspense boundary.
      return flushSubtree(request, destination, segment);
    }

    boundary.parentFlushed = true; // This segment is a Suspense boundary. We need to decide whether to
    // emit the content or the fallback now.

    if (boundary.forceClientRender) {
      // Emit a client rendered suspense boundary wrapper.
      // We never queue the inner boundary so we'll never emit its content or partial segments.
      writeStartClientRenderedSuspenseBoundary(destination, boundary.id); // Flush the fallback.

      flushSubtree(request, destination, segment);
      return writeEndSuspenseBoundary(destination);
    } else if (boundary.pendingWork > 0) {
      // This boundary is still loading. Emit a pending suspense boundary wrapper.
      // Assign an ID to refer to the future content by.
      boundary.rootSegmentID = request.nextSegmentId++;

      if (boundary.completedSegments.length > 0) {
        // If this is at least partially complete, we can queue it to be partially emmitted early.
        request.partialBoundaries.push(boundary);
      }

      writeStartPendingSuspenseBoundary(destination, boundary.id); // Flush the fallback.

      flushSubtree(request, destination, segment);
      return writeEndSuspenseBoundary(destination);
    } else if (boundary.byteSize > request.progressiveChunkSize) {
      // This boundary is large and will be emitted separately so that we can progressively show
      // other content. We add it to the queue during the flush because we have to ensure that
      // the parent flushes first so that there's something to inject it into.
      // We also have to make sure that it's emitted into the queue in a deterministic slot.
      // I.e. we can't insert it here when it completes.
      // Assign an ID to refer to the future content by.
      boundary.rootSegmentID = request.nextSegmentId++;
      request.completedBoundaries.push(boundary); // Emit a pending rendered suspense boundary wrapper.

      writeStartPendingSuspenseBoundary(destination, boundary.id); // Flush the fallback.

      flushSubtree(request, destination, segment);
      return writeEndSuspenseBoundary(destination);
    } else {
      // We can inline this boundary's content as a complete boundary.
      writeStartCompletedSuspenseBoundary(destination, boundary.id);
      var completedSegments = boundary.completedSegments;

      if (!(completedSegments.length === 1)) {
        {
          throw Error( "A previously unvisited boundary must have exactly one root segment. This is a bug in React." );
        }
      }

      var contentSegment = completedSegments[0];
      flushSegment(request, destination, contentSegment);
      return writeEndSuspenseBoundary(destination);
    }
  }

  function flushClientRenderedBoundary(request, destination, boundary) {
    return writeClientRenderBoundaryInstruction(destination, request.responseState, boundary.id);
  }

  function flushSegmentContainer(request, destination, segment) {
    writeStartSegment(destination, request.responseState, segment.id);
    flushSegment(request, destination, segment);
    return writeEndSegment(destination);
  }

  function flushCompletedBoundary(request, destination, boundary) {
    var completedSegments = boundary.completedSegments;
    var i = 0;

    for (; i < completedSegments.length; i++) {
      var segment = completedSegments[i];
      flushPartiallyCompletedSegment(request, destination, boundary, segment);
    }

    completedSegments.length = 0;
    return writeCompletedBoundaryInstruction(destination, request.responseState, boundary.id, boundary.rootSegmentID);
  }

  function flushPartialBoundary(request, destination, boundary) {
    var completedSegments = boundary.completedSegments;
    var i = 0;

    for (; i < completedSegments.length; i++) {
      var segment = completedSegments[i];

      if (!flushPartiallyCompletedSegment(request, destination, boundary, segment)) {
        i++;
        completedSegments.splice(0, i); // Only write as much as the buffer wants. Something higher priority
        // might want to write later.

        return false;
      }
    }

    completedSegments.splice(0, i);
    return true;
  }

  function flushPartiallyCompletedSegment(request, destination, boundary, segment) {
    if (segment.status === FLUSHED) {
      // We've already flushed this inline.
      return true;
    }

    var segmentID = segment.id;

    if (segmentID === -1) {
      // This segment wasn't previously referred to. This happens at the root of
      // a boundary. We make kind of a leap here and assume this is the root.
      var rootSegmentID = segment.id = boundary.rootSegmentID;

      if (!(rootSegmentID !== -1)) {
        {
          throw Error( "A root segment ID must have been assigned by now. This is a bug in React." );
        }
      }

      return flushSegmentContainer(request, destination, segment);
    } else {
      flushSegmentContainer(request, destination, segment);
      return writeCompletedSegmentInstruction(destination, request.responseState, segmentID);
    }
  }

  var reentrant = false;

  function flushCompletedQueues(request) {
    if (reentrant) {
      return;
    }

    reentrant = true;
    var destination = request.destination;

    try {
      // The structure of this is to go through each queue one by one and write
      // until the sink tells us to stop. When we should stop, we still finish writing
      // that item fully and then yield. At that point we remove the already completed
      // items up until the point we completed them.
      // TODO: Emit preloading.
      // TODO: It's kind of unfortunate to keep checking this array after we've already
      // emitted the root.
      var completedRootSegment = request.completedRootSegment;

      if (completedRootSegment !== null && request.pendingRootWork === 0) {
        flushSegment(request, destination, completedRootSegment);
        request.completedRootSegment = null;
      } // We emit client rendering instructions for already emitted boundaries first.
      // This is so that we can signal to the client to start client rendering them as
      // soon as possible.


      var clientRenderedBoundaries = request.clientRenderedBoundaries;
      var i;

      for (i = 0; i < clientRenderedBoundaries.length; i++) {
        var boundary = clientRenderedBoundaries[i];

        if (!flushClientRenderedBoundary(request, destination, boundary)) {
          request.status = BUFFERING;
          i++;
          clientRenderedBoundaries.splice(0, i);
          return;
        }
      }

      clientRenderedBoundaries.splice(0, i); // Next we emit any complete boundaries. It's better to favor boundaries
      // that are completely done since we can actually show them, than it is to emit
      // any individual segments from a partially complete boundary.

      var completedBoundaries = request.completedBoundaries;

      for (i = 0; i < completedBoundaries.length; i++) {
        var _boundary = completedBoundaries[i];

        if (!flushCompletedBoundary(request, destination, _boundary)) {
          request.status = BUFFERING;
          i++;
          completedBoundaries.splice(0, i);
          return;
        }
      }

      completedBoundaries.splice(0, i); // Allow anything written so far to flush to the underlying sink before
      // we continue with lower priorities.

      completeWriting(destination);
      beginWriting(destination); // TODO: Here we'll emit data used by hydration.
      // Next we emit any segments of any boundaries that are partially complete
      // but not deeply complete.

      var partialBoundaries = request.partialBoundaries;

      for (i = 0; i < partialBoundaries.length; i++) {
        var _boundary2 = partialBoundaries[i];

        if (!flushPartialBoundary(request, destination, _boundary2)) {
          request.status = BUFFERING;
          i++;
          partialBoundaries.splice(0, i);
          return;
        }
      }

      partialBoundaries.splice(0, i); // Next we check the completed boundaries again. This may have had
      // boundaries added to it in case they were too larged to be inlined.
      // New ones might be added in this loop.

      var largeBoundaries = request.completedBoundaries;

      for (i = 0; i < largeBoundaries.length; i++) {
        var _boundary3 = largeBoundaries[i];

        if (!flushCompletedBoundary(request, destination, _boundary3)) {
          request.status = BUFFERING;
          i++;
          largeBoundaries.splice(0, i);
          return;
        }
      }

      largeBoundaries.splice(0, i);
    } finally {
      reentrant = false;

      if (request.allPendingWork === 0 && request.pingedWork.length === 0 && request.clientRenderedBoundaries.length === 0 && request.completedBoundaries.length === 0 // We don't need to check any partially completed segments because
      // either they have pending work or they're complete.
      ) {
          {
            if (request.abortableWork.size !== 0) {
              error('There was still abortable work at the root when we closed. This is a bug in React.');
            }
          } // We're done.


          close(destination);
        }
    }
  }

  function startWork(request) {
    scheduleWork(function () {
      return performWork(request);
    });
  }
  function startFlowing(request) {
    if (request.status === CLOSED) {
      return;
    }

    request.status = FLOWING;

    try {
      flushCompletedQueues(request);
    } catch (error) {
      reportError(request, error);
      fatalError(request, error);
    }
  } // This is called to early terminate a request. It puts all pending boundaries in client rendered state.

  function abort(request) {
    try {
      var abortableWork = request.abortableWork;
      abortableWork.forEach(abortWork, request);
      abortableWork.clear();

      if (request.status === FLOWING) {
        flushCompletedQueues(request);
      }
    } catch (error) {
      reportError(request, error);
      fatalError(request, error);
    }
  }

  function notYetImplemented() {
    throw new Error('Not yet implemented.');
  }

  function unsupportedRefresh() {
    {
      {
        throw Error( "Cache cannot be refreshed during server rendering." );
      }
    }
  }

  function unsupportedStartTransition() {
    {
      {
        throw Error( "startTransition cannot be called during server rendering." );
      }
    }
  }

  function noop() {}

  var Dispatcher = {
    useMemo: function (nextCreate) {
      return nextCreate();
    },
    useCallback: function (callback) {
      return callback;
    },
    useDebugValue: function () {},
    useDeferredValue: function (value) {
      return value;
    },
    useTransition: function () {
      return [unsupportedStartTransition, false];
    },
    getCacheForType: function (resourceType) {
      throw new Error('Not yet implemented. Should mark as client rendered.');
    },
    readContext: notYetImplemented,
    useContext: notYetImplemented,
    useReducer: notYetImplemented,
    useRef: notYetImplemented,
    useState: notYetImplemented,
    useLayoutEffect: noop,
    // useImperativeHandle is not run in the server environment
    useImperativeHandle: noop,
    // Effects are not run in the server environment.
    useEffect: noop,
    useOpaqueIdentifier: notYetImplemented,
    useMutableSource: notYetImplemented,
    useCacheRefresh: function () {
      return unsupportedRefresh;
    }
  };

  function renderToReadableStream(children, options) {
    var request;

    if (options && options.signal) {
      var signal = options.signal;

      var listener = function () {
        abort(request);
        signal.removeEventListener('abort', listener);
      };

      signal.addEventListener('abort', listener);
    }

    var stream = new ReadableStream({
      start: function (controller) {
        request = createRequest(children, controller, createResponseState(options ? options.identifierPrefix : undefined), options ? options.progressiveChunkSize : undefined, options ? options.onError : undefined, options ? options.onCompleteAll : undefined, options ? options.onReadyToStream : undefined);
        startWork(request);
      },
      pull: function (controller) {
        // Pull is called immediately even if the stream is not passed to anything.
        // That's buffering too early. We want to start buffering once the stream
        // is actually used by something so we can give it the best result possible
        // at that point.
        if (stream.locked) {
          startFlowing(request);
        }
      },
      cancel: function (reason) {}
    });
    return stream;
  }

  exports.renderToReadableStream = renderToReadableStream;

})));
