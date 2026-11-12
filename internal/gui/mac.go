//go:build darwin

package gui

import (
	"context"
	"fmt"
	"image"
	"io/fs"

	"github.com/ebitengine/purego"
	"github.com/guigui-gui/guigui"
	"github.com/rin2yh/pumlv/internal/gui/bridge"
	"github.com/rin2yh/pumlv/internal/server"
	"github.com/rin2yh/pumlv/internal/static"
)

// Run opens the native tree and shared preview without an HTTP listener.
func Run(ctx context.Context, core *server.Core) error {
	if err := loadNativeFrameworks(); err != nil {
		return err
	}
	assets, err := fs.Sub(static.Frontend, "dist")
	if err != nil {
		return err
	}
	layout := newSidebarLayout(288)
	window, err := newNativeWindow(core, assets, layout)
	if err != nil {
		return err
	}
	return runSidebar(ctx, core, window)
}

func loadNativeFrameworks() error {
	for _, framework := range []string{
		"/System/Library/Frameworks/Foundation.framework/Foundation",
		"/System/Library/Frameworks/AppKit.framework/AppKit",
		"/System/Library/Frameworks/WebKit.framework/WebKit",
	} {
		if _, err := purego.Dlopen(framework, purego.RTLD_NOW|purego.RTLD_GLOBAL); err != nil {
			return fmt.Errorf("load %s: %w", framework, err)
		}
	}
	return nil
}

func runSidebar(ctx context.Context, core *server.Core, window *nativeWindow) error {
	updates := make(chan []fileEntry, 1)
	attachErrors := make(chan error, 1)
	events := core.Subscribe()
	r := &root{
		layout:      window.layout,
		onSelect:    window.bridge.SelectFile,
		onLayout:    window.requestFrameSync,
		attachError: attachErrors,
		updates:     updates,
		files:       core.List(),
	}
	eventCtx, stopEvents := context.WithCancel(ctx)
	forwarder := &eventForwarder{core: core, events: events, updates: updates, bridge: window.bridge}
	forwarderDone := make(chan struct{})
	go func() {
		defer close(forwarderDone)
		forwarder.run(eventCtx)
	}()
	defer func() {
		stopEvents()
		core.Unsubscribe(events)
	}()

	attachCtx, stopAttach := context.WithCancel(ctx)
	attachDone := make(chan struct{})
	go func() {
		defer close(attachDone)
		window.attachWhenAvailable(attachCtx, attachErrors)
	}()

	guiDone := make(chan struct{})
	go closeWindowWhenCancelled(ctx, guiDone, window)
	err := guigui.Run(r, &guigui.RunOptions{
		Title:         "pumlv",
		WindowSize:    image.Pt(1280, 800),
		WindowMinSize: image.Pt(800, 500),
	})
	close(guiDone)
	stopAttach()
	<-attachDone
	stopEvents()
	<-forwarderDone
	window.closeOnMain()
	return err
}

func closeWindowWhenCancelled(ctx context.Context, done <-chan struct{}, window *nativeWindow) {
	select {
	case <-ctx.Done():
		select {
		case <-done:
			return
		default:
		}
		window.closeAndCloseWindow()
	case <-done:
	}
}

type eventForwarder struct {
	core    *server.Core
	events  chan server.Event
	updates chan []fileEntry
	bridge  *bridge.Bridge
}

func (f *eventForwarder) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, open := <-f.events:
			if !open {
				return
			}
			if event.Name == "tree" {
				publishFiles(f.updates, f.core.List())
			}
			detail := map[string]any{"type": event.Name}
			if event.Name == "changed" {
				if data, ok := event.Data.(map[string]string); ok {
					detail["path"] = data["path"]
				}
			}
			f.bridge.DispatchPageEvent("pumlv:server-event", detail)
		}
	}
}

func publishFiles(updates chan []fileEntry, files []fileEntry) {
	select {
	case updates <- files:
		return
	default:
	}
	select {
	case <-updates:
	default:
	}
	select {
	case updates <- files:
	default:
	}
}
