# Base64 Workbench

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User requested migration from React to plain HTML, CSS, and JavaScript. Native ES modules and Web Workers use self-hosted, vendored character codecs and an encoding detector. Cloudflare Pages serves the static files; the Node build verifies assets and license notices before copying deployment assets. No server runtime or conversion API is required.

## Product Purpose
Encode and decode Base64 in the browser. The user confirmed an English interface and explicitly requested two editable text panels with Encode and Decode buttons between them. The light appearance is an implementation choice. Conversion runs when a button or shortcut is used.

## Capabilities and Constraints
- Static hosting on Cloudflare Pages; no server API required.
- Input is processed locally and is not persisted.
- The user requested the visible English notice: “Your input is not sent to a server.”
- Implementation scope: text in multiple character encodings, binary files, standard and URL-safe Base64, data URLs, padding, copy and download.
- Auto-detect and explicit selection support UTF-8, UTF-16 LE/BE, UTF-32 LE/BE, CP949 / EUC-KR (UHC), Shift_JIS / Windows-31J, GB18030, Big5 / HKSCS, Windows-1252, ISO-8859-1, and ASCII. Automatic legacy detection is a best-effort guess; ambiguous bytes can be interpreted manually or viewed as HEX.
- Edited text is encoded strictly in the selected charset, with UTF-8 as the Auto default. Unsupported characters fail visibly instead of being replaced silently.
- Uploaded and decoded bytes remain intact for Encode and download until text is edited. The selector reinterprets those bytes without transcoding them. Base64 document uploads detect their own text encoding independently of the decoded payload.
- Binary uploads and decoded results display read-only hexadecimal bytes. Copy uses the displayed hex; download and Encode preserve the original bytes.
- Assumed audience: people who need a quick developer utility. No audience or brand assets were supplied.
- Responsive and keyboard-accessible controls.
