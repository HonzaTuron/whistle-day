package apidocs

import (
	"fmt"
	"os"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"
)

// RegisterCommand adds the `openapi` command to the root command.
func RegisterCommand(app core.App, rootCmd *cobra.Command) {
	var (
		outPath  string
		htmlMode bool
	)

	cmd := &cobra.Command{
		Use:   "openapi [output-path]",
		Short: "Generate the OpenAPI 3.1 specification JSON or HTML docs",
		Long: "Generate the complete OpenAPI 3.1 specification JSON or rendered HTML documentation\n" +
			"for the Whistle.day API, including live database schema definitions for all documented collections.",
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if devFlag := cmd.Flag("dev"); devFlag != nil && !devFlag.Changed {
				_ = devFlag.Value.Set("false")
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.Bootstrap(); err != nil {
				return fmt.Errorf("bootstrap: %w", err)
			}

			// Silence dev query logs during generation unless explicitly requested
			if devFlag := cmd.Flag("dev"); devFlag == nil || !devFlag.Changed {
				silenceDB := func(b dbx.Builder) {
					if s, ok := b.(*dbx.StandardBuilder); ok && s != nil && s.DB() != nil {
						s.DB().QueryLogFunc = nil
						s.DB().ExecLogFunc = nil
					}
				}
				silenceDB(app.DB())
				silenceDB(app.ConcurrentDB())
				silenceDB(app.NonconcurrentDB())
				silenceDB(app.AuxDB())
				silenceDB(app.AuxConcurrentDB())
				silenceDB(app.AuxNonconcurrentDB())
			}

			// Ensure all migrations are applied so all collections and fields exist.
			if err := app.RunAllMigrations(); err != nil {
				return fmt.Errorf("migrations: %w", err)
			}

			var (
				payload []byte
				kind    = "OpenAPI specification"
			)

			if htmlMode {
				kind = "HTML reference"
				page, err := Page(app)
				if err != nil {
					return fmt.Errorf("build docs page: %w", err)
				}
				payload = []byte(page)
			} else {
				specBytes, err := OpenAPI(app)
				if err != nil {
					return fmt.Errorf("build openapi: %w", err)
				}
				payload = specBytes
			}

			target := outPath
			if target == "" && len(args) > 0 {
				target = args[0]
			}

			if target == "" || target == "-" {
				if _, err := os.Stdout.Write(append(payload, '\n')); err != nil {
					return err
				}
				return nil
			}

			if err := os.WriteFile(target, append(payload, '\n'), 0644); err != nil {
				return fmt.Errorf("write %s: %w", target, err)
			}

			cmd.Printf("Wrote %s to %s (%d bytes)\n", kind, target, len(payload))
			return nil
		},
	}

	cmd.Flags().StringVarP(&outPath, "out", "o", "", "Output file path (default stdout)")
	cmd.Flags().BoolVar(&htmlMode, "html", false, "Render as HTML documentation page instead of OpenAPI JSON")

	rootCmd.AddCommand(cmd)
}
