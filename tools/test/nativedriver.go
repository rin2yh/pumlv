//go:build darwin

package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/ebitengine/purego"
	"github.com/ebitengine/purego/objc"
)

const (
	treeRowCenterX       = 100.0
	treeFirstRowCenterY  = 64.0
	treeRowHeight        = 24.0
	sourceRootToggleX    = 8.0
	sourceRootToggleY    = 64.0
	windowContentCenterY = 300.0
)

const (
	secondMarkdownDiagramRow = 5
	sequenceDiagramRow       = 7
	newLiveFileRow           = 8
)

type point struct{ X, Y float64 }
type rect struct{ X, Y, W, H float64 }

type nativeDriver struct {
	queue       uintptr
	dispatch    func(uintptr, objc.Block)
	window, web objc.ID
}

// Objective-C nil is a null object pointer.
const objcNil objc.ID = 0

// NSEventType values from AppKit/NSEvent.h.
const (
	leftMouseDown        uint64  = 1
	leftMouseUp          uint64  = 2
	leftMouseDragged     uint64  = 6
	noModifierKeys       uint64  = 0
	syntheticTimestamp   float64 = 0 // Preserve the synthetic event's timestamp.
	syntheticEventNumber int64   = 1
	singleClick          int64   = 1
	pressedMousePressure float32 = 1
)

