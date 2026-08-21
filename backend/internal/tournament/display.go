package tournament

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// How much of the schedule a screen is given. A projector shows a handful of
// rows; sending the whole tournament would only make the payload heavier.
const (
	maxNextUp = 12
	maxRecent = 8
)

// DisplayScope narrows what one screen shows. Empty fields mean "everything".
type DisplayScope struct {
	Stage string `json:"stage"`
	Pool  string `json:"pool"`
	Court string `json:"court"`
}

type displayTournament struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Sport    string `json:"sport"`
	Location string `json:"location"`
	Logo     string `json:"logo"`
	Status   string `json:"status"`
}

type displayConfig struct {
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Mode          string          `json:"mode"`
	RotateSeconds int             `json:"rotate_seconds"`
	Scope         DisplayScope    `json:"scope"`
	Theme         json.RawMessage `json:"theme"`
}

type displayEntry struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ShortName string `json:"short_name"`
	Club      string `json:"club"`
	Logo      string `json:"logo"`
	Seed      int    `json:"seed"`
}

type displayCourt struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

// displaySide is one half of a fixture. Entry is empty until the slot resolves,
// and Label always carries something renderable — "Winner QF1", "1. A" — so a
// screen never has to draw a blank box.
type displaySide struct {
	Entry string `json:"entry"`
	Label string `json:"label"`
	Score int    `json:"score"`
}

type displayFixture struct {
	ID          string        `json:"id"`
	Code        string        `json:"code"`
	Stage       string        `json:"stage"`
	Pool        string        `json:"pool"`
	Round       int           `json:"round"`
	Position    int           `json:"position"`
	Status      string        `json:"status"`
	Home        displaySide   `json:"home"`
	Away        displaySide   `json:"away"`
	Winner      string        `json:"winner"`
	Court       string        `json:"court"`
	ScheduledAt string        `json:"scheduled_at"`
	Games       []displayGame `json:"games,omitempty"`
}

type displayGame struct {
	Number int `json:"number"`
	Home   int `json:"home"`
	Away   int `json:"away"`
}

type displayStanding struct {
	Position     int    `json:"position"`
	Entry        string `json:"entry"`
	Played       int    `json:"played"`
	Won          int    `json:"won"`
	Drawn        int    `json:"drawn"`
	Lost         int    `json:"lost"`
	ScoreFor     int    `json:"score_for"`
	ScoreAgainst int    `json:"score_against"`
	Points       int    `json:"points"`
	Qualified    bool   `json:"qualified"`
}

type displayRound struct {
	Round    int              `json:"round"`
	Fixtures []displayFixture `json:"fixtures"`
}

type displayPool struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Kind         string            `json:"kind"`
	AdvanceCount int               `json:"advance_count"`
	Standings    []displayStanding `json:"standings"`
	Rounds       []displayRound    `json:"rounds"`
}

type displayStage struct {
	ID       string        `json:"id"`
	Position int           `json:"position"`
	Name     string        `json:"name"`
	Format   string        `json:"format"`
	Status   string        `json:"status"`
	Pools    []displayPool `json:"pools"`
}

// DisplayPayload is everything a projector needs, in one response.
//
// Entries are sent once as a lookup map and referenced by id everywhere else,
// so a team's name and logo are not repeated into every fixture it appears in.
type DisplayPayload struct {
	GeneratedAt string                  `json:"generated_at"`
	Tournament  displayTournament       `json:"tournament"`
	Display     displayConfig           `json:"display"`
	Entries     map[string]displayEntry `json:"entries"`
	Courts      []displayCourt          `json:"courts"`
	Stages      []displayStage          `json:"stages"`
	NowPlaying  []displayFixture        `json:"now_playing"`
	NextUp      []displayFixture        `json:"next_up"`
	Recent      []displayFixture        `json:"recent"`
}

