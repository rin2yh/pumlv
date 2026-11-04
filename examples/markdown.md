# Markdown with PlantUML

Run `pumlv examples/markdown.md` to preview the diagram embedded below. pumlv
extracts the first fenced PlantUML block from a Markdown file, so the diagram
can live alongside its explanation. The `@startuml` and `@enduml` tags are
optional in the block.

```plantuml
title Previewing a Markdown diagram

actor Author
participant "Markdown file" as Markdown
participant pumlv
participant Browser

Author -> Markdown: save a fenced diagram
pumlv -> Markdown: extract the first PlantUML block
pumlv -> Browser: serve the diagram source
Browser -> Browser: render the diagram
```
