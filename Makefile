APP := pumlv
FRONTEND_DIR := frontend

.PHONY: build dev generate clean

build: generate
	go build -o $(APP) .

dev: generate
	@trap 'kill 0' EXIT; \
	go run . --no-open --port 8765 ./examples & \
	cd $(FRONTEND_DIR) && pnpm dev

generate:
	go generate ./...

clean:
	rm -f $(APP)
	rm -rf static/dist
