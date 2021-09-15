export default function Html({children}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link
          rel="shortcut icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🕹</text></svg>"
        />
        <meta name="description" content="React with Server Components demo" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="style.css" />
        <title>React Notes</title>
      </head>
      <body>
        <div id="root">{children}</div>
        <script src="src/index.client.js" type="module" />
      </body>
    </html>
  );
}
