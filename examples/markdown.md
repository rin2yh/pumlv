# Markdown with PlantUML

Run `pumlv examples/markdown.md` to preview all three diagrams below. pumlv
previews each supported fenced PlantUML block in document order. The
`@startuml` and `@enduml` tags are optional in each block.

## Sequence diagram

```plantuml
title Editing a Markdown diagram

actor Author
participant "Markdown file" as Markdown
participant pumlv
participant Browser

Author -> Markdown: add or edit a diagram block
Markdown -> pumlv: file change
pumlv -> pumlv: extract all PlantUML blocks
pumlv -> Browser: update diagram previews
```

## Class diagram

```plantuml
title Markdown diagram preview components

class MarkdownFile
class MarkdownParser {
  +extractAll(source): PlantUMLBlock[]
}
class PlantUMLBlock
class Preview {
  +render(source)
}

MarkdownFile --> MarkdownParser : source
MarkdownParser --> PlantUMLBlock : extracts
PlantUMLBlock --> Preview : rendered as
```

## Activity diagram

```plantuml
title Previewing diagrams from Markdown

start
:Open Markdown file;
:Find supported fenced blocks;
if (Any blocks found?) then (yes)
  :Render each block in document order;
  :Show diagram previews;
else (no)
  :No diagram preview;
endif
stop
```
