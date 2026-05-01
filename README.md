This system turns your Obsidian vault into a fully automated contact relationship manager. Each contact lives in its own note with structured frontmatter. A dashboard note queries all contacts using Dataview and shows you exactly who to reach out to and when — automatically sorted by overdue, due today, and upcoming.

Files included in the package
Contact Template.md  →  your template for new contact notes
Contact Dashboard.md  →  the auto-updating follow-up dashboard
newContact.js  →  QuickAdd macro: guided prompts to create a contact
logContact.js  →  QuickAdd macro: log an interaction and reset the follow-up timer

Step 1 — Install Required Plugins
All plugins below are Community Plugins available inside Obsidian. Install them before doing anything else.

Plugin	Purpose	Required?
Dataview	Queries your contact notes like a database to power all dashboard views	Required
Templater	Auto-fills dates and fields when you create a new contact note	Required
QuickAdd	Runs the newContact.js and logContact.js macro scripts	Required
Calendar	Visual calendar overlay of follow-up dates	Optional
Periodic Notes	Works alongside Calendar for daily/weekly review notes	Optional

How to install each plugin
    1. Open Obsidian. Press Cmd+, (Mac) or Ctrl+, (Windows) to open Settings.
    2. In the left sidebar, click Community Plugins.
    3. If prompted, click Turn on Community Plugins to disable Safe Mode. This is required.
    4. Click the Browse button in the top-right of the Community Plugins panel.
    5. Search for the plugin name, click it, then click Install, followed by Enable.
    6. Repeat for each Required plugin in the table above.
    7. When all plugins are installed, restart Obsidian (quit and reopen) to ensure all plugins are fully active.

Step 2 — Set Up Folder Structure
Create these three folders in your vault. Right-click any blank area in the file explorer panel and choose New folder.

Folder	What goes in it
Contacts/	All individual contact notes
Templates/	The Contact Template.md file
Macros/	The newContact.js and logContact.js script files

Once the folders exist, copy the files from this package into your vault:  
    8. Contact Template.md  →  Contacts/Templates/Contact Template.md
    9. Contact Dashboard.md  →  vault root (or any folder you prefer)
    10. newContact.js  →  Macros/newContact.js
    11. logContact.js  →  Macros/logContact.js

Step 3 — Configure Templater
Templater needs four settings configured so it auto-fills new contact notes without touching any other part of your vault.

    12. Go to Settings → Templater.
    13. Find the Template folder location field and set it to Templates. This tells Templater where your templates live.
    14. Scroll down and turn on Enable Folder Templates. This is a separate toggle that must be on for folder-scoped templates to work — it is easy to miss.
    15. In the Folder Templates table that appears below that toggle, click the + button to add a new row:
        ◦ Set Folder to Contacts
        ◦ Set Template to Templates/Contact Template
    16. Turn on Trigger Templater on new file creation. Without this, the folder template mapping above will not fire automatically.

How this keeps your vault safe
The Folder Templates mapping in step 4 scopes the contact template exclusively to the Contacts/ folder.
Notes created anywhere else in your vault are completely unaffected.
If you already have other folder template mappings, simply add this new row — each row is independent and they do not conflict.
If you have a global template set (a template that fires on every new note), check that it does not duplicate the contact frontmatter fields.

Step 4 — Configure QuickAdd
QuickAdd needs to know where your macro scripts are saved, then you will register two macros — one to create contacts and one to log interactions.

4A — Set the Macro Folder Path
    17. Go to Settings → QuickAdd.
    18. Click the Manage Macros button.
    19. At the top of the Manage Macros panel, find Macro folder path and set it to Macros. This is where QuickAdd will look for your .js script files.
    20. Close the Manage Macros panel.

4B — Register the New Contact Macro
    21. In the QuickAdd settings main panel, type New Contact in the name field.
    22. Click the Add Choice button, then choose Macro as the type.
    23. A new row appears. Click the ⚙️ gear icon on the right of that row.
    24. Click Manage Macros → Add Macro and name it newContact.
    25. Click Add Script and select Macros/newContact.js from the file picker.
    26. Click the back arrow to return to the main QuickAdd settings panel.
    27. In the main panel, find your New Contact row and make sure Macro is set to newContact.

