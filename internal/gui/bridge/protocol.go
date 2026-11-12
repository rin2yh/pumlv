//go:build darwin

package bridge

import (
	"fmt"
	"sync"

	"github.com/ebitengine/purego/objc"
)

type protocolMethod struct {
	selector string
	types    string
}

var bridgeObjects = struct {
	sync.RWMutex
	values map[objc.ID]*Bridge
}{values: map[objc.ID]*Bridge{}}

var nativeClasses struct {
	sync.Once
	scheme, message objc.Class
	err             error
}

// Objective-C nil is a null object pointer.
const objcNil objc.ID = 0
const objcNilClass objc.Class = 0

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

func registerNativeClasses() error {
	nativeClasses.Do(func() {
		if objc.GetClass("WKWebView") == objcNilClass || objc.GetClass("WKWebViewConfiguration") == objcNilClass || objc.GetClass("WKUserContentController") == objcNilClass {
			nativeClasses.err = fmt.Errorf("WebKit classes are unavailable")
			return
		}
		schemeProtocol := getOrRegisterProtocol("WKURLSchemeHandler", []protocolMethod{
			{selector: "webView:startURLSchemeTask:", types: "v@:@@"},
			{selector: "webView:stopURLSchemeTask:", types: "v@:@@"},
		})
		messageProtocol := getOrRegisterProtocol("WKScriptMessageHandler", []protocolMethod{
			{selector: "userContentController:didReceiveScriptMessage:", types: "v@:@@"},
		})
		if schemeProtocol == nil || messageProtocol == nil {
			nativeClasses.err = fmt.Errorf("WebKit bridge protocols are unavailable")
			return
		}
		nativeClasses.scheme, nativeClasses.err = objc.RegisterClass(
			"PumlvURLSchemeHandler",
			objc.GetClass("NSObject"),
			[]*objc.Protocol{schemeProtocol},
			nil,
			[]objc.MethodDef{
				{Cmd: sel("webView:startURLSchemeTask:"), Fn: startURLSchemeTask},
				{Cmd: sel("webView:stopURLSchemeTask:"), Fn: stopURLSchemeTask},
			},
		)
		if nativeClasses.err != nil {
			return
		}
		nativeClasses.message, nativeClasses.err = objc.RegisterClass(
			"PumlvScriptMessageHandler",
			objc.GetClass("NSObject"),
			[]*objc.Protocol{messageProtocol},
			nil,
			[]objc.MethodDef{{Cmd: sel("userContentController:didReceiveScriptMessage:"), Fn: receiveScriptMessage}},
		)
	})
	return nativeClasses.err
}

func getOrRegisterProtocol(name string, methods []protocolMethod) *objc.Protocol {
	if protocol := objc.GetProtocol(name); protocol != nil {
		return protocol
	}
	protocol := objc.AllocateProtocol(name)
	if protocol == nil {
		return nil
	}
	if objectProtocol := objc.GetProtocol("NSObject"); objectProtocol != nil {
		protocol.AddProtocol(objectProtocol)
	}
	for _, method := range methods {
		protocol.AddMethodDescription(sel(method.selector), method.types, true, true)
	}
	protocol.Register()
	return protocol
}

func bindBridgeObject(object objc.ID, bridge *Bridge) {
	bridgeObjects.Lock()
	bridgeObjects.values[object] = bridge
	bridgeObjects.Unlock()
}

func unbindBridgeObject(object objc.ID) {
	bridgeObjects.Lock()
	delete(bridgeObjects.values, object)
	bridgeObjects.Unlock()
}

func bridgeForObject(object objc.ID) *Bridge {
	bridgeObjects.RLock()
	defer bridgeObjects.RUnlock()
	return bridgeObjects.values[object]
}

//revive:disable:argument-limit // Objective-C protocol selectors require self, _cmd, and two object arguments.
func startURLSchemeTask(self objc.ID, _ objc.SEL, _ objc.ID, task objc.ID) {
	if bridge := bridgeForObject(self); bridge != nil {
		bridge.serveSchemeTask(task)
	}
}

//revive:enable:argument-limit

// serveSchemeTask completes or fails each embedded asset synchronously, so there is no pending load to cancel.
func stopURLSchemeTask(objc.ID, objc.SEL, objc.ID, objc.ID) {}

//revive:disable:argument-limit // Objective-C protocol selectors require self, _cmd, and two object arguments.
func receiveScriptMessage(self objc.ID, _ objc.SEL, _ objc.ID, message objc.ID) {
	if bridge := bridgeForObject(self); bridge != nil {
		bridge.receiveMessage(objcString(message.Send(sel("body"))))
	}
}

//revive:enable:argument-limit
