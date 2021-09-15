export default async function handleEvent(
  event,
  {
    request,
    entrypoint,
    streamableResponse,
    indexTemplate
  }
) {

  const url = new URL(request.url);
  const isReactHydrationRequest = url.pathname === '/react';

  try {
    const template =
      typeof indexTemplate === 'function'
        ? await indexTemplate(url.toString())
        : indexTemplate;

    const {render, hydrate, stream} =
      entrypoint.default || entrypoint;

    const isStreamable = streamableResponse && isStreamableRequest(url);

    const context = {};

    /**
     * Stream back real-user responses, but for bots/etc,
     * use `render` instead. This is because we need to inject <head>
     * things for SEO reasons.
     */
    if (isStreamable) {
      if (isReactHydrationRequest) {
        console.log('Hydrating ... \n\n')
        hydrate(url, {context, request, response: streamableResponse});
      } else {
        console.log('Streaming ... \n\n')
        stream(url, {context, request, response: streamableResponse});
      }
      return;
    }

    const {body, bodyAttributes, htmlAttributes, componentResponse, ...head} =
      await render(url, {request, context, isReactHydrationRequest});

    const headers = componentResponse.headers;

    /**
     * TODO: Set as part of cache-control headers when Oxygen support lands.
     */
    headers.set(
      EXPIRES_HEADER,
      new Date(Date.now() + CACHE_TTL_IN_SECONDS * 1000).toUTCString()
    );

    if (componentResponse.customBody) {
      return new Response(await componentResponse.customBody, {
        status: componentResponse.status ?? 200,
        headers,
      });
    }

    let response;

    if (isReactHydrationRequest) {
      response = new Response(body, {
        status: componentResponse.status ?? 200,
        headers,
      });
    } else {
      const html = template
        .replace(
          `<div id="root"></div>`,
          `<div id="root" data-server-rendered="true">${body}</div>`
        )
        .replace(/<head>(.*?)<\/head>/s, generateHeadTag(head))
        .replace('<body', bodyAttributes ? `<body ${bodyAttributes}` : '$&')
        .replace('<html', htmlAttributes ? `<html ${htmlAttributes}` : '$&');

      headers.append('content-type', 'text/html');

      response = new Response(html, {
        status: componentResponse.status ?? 200,
        headers,
      });
    }

    if (cache) {
      /**
       * Put response into cache. If the Worker runtime requires `event.waitUntil` to keep the request
       * alive while the cache operation completes, use it. Otherwise, assume queued microtasks will finish.
       */
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(cache.put(request, response.clone()));
      } else {
        cache.put(request, response.clone());
      }
    }

    return response;
  } catch (e) {
    console.log(e.stack);
    return new Response(e.message || e.toString(), {
      status: 500,
    });
  }
}

const EXPIRES_HEADER = 'Expires';
const CACHE_TTL_IN_SECONDS = 60;

function isStreamableRequest(url) {
  /**
   * TODO: Add UA detection.
   */
  const isBot = url.searchParams.has('_bot');

  return !isBot;
}

/**
 * Generate the contents of the `head` tag, and update the existing `<title>` tag
 * if one exists, and if a title is passed.
 */
function generateHeadTag(head) {
  const headProps = ['base', 'meta', 'style', 'noscript', 'script', 'link'];
  const {title, ...rest} = head;

  const otherHeadProps = headProps
    .map((prop) => rest[prop])
    .filter(Boolean)
    .join('\n');

  return (_outerHtml, innerHtml) => {
    let headHtml = otherHeadProps + innerHtml;

    if (title) {
      if (headHtml.includes('<title>')) {
        headHtml = headHtml.replace(/(<title>(?:.|\n)*?<\/title>)/, title);
      } else {
        headHtml += title;
      }
    }

    return `<head>${headHtml}</head>`;
  };
}