package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var completionCmd = &cobra.Command{
	Use:       "completion (bash|zsh|fish|powershell)",
	Short:     "Generate shell completion scripts",
	Long:      "Generate a completion script for the specified shell. See the README for instructions on loading it.",
	Args:      cobra.ExactArgs(1),
	ValidArgs: []string{"bash", "zsh", "fish", "powershell"},
	RunE: func(cmd *cobra.Command, args []string) error {
		root := cmd.Root()
		out := cmd.OutOrStdout()
		switch args[0] {
		case "bash":
			return root.GenBashCompletionV2(out, true)
		case "zsh":
			return root.GenZshCompletion(out)
		case "fish":
			return root.GenFishCompletion(out, true)
		case "powershell":
			return root.GenPowerShellCompletionWithDesc(out)
		default:
			return fmt.Errorf("unsupported shell %q (choose bash, zsh, fish, or powershell)", args[0])
		}
	},
}
