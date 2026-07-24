# Compact Output and Storage v2 Design

## Goal

Replace `agc1` with one Astrograph compact-output format (`agc2`) and establish
a storage/cache v2 boundary that rebuilds only positively identified legacy
caches.

## Compact output

`format: "compact"` emits `agc2` for eligible successful results. `agc2` uses
JSON tables with ordered columns and optional string dictionaries. `format:
"json"` and omitted format keep the ordinary strict MCP v1 envelope. Errors
always use JSON. `format: "auto"` selects `agc2` only when it saves at least
20 exact `cl100k_base` tokens and 25% of the JSON response.

`agc1` is removed. This is intentional: no compact backward-compatibility
decoder, compatibility alias, or format negotiation is retained.

## Storage and cache marker

The marker records both `storageVersion: 2` and `cacheVersion: 2`, together
with `updatedAt`. Both values must be positive integers. The storage version
governs durable layout/schema compatibility; the cache version governs derived
artifacts and compact-response assumptions.

| Marker state | Action |
| --- | --- |
| Valid `storageVersion: 2`, `cacheVersion: 2` | Use normally. |
| Valid known v1 marker | Archive the managed cache, write v2 marker, rebuild. |
| Missing, malformed, partial, or future version | Preserve all data and fail with an explicit recovery command. |
| Symlinked or active cache | Preserve data and fail; never recover automatically. |

Archiving retains the existing managed-root and active-database checks and
provides an explicit restore receipt. No path outside Astrograph-managed cache
roots is touched.

## Verification

- Unit tests cover every marker state and prove no filesystem mutation for
  malformed, future, partial, symlinked, or active caches.
- Compact tests cover `agc2` round trips for all selected tools and reject
  `agc1`.
- The MCP fixture benchmark records exact JSON versus `agc2` tokens, bytes,
  and encode/decode time.
- Package smoke proves the released artifact starts, indexes, and queries with
  a v2 marker.
