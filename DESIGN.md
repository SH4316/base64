# Base64 Workbench

An English utility with two editable panels and explicit conversion controls between them, as requested by the user. The primary path is left text → Encode → right Base64 and right Base64 → Decode → left text. Conversion is deliberate; editing never overwrites the other panel automatically.

The user requested a tool-focused surface: the editors begin at the top with 32px desktop and 20px mobile spacing. The site header, display heading, subtitle, and local-processing badge have been removed.

The visual system matches the blog: white ground, deep green text, teal actions, lime-tinted surfaces, fine separators and 8px editor corners. IBM Plex Sans 5.3.0 is self-hosted for the UI; JetBrains Mono remains for code. Visible type has a 12px floor. Dark mode follows the system preference using the blog’s deep green surfaces and yellow-green accent. Inline SVG icons and local assets require no external requests.

Desktop keeps the editors side by side. At 720px and below the text editor, conversion buttons, and Base64 editor stack vertically, with the arrows rotating to match. Persistent privacy copy directly below the editors reads “Your input is not sent to a server.”

Empty editors expose placeholders and an optional sample. Loading, validation, success, disabled, hover, focus and file-drop states are explicit. Validation preserves existing output on failure. No entry animation is used; reduced motion disables the loading animation. Inputs are never persisted.
