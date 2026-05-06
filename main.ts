import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  moment,
} from "obsidian";

// ── Types ────────────────────────────────────────────────────────────────────

interface SimpleCMSettings {
  contactsFolder: string;
  templatesFolder: string;
  dashboardPath: string;
}

const DEFAULT_SETTINGS: SimpleCMSettings = {
  contactsFolder: "Contacts",
  templatesFolder: "Templates",
  dashboardPath: "Contact Dashboard.md",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return moment().format("YYYY-MM-DD");
}

function addDays(days: number): string {
  return moment().add(days, "days").format("YYYY-MM-DD");
}

async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(folderPath);
  if (!existing) {
    await app.vault.createFolder(folderPath);
  }
}

// ── New Contact Modal ─────────────────────────────────────────────────────────

class NewContactModal extends Modal {
  private settings: SimpleCMSettings;
  private onSubmit: (data: ContactFormData) => void;

  constructor(
    app: App,
    settings: SimpleCMSettings,
    onSubmit: (data: ContactFormData) => void
  ) {
    super(app);
    this.settings = settings;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "New Contact" });

    const form = contentEl.createDiv({ cls: "scm-modal-form" });

    // Name
    const nameField = form.createDiv({ cls: "scm-field" });
    nameField.createEl("label", { text: "Full Name *" });
    const nameInput = nameField.createEl("input", {
      type: "text",
      placeholder: "Jane Smith",
    });
    nameInput.focus();

    // Email
    const emailField = form.createDiv({ cls: "scm-field" });
    emailField.createEl("label", { text: "Email" });
    const emailInput = emailField.createEl("input", {
      type: "email",
      placeholder: "jane@example.com",
    });

    // Phone
    const phoneField = form.createDiv({ cls: "scm-field" });
    phoneField.createEl("label", { text: "Phone" });
    const phoneInput = phoneField.createEl("input", {
      type: "text",
      placeholder: "555-1234",
    });

    // Company
    const companyField = form.createDiv({ cls: "scm-field" });
    companyField.createEl("label", { text: "Company" });
    const companyInput = companyField.createEl("input", {
      type: "text",
      placeholder: "Acme Corp",
    });

    // Priority
    const priorityField = form.createDiv({ cls: "scm-field" });
    priorityField.createEl("label", { text: "Priority" });
    const prioritySelect = priorityField.createEl("select");
    [
      { value: "high", label: "High (7–14 days)" },
      { value: "medium", label: "Medium (30 days)" },
      { value: "low", label: "Low (60–90 days)" },
    ].forEach(({ value, label }) => {
      const opt = prioritySelect.createEl("option", { value, text: label });
      if (value === "medium") opt.selected = true;
    });

    // Relationship
    const relField = form.createDiv({ cls: "scm-field" });
    relField.createEl("label", { text: "Relationship" });
    const relSelect = relField.createEl("select");
    [
      "client",
      "colleague",
      "friend",
      "lead",
      "mentor",
      "acquaintance",
      "other",
    ].forEach((r) => {
      const opt = relSelect.createEl("option", { value: r, text: r });
      if (r === "acquaintance") opt.selected = true;
    });

    // Follow-up cadence
    const cadenceField = form.createDiv({ cls: "scm-field" });
    cadenceField.createEl("label", { text: "Follow-up cadence (days)" });
    const cadenceSelect = cadenceField.createEl("select");
    ["7", "14", "30", "60", "90"].forEach((d) => {
      const opt = cadenceSelect.createEl("option", {
        value: d,
        text: `Every ${d} days`,
      });
      if (d === "30") opt.selected = true;
    });

    // Buttons
    const buttons = contentEl.createDiv({ cls: "scm-modal-buttons" });

    const cancelBtn = buttons.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = buttons.createEl("button", {
      text: "Create Contact",
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        new Notice("Name is required.");
        nameInput.focus();
        return;
      }
      this.onSubmit({
        name,
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        company: companyInput.value.trim(),
        priority: prioritySelect.value,
        relationship: relSelect.value,
        followupDays: parseInt(cadenceSelect.value),
      });
      this.close();
    });

    // Allow Enter to submit
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  priority: string;
  relationship: string;
  followupDays: number;
}

// ── Log Interaction Modal ─────────────────────────────────────────────────────

class LogInteractionModal extends Modal {
  private contacts: TFile[];
  private onSubmit: (file: TFile, note: string) => void;

