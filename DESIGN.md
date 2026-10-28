# Base64 Workbench

An English utility with two editable panels and explicit conversion controls between them, as requested by the user. The primary path is left text → Encode → right Base64 and right Base64 → Decode → left text. Conversion is deliberate; editing never overwrites the other panel automatically.

The user requested a tool-focused surface: an encoding selector and its status lead directly into the editors, with 32px desktop and 20px mobile outer spacing. The site header, display heading, subtitle, local-processing badge, explanatory cards, and “What is Base64” disclosure have been removed.

The visual system inherits the current blog palette in `../blog/app/styles/global.css`: white ground, navy text, blue actions, pale blue surfaces, fine separators and 8px editor corners. Editor headings use the blog’s surface color, and editor bodies use its code background. IBM Plex Sans 5.3.0 is self-hosted for the UI; JetBrains Mono remains for code. Visible type has a 12px floor. Dark mode follows the system preference using the blog’s deep navy surfaces and light blue accent. Selection, focus, checkboxes and the blue-and-white favicon follow the same palette. Inline SVG icons and local assets require no external requests.

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#ffffff` | `#101827` |
| Surface / editor heading | `#edf3fc` | `#16243a` |
| Code background | `#f7f9fd` | `#0d1625` |
| Text | `#182741` | `#e5edf9` |
| Muted text | `#536581` | `#9aacc6` |
| Border | `#dbe4f2` | `#283b58` |
| Accent | `#1d4ed8` | `#91c5fc` |
| Accent surface | `#e6efff` | `#1c3151` |
| Accent hover | `#2563eb` | `#b4d8fd` |
| Text on accent | `#ffffff` | `#101827` |
| Text selection | `#d5e8ff` | `#244e80` |

Desktop keeps the editors side by side. A native “Text encoding” select sits above them, followed by a live status describing detection and the effect of editing. Auto-detect is the default; explicit character encodings and Binary (HEX) are available. The editor format tag identifies the current charset or HEX. “Base64 options” below the editors distinguishes output syntax settings from character encoding.

At 720px and below the selector fills the width, followed by its status, and the text editor, conversion buttons, and Base64 editor stack vertically, with the arrows rotating to match. Persistent privacy copy directly below the editors reads “Your input is not sent to a server.” The favicon is a custom white “64” on the blog’s blue rounded square, with a versioned URL for cache refresh.

Empty editors expose placeholders and an optional sample. Loading, validation, success, disabled, hover, focus and file-drop states are explicit. Validation preserves existing output on failure. No entry animation is used; reduced motion disables the loading animation. Inputs are never persisted.

Binary uploads and decoded results reuse the left editor as a read-only hex view, labeled “Binary data” with a “HEX” format tag. Bytes use uppercase two-digit hex separated by spaces, with 16 bytes per line. Copy copies the displayed hex, while Encode and download use the original bytes. Clearing or removing the binary restores the plain-text editor.

Selecting an encoding reinterprets original uploaded or decoded bytes. Encode and download preserve those bytes until the user edits the text. Edited text uses the selected charset, or UTF-8 in Auto mode; unsupported characters produce an error without replacing the previous output. Automatic detection distinguishes a detected Unicode encoding from a likely legacy encoding, and ambiguous data remains in HEX with a manual-selection hint.
