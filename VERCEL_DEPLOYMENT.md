# Vercel deployment

This project is split into two services:

1. **Vercel** hosts the route-management website and the serverless route API.
2. **A long-running Node host** runs the Discord worker and its 19:00Z next-day auto-post scheduler.

Vercel cannot keep a Discord gateway connection or a permanent scheduler process alive, so the Discord worker must not be deployed as a Vercel function.

## Deploy the website and API to Vercel

1. Import this project into Vercel.
2. Keep the project root set to the repository root.
3. Vercel will use `vercel.json` automatically.
4. Add this environment variable to the Vercel project:

   - `DATABASE_URL` — the PostgreSQL connection string

5. Deploy.

The website can upload, edit, download, and manage routes and featured airports. Featured airports are stored in PostgreSQL, so changes made through Vercel are available to the Discord worker.

## Prepare the database

Run the schema push once from a machine with the repository and database credentials:

```bash
pnpm install
pnpm --filter @workspace/db run push
```

## Run the Discord worker separately

Use a host that supports a continuously running Node.js process. Set these environment variables there:

- `DATABASE_URL` — the same database used by Vercel
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`

Then run:

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
```

The worker reads the featured-airport list from PostgreSQL and continues posting the next day's routes at **19:00Z**.

## Important limitation

The Vercel API can manage the database-backed route and airport data, but the website's direct Discord posting action requires the separate Discord worker to be online. The scheduled 19:00Z post is handled by that worker.