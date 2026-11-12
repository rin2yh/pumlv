//go:build darwin

package bridge

import "testing"

func TestAssetPath(t *testing.T) {
	for _, tc := range []struct {
		name, request, want string
		valid               bool
	}{
		{name: "root document", request: "/", want: "index.html", valid: true},
		{name: "embedded asset", request: "/assets/app.js", want: "assets/app.js", valid: true},
		{name: "path traversal", request: "/../secret", want: "../secret"},
		{name: "absolute path after prefix", request: "//secret", want: "/secret"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, valid := assetPath(tc.request)
			if got != tc.want || valid != tc.valid {
				t.Fatalf("assetPath(%q) = (%q, %v), want (%q, %v)", tc.request, got, valid, tc.want, tc.valid)
			}
		})
	}
}
