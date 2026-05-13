APP := pumlv
FRONTEND_DIR := frontend
GOCREDITS := go run github.com/Songmu/gocredits/cmd/gocredits@v0.4.0

.PHONY: build dev generate credits check-credits clean e2e screenshot

build: generate credits
	go build -o $(APP) .

dev: generate credits
	@trap 'kill 0' EXIT; \
	go run . --no-open --port 8765 ./examples & \
	cd $(FRONTEND_DIR) && pnpm dev

generate:
	go generate ./...

credits:
	$(GOCREDITS) -w .

check-credits:
	@cp CREDITS CREDITS.bak
	@$(GOCREDITS) -w .
	@if ! diff -q CREDITS.bak CREDITS >/dev/null; then \
		mv CREDITS.bak CREDITS; \
		echo "CREDITS is out of date. Run 'make credits' and commit the result." >&2; \
		exit 1; \
	fi
	@rm CREDITS.bak

e2e: build
	cd $(FRONTEND_DIR) && pnpm test:e2e

screenshot: build
	cd $(FRONTEND_DIR) && pnpm screenshots

clean:
	rm -f $(APP)
	rm -rf static/dist
	rm -rf images
