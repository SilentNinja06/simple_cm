# Simple Contact Manager

An Obsidian plugin that turns your vault into a lightweight contact relationship manager. Track who you need to reach out to, log interactions, and get an auto-updating dashboard showing overdue and upcoming follow-ups.

**Requires the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) community plugin.**

---

## Features

- **New Contact** command — guided form creates a fully-formed contact note in your Contacts folder
- **Log Interaction** command — fuzzy-search your contacts, add a note, and automatically reset the follow-up timer
- **Open Dashboard** command — opens (or creates) a live Dataview dashboard sorted by overdue → due today → upcoming 7 days → upcoming 30 days → all contacts
- **Settings page** — configure the contacts folder, templates folder, and dashboard path; defaults work out of the box
- **Ribbon icon** — one-click access to the dashboard
- **No Templater or QuickAdd required** — all contact creation and interaction logging is handled natively by the plugin

---

## Installation

### From the Community Plugins page (once listed)

1. Open Obsidian → Settings → Community Plugins → Browse
2. Search for **Simple Contact Manager**
3. Click Install, then Enable

### Manual installation (current method)

1. Download the latest release from [GitHub Releases](https://github.com/SilentNinja06/simple_cm/releases)
2. Extract the zip — you need three files: `main.js`, `manifest.json`, `styles.css`
3. Copy all three into a new folder at: `<your vault>/.obsidian/plugins/simple-contact-manager/`
4. Restart Obsidian
5. Go to Settings → Community Plugins, find **Simple Contact Manager**, and enable it

---

## Setup

1. Install and enable the **Dataview** community plugin if you haven't already
2. Enable Simple Contact Manager
3. Optionally open Settings → Simple Contact Manager to adjust folder paths (defaults: `Contacts/`, `Templates/`, `Contact Dashboard.md`)
4. Run **Simple Contact Manager: New contact** from the Command Palette to create your first contact
5. Assign hotkeys in Settings → Hotkeys if desired (search "Simple Contact Manager")

---

## Commands

| Command | Description | Suggested hotkey |
|---|---|---|
| New contact | Opens a form to create a new contact note | Cmd/Ctrl+Shift+N |
| Log contact interaction | Search contacts, add a note, reset follow-up timer | Cmd/Ctrl+Shift+L |
| Open contact dashboard | Opens the auto-updating follow-up dashboard | — |

---

## Contact Note Format

Each contact note uses YAML frontmatter:

```yaml
---
name: Jane Smith
email: jane@example.com
phone: 555-1234
company: Acme Corp
tags: [contact]
priority: medium
relationship: colleague
last_contacted: 2026-05-01
followup_days: 30
next_followup: 2026-05-31
notes: 
created: 2026-05-01
---
```

The plugin manages `last_contacted` and `next_followup` automatically when you log an interaction. You never need to calculate dates manually.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Contacts folder | `Contacts` | Where new contact notes are created |
| Templates folder | `Templates` | Where your Contact Template lives (used by Templater if you still use it) |
| Dashboard note path | `Contact Dashboard.md` | Path to the dashboard note, relative to vault root |

---

## Building from source

```bash
git clone https://github.com/SilentNinja06/simple_cm.git
cd simple_cm
npm install
npm run build
```

This produces `main.js` in the project root. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder.

---

## Migrating from the Templater/QuickAdd version

If you were using the previous macro-based system:

1. Install this plugin and disable (or keep) Templater and QuickAdd — they will not conflict
2. Your existing contact notes are fully compatible — no changes needed
3. The dashboard queries `FROM "Contacts"` by folder, so any note in that folder with `tags: [contact]` will appear
4. You no longer need `newContact.js`, `logContact.js`, or the Templater folder template mapping

---

## License

[Unlicense](LICENSE) — public domain, do whatever you want with it.
