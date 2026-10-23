# South Carolina Management Discord Bot

A Discord.js v14 bot for session management, server information, private support tickets, and staff records. All bot panels use Discord Components V2 with an autumn/Halloween visual theme and persistent session, promotion, and punishment records.

## Setup

1. Keep the existing `.env` file and its `BOT_TOKEN` value private. Never paste the token into chat or commit it.
2. Copy `.env.example` to `.env` if you need to recreate the environment file. Set `BOT_TOKEN` to the bot token from the Discord Developer Portal. The supplied server and role IDs are already set as defaults in `src/config.js`.
3. Session, promotion, and punishment posts use channel `1553619403902550089` by default. Set `RECORD_CHANNEL_ID` to change their shared destination, or override promotions and punishments individually with `PROMOTION_CHANNEL_ID` and `PUNISHMENT_CHANNEL_ID`.
4. Install packages with `npm install`.
5. Invite the bot to the server with the `bot` and `applications.commands` OAuth scopes.
6. Grant it View Channel, Send Messages, Embed Links, Attach Files, Use Application Commands, Manage Channels, and Manage Roles. It needs access to the announcement, promotion, punishment, and transcript channels plus the support category. Put the notification and ticket-staff roles below the bot's highest role. The session notification role must be mentionable or the bot needs permission to mention roles.
7. Run `npm start`.

The bot registers its guild slash commands when it connects. The first startup requires access to Discord's API. Use `npm test` for a JavaScript syntax check.

## Commands

- `/session start` — saves the active session, posts the South Carolina start panel with the join link and notification button in the configured announcement channel, and pings the notification role in the **same Discord message**.
- `/session end` — ends the active session and posts the shutdown panel without pinging the role.
- `/session status` — returns an ephemeral status panel visible only to the command user.
- `/session history` — shows the most recently completed session.
- `/session subscribe` and `/session unsubscribe` — manage session-start notifications.
- `/help`, `/ping`, and `/serverinfo` — command guide, connection check, and server details.
- The bot automatically posts a reusable ticket panel in channel `1553619403902550089`. Members open the panel's form and must provide a subject and request details before a private ticket is created; there are no ticket slash commands.
- Ticket claim and close buttons manage the ticket channel. Support staff can claim it once, which disables the claim button and posts an italicized greeting to the opener signed by the staff member who claimed it. Closing saves a text transcript to the logs channel before deleting the ticket.
- `/punishment member punishment reason` — administrators issue and publicly record a punishment with a random infraction ID.
- `/punishmentchange infraction_id punishment` — administrators change a recorded punishment and update its original post.
- `/punishmenthistory member` — administrators view the member's latest punishment records.
- `/promotion member rank reason [previous_rank] [department] [effective_date] [achievement] [responsibilities] [endorsement]` — administrators publish a detailed promotion announcement with a unique ID.
- `/promotionchange promotion_id rank [reason] [previous_rank] [department] [effective_date] [achievement] [responsibilities] [endorsement]` — administrators update the promotion details and its original post.
- `/promotionhistory member` — administrators view the member's latest promotion records.

Administrators and members with the configured moderator role can start or end sessions. Promotion and punishment commands require Administrator permission. Promotion and punishment announcements use the configured record destination by default; their IDs are stored with each record so edits update the original post. Records are stored independently in `data/promotions.json` and `data/punishments.json`. Read-only session, server, ping, and help commands are available to all members. Ticket channels are visible only to their opener, ticket staff, and bot. Closing a ticket first posts a transcript to the configured log channel, then permanently deletes the ticket channel. Session state is saved in `data/session-state.json` so it survives restarts.

The session role ping is included in the Components V2 text display and sent in the same message as the announcement panel.
