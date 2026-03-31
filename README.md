# Discord Support Ticket Bot (12 Commands)

This bot creates **private support tickets** in Discord and includes claim/close workflows for owners/admins/support staff.

## Features

- Private ticket channel creation using `/ticket` or button panel.
- Ticket visibility for:
  - Ticket creator
  - Server owner
  - Admins (via Discord Administrator permission)
  - Selected support roles
- Ticket owner/admin/support commands:
  - claim, close, transcript, rename, priority, add/remove users
- Per-server settings saved in `data/store.json`
- 12 slash commands included out of the box

## Commands

1. `/ticket [reason]` - Open a support ticket
2. `/panel` - Post a button panel to create tickets
3. `/claim` - Claim current ticket
4. `/close` - Close current ticket
5. `/adduser <user>` - Add someone to ticket channel
6. `/removeuser <user>` - Remove someone from ticket channel
7. `/rename <name>` - Rename ticket channel
8. `/priority <low|normal|high|urgent>` - Set ticket priority
9. `/transcript` - Export last 100 messages
10. `/stats` - Show ticket stats
11. `/setup-roles <id,id,...>` - Set support role IDs
12. `/setup-channels [category] [log_channel]` - Set ticket category and logs channel
13. `/help` - Show command list

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy config file:
   ```bash
   cp config.example.json config.json
   ```
3. Fill out `config.json`:
   - `token`
   - `clientId`
   - `guildId`
   - optional defaults: `ticketCategoryId`, `logChannelId`, `supportRoleIds`
4. Start the bot:
   ```bash
   npm start
   ```

## Notes

- Slash commands are registered to your `guildId` on startup for fast updates.
- Admins can view tickets because Discord's Administrator permission bypasses channel restrictions.
- Ticket data persists in a local JSON store.
