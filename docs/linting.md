# Go linting

`make lint-backend` checks Go formatting and runs golangci-lint. The linter
version is pinned in `.golangci-lint-version`; CI installs that version before
running the same Make target.

The configuration enables `errcheck`, `govet`, `ineffassign`, `staticcheck`,
and `unused` for error handling and static analysis, plus `gocritic` for common
implementation improvements. `revive` checks argument counts (at most three),
error naming, receiver naming, and Go initialism casing such as `ID` and `HTTP`.

No standard rule can reliably determine whether an arbitrary function name
starts with a verb or whether a boolean predicate should start with `Is`. Those
conventions remain part of code review; this project does not add a custom
analyzer. When a function needs more than three arguments, group related values
into an options or request struct when that makes the call clearer.
