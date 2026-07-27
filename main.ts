import {
  App,
  FuzzySuggestModal,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  getAllTags,
  moment,
} from "obsidian";

// ── Types & constants ─────────────────────────────────────────────────────────

interface SimpleCMSettings {
  contactsFolder: string;
  dashboardPath: string;
}

const DEFAULT_SETTINGS: SimpleCMSettings = {
  contactsFolder: "Contacts",
  dashboardPath: "Contact Dashboard.md",
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
      // Unified frontmatter schema (docs/frontmatter-schema.md): core keys flat,
      // contact-specific fields nested under `contact:`. name/email/phone stay
      // flat (shared keys).
      fm.type = "contact";
      fm.status = "active";
      fm.name = data.name;
      fm.email = data.email;
      fm.phone = data.phone;
      fm.tags = ["contact"];
      fm.created = todayStr;
      fm.updated = todayStr;
      fm.contact = {
        company: data.company,
        priority: data.priority,
        relationship: data.relationship,
        last_contacted: todayStr,
        followup_days: data.followupDays,
        next_followup: nextFollowup,
      };
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
    // Read nested schema first, fall back to legacy flat keys for any contact
    // note authored before the frontmatter migration.
    const followupDays =
      Number(fm?.contact?.followup_days ?? fm?.followup_days) || 30;
    const todayStr = today();
    const nextFollowup = addDays(followupDays);

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      const contact =
        frontmatter.contact && typeof frontmatter.contact === "object"
          ? frontmatter.contact
          : (frontmatter.contact = {});
      contact.last_contacted = todayStr;
      contact.next_followup = nextFollowup;
      frontmatter.updated = todayStr;
      // Fold any legacy flat keys into the nested block so the note ends up
      // schema-clean after its first logged interaction.
      for (const k of [
        "last_contacted",
        "next_followup",
        "followup_days",
        "priority",
        "relationship",
        "company",
      ]) {
        if (k in frontmatter && !(k in contact)) contact[k] = frontmatter[k];
        delete frontmatter[k];
      }
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
      '  contact.priority AS "Priority",',
      '  contact.last_contacted AS "Last Contacted",',
      '  contact.next_followup AS "Was Due"',
      `FROM "${folder}"`,
      "WHERE contact.next_followup < date(today) AND is_template != true",
      "SORT contact.priority DESC, contact.next_followup ASC",
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
      '  contact.priority AS "Priority",',
      '  contact.last_contacted AS "Last Contacted"',
      `FROM "${folder}"`,
      "WHERE contact.next_followup = date(today) AND is_template != true",
      "SORT contact.priority DESC",
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
      '  contact.priority AS "Priority",',
      '  contact.next_followup AS "Follow-up Date",',
      '  (contact.next_followup - date(today)).days + " days" AS "In"',
      `FROM "${folder}"`,
      "WHERE contact.next_followup > date(today) AND contact.next_followup <= date(today) + dur(7 days) AND is_template != true",
      "SORT contact.next_followup ASC",
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
      '  contact.priority AS "Priority",',
      '  contact.next_followup AS "Follow-up Date",',
      '  (contact.next_followup - date(today)).days + " days" AS "In"',
      `FROM "${folder}"`,
      "WHERE contact.next_followup > date(today) + dur(7 days) AND contact.next_followup <= date(today) + dur(30 days) AND is_template != true",
      "SORT contact.next_followup ASC",
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
      '  contact.company AS "Company",',
      '  contact.priority AS "Priority",',
      '  contact.relationship AS "Type",',
      '  contact.last_contacted AS "Last Contacted",',
      '  contact.next_followup AS "Next Follow-up",',
      '  contact.followup_days AS "Cadence (days)"',
      `FROM "${folder}"`,
      "WHERE is_template != true",
      "SORT contact.priority DESC, name ASC",
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
