//go:build !darwin

package main

import "fmt"

func runNative() error { return fmt.Errorf("native integration tests require macOS") }
