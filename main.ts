import {
  App,
  FuzzySuggestModal,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  getAllTags,
  moment,
  normalizePath,
} from "obsidian";

// ── Types & constants ─────────────────────────────────────────────────────────

interface SimpleCMSettings {
  contactsFolder: string;
  dashboardPath: string;
  dailyNoteLinking: boolean;
  createDailyNoteIfMissing: boolean;
  dailyNoteMarker: string;
  dailyNoteHeading: string;
}

const DEFAULT_SETTINGS: SimpleCMSettings = {
  contactsFolder: "Contacts",
  dashboardPath: "Contact Dashboard.md",
  dailyNoteLinking: true,
  createDailyNoteIfMissing: true,
  dailyNoteMarker: "%% crm-log %%",
  dailyNoteHeading: "Contacts reached",
};

const PRIORITIES = ["high", "medium", "low"] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High (7–14 days)",
  medium: "Medium (30 days)",
  low: "Low (60–90 days)",
};

const RELATIONSHIPS = [
  "client",
  "colleague",
  "friend",
  "lead",
  "mentor",
  "acquaintance",
  "other",
] as const;
type Relationship = (typeof RELATIONSHIPS)[number];

const CADENCE_DAYS = [7, 14, 30, 60, 90] as const;

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  priority: Priority;
  relationship: Relationship;
  followupDays: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return moment().format("YYYY-MM-DD");
}

function addDays(days: number): string {
  return moment().add(days, "days").format("YYYY-MM-DD");
}

// Obsidian forbids \ / : * ? " < > | in file names; # ^ [ ] break wikilinks.
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim();
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  if (!app.vault.getAbstractFileByPath(folderPath)) {
    await app.vault.createFolder(folderPath);
  }
}

// ── Daily note writer ─────────────────────────────────────────────────────────
// Mirrors the marker-first / heading / append-fallback resolution and core
// Daily Notes path resolution used by the ARFID and Spiral & Shutdown plugins,
// so "who I talked to today" is written at log time into the daily note.

interface DailyNotesOptions {
  folder?: string;
  format?: string;
  template?: string;
}

function getDailyNotesOptions(app: App): DailyNotesOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dn = (app as any).internalPlugins?.getPluginById?.("daily-notes");
  return dn?.instance?.options ?? {};
}

/** Only lines this plugin wrote count when keeping chronological order. */
const CRM_LOG_LINE = /^- \d{2}:\d{2} \[\[/;

/** Insert a `- HH:MM [[Name|Name]] — descriptor` line into today's daily note,
 * honoring the marker, then the heading, then an appended heading last. */
async function linkInteractionIntoDailyNote(
  app: App,
  settings: SimpleCMSettings,
  contactName: string,
  descriptor: string,
): Promise<void> {
  if (!settings.dailyNoteLinking) return;
  try {
    const opts = getDailyNotesOptions(app);
    const format = opts.format || "YYYY-MM-DD";
    const folder = (opts.folder ?? "").trim().replace(/\/+$/, "");
    const date = moment().format("YYYY-MM-DD");
    const time = moment().format("HH:mm");
    const dailyName = moment(date, "YYYY-MM-DD").format(format);
    const path = normalizePath((folder ? folder + "/" : "") + dailyName + ".md");

    let file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      if (!settings.createDailyNoteIfMissing) return;
      await ensureParentFolder(app, path);
      const body = await renderDailyTemplate(app, opts, path, date);
      file = await app.vault.create(path, body);
    }
    if (!(file instanceof TFile)) return;

    const line = `- ${time} [[${contactName}|${contactName}]] — ${descriptor}`;
    await app.vault.process(file, (content) =>
      insertCrmLogLine(content, line, settings, time),
    );
  } catch (e) {
    // Daily-note linking is a convenience; never block logging the interaction.
    console.error("Simple Contact Manager: daily note linking failed", e);
  }
}

async function ensureParentFolder(app: App, path: string): Promise<void> {
  const dir = path.split("/").slice(0, -1).join("/");
  if (!dir) return;
  if (app.vault.getAbstractFileByPath(dir) instanceof TFolder) return;
  await app.vault.createFolder(dir).catch(() => {});
}

async function renderDailyTemplate(
  app: App,
  opts: DailyNotesOptions,
  dailyPath: string,
  date: string,
): Promise<string> {
  const templateSetting = (opts.template ?? "").trim();
  if (!templateSetting) return "";
  const templatePath = normalizePath(
    templateSetting.endsWith(".md") ? templateSetting : templateSetting + ".md",
  );
  const tFile = app.vault.getAbstractFileByPath(templatePath);
  if (!(tFile instanceof TFile)) return "";
  const raw = await app.vault.cachedRead(tFile);
  const basename = dailyPath.split("/").pop()?.replace(/\.md$/, "") ?? "";
  const m = moment(date, "YYYY-MM-DD");
  const now = moment();
  return raw
    .replace(/{{\s*title\s*}}/gi, basename)
    .replace(/{{\s*date(?::([^}]+))?\s*}}/gi, (_, fmt) => m.format(fmt || "YYYY-MM-DD"))
    .replace(/{{\s*time(?::([^}]+))?\s*}}/gi, (_, fmt) => now.format(fmt || "HH:mm"));
}

