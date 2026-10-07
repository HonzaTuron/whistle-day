package tournament

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// ClubPage is everything the public address of a club shows, in one response.
//
// Assembled here rather than read through the collections for the same reason
// a screen is: the page needs a way in to each tournament it lists, and that
// is a display token, which `displays` only gives to somebody who already has
// it. Listing a tournament on a club page is what makes handing one out the
// owner's decision.
type ClubPage struct {
	Club        clubSummary      `json:"club"`
	Tournaments []clubTournament `json:"tournaments"`
}

type clubSummary struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Slug   string `json:"slug"`
	Accent string `json:"accent"`
	// A path on this host, or "" with nothing uploaded.
	Logo string `json:"logo"`
}

type clubTournament struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Sport    string `json:"sport"`
	Location string `json:"location"`
	Status   string `json:"status"`
	// When it is played if anybody said, when it was made otherwise. The
	// wizard never asks for a date, so most tournaments only have the second.
	Date string `json:"date"`
	// The token of a screen that is switched on, for `/m/{token}`. Empty when
	// the tournament has none, and the page then names it without a link.
	Screen string `json:"screen"`
}

var errNoClub = errors.New("no such club")

// BuildClubPage assembles the page for one slug.
//
// A draft is left out, exactly as a draft's screen answers 404: an organiser
// who ticks the box while still typing team names has not published anything
// yet.
func BuildClubPage(app core.App, slug string) (*ClubPage, error) {
	club, err := app.FindFirstRecordByFilter(
		"clubs", "slug = {:slug}", dbx.Params{"slug": slug},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errNoClub
		}
		return nil, err
	}

	page := &ClubPage{
		Club: clubSummary{
			ID:     club.Id,
			Name:   club.GetString("name"),
			Slug:   club.GetString("slug"),
			Accent: club.GetString("accent"),
		},
		Tournaments: []clubTournament{},
	}
	if logo := club.GetString("logo"); logo != "" {
		page.Club.Logo = "/api/files/" + club.BaseFilesPath() + "/" + logo
	}

	tournaments, err := app.FindRecordsByFilter(
		"tournaments", "club = {:club} && status != 'draft'", "-starts_on,-created", 0, 0,
		dbx.Params{"club": club.Id},
	)
	if err != nil {
		return nil, err
	}

	// One read for every screen of every tournament listed, oldest first, so
	// the one kept per tournament is the one the wizard made.
	displays, err := app.FindRecordsByFilter(
		"displays", "active = true && tournament.club = {:club}", "created", 0, 0,
		dbx.Params{"club": club.Id},
	)
	if err != nil {
		return nil, err
	}
	screens := map[string]string{}
	for _, display := range displays {
		tournament := display.GetString("tournament")
		if _, seen := screens[tournament]; !seen {
			screens[tournament] = display.GetString("token")
		}
	}

	for _, t := range tournaments {
		date := t.GetDateTime("starts_on")
		if date.IsZero() {
			date = t.GetDateTime("created")
		}
		page.Tournaments = append(page.Tournaments, clubTournament{
			ID:       t.Id,
			Name:     t.GetString("name"),
			Sport:    t.GetString("sport"),
			Location: t.GetString("location"),
			Status:   t.GetString("status"),
			Date:     date.Time().UTC().Format(time.RFC3339),
			Screen:   screens[t.Id],
		})
	}

	return page, nil
}

var errClubNotYours = errors.New("only the owner of both the tournament and the club can change which club it is listed under")

// clubChangeFault says why a write to a tournament may not change its club,
// or nil when it may — which includes every write that leaves `club` alone.
//
// `tournaments.updateRule` admits the crew, and has to: a scorer renames
// nothing but a rule cannot tell fields apart. So this one field is checked
// here. Both ends have to belong to the account asking — its tournament,
// because being listed is publishing it; its club, because otherwise anybody
// could fill somebody else's page.
func clubChangeFault(app core.App, auth *core.Record, tournament *core.Record) error {
	club := tournament.GetString("club")
	if club == tournament.Original().GetString("club") {
		return nil
	}
	if auth == nil {
		return errClubNotYours
	}
	if auth.IsSuperuser() {
		return nil
	}

	// The owner as stored, not as sent: a request that changes both in one go
	// must not get to vouch for itself.
	owner := tournament.Original().GetString("owner")
	if tournament.IsNew() {
		owner = tournament.GetString("owner")
	}
	if owner != auth.Id {
		return errClubNotYours
	}
	if club == "" {
		return nil
	}

	record, err := app.FindRecordById("clubs", club)
	if err != nil || record.GetString("owner") != auth.Id {
		return errClubNotYours
	}
	return nil
}

// RegisterClubs adds the club page and the check on who may list a tournament
// on one.
func RegisterClubs(app core.App) {
	guard := func(e *core.RecordRequestEvent) error {
		if err := clubChangeFault(e.App, e.Auth, e.Record); err != nil {
			return e.ForbiddenError(err.Error(), nil)
		}
		return e.Next()
	}
	app.OnRecordCreateRequest("tournaments").BindFunc(guard)
	app.OnRecordUpdateRequest("tournaments").BindFunc(guard)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// A club's public page: who they are and the days they have run.
		//
		// Public, like a screen, and for one slug at a time — there is no
		// route that lists clubs.
		se.Router.GET("/api/clubs/{slug}", func(e *core.RequestEvent) error {
			page, err := BuildClubPage(e.App, e.Request.PathValue("slug"))
			if err != nil {
				if errors.Is(err, errNoClub) {
					return e.NotFoundError("club not found", nil)
				}
				return e.InternalServerError("could not load the club", err)
			}

			e.Response.Header().Set("Cache-Control", "no-cache")
			return e.JSON(http.StatusOK, page)
		})

		return se.Next()
	})
}
