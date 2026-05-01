/**
 * QuickAdd Macro: New Contact
 *
 * Paste this entire file into a QuickAdd "Macro" script.
 * It will prompt you for key info and create a contact note
 * in your Contacts/ folder with all frontmatter pre-filled.
 *
 * Setup: In QuickAdd settings → Macros → Add Macro → paste this script
 */

module.exports = async (params) => {
  const { app, quickAddApi } = params;

  // --- Prompt for contact details ---
  const name = await quickAddApi.inputPrompt("Full name");
  if (!name) return;

  const email = await quickAddApi.inputPrompt("Email (leave blank to skip)") || "";
  const phone = await quickAddApi.inputPrompt("Phone (leave blank to skip)") || "";
  const company = await quickAddApi.inputPrompt("Company (leave blank to skip)") || "";

  const priorityOptions = ["high", "medium", "low"];
  const priority = await quickAddApi.suggester(priorityOptions, priorityOptions) || "medium";

  const relationshipOptions = ["client", "colleague", "friend", "lead", "mentor", "acquaintance", "other"];
  const relationship = await quickAddApi.suggester(relationshipOptions, relationshipOptions) || "acquaintance";

  const followupOptions = ["7", "14", "30", "60", "90"];
  const followupDays = await quickAddApi.suggester(
    followupOptions.map(d => `Every ${d} days`),
    followupOptions
  ) || "30";

  const today = window.moment().format("YYYY-MM-DD");
  const nextFollowup = window.moment().add(parseInt(followupDays), "days").format("YYYY-MM-DD");

  // --- Build note content ---
  const content = `---
name: ${name}
email: ${email}
phone: ${phone}
company: ${company}
tags: [contact]
priority: ${priority}
relationship: ${relationship}
last_contacted: ${today}
followup_days: ${followupDays}
next_followup: ${nextFollowup}
notes: 
created: ${today}
---

# ${name}

## Contact Info
- **Email:** ${email}
- **Phone:** ${phone}
- **Company:** ${company}

## Notes


## Interaction Log

### ${today}
- Contact created
`;

  // --- Create the file in Contacts/ folder ---
  const folderPath = "Contacts";
  const filePath = `${folderPath}/${name}.md`;

  // Create folder if it doesn't exist
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder) {
    await app.vault.createFolder(folderPath);
  }

  // Check if file already exists
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing) {
    new Notice(`⚠️ Contact "${name}" already exists.`);
    app.workspace.openLinkText(filePath, "", true);
    return;
  }

  const newFile = await app.vault.create(filePath, content);
  app.workspace.openLinkText(filePath, "", true);

  new Notice(`✅ Created contact: ${name} — next follow-up in ${followupDays} days`);
};
