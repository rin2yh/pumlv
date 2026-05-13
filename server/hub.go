package server

import "sync"

// Event is the unit broadcast over SSE.
type Event struct {
	Name string
	Data any
}

// Hub fan-outs events to all SSE subscribers.
type Hub struct {
	mu      sync.Mutex
	clients map[chan Event]struct{}
	closed  bool
}

// NewHub creates an empty Hub.
func NewHub() *Hub {
	return &Hub{clients: map[chan Event]struct{}{}}
}

// Subscribe adds a new subscriber and returns its channel.
func (h *Hub) Subscribe() chan Event {
	ch := make(chan Event, 16)
	h.mu.Lock()
	if !h.closed {
		h.clients[ch] = struct{}{}
	} else {
		close(ch)
	}
	h.mu.Unlock()
	return ch
}

// Unsubscribe removes the subscriber and closes its channel.
func (h *Hub) Unsubscribe(ch chan Event) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// Broadcast delivers an event to all subscribers without blocking.
func (h *Hub) Broadcast(ev Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- ev:
		default:
			// drop if a slow subscriber's buffer is full
		}
	}
}

// Close terminates every subscriber. Further Subscribe calls return closed channels.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return
	}
	h.closed = true
	for ch := range h.clients {
		close(ch)
	}
	h.clients = map[chan Event]struct{}{}
}
