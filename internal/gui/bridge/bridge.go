//go:build darwin

package bridge

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"time"

	"github.com/ebitengine/purego/objc"
	"github.com/rin2yh/pumlv/internal/server"
)

const schemeName = "pumlv"

type pageEvent struct {
	name   string
	detail json.RawMessage
}

type bridgeRequest struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Path string `json:"path"`
	Line *int   `json:"line"`
}

type bridgeResponse struct {
	ID    string `json:"id"`
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

// Bridge connects the shared file core to WKWebView messages and asset requests.
type Bridge struct {
	assets              fs.FS
	core                *server.Core
	onMain              func(func())
	web                 objc.ID
	controller          objc.ID
	schemeHandler       objc.ID
	messageHandler      objc.ID
	selection           string
	pending, delivering bool
	pageReady           bool
	pendingEvents       []pageEvent
	nextDelivery        time.Time
}

func New(core *server.Core, assets fs.FS, onMain func(func())) *Bridge {
	return &Bridge{core: core, assets: assets, onMain: onMain}
}

// SetWebView supplies the view created after Install. Call it on the AppKit main thread.
func (b *Bridge) SetWebView(web objc.ID) {
	b.web = web
}

func (b *Bridge) Install(configuration objc.ID) error {
	if err := registerNativeClasses(); err != nil {
		return err
	}
	b.controller = configuration.Send(sel("userContentController"))
	b.schemeHandler = objc.ID(nativeClasses.scheme).Send(sel("new"))
	b.messageHandler = objc.ID(nativeClasses.message).Send(sel("new"))
	if b.controller == objcNil || b.schemeHandler == objcNil || b.messageHandler == objcNil {
		return fmt.Errorf("create WebKit bridge handlers")
	}
	bindBridgeObject(b.schemeHandler, b)
	bindBridgeObject(b.messageHandler, b)
	configuration.Send(sel("setURLSchemeHandler:forURLScheme:"), b.schemeHandler, ns(schemeName))
	b.controller.Send(sel("addScriptMessageHandler:name:"), b.messageHandler, ns(schemeName))
	return nil
}

func (b *Bridge) SelectFile(selection string) {
	b.onMain(func() {
		b.selection = selection
		b.pending = true
		b.deliverSelection()
	})
}

func (b *Bridge) deliverSelection() {
	web := b.web
	if web == objcNil || !b.pageReady || objc.Send[bool](web, sel("isLoading")) || !b.pending || b.delivering || time.Now().Before(b.nextDelivery) {
		return
	}
	b.delivering = true
	b.nextDelivery = time.Now().Add(100 * time.Millisecond)
	selection := b.selection
	detail, _ := json.Marshal(selection)
	callback := objc.NewBlock(func(_ objc.Block, result, err objc.ID) {
		b.delivering = false
		if err == objcNil && result != objcNil && objc.Send[bool](result, sel("boolValue")) && b.selection == selection {
			b.pending = false
		}
	})
	code := `window.dispatchEvent(new CustomEvent("pumlv:select",{detail:` + string(detail) + `}))`
	web.Send(sel("evaluateJavaScript:completionHandler:"), ns(code), callback)
	callback.Release()
}

func (b *Bridge) DispatchPageEvent(name string, detail any) {
	encoded, err := json.Marshal(detail)
	if err != nil {
		return
	}
	event := pageEvent{name: name, detail: encoded}
	b.onMain(func() {
		if !b.pageReady {
			b.pendingEvents = append(b.pendingEvents, event)
			return
		}
		b.evaluatePageEvent(event)
	})
}

func (b *Bridge) evaluatePageEvent(event pageEvent) {
	if b.web == objcNil {
		return
	}
	code := `window.dispatchEvent(new CustomEvent(` + string(mustJSON(event.name)) + `,{detail:` + string(event.detail) + `}))`
	b.web.Send(sel("evaluateJavaScript:completionHandler:"), ns(code), objcNil)
}

func mustJSON(value string) []byte {
	encoded, _ := json.Marshal(value)
	return encoded
}

func (b *Bridge) pageDidBecomeReady() {
	b.pageReady = true
	for _, event := range b.pendingEvents {
		b.evaluatePageEvent(event)
	}
	b.pendingEvents = nil
	b.deliverSelection()
}

func (b *Bridge) receiveMessage(raw string) {
	var request bridgeRequest
	if err := json.Unmarshal([]byte(raw), &request); err != nil {
		return
	}
	if request.Type == "ready" {
		b.onMain(b.pageDidBecomeReady)
		return
	}
	if request.ID == "" {
		return
	}
	go func() {
		response := bridgeResponse{ID: request.ID, OK: true}
		switch request.Type {
		case "files":
			response.Data = b.core.List()
		case "file":
			data, err := b.core.ReadFile(request.Path, request.Line)
			if err != nil {
				response.OK = false
				response.Error = err.Error()
			} else {
				response.Data = string(data)
			}
		default:
			response.OK = false
			response.Error = "unknown native request"
		}
		b.DispatchPageEvent("pumlv:response", response)
	}()
}

func (b *Bridge) Close() {
	if b.controller != objcNil {
		b.controller.Send(sel("removeScriptMessageHandlerForName:"), ns(schemeName))
		b.controller = objcNil
	}
	if b.schemeHandler != objcNil {
		unbindBridgeObject(b.schemeHandler)
		b.schemeHandler.Send(sel("release"))
		b.schemeHandler = objcNil
	}
	if b.messageHandler != objcNil {
		unbindBridgeObject(b.messageHandler)
		b.messageHandler.Send(sel("release"))
		b.messageHandler = objcNil
	}
}