func newNativeDriver() (*nativeDriver, error) {
	queue, err := purego.Dlsym(purego.RTLD_DEFAULT, "_dispatch_main_q")
	if err != nil {
		return nil, err
	}
	driver := &nativeDriver{queue: queue}
	purego.RegisterLibFunc(&driver.dispatch, purego.RTLD_DEFAULT, "dispatch_async")
	return driver, nil
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

func (d *nativeDriver) onMain(callback func()) {
	done := make(chan struct{})
	block := objc.NewBlock(func(_ objc.Block) {
		defer close(done)
		callback()
	})
	d.dispatch(d.queue, block)
	block.Release()
	<-done
}

func (d *nativeDriver) attach() error {
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		d.onMain(func() {
			app := objc.ID(objc.GetClass("NSApplication")).Send(sel("sharedApplication"))
			windows := app.Send(sel("windows"))
			for i := uint64(0); i < objc.Send[uint64](windows, sel("count")); i++ {
				candidate := windows.Send(sel("objectAtIndex:"), i)
				if objcString(candidate.Send(sel("title"))) != "pumlv" {
					continue
				}
				d.window = candidate
				d.window.Send(sel("makeKeyAndOrderFront:"), objcNil)
				app.Send(sel("activateIgnoringOtherApps:"), true)
				d.web = d.window.Send(sel("contentView")).Send(sel("subviews")).Send(sel("lastObject"))
				return
			}
		})
		if d.window != objcNil && d.web != objcNil {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("native window not found")
}

func (d *nativeDriver) closeApplication() {
	d.onMain(func() {
		if d.window != objcNil {
			d.window.Send(sel("performClose:"), objcNil)
			return
		}
		app := objc.ID(objc.GetClass("NSApplication")).Send(sel("sharedApplication"))
		app.Send(sel("terminate:"), objcNil)
	})
}

func (d *nativeDriver) evaluate(code string) (string, error) {
	results := make(chan string, 1)
	d.onMain(func() {
		completion := objc.NewBlock(func(_ objc.Block, value, err objc.ID) {
			if err != objcNil || value == objcNil {
				results <- ""
				return
			}
			results <- objcString(value)
		})
		d.web.Send(sel("evaluateJavaScript:completionHandler:"), ns(code), completion)
		completion.Release()
	})
	select {
	case result := <-results:
		return result, nil
	case <-time.After(10 * time.Second):
		return "", fmt.Errorf("JavaScript callback timed out")
	}
}

func (d *nativeDriver) expectJavaScript(code, want string) error {
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		got, err := d.evaluate(code)
		if err != nil {
			return err
		}
		if got == want {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("JavaScript value did not reach %q", want)
}

func (d *nativeDriver) expectURLScheme(scheme string) error {
	return d.expectJavaScript("location.protocol", scheme)
}

func (d *nativeDriver) expectHeader(text string) error {
	return d.expectJavaScript(`document.querySelector('header span')?.textContent || ''`, text)
}

func (d *nativeDriver) expectPreviewContains(text string) error {
	code := fmt.Sprintf(`String(decodeURIComponent(document.querySelector('img[alt="preview"]')?.src || '').includes(%q))`, text)
	return d.expectJavaScript(code, "true")
}

func (d *nativeDriver) expectPreviewControls() error {
	code := `String(!!document.querySelector('img[alt="preview"]') && !!document.querySelector('button[aria-label="Zoom in"]'))`
	return d.expectJavaScript(code, "true")
}

func expectNoTCPListener() error {
	command := exec.Command("lsof", "-nP", "-a", "-p", strconv.Itoa(os.Getpid()), "-iTCP", "-sTCP:LISTEN")
	output, err := command.CombinedOutput()
	if err == nil {
		return fmt.Errorf("GUI mode opened a TCP listener:\n%s", output)
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) && exitErr.ExitCode() == 1 && len(output) == 0 {
		return nil
	}
	return fmt.Errorf("inspect GUI TCP listeners: %w: %s", err, output)
}

func (d *nativeDriver) clickAt(location point) {
	d.sendMouse(leftMouseDown, location)
	time.Sleep(150 * time.Millisecond)
	d.sendMouse(leftMouseUp, location)
	time.Sleep(350 * time.Millisecond)
}

func (d *nativeDriver) drag(from, to point) {
	d.sendMouse(leftMouseDown, from)
	time.Sleep(120 * time.Millisecond)
	d.sendMouse(leftMouseDragged, to)
	time.Sleep(180 * time.Millisecond)
	d.sendMouse(leftMouseUp, to)
	time.Sleep(350 * time.Millisecond)
}

func (d *nativeDriver) sendMouse(kind uint64, location point) {
	d.onMain(func() {
		content := d.window.Send(sel("contentView"))
		contentHeight := objc.Send[rect](content, sel("bounds")).H
		screen := objc.ID(objc.GetClass("NSScreen")).Send(sel("screens")).Send(sel("objectAtIndex:"), uint64(0))
		screenHeight := objc.Send[rect](screen, sel("frame")).H
		windowPoint := point{location.X, contentHeight - location.Y}
		pointOnScreen := objc.Send[point](d.window, sel("convertPointToScreen:"), windowPoint)
		var warp func(point) int32
		purego.RegisterLibFunc(&warp, purego.RTLD_DEFAULT, "CGWarpMouseCursorPosition")
		_ = warp(point{pointOnScreen.X, screenHeight - pointOnScreen.Y})
		event := objc.ID(objc.GetClass("NSEvent")).Send(
			sel("mouseEventWithType:location:modifierFlags:timestamp:windowNumber:context:eventNumber:clickCount:pressure:"),
			kind, windowPoint, noModifierKeys, syntheticTimestamp, d.window.Send(sel("windowNumber")), objcNil, syntheticEventNumber, singleClick, pressedMousePressure,
		)
		d.window.Send(sel("sendEvent:"), event)
	})
}

func (d *nativeDriver) sidebarWidth() float64 {
	var width float64
	d.onMain(func() { width = objc.Send[rect](d.web, sel("frame")).X })
	return width
}

func (d *nativeDriver) resizeSidebarTo(targetX float64) {
	d.drag(point{X: d.sidebarWidth() - 4, Y: windowContentCenterY}, point{X: targetX, Y: windowContentCenterY})
}

func (d *nativeDriver) maximumSidebarWidth() float64 {
	var width float64
	d.onMain(func() {
		content := d.window.Send(sel("contentView"))
		width = objc.Send[rect](content, sel("bounds")).W / 2
	})
	return width
}

func (d *nativeDriver) expectSidebarWidth(want float64) error {
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if got := d.sidebarWidth(); got >= want-12 && got <= want+12 {
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("sidebar width: got %.1f, want %.1f", d.sidebarWidth(), want)
}

func (d *nativeDriver) toggleSourceDirectory() {
	d.clickAt(point{X: sourceRootToggleX, Y: sourceRootToggleY})
}

func (d *nativeDriver) selectSequenceDiagram() {
	d.selectTreeRow(sequenceDiagramRow)
}

func (d *nativeDriver) selectSecondMarkdownDiagram() {
	d.selectTreeRow(secondMarkdownDiagramRow)
}

func (d *nativeDriver) selectNewLiveFile() {
	d.selectTreeRow(newLiveFileRow)
}

func (d *nativeDriver) selectTreeRow(row int) {
	center := point{X: treeRowCenterX, Y: treeFirstRowCenterY + float64(row)*treeRowHeight}
	d.clickAt(center)
}

func (d *nativeDriver) reloadWebView() {
	d.onMain(func() { d.web.Send(sel("reload")) })
}

func (d *nativeDriver) expectFileListed(name string) error {
	requestID := fmt.Sprintf("native-test-files-%d", time.Now().UnixNano())
	request := fmt.Sprintf(`(() => { window.__nativeFiles = null; const id = %q; const listener = e => { if (e.detail.id === id) { window.__nativeFiles = e.detail.data; window.removeEventListener("pumlv:response", listener); } }; window.addEventListener("pumlv:response", listener); window.webkit.messageHandlers.pumlv.postMessage(JSON.stringify({id,type:"files"})); return "requested"; })()`, requestID)
	if _, err := d.evaluate(request); err != nil {
		return err
	}
	listed := fmt.Sprintf(`String((window.__nativeFiles || []).some(file => file.name === %q))`, name)
	if err := d.expectJavaScript(listed, "true"); err != nil {
		return fmt.Errorf("native bridge did not list %q: %w", name, err)
	}
	return nil
}
