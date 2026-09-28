package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRenderEndpoint(t *testing.T) {
	s := &Server{}
	defer s.renderer.Close()
	request := httptest.NewRequest(http.MethodPost, "/api/render", strings.NewReader("@startuml\nAlice -> Bob: hello\n@enduml"))
	response := httptest.NewRecorder()
	s.handleRender(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
	if got := response.Header().Get("Content-Type"); got != "image/svg+xml; charset=utf-8" {
		t.Fatalf("content type %q", got)
	}
	if !strings.Contains(response.Body.String(), "hello") {
		t.Fatal("SVG does not contain diagram label")
	}
}

func TestRenderRejectsOversizedSource(t *testing.T) {
	s := &Server{}
	request := httptest.NewRequest(http.MethodPost, "/api/render", strings.NewReader(strings.Repeat("x", (2<<20)+1)))
	response := httptest.NewRecorder()
	s.handleRender(response, request)
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, want 413", response.Code)
	}
}
