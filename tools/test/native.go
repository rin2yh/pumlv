//go:build darwin

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rin2yh/pumlv/cmd"
)

func runNative() error {
	os.Args = []string{"pumlv", "gui", "./examples"}
	driver, err := newNativeDriver()
	if err != nil {
		return err
	}

	result := make(chan error, 1)
	go func() {
		result <- runNativeScenario(driver)
		driver.closeApplication()
	}()
	if err := cmd.Execute(); err != nil {
		return err
	}
	return <-result
}

func runNativeScenario(driver *nativeDriver) error {
	if err := driver.attach(); err != nil {
		return err
	}
	if err := driver.expectURLScheme("pumlv:"); err != nil {
		return err
	}
	if err := expectNoTCPListener(); err != nil {
		return err
	}
	if err := verifySidebarResizing(driver); err != nil {
		return err
	}
	if err := verifyTreeSelection(driver); err != nil {
		return err
	}
	driver.onMain(captureWindow)
	time.Sleep(time.Second)
	if err := verifyLiveFileChanges(driver); err != nil {
		return err
	}
	log.Print("native scheme, bridge, tree changes, selection, resizing, Markdown selection and preview passed")
	return nil
}

func verifySidebarResizing(driver *nativeDriver) error {
	if err := driver.expectSidebarWidth(288); err != nil {
		return err
	}
	driver.resizeSidebarTo(360)
	if err := driver.expectSidebarWidth(360); err != nil {
		return err
	}
	driver.resizeSidebarTo(100)
	if err := driver.expectSidebarWidth(200); err != nil {
		return err
	}
	driver.resizeSidebarTo(1000)
	if err := driver.expectSidebarWidth(driver.maximumSidebarWidth()); err != nil {
		return err
	}
	driver.resizeSidebarTo(288)
	return driver.expectSidebarWidth(288)
}

func verifyTreeSelection(driver *nativeDriver) error {
	if err := driver.expectHeader("class.puml"); err != nil {
		return err
	}
	driver.toggleSourceDirectory()
	driver.selectSequenceDiagram()
	if err := driver.expectHeader("class.puml"); err != nil {
		return err
	}
	driver.toggleSourceDirectory()

	// Select immediately after reload to exercise listener readiness and replay.
	driver.reloadWebView()
	driver.selectSequenceDiagram()
	if err := driver.expectHeader("seq.puml"); err != nil {
		return err
	}
	if err := driver.expectPreviewControls(); err != nil {
		return err
	}
	driver.selectSecondMarkdownDiagram()
	return driver.expectPreviewContains("Markdown diagram preview components")
}

func verifyLiveFileChanges(driver *nativeDriver) error {
	file, err := os.CreateTemp("examples", "zz-native-live-*.puml")
	if err != nil {
		return err
	}
	filePath := file.Name()
	if err := file.Close(); err != nil {
		_ = os.Remove(filePath)
		return err
	}
	defer func() { _ = os.Remove(filePath) }()

	name := filepath.Base(filePath)
	source := "@startuml\ntitle NativeLiveInitial\nAlice -> Bob: Initial\n@enduml\n"
	if err := os.WriteFile(filePath, []byte(source), 0o600); err != nil {
		return err
	}
	if err := driver.expectFileListed(name); err != nil {
		return err
	}
	driver.selectNewLiveFile()
	if err := driver.expectHeader(name); err != nil {
		return err
	}
	updated := strings.ReplaceAll(source, "NativeLiveInitial", "NativeLiveUpdated")
	if err := os.WriteFile(filePath, []byte(updated), 0o600); err != nil {
		return err
	}
	if err := driver.expectPreviewContains("NativeLiveUpdated"); err != nil {
		return fmt.Errorf("native bridge did not reload changed source: %w", err)
	}
	if err := os.Remove(filePath); err != nil {
		return err
	}
	if err := driver.expectHeader("class.puml"); err != nil {
		return fmt.Errorf("native selection did not fall back after removal: %w", err)
	}
	return nil
}
