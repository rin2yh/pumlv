APP := pumlv
FRONTEND_DIR := frontend

.PHONY: build dev generate clean e2e screenshot

build: generate
	go build -o $(APP) .

dev: generate
	@trap 'kill 0' EXIT; \
	go run . --no-open --port 8765 ./examples & \
	cd $(FRONTEND_DIR) && pnpm dev

generate:
	go generate ./...

e2e: build
	cd $(FRONTEND_DIR) && pnpm test:e2e

screenshot: build
	cd $(FRONTEND_DIR) && pnpm screenshots

clean:
	rm -f $(APP)
	rm -rf static/dist
	rm -rf images
