package server

import (
	"testing"
	"time"
)

func TestHubBroadcastsToAllSubscribers(t *testing.T) {
	h := NewHub()
	defer h.Close()

	a := h.Subscribe()
	b := h.Subscribe()

	h.Broadcast(Event{Name: "changed", Data: map[string]string{"path": "/x"}})

	for _, ch := range []chan Event{a, b} {
		select {
		case ev := <-ch:
			if ev.Name != "changed" {
				t.Errorf("unexpected event name: %q", ev.Name)
			}
		case <-time.After(time.Second):
			t.Fatal("subscriber did not receive event in time")
		}
	}
}

func TestHubUnsubscribeClosesChannel(t *testing.T) {
	h := NewHub()
	defer h.Close()

	ch := h.Subscribe()
	h.Unsubscribe(ch)
	if _, ok := <-ch; ok {
		t.Error("expected channel to be closed after unsubscribe")
	}
}

func TestHubCloseClosesAllSubscribers(t *testing.T) {
	h := NewHub()
	ch := h.Subscribe()
	h.Close()
	if _, ok := <-ch; ok {
		t.Error("expected channel to be closed after Hub.Close")
	}
	// Subscribing after Close yields an already-closed channel.
	ch2 := h.Subscribe()
	if _, ok := <-ch2; ok {
		t.Error("expected post-close subscribe to be a closed channel")
	}
}
