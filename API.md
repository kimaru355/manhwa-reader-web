# API v1

Base: `https://manhwa-reader-web.vercel.app`. JSON in, JSON out. Authenticated calls send `Authorization: Bearer <accessToken>`.

Errors are always `{ "error": { "code", "message", "requestId" } }`. `message` is safe to show to the reader.
Codes: `invalid_input` 400, `invalid_credentials` / `unauthorized` 401, `forbidden` 403, `not_found` 404, `conflict` 409,
`rate_limited` 429, `server_error` 5xx. Unknown request fields are rejected.

Rate limits: auth 10/min (per IP), writes 60/min (per user), reads 300/min.

## Recommendations (public)

`GET /recommendations.json` is the file the app already reads (built from the database, ETag, cached 5 min).
`GET /api/v1/recommendations/community?sort&q&category&tier&source&limit(<=50)&cursor&adult=1` returns
`{ items: [{ id, source, seriesId, title, cover, url, category, tier, note, createdAt, votes, voted }], nextCursor }`.
`sort` is `latest` (default, newest first), `popular` (most votes) or `week` (most votes in the last 7 days); ties are newest first.
`q` searches titles. The `interesting` category is only returned with `adult=1`. Send a bearer token to get `voted`
(whether the caller has voted); without one it is always `false`. Public responses are cached for 30 seconds.

`PUT /api/v1/community/recommendations/:id/vote` upvotes and `DELETE` takes the vote back (signed in). Both are
idempotent and return `{ votes, voted }`. You cannot vote for your own recommendation (403).

## Community bookmarks

Readers suggest a bookmark; it stays hidden until an admin approves it at `/admin/bookmarks`.

`GET /api/v1/community/bookmarks?source&seriesId` (public) returns the approved ones for a title:
`{ items: [{ id, chapterId, chapterName, page, note, createdAt }] }`. Nothing about who suggested them is exposed.

`POST /api/v1/community/bookmarks` (signed in) takes `{ source (mangadex|webtoons|hentai20), seriesId, seriesTitle, chapterId, chapterName, page, note?(<=300) }`
and returns 201 `{ id, status: 'pending' }`. The same chapter and page can only be suggested once per user (409); up to 20 per day.

`GET /api/v1/me/community-bookmarks` returns your suggestions with `status` (`pending`, `approved`, `rejected`) and
`rejectReason`. `DELETE /api/v1/me/community-bookmarks/:id` withdraws one (204).

## Accounts

A `session` is `{ accessToken, refreshToken, expiresAt (unix seconds), user: { id, email } }`.
The access token lasts about 15 minutes; call refresh when it is near expiry or on a 401.

| Call | Body | Returns |
|---|---|---|
| `POST /api/v1/auth/signup` | `{ email, password(8+) }` | `{ needsConfirmation, session? }` |
| `POST /api/v1/auth/signin` | `{ email, password }` | `{ session }` |
| `POST /api/v1/auth/refresh` | `{ refreshToken }` | `{ session }` |
| `POST /api/v1/auth/signout` | `{ refreshToken? }` | 204 |
| `POST /api/v1/auth/forgot` | `{ email }` | 204 always |
| `DELETE /api/v1/me` | | 204, deletes the account and all its rows |

## Sync (signed in)

`GET /api/v1/me/sync` returns `{ favorites: [{ kind: 'favorite'|'wishlist', seriesKey, series }], bookmarks: [{ id, seriesKey, chapterId, chapterName, page, note, ts, updatedAt }] }`.

`POST /api/v1/me/sync` takes `{ favorites?: { put: [{ kind, seriesKey, series }], remove: [{ kind, seriesKey }] }, bookmarks?: { put: [Bookmark], remove: [id] } }`
(at most 500 items in total; note up to 200 characters; page above 0) and returns 204. Timestamps are stored as sent.

## My recommendations (signed in)

`POST /api/v1/me/recommendations` with `{ source, seriesId, title, cover?, url?, category, tier, note?(<=500) }` creates (201) or updates (200).
`GET /api/v1/me/recommendations` returns `{ items }`. `DELETE /api/v1/me/recommendations/:id` returns 204 (own only).
Up to 50 new recommendations per day per user.

## Testing

`scripts/e2e.mts` runs 37 checks against a local server using a mock JWKS (see the header of that file).
