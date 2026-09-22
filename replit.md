# Route Picker Discord Bot

A Discord bot that stores flight routes in a database, lets you import them via CSV, and randomly picks 4 routes for any featured airport.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Discord bot (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Discord: discord.js v14
- CSV parsing: csv-parse + multer
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/routes.ts` — routes table schema (origin, destination, airline, flight_number, distance, duration)
- `artifacts/api-server/src/bot/index.ts` — Discord bot client, slash command handlers
- `artifacts/api-server/src/bot/commands.ts` — slash command definitions + registration
- `artifacts/api-server/src/bot/airports.ts` — in-memory featured airports store
- `artifacts/api-server/src/routes/upload.ts` — CSV upload endpoint + GET/DELETE routes

## Discord Commands

- `/routes airport:<ICAO>` — pick 4 random routes departing or arriving at that airport
- `/addairport code:<ICAO>` — add an airport to featured list
- `/removeairport code:<ICAO>` — remove an airport from featured list
- `/listairports` — show all featured airports
- `/routecount` — show total routes in database

## REST API Endpoints

- `POST /api/routes/upload` — upload a CSV file (field name: `file`)
- `GET /api/routes` — list up to 100 routes
- `DELETE /api/routes` — delete all routes

## CSV Format

Required columns: `origin`, `destination`
Optional columns: `airline`, `flight_number`, `distance`, `duration`

Example:
```
origin,destination,airline,flight_number,distance,duration
JFK,LAX,Delta,DL123,4500,5h30m
```

Column names are case-insensitive.

## Architecture decisions

- Bot and HTTP server run in the same process — keeps deployment simple, single workflow
- Featured airports stored in-memory (per process) — fast, no DB overhead, resets on restart
- Slash commands are re-registered on every startup — ensures they stay in sync with code
- CSV upload chunked in batches of 500 rows — avoids DB timeouts on large files

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` after schema changes
- Featured airports reset on server restart (in-memory only)
- Discord slash commands may take a few minutes to appear globally after registration