  constructor(
    app: App,
    contacts: TFile[],
    onSubmit: (file: TFile, note: string) => void
  ) {
    super(app);
    this.contacts = contacts;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Log Interaction" });

    const form = contentEl.createDiv({ cls: "scm-modal-form" });

    // Contact picker
    const contactField = form.createDiv({ cls: "scm-field" });
    contactField.createEl("label", { text: "Contact *" });

    // Search input
    const searchInput = contactField.createEl("input", {
      type: "text",
      placeholder: "Type to search...",
    });
    searchInput.focus();

    // Dropdown list
    const dropdown = contactField.createEl("select", {
      attr: { size: "6" },
    });
    dropdown.style.width = "100%";
    dropdown.style.marginTop = "4px";

    const populateDropdown = (filter: string) => {
      dropdown.empty();
      const filtered = this.contacts.filter((f) =>
        f.basename.toLowerCase().includes(filter.toLowerCase())
      );
      filtered.forEach((f) => {
        dropdown.createEl("option", { value: f.path, text: f.basename });
      });
      if (filtered.length > 0) {
        dropdown.options[0].selected = true;
      }
    };

    populateDropdown("");

    searchInput.addEventListener("input", () => {
      populateDropdown(searchInput.value);
    });

    // Interaction note
    const noteField = form.createDiv({ cls: "scm-field" });
    noteField.createEl("label", { text: "Interaction note *" });
    const noteInput = noteField.createEl("input", {
      type: "text",
      placeholder: "e.g. Called re: contract renewal",
    });

    // Buttons
    const buttons = contentEl.createDiv({ cls: "scm-modal-buttons" });
    const cancelBtn = buttons.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = buttons.createEl("button", {
      text: "Log Interaction",
      cls: "mod-cta",
    });
    saveBtn.addEventListener("click", () => {
      const selectedPath = dropdown.value;
      const noteText = noteInput.value.trim();

      if (!selectedPath) {
        new Notice("Please select a contact.");
        return;
      }
      if (!noteText) {
        new Notice("Please enter an interaction note.");
        noteInput.focus();
        return;
      }

      const file = this.contacts.find((f) => f.path === selectedPath);
      if (!file) {
        new Notice("Contact not found.");
        return;
      }

      this.onSubmit(file, noteText);
      this.close();
    });

    noteInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click();
    });
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

    containerEl.createEl("h2", { text: "Simple Contact Manager" });
    containerEl.createEl("p", {
      text: "Configure folder locations below. Defaults match the standard setup guide. Changes take effect immediately.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Contacts folder")
      .setDesc(
        "Folder where new contact notes are created. Default: Contacts"
      )
      .addText((text) =>
        text
          .setPlaceholder("Contacts")
          .setValue(this.plugin.settings.contactsFolder)
          .onChange(async (value) => {
            this.plugin.settings.contactsFolder = value.trim() || "Contacts";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Templates folder")
      .setDesc(
        "Folder where Contact Template.md is stored. Default: Templates"
      )
      .addText((text) =>
        text
          .setPlaceholder("Templates")
          .setValue(this.plugin.settings.templatesFolder)
          .onChange(async (value) => {
            this.plugin.settings.templatesFolder =
              value.trim() || "Templates";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Dashboard note path")
      .setDesc(
        "Path to your Contact Dashboard note (relative to vault root). Default: Contact Dashboard.md"
      )
      .addText((text) =>
        text
          .setPlaceholder("Contact Dashboard.md")
          .setValue(this.plugin.settings.dashboardPath)
          .onChange(async (value) => {
            this.plugin.settings.dashboardPath =
              value.trim() || "Contact Dashboard.md";
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Actions" });

    new Setting(containerEl)
      .setName("Open Contact Dashboard")
      .setDesc("Open the dashboard note in the current pane.")
      .addButton((btn) =>
        btn.setButtonText("Open Dashboard").onClick(async () => {
          await this.plugin.openDashboard();
        })
      );

    new Setting(containerEl)
      .setName("Restore default paths")
      .setDesc("Reset all folder paths back to the defaults.")
      .addButton((btn) =>
        btn
          .setButtonText("Restore Defaults")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = { ...DEFAULT_SETTINGS };
            await this.plugin.saveSettings();
            this.display();
            new Notice("Paths restored to defaults.");
          })
      );

    // Dataview check
    containerEl.createEl("h3", { text: "Dependency status" });
    const dvInstalled = (this.app as any).plugins?.enabledPlugins?.has(
      "dataview"
    );
    const statusEl = containerEl.createDiv();
    if (dvInstalled) {
      statusEl.createEl("p", {
        text: "✅ Dataview is installed and enabled.",
      });
    } else {
      const warning = statusEl.createDiv({ cls: "scm-dataview-warning" });
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

    // Settings tab
    this.addSettingTab(new SimpleCMSettingTab(this.app, this));

    // ── Command: New Contact ──────────────────────────────────────────────
    this.addCommand({
      id: "new-contact",
      name: "New contact",
      callback: () => this.createContact(),
    });

    // ── Command: Log Interaction ──────────────────────────────────────────
    this.addCommand({
      id: "log-interaction",
      name: "Log contact interaction",
      callback: () => this.logInteraction(),
    });

    // ── Command: Open Dashboard ───────────────────────────────────────────
    this.addCommand({
      id: "open-dashboard",
      name: "Open contact dashboard",
      callback: () => this.openDashboard(),
    });

    // ── Ribbon icon ───────────────────────────────────────────────────────
    this.addRibbonIcon("contact", "Simple Contact Manager", () => {
      this.openDashboard();
    });

    console.log("Simple Contact Manager loaded.");
  }

  onunload() {
    console.log("Simple Contact Manager unloaded.");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ── Create Contact ──────────────────────────────────────────────────────

  async createContact() {
    new NewContactModal(this.app, this.settings, async (data) => {
      await this.writeContactNote(data);
    }).open();
  }

  async writeContactNote(data: ContactFormData) {
    const { name, email, phone, company, priority, relationship, followupDays } = data;
    const todayStr = today();
    const nextFollowup = addDays(followupDays);
    const folderPath = this.settings.contactsFolder;
    const filePath = `${folderPath}/${name}.md`;

    // Guard: already exists
    if (this.app.vault.getAbstractFileByPath(filePath)) {
      new Notice(`⚠️ A contact named "${name}" already exists.`);
      const existing = this.app.vault.getAbstractFileByPath(filePath) as TFile;
      await this.app.workspace.getLeaf().openFile(existing);
      return;
    }

    await ensureFolder(this.app, folderPath);

    const content = [
      "---",
      `name: ${name}`,
      `email: ${email}`,
      `phone: ${phone}`,
      `company: ${company}`,
      `tags: [contact]`,
      `priority: ${priority}`,
      `relationship: ${relationship}`,
      `last_contacted: ${todayStr}`,
      `followup_days: ${followupDays}`,
      `next_followup: ${nextFollowup}`,
      `notes: `,
      `created: ${todayStr}`,
      "---",
      "",
      `# ${name}`,
      "",
      "## Contact Info",
      `- **Email:** ${email}`,
      `- **Phone:** ${phone}`,
      `- **Company:** ${company}`,
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

    const newFile = await this.app.vault.create(filePath, content);
    await this.app.workspace.getLeaf().openFile(newFile);
    new Notice(
      `✅ Created contact: ${name} — next follow-up in ${followupDays} days (${nextFollowup})`
    );
  }

  // ── Log Interaction ─────────────────────────────────────────────────────

  async logInteraction() {
    const contactFiles = this.getContactFiles();

    if (contactFiles.length === 0) {
      new Notice(
        "No contacts found. Create a contact first using the 'New contact' command."
      );
      return;
    }

    new LogInteractionModal(
      this.app,
      contactFiles,
      async (file, noteText) => {
        await this.writeInteractionLog(file, noteText);
      }
    ).open();
  }

  async writeInteractionLog(file: TFile, noteText: string) {
    let content = await this.app.vault.read(file);
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;

    if (!fm) {
      new Notice("Could not read frontmatter from this contact note.");
      return;
    }

    const followupDays = parseInt(fm["followup_days"]) || 30;
    const todayStr = today();
    const nextFollowup = addDays(followupDays);

    // Update last_contacted
    content = content.replace(
      /^last_contacted:.*$/m,
      `last_contacted: ${todayStr}`
    );

    // Update next_followup
    content = content.replace(
      /^next_followup:.*$/m,
      `next_followup: ${nextFollowup}`
    );

    // Append log entry under "## Interaction Log"
    const logEntry = `\n### ${todayStr}\n- ${noteText}\n`;

    if (content.includes("## Interaction Log")) {
      content = content.replace(
        /## Interaction Log/,
        `## Interaction Log${logEntry}`
      );
    } else {
      content += `\n## Interaction Log\n${logEntry}`;
    }

    await this.app.vault.modify(file, content);
    new Notice(
      `✅ Logged interaction for ${file.basename} — next follow-up: ${nextFollowup}`
    );
  }

  // ── Open Dashboard ──────────────────────────────────────────────────────

  async openDashboard() {
    const dashPath = this.settings.dashboardPath;
    let file = this.app.vault.getAbstractFileByPath(dashPath) as TFile | null;

    if (!file) {
      // Dashboard doesn't exist yet — create it
      file = await this.createDashboard(dashPath);
      if (!file) return;
    }

    await this.app.workspace.getLeaf().openFile(file);
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
      // Create parent folder if needed
      const parts = dashPath.split("/");
      if (parts.length > 1) {
        const parentFolder = parts.slice(0, -1).join("/");
        await ensureFolder(this.app, parentFolder);
      }
      return await this.app.vault.create(dashPath, content);
    } catch (e) {
      new Notice(`Could not create dashboard at "${dashPath}". Check the path in plugin settings.`);
      return null;
    }
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  getContactFiles(): TFile[] {
    const folder = this.settings.contactsFolder;
    return this.app.vault.getMarkdownFiles().filter((f) => {
      if (!f.path.startsWith(folder + "/")) return false;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (!fm) return false;
      const tags: string[] = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
      return tags.includes("contact") && fm.is_template !== true;
    });
  }
}