function insertCrmLogLine(
  content: string,
  line: string,
  settings: SimpleCMSettings,
  time: string,
): string {
  const lines = content.split("\n");
  if (lines.some((l) => l.trim() === line.trim())) return content;

  const marker = settings.dailyNoteMarker.trim();
  let anchor = -1;
  if (marker) anchor = lines.findIndex((l) => l.includes(marker));
  if (anchor === -1) {
    const heading = settings.dailyNoteHeading.trim().toLowerCase().replace(/:$/, "");
    if (heading) {
      anchor = lines.findIndex((l) => {
        const m = l.match(/^#{1,6}\s+(.*?)\s*$/);
        return !!m && m[1].trim().toLowerCase().replace(/:$/, "") === heading;
      });
    }
  }
  if (anchor === -1) {
    const heading = settings.dailyNoteHeading.trim() || "Contacts reached";
    const trimmed = content.replace(/\n+$/, "");
    return (trimmed ? trimmed + "\n\n" : "") + `# ${heading}\n${line}\n`;
  }

  let insertAt = anchor + 1;
  while (insertAt < lines.length && CRM_LOG_LINE.test(lines[insertAt])) {
    const existingTime = lines[insertAt].slice(2, 7);
    if (existingTime > time) break;
    insertAt++;
  }
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

// ── New Contact Modal ─────────────────────────────────────────────────────────

class NewContactModal extends Modal {
  private onSubmit: (data: ContactFormData) => void;
  private data: ContactFormData = {
    name: "",
    email: "",
    phone: "",
    company: "",
    priority: "medium",
    relationship: "acquaintance",
    followupDays: 30,
  };

  constructor(app: App, onSubmit: (data: ContactFormData) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("New contact");

    new Setting(contentEl).setName("Full name").addText((text) => {
      text.setPlaceholder("Jane Smith").onChange((v) => (this.data.name = v));
      text.inputEl.focus();
    });

    new Setting(contentEl).setName("Email").addText((text) =>
      text
        .setPlaceholder("jane@example.com")
        .onChange((v) => (this.data.email = v.trim()))
    );

    new Setting(contentEl).setName("Phone").addText((text) =>
      text
        .setPlaceholder("555-1234")
        .onChange((v) => (this.data.phone = v.trim()))
    );

    new Setting(contentEl).setName("Company").addText((text) =>
      text
        .setPlaceholder("Acme Corp")
        .onChange((v) => (this.data.company = v.trim()))
    );

    new Setting(contentEl).setName("Priority").addDropdown((dd) => {
      PRIORITIES.forEach((p) => dd.addOption(p, PRIORITY_LABELS[p]));
      dd.setValue(this.data.priority).onChange(
        (v) => (this.data.priority = v as Priority)
      );
    });

    new Setting(contentEl).setName("Relationship").addDropdown((dd) => {
      RELATIONSHIPS.forEach((r) => dd.addOption(r, r));
      dd.setValue(this.data.relationship).onChange(
        (v) => (this.data.relationship = v as Relationship)
      );
    });

    new Setting(contentEl).setName("Follow-up cadence").addDropdown((dd) => {
      CADENCE_DAYS.forEach((d) => dd.addOption(String(d), `Every ${d} days`));
      dd.setValue(String(this.data.followupDays)).onChange(
        (v) => (this.data.followupDays = Number(v))
      );
    });

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((btn) =>
        btn.setButtonText("Create contact").setCta().onClick(() => this.submit())
      );

    contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        this.submit();
      }
    });
  }

  private submit() {
    this.data.name = this.data.name.trim();
    if (!this.data.name) {
      new Notice("Name is required.");
      return;
    }
    this.onSubmit(this.data);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ── Log Interaction Modals ────────────────────────────────────────────────────

class ContactSuggestModal extends FuzzySuggestModal<TFile> {
  private contacts: TFile[];
  private onChoose: (file: TFile) => void;

  constructor(app: App, contacts: TFile[], onChoose: (file: TFile) => void) {
    super(app);
    this.contacts = contacts;
    this.onChoose = onChoose;
    this.setPlaceholder("Search contacts…");
  }

  getItems(): TFile[] {
    return this.contacts;
  }

  getItemText(file: TFile): string {
    return file.basename;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}

class InteractionNoteModal extends Modal {
  private contact: TFile;
  private onSubmit: (note: string) => void;
  private note = "";

  constructor(app: App, contact: TFile, onSubmit: (note: string) => void) {
    super(app);
    this.contact = contact;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(`Log interaction — ${this.contact.basename}`);

    new Setting(contentEl).setName("Interaction note").addText((text) => {
      text
        .setPlaceholder("e.g. Called re: contract renewal")
        .onChange((v) => (this.note = v));
      text.inputEl.focus();
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.submit();
        }
      });
    });

    new Setting(contentEl)
      .addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((btn) =>
        btn.setButtonText("Log interaction").setCta().onClick(() => this.submit())
      );
  }

  private submit() {
    const note = this.note.trim();
    if (!note) {
      new Notice("Please enter an interaction note.");
      return;
    }
    this.onSubmit(note);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

class SimpleCMSettingTab extends PluginSettingTab {
  plugin: SimpleCMPlugin;

  constructor(app: App, plugin: SimpleCMPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Contacts folder")
      .setDesc(
        "Folder where new contact notes are created and where the dashboard looks for contacts. If you change this after creating the dashboard, delete the dashboard note and reopen it to regenerate its queries."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.contactsFolder)
          .setValue(this.plugin.settings.contactsFolder)
          .onChange(async (value) => {
            this.plugin.settings.contactsFolder =
              value.trim() || DEFAULT_SETTINGS.contactsFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Dashboard note path")
      .setDesc(
        "Path to your Contact Dashboard note, relative to the vault root."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dashboardPath)
          .setValue(this.plugin.settings.dashboardPath)
          .onChange(async (value) => {
            this.plugin.settings.dashboardPath =
              value.trim() || DEFAULT_SETTINGS.dashboardPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("Daily note").setHeading();

    new Setting(containerEl)
      .setName("Log interactions into the daily note")
      .setDesc(
        "When you log an interaction, also write a line into that day's daily note under the marker/heading below."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.dailyNoteLinking).onChange(async (v) => {
          this.plugin.settings.dailyNoteLinking = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Create the daily note if missing")
      .setDesc("Seed a new daily note from the Daily Notes core template when one doesn't exist yet.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.createDailyNoteIfMissing).onChange(async (v) => {
          this.plugin.settings.createDailyNoteIfMissing = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Placement marker")
      .setDesc(
        "Interactions are inserted after this marker if the daily note contains it (invisible in reading view)."
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyNoteMarker)
          .setValue(this.plugin.settings.dailyNoteMarker)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteMarker = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Fallback heading")
      .setDesc("If the marker isn't found, interactions go under this heading; a heading is appended only as a last resort.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyNoteHeading)
          .setValue(this.plugin.settings.dailyNoteHeading)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteHeading =
              value.trim() || DEFAULT_SETTINGS.dailyNoteHeading;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setName("Actions").setHeading();

    new Setting(containerEl)
      .setName("Open contact dashboard")
      .setDesc("Open the dashboard note in the current pane.")
      .addButton((btn) =>
        btn.setButtonText("Open dashboard").onClick(async () => {
          await this.plugin.openDashboard();
        })
      );

    new Setting(containerEl)
      .setName("Restore default paths")
      .setDesc("Reset all folder paths back to the defaults.")
      .addButton((btn) =>
        btn
          .setButtonText("Restore defaults")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = { ...DEFAULT_SETTINGS };
            await this.plugin.saveSettings();
            this.display();
            new Notice("Paths restored to defaults.");
          })
      );

    new Setting(containerEl).setName("Dependency status").setHeading();

    const dvInstalled = (this.app as any).plugins?.enabledPlugins?.has(
      "dataview"
    );
    if (dvInstalled) {
      containerEl.createEl("p", {
        text: "✅ Dataview is installed and enabled.",
      });
    } else {
      const warning = containerEl.createDiv({ cls: "scm-dataview-warning" });
      warning.createEl("strong", { text: "⚠️ Dataview is not enabled." });
      warning.createEl("p", {
        text: "The Contact Dashboard requires the Dataview community plugin. Please install and enable it from Settings → Community Plugins.",
      });
    }
  }
}

// ── Main Plugin ───────────────────────────────────────────────────────────────

export default class SimpleCMPlugin extends Plugin {
  settings: SimpleCMSettings;

  /**
   * Read-only API for companion plugins (e.g. the MERIDIAN dashboard). Consumers
   * check `version` and fall back to scanning contact notes if it is absent.
   */
  public api = {
    version: 2,
    /** Today + overdue triage rows, overdue first then by priority. */
    getContactsSummary: () => this.contactsSummary(),
    /** Open the interaction-note modal for a specific contact (by vault path or
     * contact name) and log it — so a companion UI can log against a contact it
     * already has in hand, without re-selecting from a picker. Returns true if
     * the contact was found. */
    logInteraction: (pathOrName: string): boolean => {
      let file = this.app.vault.getAbstractFileByPath(pathOrName);
      if (!(file instanceof TFile)) {
        file =
          this.getContactFiles().find(
            (f) => f.path === pathOrName || f.basename === pathOrName,
          ) ?? null;
      }
      if (file instanceof TFile) {
        this.logInteractionForFile(file);
        return true;
      }
      return false;
    },
  };

  /** Open the interaction-note modal for `file` and write the result, reusing
   * the same flow as the command. */
  logInteractionForFile(file: TFile): void {
    new InteractionNoteModal(this.app, file, async (noteText) => {
      await this.writeInteractionLog(file, noteText);
    }).open();
  }

  private contactsSummary() {
    const todayStr = today();
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2, "": 3 };
    const rows = this.getContactFiles().map((file) => {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const last = String(fm.last_contacted ?? "").slice(0, 10);
      const next = String(fm.next_followup ?? "").slice(0, 10);
      const priority = ["high", "medium", "low"].includes(String(fm.priority))
        ? String(fm.priority)
        : "";
      return {
        name: String(fm.name ?? file.basename),
        path: file.path,
        priority,
        daysSince: last ? moment(todayStr).diff(moment(last, "YYYY-MM-DD"), "days") : null,
        nextFollowup: next,
        overdue: !!next && next < todayStr,
        dueToday: !!next && next === todayStr,
      };
    });
    rows.sort((a, b) => {
      const bucket = (r: typeof a) => (r.overdue ? 0 : r.dueToday ? 1 : 2);
      return (
        bucket(a) - bucket(b) ||
        rank[a.priority] - rank[b.priority] ||
        (b.daysSince ?? -1) - (a.daysSince ?? -1)
      );
    });
    return rows;
  }

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SimpleCMSettingTab(this.app, this));

    this.addCommand({
      id: "new-contact",
      name: "New contact",
      callback: () => this.createContact(),
    });

    this.addCommand({
      id: "log-interaction",
      name: "Log contact interaction",
      callback: () => this.logInteraction(),
    });

    this.addCommand({
      id: "open-dashboard",
      name: "Open contact dashboard",
      callback: () => this.openDashboard(),
    });

    this.addRibbonIcon("contact", "Simple Contact Manager", () => {
      this.openDashboard();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ── Create Contact ──────────────────────────────────────────────────────

  createContact() {
    new NewContactModal(this.app, async (data) => {
      await this.writeContactNote(data);
    }).open();
  }

  async writeContactNote(data: ContactFormData) {
    const todayStr = today();
    const nextFollowup = addDays(data.followupDays);
    const folderPath = this.settings.contactsFolder;
    const fileName = sanitizeFileName(data.name);
    const filePath = `${folderPath}/${fileName}.md`;

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      new Notice(`⚠️ A contact named "${fileName}" already exists.`);
      await this.app.workspace.getLeaf().openFile(existing);
      return;
    }

    await ensureFolder(this.app, folderPath);

    const body = [
      `# ${data.name}`,
      "",
      "## Contact Info",
      `- **Email:** ${data.email}`,
      `- **Phone:** ${data.phone}`,
      `- **Company:** ${data.company}`,
      "",
      "## Notes",
      "",
      "",
      "## Interaction Log",
      "",
      `### ${todayStr}`,
      "- Contact created",
      "",
    ].join("\n");

    const newFile = await this.app.vault.create(filePath, body);

    await this.app.fileManager.processFrontMatter(newFile, (fm) => {
      fm.name = data.name;
      fm.email = data.email;
      fm.phone = data.phone;
      fm.company = data.company;
      fm.tags = ["contact"];
      fm.priority = data.priority;
      fm.relationship = data.relationship;
      fm.last_contacted = todayStr;
      fm.followup_days = data.followupDays;
      fm.next_followup = nextFollowup;
      fm.created = todayStr;
    });

    await this.app.workspace.getLeaf().openFile(newFile);
    new Notice(
      `✅ Created contact: ${data.name} — next follow-up in ${data.followupDays} days (${nextFollowup})`
    );
  }

  // ── Log Interaction ─────────────────────────────────────────────────────

  logInteraction() {
    const contactFiles = this.getContactFiles();

    if (contactFiles.length === 0) {
      new Notice(
        "No contacts found. Create a contact first using the 'New contact' command."
      );
      return;
    }

    new ContactSuggestModal(this.app, contactFiles, (file) => {
      new InteractionNoteModal(this.app, file, async (noteText) => {
        await this.writeInteractionLog(file, noteText);
      }).open();
    }).open();
  }

  async writeInteractionLog(file: TFile, noteText: string) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const followupDays = Number(fm?.followup_days) || 30;
    const todayStr = today();
    const nextFollowup = addDays(followupDays);

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.last_contacted = todayStr;
      frontmatter.next_followup = nextFollowup;
    });

    await this.app.vault.process(file, (content) => {
      const logHeading = /^## Interaction Log$/m;
      const todayHeading = `### ${todayStr}`;

      if (!logHeading.test(content)) {
        return `${content.trimEnd()}\n\n## Interaction Log\n\n${todayHeading}\n- ${noteText}\n`;
      }

      // If today's date heading already sits at the top of the log, add the
      // note under it instead of creating a duplicate heading.
      const todayAtTop = new RegExp(
        `^## Interaction Log\\n+${todayHeading}$`,
        "m"
      );
      if (todayAtTop.test(content)) {
        return content.replace(todayAtTop, (match) => `${match}\n- ${noteText}`);
      }

      return content.replace(
        logHeading,
        (match) => `${match}\n\n${todayHeading}\n- ${noteText}\n`
      );
    });

    // Mirror the interaction into today's daily note at log time (§8.3) — this
    // keeps "who I talked to today" correct even on days the dashboard is never
    // opened, and captures interactions logged from the command palette.
    const contactName = String(fm?.name ?? file.basename);
    await linkInteractionIntoDailyNote(this.app, this.settings, contactName, noteText);

    new Notice(
      `✅ Logged interaction for ${file.basename} — next follow-up: ${nextFollowup}`
    );
  }

  // ── Open Dashboard ──────────────────────────────────────────────────────

  async openDashboard() {
    const dashPath = this.settings.dashboardPath;
    let file = this.app.vault.getAbstractFileByPath(dashPath);

    if (!(file instanceof TFile)) {
      file = await this.createDashboard(dashPath);
      if (!file) return;
    }

    await this.app.workspace.getLeaf().openFile(file as TFile);
  }

  async createDashboard(dashPath: string): Promise<TFile | null> {
    const folder = this.settings.contactsFolder;
    const content = [
      "# 📇 Contact Dashboard",
      "",
      "> [!tip] This dashboard is powered by the Simple Contact Manager plugin and Dataview.",
      "> Each section auto-updates when you open this note.",
      "",
      "---",
      "",
      "## 🔴 Overdue — Reach Out Now",
      "",
      "```dataview",
      "TABLE WITHOUT ID",
      `  ("[[" + file.name + "|" + name + "]]") AS "Contact",`,
      '  email AS "Email",',
      '  priority AS "Priority",',
      '  last_contacted AS "Last Contacted",',
      '  next_followup AS "Was Due"',
      `FROM "${folder}"`,
      "WHERE next_followup < date(today) AND is_template != true",
      "SORT priority DESC, next_followup ASC",
      "```",
      "",
      "---",
      "",
      "## 🟡 Due Today",
      "",
      "```dataview",
      "TABLE WITHOUT ID",
      `  ("[[" + file.name + "|" + name + "]]") AS "Contact",`,
      '  email AS "Email",',
      '  priority AS "Priority",',
      '  last_contacted AS "Last Contacted"',
      `FROM "${folder}"`,
      "WHERE next_followup = date(today) AND is_template != true",
      "SORT priority DESC",
      "```",
      "",
      "---",
      "",
      "## 🟢 Upcoming — Next 7 Days",
      "",
      "```dataview",
      "TABLE WITHOUT ID",
      `  ("[[" + file.name + "|" + name + "]]") AS "Contact",`,
      '  email AS "Email",',
      '  priority AS "Priority",',
      '  next_followup AS "Follow-up Date",',
      '  (next_followup - date(today)).days + " days" AS "In"',
      `FROM "${folder}"`,
      "WHERE next_followup > date(today) AND next_followup <= date(today) + dur(7 days) AND is_template != true",
      "SORT next_followup ASC",
      "```",
      "",
      "---",
      "",
      "## 📅 Upcoming — Next 30 Days",
      "",
      "```dataview",
      "TABLE WITHOUT ID",
      `  ("[[" + file.name + "|" + name + "]]") AS "Contact",`,
      '  email AS "Email",',
      '  priority AS "Priority",',
      '  next_followup AS "Follow-up Date",',
      '  (next_followup - date(today)).days + " days" AS "In"',
      `FROM "${folder}"`,
      "WHERE next_followup > date(today) + dur(7 days) AND next_followup <= date(today) + dur(30 days) AND is_template != true",
      "SORT next_followup ASC",
      "```",
      "",
      "---",
      "",
      "## 🗂️ All Contacts",
      "",
      "```dataview",
      "TABLE WITHOUT ID",
      `  ("[[" + file.name + "|" + name + "]]") AS "Name",`,
      '  email AS "Email",',
      '  company AS "Company",',
      '  priority AS "Priority",',
      '  relationship AS "Type",',
      '  last_contacted AS "Last Contacted",',
      '  next_followup AS "Next Follow-up",',
      '  followup_days AS "Cadence (days)"',
      `FROM "${folder}"`,
      "WHERE is_template != true",
      "SORT priority DESC, name ASC",
      "```",
    ].join("\n");

    try {
      const parentFolder = dashPath.split("/").slice(0, -1).join("/");
      if (parentFolder) {
        await ensureFolder(this.app, parentFolder);
      }
      return await this.app.vault.create(dashPath, content);
    } catch (e) {
      new Notice(
        `Could not create dashboard at "${dashPath}". Check the path in plugin settings.`
      );
      return null;
    }
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  getContactFiles(): TFile[] {
    const folder = this.settings.contactsFolder;
    return this.app.vault.getMarkdownFiles().filter((f) => {
      if (!f.path.startsWith(folder + "/")) return false;
      const cache = this.app.metadataCache.getFileCache(f);
      if (!cache) return false;
      const tags = getAllTags(cache) ?? [];
      return tags.includes("#contact") && cache.frontmatter?.is_template !== true;
    });
  }
}
