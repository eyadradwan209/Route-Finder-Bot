Route Finder Bot ✈️

A Discord bot built for Infinite Flight Virtual Airlines that generates randomized route schedules from a PostgreSQL database with support for featured airports, daily automatic postings, and distributed route selection.

Features

* Generate random routes from selected airports
* Even route distribution across multiple airports
* Sort routes by duration
* Automatic daily route posting
* Featured airport management
* Slash command support
* PostgreSQL database support
* Hosted on Render

Commands

Route Commands

/routes airport: HECA

Generate random routes for one airport.

/routes airport: HECA, OMDB, EGLL

Generate distributed routes across multiple airports.

⸻

Featured Airports

/addairport code: HECA, OMDB, EGLL

Add one or multiple featured airports.

/removeairport code: HECA

Remove a featured airport.

/listairports

View all featured airports.

⸻

Scheduling

/setschedule

Set the channel for daily route posts.

/testschedule

Send a test schedule immediately.

/unsetschedule

Disable daily route posting.

⸻

Database

/routecount

Show total number of routes in the database.

⸻

Tech Stack

* Node.js
* TypeScript
* Discord.js
* PostgreSQL
* Drizzle ORM
* Render Hosting

Environment Variables

Create the following environment variables:

DISCORD_BOT_TOKEN=your_bot_token

DISCORD_CLIENT_ID=your_client_id

DATABASE_URL=your_postgres_url

PORT=10000

NODE_ENV=production

Running Locally

Install dependencies:

pnpm install

Run the bot:

PORT=3000 pnpm --filter @workspace/api-server run dev

Deployment

This bot is deployed using Render with a PostgreSQL database.

Credits

Developed for EgyptAir Virtual Group (EAVG) and Infinite Flight operations.
