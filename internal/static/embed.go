package static

import "embed"

//go:generate sh -c "cd ../frontend && pnpm install && pnpm run build"

// Frontend contains the embedded frontend distribution files.
//go:embed all:dist
var Frontend embed.FS