// BuildDisplayPayload assembles the whole screen in one pass.
//
// The point of this endpoint is that a projector makes one request instead of
// subscribing to five collections and joining them in the browser.
func BuildDisplayPayload(app core.App, display *core.Record) (*DisplayPayload, error) {
	tournamentID := display.GetString("tournament")
	tournament, err := app.FindRecordById("tournaments", tournamentID)
	if err != nil {
		return nil, err
	}

	scope := DisplayScope{}
	if raw := display.GetString("scope"); raw != "" && raw != "null" {
		_ = json.Unmarshal([]byte(raw), &scope)
	}

	theme := json.RawMessage("null")
	if raw := display.GetString("theme"); raw != "" {
		theme = json.RawMessage(raw)
	}

	payload := &DisplayPayload{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Tournament: displayTournament{
			ID:       tournament.Id,
			Name:     tournament.GetString("name"),
			Sport:    tournament.GetString("sport"),
			Location: tournament.GetString("location"),
			Logo:     tournament.GetString("logo"),
			Status:   tournament.GetString("status"),
		},
		Display: displayConfig{
			ID:            display.Id,
			Name:          display.GetString("name"),
			Mode:          display.GetString("mode"),
			RotateSeconds: display.GetInt("rotate_seconds"),
			Scope:         scope,
			Theme:         theme,
		},
		Entries: map[string]displayEntry{},
		Courts:  []displayCourt{},
		Stages:  []displayStage{},
	}

	entries, err := app.FindRecordsByFilter(
		"entries", "tournament = {:t}", "name", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		payload.Entries[e.Id] = displayEntry{
			ID:        e.Id,
			Name:      e.GetString("name"),
			ShortName: e.GetString("short_name"),
			Club:      e.GetString("club"),
			Logo:      e.GetString("logo"),
			Seed:      e.GetInt("seed"),
		}
	}

	courts, err := app.FindRecordsByFilter(
		"courts", "tournament = {:t}", "position", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return nil, err
	}
	for _, c := range courts {
		payload.Courts = append(payload.Courts, displayCourt{
			ID: c.Id, Name: c.GetString("name"), Position: c.GetInt("position"),
		})
	}

	// --- fixtures, once, indexed every way the payload needs them ----------
	allFixtures, err := app.FindRecordsByFilter(
		"fixtures", "tournament = {:t}", "round, position", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return nil, err
	}

	slotLabels, err := slotLabelIndex(app, tournamentID)
	if err != nil {
		return nil, err
	}

	converted := make([]displayFixture, 0, len(allFixtures))
	for _, f := range allFixtures {
		converted = append(converted, toDisplayFixture(f, slotLabels))
	}

	byPool := map[string][]displayFixture{}
	for _, f := range converted {
		byPool[f.Pool] = append(byPool[f.Pool], f)
	}

	// --- stages, pools, tables, rounds -------------------------------------
	stageFilter := "tournament = {:t}"
	params := dbx.Params{"t": tournamentID}
	if scope.Stage != "" {
		stageFilter += " && id = {:stage}"
		params["stage"] = scope.Stage
	}

	stages, err := app.FindRecordsByFilter("stages", stageFilter, "position", 0, 0, params)
	if err != nil {
		return nil, err
	}

	for _, stage := range stages {
		out := displayStage{
			ID:       stage.Id,
			Position: stage.GetInt("position"),
			Name:     stage.GetString("name"),
			Format:   stage.GetString("format"),
			Status:   stage.GetString("status"),
			Pools:    []displayPool{},
		}

		pools, err := app.FindRecordsByFilter(
			"pools", "stage = {:stage}", "position", 0, 0,
			dbx.Params{"stage": stage.Id},
		)
		if err != nil {
			return nil, err
		}

		for _, pool := range pools {
			if scope.Pool != "" && pool.Id != scope.Pool {
				continue
			}

			poolOut := displayPool{
				ID:           pool.Id,
				Name:         pool.GetString("name"),
				Kind:         pool.GetString("kind"),
				AdvanceCount: pool.GetInt("advance_count"),
				Standings:    []displayStanding{},
				Rounds:       []displayRound{},
			}

			table, err := app.FindRecordsByFilter(
				"standings", "pool = {:pool}", "position", 0, 0,
				dbx.Params{"pool": pool.Id},
			)
			if err != nil {
				return nil, err
			}
			for _, row := range table {
				poolOut.Standings = append(poolOut.Standings, displayStanding{
					Position:     row.GetInt("position"),
					Entry:        row.GetString("entry"),
					Played:       row.GetInt("played"),
					Won:          row.GetInt("won"),
					Drawn:        row.GetInt("drawn"),
					Lost:         row.GetInt("lost"),
					ScoreFor:     row.GetInt("score_for"),
					ScoreAgainst: row.GetInt("score_against"),
					Points:       row.GetInt("points"),
					Qualified:    row.GetBool("qualified"),
				})
			}

			poolOut.Rounds = groupByRound(byPool[pool.Id])
			out.Pools = append(out.Pools, poolOut)
		}

		payload.Stages = append(payload.Stages, out)
	}

	// --- the three live lists ----------------------------------------------
	for _, f := range converted {
		if scope.Court != "" && f.Court != scope.Court {
			continue
		}
		switch {
		case f.Status == "live":
			payload.NowPlaying = append(payload.NowPlaying, f)
		case f.Status == "ready":
			payload.NextUp = append(payload.NextUp, f)
		case isSettled(f.Status):
			payload.Recent = append(payload.Recent, f)
		}
	}

	sortSchedule(payload.NextUp)
	sortRecent(payload.Recent)

	payload.NextUp = truncate(payload.NextUp, maxNextUp)
	payload.Recent = truncate(payload.Recent, maxRecent)

	if payload.NowPlaying == nil {
		payload.NowPlaying = []displayFixture{}
	}
	if payload.NextUp == nil {
		payload.NextUp = []displayFixture{}
	}
	if payload.Recent == nil {
		payload.Recent = []displayFixture{}
	}

	return payload, nil
}

