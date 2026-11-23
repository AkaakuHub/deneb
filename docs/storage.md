# Storage and setup

Supply the saved files under `DATA_ROOT`.

```text
<DATA_ROOT>/
  index.html
  webview-documents.json
  legal/
  news/
  images/
  api-data/
```

- Store the WebView shell as `index.html`.
- Store the document manifest as `webview-documents.json`, with the saved pages in `legal/` and `news/`. Preserve the document and stylesheet paths listed in the manifest.
- Store images in `images/`, preserving the paths referenced by the pages.
- Store saved API responses in `api-data/`, preserving the subdirectories produced by `bun run import:webview-api`.

Install Bun, copy `.env.example` to `.env`, and set all three variables.

| Variable | Value |
| --- | --- |
| `DATA_ROOT` | Absolute path to the directory shown above |
| `HOST` | Listen address |
| `PORT` | TCP port |

Run these commands from the server directory.

```sh
bun install --frozen-lockfile
bun run start
```
