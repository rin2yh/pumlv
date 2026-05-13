package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/k1LoW/donegroup"
	"github.com/muesli/termenv"
	"github.com/pkg/browser"
	"github.com/rin2yh/pumlv/server"
	"github.com/rin2yh/pumlv/version"
	"github.com/spf13/cobra"
)

var (
	flagPort   int
	flagHost   string
	flagNoOpen bool
	flagExt    []string
)

// Credits は main から注入される CREDITS ファイルの内容（第三者ライブラリのライセンス全文）。
var Credits string

var creditsCmd = &cobra.Command{
	Use:   "credits",
	Short: "Print third-party license credits bundled in this binary",
	RunE: func(cmd *cobra.Command, args []string) error {
		_, err := fmt.Fprint(cmd.OutOrStdout(), Credits)
		return err
	},
}

var rootCmd = &cobra.Command{
	Use:   "pumlv [paths...]",
	Short: "Local PlantUML preview server",
	Long:  "pumlv starts a local web server that previews PlantUML files in the browser with live reload.",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		ctx, cancel := donegroup.WithCancel(sigCtx)

		opts := server.Options{
			Paths: args,
			Host:  flagHost,
			Port:  flagPort,
			Exts:  flagExt,
		}
		srv, err := server.New(ctx, opts)
		if err != nil {
			cancel()
			return err
		}

		addr, err := srv.Start(ctx)
		if err != nil {
			cancel()
			return err
		}

		p := termenv.ColorProfile()
		url := fmt.Sprintf("http://%s", addr)
		out := termenv.String(version.Name).Foreground(p.Color("#7c3aed")).Bold().String()
		linkText := termenv.String(url).Foreground(p.Color("#2563eb")).Underline().String()
		fmt.Fprintf(os.Stderr, "%s listening on %s\n", out, linkText)

		if !flagNoOpen {
			if err := browser.OpenURL(url); err != nil {
				fmt.Fprintf(os.Stderr, "failed to open browser: %v\n", err)
			}
		}

		<-sigCtx.Done()
		fmt.Fprintln(os.Stderr, "shutting down...")
		cancel()
		if err := donegroup.Wait(ctx); err != nil {
			return err
		}
		return nil
	},
}

func init() {
	rootCmd.Version = version.Version + " (" + version.Revision + ")"
	rootCmd.Flags().IntVar(&flagPort, "port", 0, "TCP port to listen on (0 = pick a free port)")
	rootCmd.Flags().StringVar(&flagHost, "host", "127.0.0.1", "Host to bind")
	rootCmd.Flags().BoolVar(&flagNoOpen, "no-open", false, "Do not open the browser automatically")
	rootCmd.Flags().StringSliceVar(&flagExt, "ext", []string{".puml", ".plantuml", ".iuml", ".wsd"}, "File extensions to watch")
	rootCmd.AddCommand(creditsCmd)
}

// Execute runs the root command.
func Execute() error {
	return rootCmd.Execute()
}
