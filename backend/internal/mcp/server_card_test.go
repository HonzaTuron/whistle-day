package mcp

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
)

// The server card is a file the web build ships, because everything under
// /.well-known/ that is not OAuth's is served from disk and a route here would
// need a line in the Caddyfile to be reached. A file can say something the
// server no longer does, so this is what stops it: the card's serverInfo and
// capabilities have to be the ones `initialize` answers with.
const serverCardPath = "../../../apps/web/public/.well-known/mcp/server-card.json"

func TestServerCardMatchesTheServer(t *testing.T) {
	app := newTestApp(t)
	defer app.Cleanup()
	s := New(app)

	raw := s.mcp.HandleMessage(ctx, json.RawMessage(
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18",`+
			`"capabilities":{},"clientInfo":{"name":"card-test","version":"0"}}}`))
	out, _ := json.Marshal(raw)

	var resp struct {
		Result struct {
			ServerInfo   map[string]any `json:"serverInfo"`
			Capabilities map[string]any `json:"capabilities"`
		} `json:"result"`
	}
	if err := json.Unmarshal(out, &resp); err != nil {
		t.Fatalf("unmarshal initialize: %v", err)
	}

	file, err := os.ReadFile(serverCardPath)
	if err != nil {
		t.Fatalf("read the card: %v", err)
	}
	var card struct {
		ServerInfo   map[string]any `json:"serverInfo"`
		Capabilities map[string]any `json:"capabilities"`
		Transport    struct {
			Type     string `json:"type"`
			Endpoint string `json:"endpoint"`
		} `json:"transport"`
	}
	if err := json.Unmarshal(file, &card); err != nil {
		t.Fatalf("the card does not parse: %v", err)
	}

	for _, key := range []string{"name", "version"} {
		if card.ServerInfo[key] != resp.Result.ServerInfo[key] {
			t.Errorf("serverInfo.%s = %v in the card, %v from the server",
				key, card.ServerInfo[key], resp.Result.ServerInfo[key])
		}
	}
	if !reflect.DeepEqual(card.Capabilities, resp.Result.Capabilities) {
		got, _ := json.Marshal(resp.Result.Capabilities)
		t.Errorf("capabilities in the card are not the server's, which are %s", got)
	}
	if card.Transport.Type != "streamable-http" || !strings.HasSuffix(card.Transport.Endpoint, MCPEndpoint) {
		t.Errorf("transport = %+v, want streamable-http at %s", card.Transport, MCPEndpoint)
	}
}
