# Whistle.day auth.md

How an AI agent gets to act on Whistle.day. Written for the agent: every step
here is one you can take yourself, except the one that says a person has to.

There are two ways in. Pick by what the person you are working for has.

| They have | Use | A person is needed |
|---|---|---|
| Nothing — they want a tournament set up | [No credential](#no-credential) | No |
| A Whistle.day account with tournaments on it | [OAuth](#oauth) | Once, in a browser |

The resource is the MCP server at `https://whistle.day/api/mcp` (Streamable
HTTP). What it does is described at <https://whistle.day/mcp>.

## Discover

```
GET https://whistle.day/.well-known/oauth-protected-resource
GET https://whistle.day/.well-known/oauth-authorization-server
```

The first names the resource, its authorization server, the one scope
(`tournaments`) and how a token is sent (`header`). The second lists the
endpoints used under [OAuth](#oauth) below.

## No credential

Connect to `https://whistle.day/api/mcp` and call `create_tournament`. It needs
no credential: it makes a temporary account and the tournament in one step.

The connection is what remembers that account. Send the `Mcp-Session-Id` the
server gave you at `initialize` on every request, as the transport already
requires, and each later tool call on that connection acts as the same account.
No token is returned and there is none to store.

The account lasts as long as the connection. If you reconnect you are a
stranger and cannot reach the tournament again. Before you disconnect, call
`create_handoff` and give the person the link it returns: they open it, set an
email and a password, and the tournament is theirs. Your access to it stops at
that moment, which is the point.

## OAuth

For an account that already exists. This is OAuth 2.1 with PKCE, and the person
approves it once in a browser.

1. **Register a client.** `POST https://whistle.day/oauth/register` (RFC 7591)
   with `redirect_uris` and a `client_name`. Clients are public:
   `token_endpoint_auth_method` is `none` and no secret is issued. A redirect
   URI must be `https`, `http` on a loopback address, or a private-use scheme.
2. **Send the person to authorize.** `GET https://whistle.day/oauth/authorize`
   with `response_type=code`, your `client_id`, `redirect_uri`, `state`,
   `scope=tournaments`, `code_challenge` and `code_challenge_method=S256`, and
   `resource=https://whistle.day/api/mcp`. They sign in and approve.
3. **Exchange the code.** `POST https://whistle.day/oauth/token`,
   form-encoded, with `grant_type=authorization_code`, the `code`,
   `redirect_uri`, `client_id` and `code_verifier`.
4. **Refresh.** The same endpoint with `grant_type=refresh_token`. Each refresh
   returns a new refresh token and retires the old one. Presenting a retired
   one revokes every token from that sign-in, so keep only the newest.

## Use the credential

```
Authorization: Bearer <access_token>
```

on every request to `https://whistle.day/api/mcp`. The token reaches everything
the account owns or is on the crew of.

A tool called with no credential, on a connection that has not made a
tournament, answers with a sign-in challenge that points back at the discovery
document above. An expired or revoked token is refused rather than quietly
replaced by a new temporary account: refresh it, or start again from
[Discover](#discover).

## What is not here

There is no endpoint that hands out an API key, and no registration by identity
assertion or verified email. The two ways above are all of it.

Questions: <info@whistle.day>.
