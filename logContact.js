/**
 * QuickAdd Macro: Log Contact Interaction
 *
 * Paste this entire file into a QuickAdd "Macro" script.
 * It will:
 *   1. Ask you to pick a contact note
 *   2. Ask for interaction notes
 *   3. Update last_contacted to today
 *   4. Recalculate next_followup based on followup_days
 *   5. Append a log entry to the note
 *
 * Setup: In QuickAdd settings → Macros → Add Macro → paste this script
 */

module.exports = async (params) => {
  const { app, quickAddApi } = params;

  // --- 1. Pick a contact ---
  const contactFiles = app.vault.getMarkdownFiles().filter(f =>
    app.metadataCache.getFileCache(f)?.frontmatter?.tags?.includes("contact")
  );

  if (contactFiles.length === 0) {
    new Notice("No contact notes found. Make sure your contacts have 'tags: [contact]' in frontmatter.");
    return;
  }

  const contactNames = contactFiles.map(f => f.basename);
  const chosen = await quickAddApi.suggester(contactNames, contactFiles);
  if (!chosen) return;

  // --- 2. Get interaction note ---
  const note = await quickAddApi.inputPrompt("Interaction notes (what did you discuss?)");
  if (note === null) return;

  // --- 3. Read file and frontmatter ---
  const content = await app.vault.read(chosen);
  const cache = app.metadataCache.getFileCache(chosen);
  const fm = cache?.frontmatter;

  if (!fm) {
    new Notice("Could not read frontmatter from this contact note.");
    return;
  }

  const followupDays = parseInt(fm.followup_days) || 30;
  const today = window.moment().format("YYYY-MM-DD");
  const nextFollowup = window.moment().add(followupDays, "days").format("YYYY-MM-DD");

  // --- 4. Update frontmatter fields ---
  let updated = content;

  // Replace last_contacted
  updated = updated.replace(
    /^last_contacted:.*$/m,
    `last_contacted: ${today}`
  );

  // Replace next_followup
  updated = updated.replace(
    /^next_followup:.*$/m,
    `next_followup: ${nextFollowup}`
  );

  // --- 5. Append interaction log entry ---
  const logEntry = `\n### ${today}\n- ${note}\n`;

  // Insert before the end or after "## Interaction Log" section
  if (updated.includes("## Interaction Log")) {
    updated = updated.replace(
      /## Interaction Log/,
      `## Interaction Log${logEntry}`
    );
  } else {
    updated += `\n## Interaction Log\n${logEntry}`;
  }

  await app.vault.modify(chosen, updated);

  new Notice(`✅ Updated ${chosen.basename} — next follow-up in ${followupDays} days (${nextFollowup})`);
};
