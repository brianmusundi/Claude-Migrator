# Staff Migration Guide — Claude Account Migration

**For all staff migrating from a personal Claude account to the team account**

---

## Overview

This guide walks you through transferring your Claude chat history, memory, and context from your **personal** Claude account to the **team** account. Since Anthropic doesn't support direct account-to-account migration, we use a structured export → parse → import workflow.

**Time required:** 15–30 minutes (plus export processing time)

---

## What You'll Get

| What | How |
|------|-----|
| **Memory & preferences** | Imported directly into team account memory |
| **Chat history** | Exported as searchable Markdown files for reference |
| **Recurring topics & context** | Summarized into memory edits |
| **Tool usage patterns** | Documented in the export summary |

**What does NOT migrate:** Active conversation threads cannot be continued in the new account. You get the content, not the live session.

---

## Step 1: Export Your Personal Account Data

1. Log into your **personal** Claude account at [claude.ai](https://claude.ai)
2. Click your initials (bottom-left corner)
3. Select **Settings**
4. Go to the **Privacy** tab
5. Click **"Export data"**
6. Check your email — you'll receive a download link
7. **Download the ZIP file within 24 hours** (the link expires)
8. Save the ZIP somewhere accessible

**Troubleshooting:**
- **Can't find the button?** Look for "Data Controls" instead of "Privacy"
- **No email after 4 hours?** Check spam, verify email in Settings → Account, then retry
- **Link expired?** Just request a new export from the same place
- **On mobile?** Use your phone's browser at claude.ai — the app doesn't support export

---

## Step 2: Process Your Export

### Option A: Use Claude (Recommended)

1. Log into your **team** Claude account
2. Start a new conversation
3. Upload the ZIP file
4. Say: *"I need to migrate my Claude data"* or *"Parse this Claude export"*
5. Claude handles everything automatically — parsing, validation, and file generation

### Option B: Run the Script

```bash
git clone https://github.com/YOUR_USERNAME/claude-migrator.git
cd claude-migrator
python3 scripts/parse_claude_export.py your-export.zip ./output
```

No external dependencies needed.

---

## Step 3: Review the Memory Summary

Open `memory-summary.md` and review it carefully:

- ❌ **Remove** anything outdated (old projects, former roles)
- ❌ **Remove** anything personal you don't want in the team context
- ✅ **Keep** work-relevant context (projects, tool preferences, workflows)
- ➕ **Add** anything missing

---

## Step 4: Import into Team Account

1. Log into your **team** Claude account
2. Go to **Settings → Capabilities → Memory**
3. Click **"View and edit your memory"**
4. Add each relevant line from your curated memory summary

**Alternative — Bulk Import:**
1. Go to **Settings → Capabilities → Memory**
2. Click **"Start import"** under "Import memory from other AI providers"
3. Paste your curated memory summary
4. Click **"Add to memory"** — updates appear within 24 hours

---

## Step 5: Verify

Start a new conversation and ask: *"What do you remember about me?"*

Claude should reflect back the context you imported. If anything is missing, add it manually.

---

## Step 6: Seed Critical Context (Optional)

For important ongoing projects, open a new chat and paste:

> "Here is context about my current work: I'm a [role] at [company]. I'm currently working on [project]. My key tools are [tools]. Please keep this for future conversations."

---

## Step 7: Archive

Upload the `conversations/` folder and `index.md` to Google Drive for searchable reference.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| Export link expired | Request a new one from Settings → Privacy |
| ZIP has no conversations | May only contain metadata — verify you had saved chats |
| Parser errors | Ensure ZIP is the original download (not re-zipped) |
| Memory not appearing | Allow up to 24 hours |
| Missing context | Add specific edits in Settings → Capabilities → Memory |
| Wrong things remembered | Remove in Settings → Capabilities → Memory → View and edit |

---

## Questions?

Reach out to **Brian Musundi** (brianw@lighthousesports.com) for help.
