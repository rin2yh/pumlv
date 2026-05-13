package version

// Version は tagpr がバンプし、GoReleaser が ldflags で上書きする。
var Version = "dev"

// Revision は GoReleaser が ldflags で埋める短縮 commit hash。
var Revision = ""