⚠️  Script trust prompt
The first time you run either macro, QuickAdd will show a security warning asking you to confirm running a community script.
Click 'Trust author and enable' to allow the script. This only appears once per script.

4C — Register the Log Interaction Macro
    28. Back in the QuickAdd settings main panel, type Log Contact Interaction in the name field.
    29. Click Add Choice → Macro.
    30. Click the ⚙️ gear icon, then Manage Macros → Add Macro, name it logContact.
    31. Click Add Script and select Macros/logContact.js.
    32. Return to the main QuickAdd panel and confirm the macro is linked.

4D — Assign Keyboard Shortcuts (Recommended)
    33. Go to Settings → Hotkeys.
    34. Search for QuickAdd: New Contact.
    35. Click the + button and press your desired shortcut, e.g. Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows).
    36. Search for QuickAdd: Log Contact Interaction.
    37. Assign Cmd+Shift+L / Ctrl+Shift+L.

Step 5 — Configure Dataview
The dashboard uses Dataview queries. Two settings need to be verified.

    38. Go to Settings → Dataview.
    39. Confirm Enable JavaScript Queries is turned ON.
    40. Set Default Date Format to YYYY-MM-DD. This must match the date format used in contact frontmatter.
    41. Leave Inline Query Prefix as = (the default).

Step 6 — Create Your First Contact
There are two ways to create a contact. Method A is recommended for everyday use.

Method A — QuickAdd Macro (Recommended)
    42. Press Cmd+Shift+N (Mac) / Ctrl+Shift+N (Windows), or open the Command Palette (Cmd/Ctrl+P) and search QuickAdd: New Contact.
    43. You will be guided through a series of prompts. Answer each one:
        ◦ Full name
        ◦ Email address
        ◦ Phone number
        ◦ Company
        ◦ Priority: high / medium / low
        ◦ Relationship type: client / colleague / friend / lead / mentor / acquaintance / other
        ◦ Follow-up cadence: choose from 7, 14, 30, 60, or 90 days
    44. The macro creates the note in your Contacts/ folder with all frontmatter pre-filled and opens it immediately.
    45. Add any extra notes in the body of the note.

Method B — Manual
    46. In the file explorer, right-click the Contacts/ folder and choose New note.
    47. Templater will automatically fire and fill in the frontmatter template including today's date.
    48. Fill in the remaining fields (email, phone, company, priority, followup_days, etc.) manually.

📋  Follow-up cadence guide
high priority (clients, active leads)  →  7–14 days
medium priority (colleagues, regular contacts)  →  30 days
low priority (loose network, annual check-ins)  →  60–90 days

Step 7 — Log an Interaction
Every time you call, email, or meet with a contact, log it. This is the key action that keeps the system accurate — it resets the follow-up timer automatically.

    49. Press Cmd+Shift+L (Mac) / Ctrl+Shift+L (Windows), or Command Palette → QuickAdd: Log Contact Interaction.
    50. A fuzzy search appears. Start typing the contact's name and select them.
    51. Type a brief note about what you discussed or did (e.g. "Called re: contract renewal").
    52. The macro automatically does three things:
        ◦ Updates last_contacted to today's date
        ◦ Recalculates next_followup as today + followup_days
        ◦ Appends a dated log entry to the bottom of the contact's note
    53. A confirmation notice appears in the top-right corner of Obsidian showing the new follow-up date.

💡  Manual update fallback
You can also update a contact by opening their note and editing last_contacted and next_followup directly in the frontmatter.
The dashboard reflects changes immediately on next open — no refresh button needed.

Step 8 — Test That Everything Works
Before relying on the system, run a quick end-to-end test.

    54. Press Cmd+Shift+N and create a test contact named Test Contact with a follow-up cadence of 7 days.
    55. Open Contact Dashboard.md. You should see Test Contact appear in the Upcoming — Next 7 Days section.
    56. Press Cmd+Shift+L, select Test Contact, and type test log entry.
    57. Reopen the dashboard. The contact should have moved to the Upcoming — Next 7 Days section with a refreshed date.
    58. Open the Test Contact note. Confirm last_contacted is today, next_followup is 7 days from today, and the log entry appears at the bottom.
    59. Delete the Test Contact note when done.

