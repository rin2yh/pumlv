//go:build darwin

package gui

import (
	"fmt"
	"image"
	"image/color"
	"reflect"
	"sync"

	"github.com/guigui-gui/guigui"
	"github.com/guigui-gui/guigui/basicwidget"
	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
)

type sidebarLayout struct {
	mu          sync.RWMutex
	width       float64
	windowWidth float64
}

func newSidebarLayout(width float64) *sidebarLayout {
	return &sidebarLayout{width: width}
}

func (s *sidebarLayout) Width() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.width
}

func (s *sidebarLayout) SetWindowWidth(width float64) {
	s.mu.Lock()
	s.windowWidth = width
	s.width = clampSidebarWidth(s.width, width)
	s.mu.Unlock()
}

func (s *sidebarLayout) Set(width float64) {
	s.mu.Lock()
	s.width = clampSidebarWidth(width, s.windowWidth)
	s.mu.Unlock()
}

func clampSidebarWidth(width, windowWidth float64) float64 {
	maximum := windowWidth / 2
	if maximum < 200 {
		maximum = 200
	}
	return min(max(width, 200), maximum)
}

type root struct {
	guigui.DefaultWidget
	background  basicwidget.Background
	title       basicwidget.Text
	tree        basicwidget.List[string]
	divider     splitter
	rows        []treeRow
	collapsed   map[string]bool
	files       []fileEntry
	updates     chan []fileEntry
	selected    string
	layout      *sidebarLayout
	attachError <-chan error
	onSelect    func(string)
	onLayout    func()
	lastBounds  image.Rectangle
	lastWidth   float64
}

func (r *root) Build(c *guigui.Context, a *guigui.ChildAdder) error {
	c.SetPreferredColorMode(ebiten.ColorModeLight)
	a.AddWidget(&r.background)
	a.AddWidget(&r.title)
	r.title.SetValue("pumlv")
	a.AddWidget(&r.tree)
	r.tree.SetStyle(basicwidget.ListStyleSidebar)
	r.tree.SetItemHeight(int(24 * ebiten.Monitor().DeviceScaleFactor()))
	r.tree.SetHoverBackgroundVisible(true)
	if r.collapsed == nil {
		r.collapsed = map[string]bool{}
	}
	r.rows = buildRows(r.files)
	r.selected = reconcileSelection(r.files, r.selected)
	items := make([]basicwidget.ListItem[string], 0, len(r.rows))
	for _, row := range r.rows {
		items = append(items, basicwidget.ListItem[string]{Text: row.label, Value: row.key, IndentLevel: row.depth, Unselectable: row.selection == "", Collapsed: r.collapsed[row.key]})
	}
	r.tree.SetItems(items)
	r.tree.SelectItemByValue(r.selected)
	r.tree.OnItemSelected(func(_ *guigui.Context, index int) {
		if index < 0 || index >= len(r.rows) {
			return
		}
		selection := r.rows[index].selection
		if selection != "" && selection != r.selected {
			r.selected = selection
			r.onSelect(selection)
		}
	})
	r.tree.OnItemExpanderToggled(func(_ *guigui.Context, index int, expanded bool) {
		if index >= 0 && index < len(r.rows) {
			r.collapsed[r.rows[index].key] = !expanded
		}
	})
	r.divider.layout = r.layout
	a.AddWidget(&r.divider)
	return nil
}

func (r *root) Layout(_ *guigui.Context, b *guigui.WidgetBounds, l *guigui.ChildLayouter) {
	scale := ebiten.Monitor().DeviceScaleFactor()
	bounds := b.Bounds()
	r.layout.SetWindowWidth(float64(bounds.Dx()) / scale)
	width := int(r.layout.Width() * scale)
	l.LayoutWidget(&r.background, bounds)
	l.LayoutWidget(&r.title, image.Rect(int(16*scale), int(12*scale), width-int(16*scale), int(42*scale)))
	l.LayoutWidget(&r.tree, image.Rect(0, int(52*scale), width-int(8*scale), bounds.Max.Y))
	l.LayoutWidget(&r.divider, image.Rect(width-int(8*scale), 0, width, bounds.Max.Y))
	if bounds != r.lastBounds || r.layout.Width() != r.lastWidth {
		r.lastBounds = bounds
		r.lastWidth = r.layout.Width()
		if r.onLayout != nil {
			r.onLayout()
		}
	}
}

func (r *root) Tick(_ *guigui.Context, _ *guigui.WidgetBounds) error {
	if r.attachError != nil {
		select {
		case err := <-r.attachError:
			if err != nil {
				return fmt.Errorf("attach native preview: %w", err)
			}
		default:
		}
	}
	select {
	case files := <-r.updates:
		if !reflect.DeepEqual(r.files, files) {
			r.files = files
			selected := reconcileSelection(files, r.selected)
			if selected != r.selected {
				r.selected = selected
				r.onSelect(selected)
			}
			guigui.RequestRebuild()
		}
	default:
	}
	return nil
}

type splitter struct {
	guigui.DefaultWidget
	layout   *sidebarLayout
	dragging bool
}

func (s *splitter) HandlePointingInput(_ *guigui.Context, bounds *guigui.WidgetBounds) guigui.HandleInputResult {
	if !s.dragging && bounds.IsHitAtCursor() && inpututil.IsMouseButtonJustPressed(ebiten.MouseButtonLeft) {
		s.dragging = true
		s.resize()
		return guigui.HandleInputByWidget(s)
	}
	if s.dragging && ebiten.IsMouseButtonPressed(ebiten.MouseButtonLeft) {
		s.resize()
		return guigui.HandleInputByWidget(s)
	}
	if s.dragging {
		s.dragging = false
		return guigui.HandleInputByWidget(s)
	}
	return guigui.HandleInputResult{}
}

func (s *splitter) resize() {
	x, _ := ebiten.CursorPosition()
	s.layout.Set(float64(x) / ebiten.Monitor().DeviceScaleFactor())
	guigui.RequestRebuild()
}

func (s *splitter) CursorShape(_ *guigui.Context, _ *guigui.WidgetBounds) (ebiten.CursorShapeType, bool) {
	return ebiten.CursorShapeEWResize, true
}

func (s *splitter) Draw(_ *guigui.Context, _ *guigui.WidgetBounds, dst *ebiten.Image) {
	dst.Fill(color.RGBA{R: 226, G: 232, B: 240, A: 255})
}
