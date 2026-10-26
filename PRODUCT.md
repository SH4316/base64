# Base64 Workbench

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User requested migration from React to plain HTML, CSS, and JavaScript. Native ES modules and Web Workers now run with no runtime npm dependencies. Cloudflare Pages serves the static files; the optional Node build command only copies deployment assets.

## Product Purpose
Encode and decode Base64 in the browser. The user confirmed an English interface and explicitly requested two editable text panels with Encode and Decode buttons between them. The light appearance is an implementation choice. Conversion runs when a button or shortcut is used.

## Capabilities and Constraints
- Static hosting on Cloudflare Pages; no server API required.
- Input is processed locally and is not persisted.
- The user requested the visible English notice: “Your input is not sent to a server.”
- Implementation scope: UTF-8 text, binary files, standard and URL-safe Base64, padding, copy and download.
- Assumed audience: people who need a quick developer utility. No audience or brand assets were supplied.
- Responsive and keyboard-accessible controls.