All green? You're ready
If the test passes, your system is fully operational. If something did not work as expected, see the Troubleshooting section at the end of this guide.

Step 9 — Using the Contact Dashboard
Open Contact Dashboard.md in your vault. It refreshes automatically whenever you open it. No manual refresh is needed.

Section	What it shows
Overdue	Contacts whose follow-up date has already passed, sorted most overdue first
Due Today	Contacts due for follow-up today
Next 7 Days	Contacts due within the next week, sorted soonest first
Next 30 Days	Contacts due within the next month
All Contacts	Full table of every contact — name, email, company, cadence, and next follow-up date

Click any contact name in the dashboard to open their note directly.

Pin the dashboard for quick access
Right-click the Contact Dashboard tab → Pin tab. It will stay open across sessions.
You can also set it as your vault home page: Settings → Core Plugins → Workspaces.

Daily Workflow
Once set up, your daily routine takes about two minutes:

    Open Contact Dashboard.md.
    Check the Overdue and Due Today sections.
    For each contact you reach out to, press Cmd+Shift+L to log the interaction.
    The dashboard automatically reschedules the next follow-up — nothing else to do.

Weekly review tip
Every Monday, check the Next 30 Days section and plan your outreach in batches.
You can batch a few emails one day and calls another, rather than reacting day-by-day.

Frontmatter Field Reference
Each contact note uses these YAML fields between the --- lines at the top of the file:

Field	Example value	Notes
name	Jane Smith	Contact's full name
email	jane@email.com	Email address
phone	555-1234	Phone number
company	Acme Corp	Employer or organization
tags	[contact]	Must include contact — this is how the dashboard finds notes
priority	high	high, medium, or low — used for dashboard sort order
relationship	client	client, colleague, friend, lead, mentor, acquaintance, other
last_contacted	2026-05-01	Date you last reached out — update this via the log macro
followup_days	30	Number of days between follow-ups
next_followup	2026-05-31	Auto-calculated: last_contacted + followup_days
notes	Met at conf.	Quick reference note visible in the All Contacts table
created	2026-05-01	Date the note was first created

Troubleshooting

Dashboard shows no contacts
    • Make sure each contact note has tags: [contact] in the frontmatter — not just a #contact tag in the note body. Dataview reads frontmatter tags, not inline tags.
    • Confirm Dataview is installed and enabled in Community Plugins.
    • Close and reopen the dashboard note to force a refresh.

Dates not auto-filling in new contact notes
    • Confirm Enable Folder Templates is turned on in Templater settings (Step 3, instruction 3).
    • Check that the Folder Templates row maps Contacts → Templates/Contact Template exactly.
    • Confirm Trigger Templater on new file creation is enabled.
    • Make sure you are creating the note inside the Contacts/ folder — not in the vault root.

QuickAdd macro shows an error or does not appear
    • Confirm Macro folder path in QuickAdd's Manage Macros panel is set to Macros.
    • Check that newContact.js and logContact.js are saved in the Macros/ folder — not a subfolder.
    • If a script trust prompt appeared and you dismissed it, go to Community Plugins, find QuickAdd, and re-run the macro to see the prompt again.

next_followup not updating after logging
    • The macro looks for last_contacted: and next_followup: as exact strings in the frontmatter. Make sure those field names exist and are spelled correctly.
    • If you renamed a field, update the corresponding line in logContact.js.

Templater is firing on notes outside Contacts/
    • Check whether you have a global template set in Templater (a template path set directly above the 'Trigger on new file creation' toggle, outside the Folder Templates table). If so, that template fires on every note. Remove it or ensure it does not conflict.
    • The Folder Templates table entries are scoped — only the Contacts/ entry fires in Contacts/.

File Summary
Quick reference for where each file belongs in your vault:

File	Destination in vault
Contact Template.md	Templates/Contact Template.md
Contact Dashboard.md	Vault root (or any folder)
newContact.js	Macros/newContact.js
logContact.js	Macros/logContact.js
