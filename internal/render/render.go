package render

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	graphviz "github.com/goccy/go-graphviz"
	spidermonkey "github.com/goccy/go-spidermonkey"
	"golang.org/x/image/font"
)

//go:embed assets/*.js
var assets embed.FS

// Renderer owns one JavaScript interpreter. A render is serialized so that
// TeaVM's timers and callbacks cannot leak into the next diagram.
type Renderer struct {
	mu         sync.Mutex
	js         *spidermonkey.JS
	currentCtx context.Context
	faces      map[int]font.Face
}

func (r *Renderer) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.js != nil {
		r.js.Close()
		r.js = nil
	}
	for _, face := range r.faces {
		_ = face.Close()
	}
	r.faces = nil
}

func (r *Renderer) Render(ctx context.Context, source string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.js == nil {
		js, err := r.newInterpreter(ctx)
		if err != nil {
			return "", err
		}
		r.js = js
	}
	js := r.js
	r.currentCtx = ctx
	// A cancelled evaluation may leave a suspended TeaVM thread behind.
	defer func() {
		if ctx.Err() != nil {
			js.Close()
			r.js = nil
		}
	}()
	lines := strings.Split(strings.ReplaceAll(strings.ReplaceAll(source, "\r\n", "\n"), "\r", "\n"), "\n")
	encoded, err := json.Marshal(lines)
	if err != nil {
		return "", err
	}
	script := fmt.Sprintf("globalThis.__result=null;renderToString(%s,s=>{__result={svg:s}},e=>{__result={error:e}},{maxSvgSize:65536})", encoded)
	if err := eval(ctx, js, script); err != nil {
		return "", err
	}
	// Browser setTimeout(0) is replaced by an explicit event queue. Eval drains
	// Promise jobs, including the Graphviz callback, between queue iterations.
	for i := 0; i < 10000; i++ {
		if err := eval(ctx, js, "{const tasks=__timers.splice(0);for(const task of tasks)task()}"); err != nil {
			return "", err
		}
		result, err := js.Eval(ctx, "__result === null ? null : JSON.stringify(__result)")
		if err != nil {
			return "", err
		}
		if result.Error != nil {
			return "", result.Error
		}
		if result.Value.String() == "null" {
			continue
		}
		var value struct {
			SVG   string `json:"svg"`
			Error string `json:"error"`
		}
		if err := json.Unmarshal([]byte(result.Value.String()), &value); err != nil {
			return "", err
		}
		if value.Error != "" {
			return "", errors.New(value.Error)
		}
		return value.SVG, nil
	}
	return "", errors.New("PlantUML render did not complete")
}

func (r *Renderer) newInterpreter(ctx context.Context) (*spidermonkey.JS, error) {
	js, err := spidermonkey.New(spidermonkey.Config{})
	if err != nil {
		return nil, err
	}
	ok := false
	defer func() {
		if !ok {
			js.Close()
		}
	}()
	if err := js.Global().DefineFunc("renderDot", func(_ spidermonkey.Config, args []spidermonkey.Value) (spidermonkey.Value, error) {
		if len(args) < 1 {
			return nil, errors.New("expected DOT source")
		}
		graph, err := graphviz.ParseBytes([]byte(args[0].String()))
		if err != nil {
			return nil, err
		}
		defer graph.Close()
		g, err := graphviz.New(r.currentCtx)
		if err != nil {
			return nil, err
		}
		defer g.Close()
		var out bytes.Buffer
		if err := g.Render(r.currentCtx, graph, graphviz.SVG, &out); err != nil {
			return nil, err
		}
		return spidermonkey.ValueOf(out.String()), nil
	}); err != nil {
		return nil, err
	}
	if err := js.Global().DefineFunc("hostMeasureText", func(_ spidermonkey.Config, args []spidermonkey.Value) (spidermonkey.Value, error) {
		if len(args) < 2 {
			return nil, errors.New("expected text and font")
		}
		return spidermonkey.ValueOf(r.textWidth(args[0].String(), args[1].String())), nil
	}); err != nil {
		return nil, err
	}
	for _, name := range []string{"buffer.js", "dom.js", "plantuml.js"} {
		script, err := assets.ReadFile("assets/" + name)
		if err != nil {
			return nil, err
		}
		if err := eval(ctx, js, string(script)); err != nil {
			return nil, fmt.Errorf("load %s: %w", name, err)
		}
	}
	if err := eval(ctx, js, `globalThis.console={info(){},log(){},error(){}};globalThis.__timers=[];globalThis.setTimeout=f=>{__timers.push(f);return __timers.length};globalThis.clearTimeout=()=>{};globalThis.Viz={instance:async()=>({renderString:renderDot})};`); err != nil {
		return nil, err
	}
	ok = true
	return js, nil
}

func eval(ctx context.Context, js *spidermonkey.JS, script string) error {
	result, err := js.Eval(ctx, script)
	if err != nil {
		return err
	}
	return result.Error
}
