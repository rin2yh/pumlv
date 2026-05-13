APP      := pumlv
FRONTEND := frontend

GOCREDITS := go run github.com/Songmu/gocredits/cmd/gocredits@v0.4.0 -skip-missing

default: test

ci: generate lint test

generate:
	go generate ./...

build: generate
	go build -trimpath -o $(APP) .

dev: generate
	@trap 'kill 0' EXIT; \
	go run . --no-open --port 8765 ./examples & \
	cd $(FRONTEND) && pnpm dev

test: test-frontend test-backend

test-frontend: $(FRONTEND)/node_modules
	cd $(FRONTEND) && pnpm test

test-backend:
	go test -race -coverprofile=coverage.out -covermode=atomic ./...

e2e: build
	cd $(FRONTEND) && pnpm test:e2e

screenshot: build
	cd $(FRONTEND) && pnpm screenshots

lint: lint-frontend lint-backend

lint-frontend: fmt-check-frontend
	cd $(FRONTEND) && pnpm lint

lint-backend: fmt-check-backend
	go vet ./...

fmt: fmt-frontend fmt-backend

fmt-frontend: $(FRONTEND)/node_modules
	cd $(FRONTEND) && pnpm fmt

fmt-backend:
	go fmt ./...

fmt-check: fmt-check-frontend fmt-check-backend

fmt-check-frontend: $(FRONTEND)/node_modules
	cd $(FRONTEND) && pnpm fmt:check

fmt-check-backend:
	test -z "$$(go fmt ./... | tee /dev/stderr)"

$(FRONTEND)/node_modules: $(FRONTEND)/pnpm-lock.yaml
	cd $(FRONTEND) && pnpm install --frozen-lockfile
	@touch $@

credits:
	$(GOCREDITS) -w .

prerelease_for_tagpr: credits
	git add CREDITS go.sum

release-snapshot: generate
	goreleaser release --snapshot --clean

clean:
	rm -f $(APP)
	rm -rf static/dist
	rm -rf images
	rm -rf dist

.PHONY: default ci generate build dev \
	test test-frontend test-backend \
	e2e screenshot \
	lint lint-frontend lint-backend \
	fmt fmt-frontend fmt-backend \
	fmt-check fmt-check-frontend fmt-check-backend \
	credits prerelease_for_tagpr release-snapshot clean
