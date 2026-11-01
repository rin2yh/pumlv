# ADR 0001: Skip unreadable Markdown files during Registry scans

## Context

PR #213 adds Markdown files to the Registry only when they contain a supported PlantUML code block. Determining that requires reading and parsing the file. A read error can occur while scanning a directory or when rechecking one changed file. A Registry entry also controls whether a file is listed and served.

## Decision

Register Markdown only when a successful read finds a supported PlantUML block; if a full scan cannot read a file, skip and log it while continuing the scan. This keeps files whose preview eligibility could not be established out of a rebuilt Registry. During a single-file update, return the read error and keep that path's existing entry unchanged, so a failed read is not treated as a confirmed removal. A directory-add scan that encounters a read error does not publish partial candidate entries; the watcher retries the path with increasing delays, capped at five seconds.

## Consequences

An unreadable Markdown file is absent after a full refresh, while other readable files can still be registered. A later successful refresh can register it if it contains a supported PlantUML block. For a single-file update, the previous entry remains until a later successful update; a successful read showing no supported block removes it. If a directory-add scan fails, its previous Registry state remains until retry succeeds. Read and watch failures are logged with the affected path and cause.

This means the Registry can temporarily omit a valid diagram after a full refresh, or retain a prior entry after a failed single-file update. Non-Markdown files are not read to determine Registry eligibility, so this read policy applies to Markdown discovery.
