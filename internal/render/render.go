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
	if err := r.initInterpreter(ctx); err != nil {
		return "", err
	}
	r.currentCtx = ctx
	// A cancelled evaluation may leave a suspended TeaVM thread behind.
	defer func() {
		if ctx.Err() != nil {
			r.js.Close()
			r.js = nil
		}
	}()

	if err := r.startRender(ctx, source); err != nil {
		return "", err
	}
	return r.waitForSVG(ctx)
}

func (r *Renderer) initInterpreter(ctx context.Context) error {
	if r.js != nil {
		return nil
	}
	js, err := r.newInterpreter(ctx)
	if err != nil {
		return err
	}
	r.js = js
	return nil
}

func (r *Renderer) startRender(ctx context.Context, source string) error {
	lines := strings.Split(strings.ReplaceAll(strings.ReplaceAll(source, "\r\n", "\n"), "\r", "\n"), "\n")
	encoded, err := json.Marshal(lines)
	if err != nil {
		return err
	}
	script := fmt.Sprintf(`globalThis.__result = null;
renderToString(%s,
  svg => { __result = {svg} },
  error => { __result = {error} },
  {maxSvgSize: 65536}
)`, encoded)
	return evalScript(ctx, r.js, script)
}

func (r *Renderer) waitForSVG(ctx context.Context) (string, error) {
	// Browser setTimeout(0) is replaced by an explicit event queue. Eval drains
	// Promise jobs, including the Graphviz callback, between queue iterations.
	for i := 0; i < 10000; i++ {
		if err := evalScript(ctx, r.js, "{const tasks=__timers.splice(0);for(const task of tasks)task()}"); err != nil {
			return "", err
		}
		svg, ready, err := r.readSVGResult(ctx)
		if err != nil {
			return "", err
		}
		if !ready {
			continue
		}
		return svg, nil
	}
	return "", errors.New("PlantUML render did not complete")
}

func (r *Renderer) readSVGResult(ctx context.Context) (string, bool, error) {
	result, err := r.js.Eval(ctx, "__result === null ? null : JSON.stringify(__result)")
	if err != nil {
		return "", false, err
	}
	if result.Error != nil {
		return "", false, result.Error
	}
	if result.Value.String() == "null" {
		return "", false, nil
	}
	var value struct {
		SVG   string `json:"svg"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(result.Value.String()), &value); err != nil {
		return "", false, err
	}
	if value.Error != "" {
		return "", false, errors.New(value.Error)
	}
	return value.SVG, true, nil
}

func (r *Renderer) newInterpreter(ctx context.Context) (*spidermonkey.JS, error) {
	js, err := spidermonkey.New(spidermonkey.Config{})
	if err != nil {
		return nil, err
	}
	initialized := false
	defer func() {
		if !initialized {
			js.Close()
		}
	}()
	if err := r.registerHostFunctions(js); err != nil {
		return nil, err
	}
	if err := loadRendererScripts(ctx, js); err != nil {
		return nil, err
	}
	initialized = true
	return js, nil
}

func (r *Renderer) registerHostFunctions(js *spidermonkey.JS) error {
	if err := js.Global().DefineFunc("renderDot", r.renderDot); err != nil {
		return err
	}
	return js.Global().DefineFunc("hostMeasureText", r.hostMeasureText)
}

func (r *Renderer) renderDot(_ spidermonkey.Config, args []spidermonkey.Value) (spidermonkey.Value, error) {
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
}

func (r *Renderer) hostMeasureText(_ spidermonkey.Config, args []spidermonkey.Value) (spidermonkey.Value, error) {
	if len(args) < 2 {
		return nil, errors.New("expected text and font")
	}
	return spidermonkey.ValueOf(r.measureText(args[0].String(), args[1].String())), nil
}

func loadRendererScripts(ctx context.Context, js *spidermonkey.JS) error {
	for _, name := range []string{"buffer.js", "dom.js", "plantuml.js"} {
		script, err := assets.ReadFile("assets/" + name)
		if err != nil {
			return err
		}
		if err := evalScript(ctx, js, string(script)); err != nil {
			return fmt.Errorf("load %s: %w", name, err)
		}
	}
	return evalScript(ctx, js, `
globalThis.console = {info() {}, log() {}, error() {}};
globalThis.__timers = [];
globalThis.setTimeout = callback => { __timers.push(callback); return __timers.length };
globalThis.clearTimeout = () => {};
globalThis.Viz = {instance: async () => ({renderString: renderDot})};
`)
}

func evalScript(ctx context.Context, js *spidermonkey.JS, script string) error {
	result, err := js.Eval(ctx, script)
	if err != nil {
		return err
	}
	return result.Error
}