// slotLabelIndex maps slot id -> the text to show when it has no entry yet.
func slotLabelIndex(app core.App, tournamentID string) (map[string]string, error) {
	stages, err := app.FindRecordsByFilter(
		"stages", "tournament = {:t}", "", 0, 0,
		dbx.Params{"t": tournamentID},
	)
	if err != nil {
		return nil, err
	}

	labels := map[string]string{}
	for _, stage := range stages {
		slots, err := app.FindRecordsByFilter(
			"slots", "stage = {:stage}", "", 0, 0,
			dbx.Params{"stage": stage.Id},
		)
		if err != nil {
			return nil, err
		}
		for _, slot := range slots {
			labels[slot.Id] = slot.GetString("label")
		}
	}
	return labels, nil
}

func toDisplayFixture(f *core.Record, slotLabels map[string]string) displayFixture {
	side := func(entryField, slotField, scoreField string) displaySide {
		entry := f.GetString(entryField)
		label := ""
		if entry == "" {
			label = slotLabels[f.GetString(slotField)]
			if label == "" {
				label = "TBD"
			}
		}
		return displaySide{Entry: entry, Label: label, Score: f.GetInt(scoreField)}
	}

	return displayFixture{
		ID:          f.Id,
		Code:        f.GetString("code"),
		Stage:       f.GetString("stage"),
		Pool:        f.GetString("pool"),
		Round:       f.GetInt("round"),
		Position:    f.GetInt("position"),
		Status:      f.GetString("status"),
		Home:        side("home_entry", "home_slot", "home_score"),
		Away:        side("away_entry", "away_slot", "away_score"),
		Winner:      f.GetString("winner"),
		Court:       f.GetString("court"),
		ScheduledAt: f.GetString("scheduled_at"),
	}
}

func groupByRound(fixtures []displayFixture) []displayRound {
	if len(fixtures) == 0 {
		return []displayRound{}
	}

	order := []int{}
	byRound := map[int][]displayFixture{}
	for _, f := range fixtures {
		if _, seen := byRound[f.Round]; !seen {
			order = append(order, f.Round)
		}
		byRound[f.Round] = append(byRound[f.Round], f)
	}
	sort.Ints(order)

	rounds := make([]displayRound, 0, len(order))
	for _, r := range order {
		group := byRound[r]
		sort.SliceStable(group, func(i, j int) bool {
			return group[i].Position < group[j].Position
		})
		rounds = append(rounds, displayRound{Round: r, Fixtures: group})
	}
	return rounds
}

// sortSchedule puts scheduled fixtures first in time order, then unscheduled
// ones in bracket order — which is the order they will actually be played in.
func sortSchedule(fixtures []displayFixture) {
	sort.SliceStable(fixtures, func(i, j int) bool {
		a, b := fixtures[i], fixtures[j]
		switch {
		case a.ScheduledAt != "" && b.ScheduledAt != "":
			return a.ScheduledAt < b.ScheduledAt
		case a.ScheduledAt != "":
			return true
		case b.ScheduledAt != "":
			return false
		case a.Round != b.Round:
			return a.Round < b.Round
		default:
			return a.Position < b.Position
		}
	})
}

// sortRecent shows the most recently decided fixtures first.
func sortRecent(fixtures []displayFixture) {
	sort.SliceStable(fixtures, func(i, j int) bool {
		a, b := fixtures[i], fixtures[j]
		if a.Round != b.Round {
			return a.Round > b.Round
		}
		return a.Position > b.Position
	})
}

func truncate(fixtures []displayFixture, limit int) []displayFixture {
	if len(fixtures) <= limit {
		return fixtures
	}
	return fixtures[:limit]
}

// payloadETag lets a polling screen get a cheap 304 when nothing has changed.
func payloadETag(body []byte) string {
	sum := sha256.Sum256(body)
	return `"` + hex.EncodeToString(sum[:16]) + `"`
}
