//go:build darwin

package gui

import (
	"context"
	"fmt"
	"io/fs"
	"sync/atomic"
	"time"

	"github.com/ebitengine/purego"
	"github.com/ebitengine/purego/objc"
	"github.com/rin2yh/pumlv/internal/gui/bridge"
	"github.com/rin2yh/pumlv/internal/server"
)

type rect struct{ X, Y, W, H float64 }

type nativeWindow struct {
	queue      uintptr
	dispatch   func(uintptr, objc.Block)
	window     objc.ID
	content    objc.ID
	web        objc.ID
	config     objc.ID
	bridge     *bridge.Bridge
	layout     *sidebarLayout
	frame      rect
	closed     bool
	syncQueued atomic.Bool
}

// Objective-C nil is a null object pointer.
const objcNil objc.ID = 0

func newNativeWindow(core *server.Core, assets fs.FS, layout *sidebarLayout) (*nativeWindow, error) {
	queue, err := purego.Dlsym(purego.RTLD_DEFAULT, "_dispatch_main_q")
	if err != nil {
		return nil, err
	}
	window := &nativeWindow{queue: queue, layout: layout}
	purego.RegisterLibFunc(&window.dispatch, purego.RTLD_DEFAULT, "dispatch_async")
	window.bridge = bridge.New(core, assets, window.onMain)
	return window, nil
}

func (w *nativeWindow) onMain(callback func()) {
	block := objc.NewBlock(func(_ objc.Block) { callback() })
	w.dispatch(w.queue, block)
	block.Release()
}

func (w *nativeWindow) onMainSync(callback func()) {
	if objc.Send[bool](objc.ID(objc.GetClass("NSThread")), sel("isMainThread")) {
		callback()
		return
	}
	done := make(chan struct{})
	w.onMain(func() {
		defer close(done)
		callback()
	})
	<-done
}

func (w *nativeWindow) attach(ctx context.Context) (bool, error) {
	type attachResult struct {
		attached bool
		err      error
	}
	result := make(chan attachResult, 1)
	w.onMain(func() {
		if ctx.Err() != nil {
			result <- attachResult{}
			return
		}
		attached, err := w.attachOnMain()
		result <- attachResult{attached: attached, err: err}
	})
	select {
	case result := <-result:
		return result.attached, result.err
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

func (w *nativeWindow) attachWhenAvailable(ctx context.Context, failures chan<- error) {
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	timeout := time.NewTimer(15 * time.Second)
	defer timeout.Stop()
	for {
		attached, err := w.attach(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			reportAttachFailure(failures, err)
			return
		}
		if attached {
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			reportAttachFailure(failures, fmt.Errorf("pumlv AppKit window did not appear"))
			return
		case <-ticker.C:
		}
	}
}

func reportAttachFailure(failures chan<- error, err error) {
	select {
	case failures <- err:
	default:
	}
}

func (w *nativeWindow) attachOnMain() (bool, error) {
	if w.closed {
		return false, nil
	}
	if w.web != objcNil {
		return true, nil
	}
	app := objc.ID(objc.GetClass("NSApplication")).Send(sel("sharedApplication"))
	windows := app.Send(sel("windows"))
	for i := uint64(0); i < objc.Send[uint64](windows, sel("count")); i++ {
		candidate := windows.Send(sel("objectAtIndex:"), i)
		if objcString(candidate.Send(sel("title"))) == "pumlv" {
			w.window = candidate
			break
		}
	}
	if w.window == objcNil {
		return false, nil
	}
	w.content = w.window.Send(sel("contentView"))
	w.config = objc.ID(objc.GetClass("WKWebViewConfiguration")).Send(sel("new"))
	if w.config == objcNil {
		return false, fmt.Errorf("create WKWebView configuration")
	}
	if err := w.bridge.Install(w.config); err != nil {
		return false, err
	}
	w.web = objc.ID(objc.GetClass("WKWebView")).Send(sel("alloc")).Send(sel("initWithFrame:configuration:"), rect{}, w.config)
	if w.web == objcNil {
		return false, fmt.Errorf("create WKWebView")
	}
	w.bridge.SetWebView(w.web)
	w.content.Send(sel("addSubview:"), w.web)
	requestURL := objc.ID(objc.GetClass("NSURL")).Send(sel("URLWithString:"), ns("pumlv://app/"))
	request := objc.ID(objc.GetClass("NSURLRequest")).Send(sel("requestWithURL:"), requestURL)
	w.web.Send(sel("loadRequest:"), request)
	w.syncFrameOnMain()
	app.Send(sel("activateIgnoringOtherApps:"), true)
	return true, nil
}

func (w *nativeWindow) requestFrameSync() {
	if !w.syncQueued.CompareAndSwap(false, true) {
		return
	}
	w.onMain(func() {
		defer w.syncQueued.Store(false)
		w.syncFrameOnMain()
	})
}

func (w *nativeWindow) syncFrameOnMain() {
	if w.web == objcNil || w.content == objcNil {
		return
	}
	r := objc.Send[rect](w.content, sel("bounds"))
	w.layout.SetWindowWidth(r.W)
	r.X = w.layout.Width()
	r.W -= r.X
	if r == w.frame {
		return
	}
	w.frame = r
	w.web.Send(sel("setFrame:"), r)
}

func (w *nativeWindow) closeOnMain() {
	w.onMainSync(w.close)
}

func (w *nativeWindow) closeAndCloseWindow() {
	w.onMainSync(func() {
		w.close()
		if w.window != objcNil {
			w.window.Send(sel("performClose:"), objcNil)
			return
		}
		app := objc.ID(objc.GetClass("NSApplication")).Send(sel("sharedApplication"))
		app.Send(sel("terminate:"), objcNil)
	})
}

func (w *nativeWindow) close() {
	if w.closed {
		return
	}
	w.closed = true
	if w.web != objcNil {
		w.bridge.SetWebView(objcNil)
		w.web.Send(sel("stopLoading"))
		w.web.Send(sel("removeFromSuperview"))
		w.web.Send(sel("release"))
		w.web = objcNil
	}
	if w.bridge != nil {
		w.bridge.Close()
	}
	if w.config != objcNil {
		w.config.Send(sel("release"))
		w.config = objcNil
	}
}

func sel(value string) objc.SEL { return objc.RegisterName(value) }

func ns(value string) objc.ID {
	return objc.ID(objc.GetClass("NSString")).Send(sel("stringWithUTF8String:"), value)
}

func objcString(value objc.ID) string {
	if value == objcNil {
		return ""
	}
	return objc.Send[string](value, sel("UTF8String"))
}
