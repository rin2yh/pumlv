# Markdown extraction fixtures

Inputs (`.md`) and expected PlantUML (`.puml`) are listed explicitly in
`TestExtractMarkdownPlantUML`. Paths in that table are relative to this directory.
Update these checked-in files directly; there is no golden update flag.

`no-block.puml` is empty and means no supported block was found (`found == false`).
`empty-block.puml` contains the wrapper tags for an empty supported block
(`found == true`). The language/fence/tag cases share `sequence.puml`.

`indented-crlf.md` intentionally uses CRLF line endings. Its Git attribute keeps
those bytes intact. `unclosed-block.md` intentionally has no closing fence or
trailing newline.
