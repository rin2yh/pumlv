//go:build darwin

package bridge

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"unsafe"

	"github.com/ebitengine/purego/objc"
)

func assetPath(requestPath string) (string, bool) {
	asset := strings.TrimPrefix(requestPath, "/")
	if asset == "" {
		asset = "index.html"
	}
	asset = path.Clean(asset)
	return asset, fs.ValidPath(asset) && !strings.HasPrefix(asset, "../")
}

func (b *Bridge) serveSchemeTask(task objc.ID) {
	request := task.Send(sel("request"))
	requestURL := request.Send(sel("URL"))
	requestPath := objcString(requestURL.Send(sel("path")))
	if requestPath == "/" || requestPath == "" {
		b.onMain(func() { b.pageReady = false })
	}
	asset, valid := assetPath(requestPath)
	if !valid {
		b.failSchemeTask(task, http.StatusNotFound)
		return
	}
	data, err := fs.ReadFile(b.assets, asset)
	if err != nil {
		b.failSchemeTask(task, http.StatusNotFound)
		return
	}
	contentType := mime.TypeByExtension(filepath.Ext(asset))
	encoding := objcNil
	if mediaType, params, parseErr := mime.ParseMediaType(contentType); parseErr == nil {
		contentType = mediaType
		if params["charset"] != "" {
			encoding = ns(params["charset"])
		}
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	response := objc.ID(objc.GetClass("NSURLResponse")).Send(sel("alloc")).Send(sel("initWithURL:MIMEType:expectedContentLength:textEncodingName:"), requestURL, ns(contentType), int64(len(data)), encoding)
	dataObject := objc.ID(objc.GetClass("NSData")).Send(sel("alloc")).Send(sel("initWithBytes:length:"), unsafe.Pointer(unsafe.SliceData(data)), uint64(len(data)))
	task.Send(sel("didReceiveResponse:"), response)
	task.Send(sel("didReceiveData:"), dataObject)
	task.Send(sel("didFinish"))
	dataObject.Send(sel("release"))
	response.Send(sel("release"))
}

func (b *Bridge) failSchemeTask(task objc.ID, code int64) {
	err := objc.ID(objc.GetClass("NSError")).Send(sel("errorWithDomain:code:userInfo:"), ns("pumlv"), code, objcNil)
	task.Send(sel("didFailWithError:"), err)
}
