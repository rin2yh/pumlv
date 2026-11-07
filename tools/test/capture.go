//go:build darwin

package main

import (
	"log"

	"github.com/ebitengine/purego"
	"github.com/ebitengine/purego/objc"
)

// NSBitmapImageFileTypePNG from AppKit/NSBitmapImageRep.h.
const bitmapImageFileTypePNG uint64 = 4

const capturePixelsPerPoint = 2

// Capture only this process's window through the public ScreenCaptureKit API.
func captureWindow() {
	if _, err := purego.Dlopen("/System/Library/Frameworks/ScreenCaptureKit.framework/ScreenCaptureKit", purego.RTLD_NOW|purego.RTLD_GLOBAL); err != nil {
		panic(err)
	}
	callback := objc.NewBlock(func(_ objc.Block, shareable, err objc.ID) {
		if err != objcNil {
			log.Printf("own capture enumeration error=%s", objc.Send[string](err.Send(sel("description")), sel("UTF8String")))
			return
		}
		windows := shareable.Send(sel("windows"))
		for i := uint64(0); i < objc.Send[uint64](windows, sel("count")); i++ {
			w := windows.Send(sel("objectAtIndex:"), i)
			title := objc.Send[string](w.Send(sel("title")), sel("UTF8String"))
			if title != "pumlv" {
				continue
			}
			filter := objc.ID(objc.GetClass("SCContentFilter")).Send(sel("alloc")).Send(sel("initWithDesktopIndependentWindow:"), w)
			config := objc.ID(objc.GetClass("SCStreamConfiguration")).Send(sel("new"))
			bounds := objc.Send[rect](w, sel("frame"))
			config.Send(sel("setWidth:"), uint64(bounds.W*capturePixelsPerPoint))
			config.Send(sel("setHeight:"), uint64(bounds.H*capturePixelsPerPoint))
			complete := objc.NewBlock(func(_ objc.Block, img uintptr, err objc.ID) {
				if err != objcNil {
					log.Printf("own capture error=%s", objc.Send[string](err.Send(sel("description")), sel("UTF8String")))
					return
				}
				bitmap := objc.ID(objc.GetClass("NSBitmapImageRep")).Send(sel("alloc")).Send(sel("initWithCGImage:"), img)
				data := bitmap.Send(sel("representationUsingType:properties:"), bitmapImageFileTypePNG, objc.ID(objc.GetClass("NSDictionary")).Send(sel("dictionary")))
				ok := objc.Send[bool](data, sel("writeToFile:atomically:"), ns("/tmp/pumlv-gui.png"), true)
				bitmap.Send(sel("release"))
				log.Printf("native window captured=%v", ok)
			})
			objc.ID(objc.GetClass("SCScreenshotManager")).Send(sel("captureImageWithFilter:configuration:completionHandler:"), filter, config, complete)
			complete.Release()
			filter.Send(sel("release"))
			config.Send(sel("release"))
			return
		}
		log.Print("own capture window not found")
	})
	objc.ID(objc.GetClass("SCShareableContent")).Send(sel("getCurrentProcessShareableContentWithCompletionHandler:"), callback)
	callback.Release()
}
