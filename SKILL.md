---
name: claude-account-migrator
description: "Interactive wizard for migrating Claude chat history and memory between Claude accounts (personal to team, team to team, etc). Use this skill whenever a user mentions migrating, transferring, exporting, or importing Claude data between accounts. Also trigger on phrases like 'move my chats', 'transfer to team account', 'export Claude data', 'import my history', 'switch Claude accounts', 'account migration', or 'bring my data over'. This skill handles the FULL pipeline with step-by-step guidance, automatic validation, self-healing for broken exports, and troubleshooting — even for non-technical users."
---

# Claude Account Migrator — Interactive Wizard

You are a migration assistant guiding a user through transferring their Claude data between accounts. Follow this file exactly. Be warm, clear, and proactive about fixing problems.

---

## STEP 0: Determine the User's Goal

When this skill triggers, your FIRST action is to ask the user what they need:

**Ask:**
> Welcome! I'll help you move your Claude data between accounts.
>
> **What would you like to do?**
> 1. **Full Migration** — Export from one account and import into another (I'll guide you through both)
> 2. **Export Only** — Get your data out of a Claude account into organized files
> 3. **Import Only** — I already have my export file, help me bring it into a new account
>
> Just tell me which one, or upload your export ZIP/JSON file and I'll jump straight to processing it.

**Routing logic:**
- If user says "1", "full", or "migration" → Start at **PHASE 1: EXPORT**
- If user says "2" or "export" → Start at **PHASE 1: EXPORT**
- If user says "3", "import", or uploads a file → Skip to **PHASE 2: PROCESS & VALIDATE**
- If user uploads a file without saying anything → Skip to **PHASE 2: PROCESS & VALIDATE**

---

## PHASE 1: EXPORT

### Step 1.1: Confirm Source Account Access

**Ask:**
> Which account are you exporting FROM? (e.g., "my personal Pro account", "my old team account")
>
> Make sure you're currently logged into that account in your browser. The export must be done from within the account itself — I can't do it for you, but I'll walk you through every click.

### Step 1.2: Walk Through the Export Process

**Provide these instructions exactly, one step at a time. After each step, confirm the user completed it before moving on.**

> **Step 1 of 5:** Open [claude.ai](https://claude.ai) in your browser and make sure you're logged into the account you want to export from. Look at the bottom-left corner — you should see your initials or profile icon.
>
> ✅ Can you confirm you're logged into the right account?

Wait for confirmation, then:

> **Step 2 of 5:** Click your initials or profile icon in the bottom-left corner, then select **"Settings"** from the menu that appears.
>
> ✅ Are you in Settings now?

Wait for confirmation, then:

> **Step 3 of 5:** Look for the **"Privacy"** tab (sometimes called "Privacy & Data"). Click on it. You should see a section about data export.
>
> ✅ Can you see an "Export data" button?

**If user says they can't find it:**
> No worries — the layout can vary slightly. Try these alternatives:
> - Look for a tab called **"Data Controls"** instead of "Privacy"
> - On mobile, you may need to scroll down within Settings
> - If you're on a Free plan, confirm you have export access (it's available on Free, Pro, Max, Team, and Enterprise)
>
> If you're still stuck, tell me what tabs you DO see in Settings and I'll guide you from there.

Wait for confirmation, then:

> **Step 4 of 5:** Click the **"Export data"** button. Claude will confirm your request and tell you to check your email.
>
> ✅ Did you see the confirmation message?

Wait for confirmation, then:

> **Step 5 of 5:** Check your email (the one linked to this Claude account). You'll receive a download link. A few important notes:
> - It may take **a few minutes to a few hours** depending on how much data you have
> - The download link **expires in 24 hours** — download it promptly
> - You must be **logged into the same account** to use the download link
> - Save the ZIP file somewhere easy to find (Desktop or Downloads)
>
> ⏳ Once you've downloaded the ZIP, upload it here and I'll take it from there.

### Step 1.3: Handle Common Export Issues

**If user says they didn't receive the email:**
> Here's what to check:
> 1. **Spam/Junk folder** — the email comes from Anthropic and some providers flag it
> 2. **Correct email** — make sure you're checking the email address linked to your Claude account (check Settings → Account to confirm)
> 3. **Wait time** — for accounts with lots of conversations, it can take up to a few hours
> 4. **Try again** — if it's been more than 4 hours, go back to Settings → Privacy and request a new export
>
> Let me know what happens.

**If user says the download link expired:**
> No problem — just go back to **Settings → Privacy → Export data** and request a new one. The link only lasts 24 hours, but you can request as many times as you need.

**If user says they're on mobile and can't export:**
> The export feature isn't available on iOS or Android apps. You'll need to:
> 1. Open a browser on your phone (Safari, Chrome, etc.)
> 2. Go to [claude.ai](https://claude.ai)
> 3. Log in and follow the export steps from there
>
> Or if you have access to a computer, that's easier.

---

## PHASE 2: PROCESS & VALIDATE

### Step 2.1: Receive the File

When the user uploads a file, immediately identify what they uploaded:

```python
import os, zipfile, json
from pathlib import Path

upload_dir = Path("/mnt/user-data/uploads")
files = list(upload_dir.iterdir())

# Find the uploaded file
target = None
for f in files:
    if f.suffix in ('.zip', '.json'):
        target = f
        break
```

**Identify file type and act accordingly:**

| File Type | Action |
|-----------|--------|
| `.zip` file | Extract and look for JSON files inside |
| `.json` file | Parse directly |
| Other | Tell user: "I need a ZIP or JSON file from your Claude export. The export produces a ZIP — please upload that file." |

### Step 2.2: Extract and Validate

Run the full parser. The parser script is embedded below — execute it inline.

**CRITICAL: The parser must handle ALL of these known export structures:**

1. **Top-level array of conversation objects** — each with `chat_messages` or `messages`
2. **Object with a `conversations` key** containing an array
3. **Object with `chats`, `data`, or `chat_histories` keys**
4. **Single conversation object** (one chat only)
5. **ChatGPT-style export** (if user accidentally uploaded wrong platform) — detect `mapping` key and warn

**For each conversation, extract:**
- UUID/ID
- Name/title (fall back to first user message if unnamed)
- Created/updated timestamps
- All messages with role and content (handling both string and structured content blocks)
- Tool usage

### Step 2.3: Run Validation Checks

After parsing, run these checks and report results to the user:

```
VALIDATION REPORT
═══════════════════════════════════════

✅ File format:        Valid ZIP/JSON
✅ Conversations found: [N] conversations
✅ Messages parsed:     [N] total ([N] from you, [N] from Claude)
✅ Date range:          [earliest] to [latest]
✅ Named conversations: [N] of [N] have titles
⚠️  Empty conversations: [N] conversations with 0 messages (skipped)
❌ Parse errors:        [N] conversations failed to parse

MONTHLY ACTIVITY
═══════════════════════════════════════
2025-06  ████████████ 12
2025-07  ████████████████████ 20
...
```

### Step 2.4: Self-Healing — Fix Common Problems

**Run these fixes AUTOMATICALLY without asking the user. Just inform them what was fixed.**

#### Fix 1: Missing Conversation Names
```python
# If a conversation has no name/title, generate one from the first user message
if not conv.get('name') and not conv.get('title'):
    first_msg = get_first_user_message(conv)
    conv['name'] = first_msg[:80] + '...' if len(first_msg) > 80 else first_msg
    fixes.append(f"Named untitled conversation: '{conv['name']}'")
```

#### Fix 2: Malformed Timestamps
```python
# Handle Unix timestamps, ISO strings with/without timezone, and missing dates
def safe_parse_date(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(val, tz=timezone.utc)
        except (ValueError, OSError):
            return None
    if isinstance(val, str):
        for fmt in [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%S.%f%z',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
        ]:
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
    return None
```

#### Fix 3: Structured Content Blocks
```python
# Handle content that is a list of blocks instead of a plain string
def extract_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get('type') == 'text':
                    parts.append(block.get('text', ''))
                elif block.get('type') == 'tool_use':
                    parts.append(f"[Tool: {block.get('name', 'unknown')}]")
                elif block.get('type') == 'tool_result':
                    # Extract text from tool results too
                    inner = block.get('content', '')
                    if isinstance(inner, list):
                        for sub in inner:
                            if isinstance(sub, dict) and sub.get('type') == 'text':
                                parts.append(sub.get('text', ''))
                    elif isinstance(inner, str):
                        parts.append(inner)
                elif block.get('type') in ('image', 'document'):
                    parts.append(f"[{block.get('type').title()}]")
            elif isinstance(block, str):
                parts.append(block)
        return '\n\n'.join(p for p in parts if p.strip())
    return str(content) if content else ''
```

#### Fix 4: Duplicate Conversations
```python
# Detect and merge duplicates by UUID
seen_uuids = {}
for conv in conversations:
    uid = conv.get('uuid', conv.get('id', ''))
    if uid and uid in seen_uuids:
        # Keep the one with more messages
        existing = seen_uuids[uid]
        if len(get_messages(conv)) > len(get_messages(existing)):
            seen_uuids[uid] = conv
            fixes.append(f"Replaced duplicate conversation: {uid}")
    else:
        seen_uuids[uid] = conv
```

#### Fix 5: Wrong Platform Detection
```python
# Detect if user uploaded a ChatGPT export instead of Claude
if any(conv.get('mapping') for conv in conversations):
    warn_user(
        "⚠️ This looks like a ChatGPT export, not a Claude export. "
        "I can still parse it, but if you meant to export from Claude, "
        "go to claude.ai → Settings → Privacy → Export data."
    )
```

#### Fix 6: Encoding Issues
```python
# Handle non-UTF-8 content gracefully
def safe_read(raw_bytes):
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            return raw_bytes.decode(encoding)
        except (UnicodeDecodeError, AttributeError):
            continue
    return raw_bytes.decode('utf-8', errors='replace')
```

**After all fixes, report to user:**
> 🔧 **Auto-fixes applied:**
> - Named 3 untitled conversations from their first message
> - Fixed 2 timestamps that were in Unix format
> - Removed 1 duplicate conversation
> - Extracted text from 5 structured content blocks
>
> Everything is clean now. Here's your processed data:

### Step 2.5: Generate Output Files

Produce these files in `/home/claude/migration-output/`:

1. **index.md** — Master conversation index (date, topic, message count, link to file)
2. **memory-summary.md** — Extracted context for memory import (topics, keywords, tools, suggested edits)
3. **stats.md** — Export statistics with monthly activity chart
4. **conversations/** — One Markdown file per conversation, named `YYYY-MM-DD_topic-slug.md`

**Conversation file format:**
```markdown
# [Topic/Name]

**Date:** [Human-readable date]
**Messages:** [N] ([N] from you, [N] from Claude)
**Original ID:** `[uuid]`

---

**You:**
[message content]

---

**Claude:**
[message content]

---
```

**Memory summary must include:**
- Top discussion topics (deduplicated)
- Most frequent keywords (filtered for stop words)
- Tools used and frequency
- A ready-to-paste block of suggested memory edits
- Clear instructions for what to do with it

### Step 2.6: Present Results

Show the user their validation report and output files. Then ask:

> Your export is processed and validated. Here's what I found:
>
> [Show validation report]
>
> I've generated [N] conversation files, a master index, and a memory summary ready for import.
>
> **What would you like to do next?**
> 1. **Import into another account** — I'll walk you through it step by step
> 2. **Download the files** — Get everything as organized Markdown for your records
> 3. **Review and edit the memory summary** — Before importing, let's make sure it's accurate
> 4. **Fix something** — If anything looks wrong, tell me and I'll correct it

---

## PHASE 3: IMPORT INTO TARGET ACCOUNT

### Step 3.1: Confirm Target Account

**Ask:**
> Which account are you importing INTO? (e.g., "my Lighthouse Sports team account", "my new Pro account")
>
> Make sure you have access to that account. You'll need to be logged into it in your browser for the memory import steps.

### Step 3.2: Review Memory Summary

**Always show the memory summary to the user before importing:**

> Before we import, let's review what Claude will remember about you in the new account. Here's the memory summary I generated:
>
> [Show memory-summary.md content]
>
> **Please review this carefully:**
> - ❌ Remove anything outdated (old projects, former job roles, expired info)
> - ❌ Remove anything personal you don't want in a team/shared context
> - ✅ Keep work-relevant context (current projects, tool preferences, communication style)
> - ➕ Add anything important that's missing
>
> Tell me what to change, or say "looks good" to proceed.

**Handle edits:** If user requests changes, update the memory summary and show the revised version before proceeding.

### Step 3.3: Walk Through Memory Import

**Provide these instructions one step at a time:**

> **Step 1 of 4:** Open [claude.ai](https://claude.ai) in your browser and log into your **target** account (the one you're importing into).
>
> ✅ Logged in to the right account?

Wait for confirmation, then:

> **Step 2 of 4:** Go to **Settings → Capabilities → Memory**. You should see a section called "Memory" with options to view and manage it.
>
> ✅ Can you see the Memory section?

**If user can't find it:**
> Try these alternatives:
> - On some plans, it's under **Settings → Capabilities** directly
> - Make sure Memory is **turned on** (there should be a toggle)
> - If you're on a Team plan, your admin may need to enable Memory for the workspace
>
> Tell me what you see and I'll help you find it.

Wait for confirmation, then:

> **Step 3 of 4:** You have two options for importing:
>
> **Option A (Recommended for <15 items):** Click **"View and edit your memory"**, then click **"Add"** for each memory edit. I'll give you the items one at a time to copy-paste.
>
> **Option B (Faster for large imports):** If you see an **"Import memory"** or **"Start import"** option, click it. Then paste the entire memory summary text I'll provide, and click "Add to memory."
>
> Which option do you see / prefer?

**If Option A:**
Feed the user memory edits one at a time:
> Here's memory edit 1 of [N]. Copy this and click "Add":
>
> `[memory edit text]`
>
> ✅ Added? Here's the next one...

**If Option B:**
Provide the full summary block:
> Copy everything below and paste it into the import box:
>
> ```
> [Full curated memory summary]
> ```
>
> Then click "Add to memory." It may take up to 24 hours for Claude to fully absorb the imported memory.

Wait for confirmation, then:

> **Step 4 of 4:** To verify the import worked, start a new conversation in your target account and ask:
>
> *"What do you remember about me?"*
>
> Claude should reflect back the context you just imported. If anything is missing, you can always add more memory edits manually.

### Step 3.4: Optional — Seed Critical Context

> **Bonus step (optional but recommended):**
>
> If you have important ongoing projects, open a new chat in your target account and paste a brief context dump. For example:
>
> *"Here's context about my current work: I'm a [role] at [company]. I'm currently working on [project]. I prefer [tools/languages]. My communication style is [description]. Please keep this in mind for our future conversations."*
>
> This gives Claude an immediate working context without waiting for memory to build up.

### Step 3.5: Archive Conversation Files

> Finally, I recommend saving your conversation files for reference:
>
> 1. Download the organized Markdown files I generated
> 2. Upload them to **Google Drive** or your team's shared workspace
> 3. They're fully searchable — you can find any old conversation by keyword
>
> Your migration is complete! 🎉

---

## TROUBLESHOOTING REFERENCE

**Use this section to diagnose and fix issues at any point in the process. Match the user's symptom to the fix.**

### Export Issues

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| No export button visible | Wrong settings tab or unsupported plan | Guide to Settings → Privacy. Export is available on all plans (Free, Pro, Max, Team, Enterprise) |
| Export email never arrives | Spam filter or wrong email | Check spam, verify account email in Settings → Account, wait up to 4 hours, then retry |
| Download link expired | More than 24 hours elapsed | Request a new export from Settings → Privacy |
| ZIP file is 0 bytes or corrupted | Download interrupted | Re-download using the same link (if within 24h) or request new export |
| Can't export on mobile | Feature not available on iOS/Android apps | Use mobile browser (Safari/Chrome) at claude.ai, or use a computer |

### Parse Issues

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| "No conversations found" | Export contains only account metadata, or format changed | Check if the ZIP contains a `conversations.json` or similar file. If only `account.json` exists, the account may have had no saved chats. |
| JSON parse errors | Corrupted download or non-JSON content | Re-download the export. If persists, extract the ZIP manually and upload the individual JSON files |
| Conversations missing messages | Deleted chats or ephemeral conversations | Deleted conversations may not be included in exports. Nothing to fix — this is expected. |
| Garbled/encoding characters | Non-UTF-8 content in messages | The parser auto-fixes this with fallback encoding. If still garbled, report the specific conversation and I'll investigate. |
| Wrong platform export | User uploaded ChatGPT/Gemini export | The parser detects this and warns. Guide user to export from the correct platform. |
| Very large export (>500MB) | Heavy user with many conversations | Parser handles this fine but processing will take longer. Be patient. |

### Import Issues

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Memory section not visible | Memory disabled or not available on plan | Check Settings → Capabilities → toggle Memory ON. Available on Pro, Max, Team, Enterprise. |
| Import feature not showing | Not all plans have the import button | Use manual "Add" method instead — add memory edits one by one |
| Memory not reflecting after import | Needs up to 24 hours to process | Wait 24 hours, then test with "What do you remember about me?" |
| Claude remembers wrong things | Outdated or incorrect items imported | Go to Settings → Capabilities → Memory → View and edit. Remove incorrect entries manually. |
| Team admin blocked memory | Team workspace policy | Contact your workspace admin to enable Memory for team members |

### Recovery Procedures

**If the export ZIP won't open:**
```python
# Try to repair the ZIP
import zipfile
try:
    with zipfile.ZipFile(path, 'r') as zf:
        # Test integrity
        bad = zf.testzip()
        if bad:
            print(f"Corrupted file in ZIP: {bad}")
            # Extract what we can
            for name in zf.namelist():
                try:
                    zf.extract(name, output_dir)
                except zipfile.BadZipFile:
                    print(f"Skipping corrupted: {name}")
except zipfile.BadZipFile:
    print("ZIP is severely corrupted — request a new export")
```

**If JSON is truncated:**
```python
# Attempt to recover partial JSON
import json
raw = open(path).read()
# Try parsing as-is
try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    # Try to close open brackets
    trimmed = raw[:e.pos]
    depth_arr = trimmed.count('[') - trimmed.count(']')
    depth_obj = trimmed.count('{') - trimmed.count('}')
    patched = trimmed.rstrip(', \n\t')
    patched += '}' * depth_obj + ']' * depth_arr
    try:
        data = json.loads(patched)
        print(f"Recovered partial JSON: {len(data)} items")
    except:
        print("JSON is too corrupted to recover")
```

**If conversations directory is too large for upload:**
```python
# Offer to split into batches
import math
BATCH_SIZE = 50
total = len(conversation_files)
batches = math.ceil(total / BATCH_SIZE)
for i in range(batches):
    batch_files = conversation_files[i*BATCH_SIZE:(i+1)*BATCH_SIZE]
    # Create ZIP per batch
    create_zip(f"conversations-batch-{i+1}-of-{batches}.zip", batch_files)
```

---

## INLINE PARSER — COMPLETE IMPLEMENTATION

When the user uploads their export file, execute this complete parser. Do NOT import from an external module — run it inline so the skill is fully self-contained.

```python
#!/usr/bin/env python3
"""
Claude Export Parser — Self-contained inline implementation.
Run this when a user uploads their export ZIP or JSON.
"""

import json
import os
import re
import sys
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def sanitize_filename(text, max_len=60):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = text.strip('-')
    return text[:max_len] if text else 'untitled'


def safe_parse_date(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(val, tz=timezone.utc)
        except (ValueError, OSError):
            return None
    if isinstance(val, str):
        for fmt in [
            '%Y-%m-%dT%H:%M:%S.%fZ',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%f%z',
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
        ]:
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
        # Last resort: fromisoformat
        try:
            return datetime.fromisoformat(val.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            pass
    return None


def extract_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                btype = block.get('type', '')
                if btype == 'text':
                    parts.append(block.get('text', ''))
                elif btype == 'tool_use':
                    parts.append(f"[Tool: {block.get('name', 'unknown')}]")
                elif btype == 'tool_result':
                    inner = block.get('content', '')
                    if isinstance(inner, list):
                        for sub in inner:
                            if isinstance(sub, dict) and sub.get('type') == 'text':
                                parts.append(sub.get('text', ''))
                    elif isinstance(inner, str):
                        parts.append(inner)
                elif btype in ('image', 'document'):
                    parts.append(f"[{btype.title()}]")
            elif isinstance(block, str):
                parts.append(block)
        return '\n\n'.join(p for p in parts if p.strip())
    return str(content) if content else ''


def get_messages(conv):
    for key in ('chat_messages', 'messages', 'conversation'):
        if key in conv and isinstance(conv[key], list):
            return conv[key]
    if 'mapping' in conv:
        msgs = []
        for node in conv['mapping'].values():
            if isinstance(node, dict) and node.get('message'):
                msgs.append(node['message'])
        return sorted(msgs, key=lambda m: m.get('create_time', 0))
    return []


def extract_topic(messages, name=''):
    if name and name.strip():
        return name.strip()
    for msg in messages:
        role = msg.get('role', msg.get('sender', ''))
        if role in ('user', 'human'):
            text = extract_text(msg.get('content', msg.get('text', '')))
            if text.strip():
                return text.strip().split('\n')[0][:120]
    return 'Untitled Conversation'


def parse_conversations(data):
    conversations = []
    is_chatgpt = False

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                if 'mapping' in item:
                    is_chatgpt = True
                if any(k in item for k in ('chat_messages', 'messages', 'mapping')):
                    conversations.append(item)
        if not conversations and all(isinstance(m, dict) and ('role' in m or 'sender' in m) for m in data):
            conversations.append({'messages': data, 'name': 'Exported Conversation'})

    elif isinstance(data, dict):
        for key in ('conversations', 'chats', 'data', 'chat_histories'):
            if key in data and isinstance(data[key], list):
                conversations = data[key]
                break
        if not conversations:
            if any(k in data for k in ('chat_messages', 'messages', 'mapping')):
                conversations = [data]
                if 'mapping' in data:
                    is_chatgpt = True

    return conversations, is_chatgpt


def safe_read_bytes(raw_bytes):
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
        try:
            return raw_bytes.decode(encoding)
        except (UnicodeDecodeError, AttributeError):
            continue
    return raw_bytes.decode('utf-8', errors='replace')


def run_migration(input_path, output_dir):
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    conv_dir = output_dir / 'conversations'
    conv_dir.mkdir(exist_ok=True)

    fixes = []
    warnings = []
    all_conversations = []
    json_files = []
    is_chatgpt_export = False

    # === EXTRACT ===
    if input_path.suffix == '.zip':
        try:
            with zipfile.ZipFile(input_path, 'r') as zf:
                bad = zf.testzip()
                if bad:
                    fixes.append(f"Skipped corrupted file in ZIP: {bad}")

                for name in zf.namelist():
                    if name.endswith('.json'):
                        json_files.append(name)
                        try:
                            raw = safe_read_bytes(zf.read(name))
                            data = json.loads(raw)
                            convs, is_gpt = parse_conversations(data)
                            if is_gpt:
                                is_chatgpt_export = True
                            all_conversations.extend(convs)
                        except json.JSONDecodeError as e:
                            # Try recovery
                            try:
                                trimmed = raw[:e.pos].rstrip(', \n\t')
                                depth_arr = trimmed.count('[') - trimmed.count(']')
                                depth_obj = trimmed.count('{') - trimmed.count('}')
                                patched = trimmed + '}' * depth_obj + ']' * depth_arr
                                data = json.loads(patched)
                                convs, _ = parse_conversations(data)
                                all_conversations.extend(convs)
                                fixes.append(f"Recovered truncated JSON in {name}")
                            except:
                                warnings.append(f"Could not parse {name}: {e}")
        except zipfile.BadZipFile:
            return None, [], ["ZIP file is corrupted. Please re-download your export."]

    elif input_path.suffix == '.json':
        try:
            raw = safe_read_bytes(input_path.read_bytes())
            data = json.loads(raw)
            convs, is_gpt = parse_conversations(data)
            if is_gpt:
                is_chatgpt_export = True
            all_conversations.extend(convs)
        except json.JSONDecodeError as e:
            warnings.append(f"JSON parse error: {e}")

    if is_chatgpt_export:
        warnings.append(
            "This appears to be a ChatGPT export, not Claude. "
            "I've parsed it anyway, but if you meant to export from Claude, "
            "go to claude.ai → Settings → Privacy → Export data."
        )

    if not all_conversations:
        return None, fixes, warnings + ["No conversations found in the export."]

    # === DEDUPLICATE ===
    seen_uuids = {}
    deduped = []
    for conv in all_conversations:
        uid = conv.get('uuid', conv.get('id', ''))
        if uid and uid in seen_uuids:
            existing = seen_uuids[uid]
            if len(get_messages(conv)) > len(get_messages(existing)):
                seen_uuids[uid] = conv
                fixes.append(f"Replaced duplicate: {uid[:20]}...")
        elif uid:
            seen_uuids[uid] = conv
        else:
            deduped.append(conv)
    all_conversations = list(seen_uuids.values()) + deduped

    # === PROCESS ===
    stop_words = {
        'the','a','an','is','are','was','were','be','been','being','have','has',
        'had','do','does','did','will','would','could','should','may','might',
        'shall','can','to','of','in','for','on','with','at','by','from','as',
        'into','through','during','before','after','above','below','between',
        'out','off','over','under','again','further','then','once','here',
        'there','when','where','why','how','all','each','every','both','few',
        'more','most','other','some','such','no','nor','not','only','own',
        'same','so','than','too','very','just','because','but','and','or',
        'if','while','about','up','that','this','it','its','i','me','my',
        'we','our','you','your','he','she','they','them','what','which',
        'who','whom','these','those','am','hi','hello','thanks','thank',
        'please','okay','ok','yes','get','got','like','also','one','two',
        'use','using','used','want','need','make','know','think','see',
        'look','help','let','try','give','go','going','come','take',
        'dont',"don't",'im',"i'm",'ive',"i've",'well','still',
        'something','anything','thing','things','way','right','now',
    }

    index_entries = []
    monthly_counts = Counter()
    total_msgs = 0
    total_user = 0
    total_assistant = 0
    all_topics = []
    word_freq = Counter()
    tool_mentions = Counter()
    earliest_date = None
    latest_date = None

    for conv in all_conversations:
        messages = get_messages(conv)
        if not messages:
            continue

        conv_name = conv.get('name', conv.get('title', ''))
        topic = extract_topic(messages, conv_name)

        # Fix: Name untitled conversations
        if not conv_name or not conv_name.strip():
            fixes.append(f"Auto-named: '{topic[:60]}'")

        all_topics.append(topic)

        date = None
        for key in ('created_at', 'updated_at', 'create_time', 'timestamp'):
            date = safe_parse_date(conv.get(key))
            if date:
                break

        date_str = date.strftime('%Y-%m-%d') if date else 'unknown-date'
        date_display = date.strftime('%B %d, %Y') if date else 'Unknown date'

        if date:
            monthly_counts[date.strftime('%Y-%m')] += 1
            if earliest_date is None or date < earliest_date:
                earliest_date = date
            if latest_date is None or date > latest_date:
                latest_date = date

        slug = sanitize_filename(topic)
        filename = f"{date_str}_{slug}.md"
        counter = 1
        while (conv_dir / filename).exists():
            filename = f"{date_str}_{slug}_{counter}.md"
            counter += 1

        msg_count = len(messages)
        user_count = sum(1 for m in messages if m.get('role', m.get('sender', '')) in ('user', 'human'))
        asst_count = sum(1 for m in messages if m.get('role', m.get('sender', '')) in ('assistant',))
        total_msgs += msg_count
        total_user += user_count
        total_assistant += asst_count

        # Build conversation markdown
        lines = [f"# {topic}", ""]
        lines.append(f"**Date:** {date_display}")
        lines.append(f"**Messages:** {msg_count} ({user_count} from you, {asst_count} from Claude)")
        uid = conv.get('uuid', conv.get('id', ''))
        if uid:
            lines.append(f"**Original ID:** `{uid}`")
        lines.extend(["", "---", ""])

        for msg in messages:
            role = msg.get('role', msg.get('sender', 'unknown'))
            role_label = {'user': '**You**', 'human': '**You**', 'assistant': '**Claude**', 'system': '**System**'}.get(
                role.lower() if isinstance(role, str) else '', f'**{role}**')
            text = extract_text(msg.get('content', msg.get('text', '')))
            lines.extend([f"{role_label}:", text, "", "---", ""])

            # Track keywords and tools from user messages
            if role in ('user', 'human') and isinstance(text, str):
                words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
                for w in words:
                    if w not in stop_words:
                        word_freq[w] += 1

            content_raw = msg.get('content', '')
            if isinstance(content_raw, list):
                for block in content_raw:
                    if isinstance(block, dict) and block.get('type') == 'tool_use':
                        tool_mentions[block.get('name', 'unknown')] += 1

        (conv_dir / filename).write_text('\n'.join(lines), encoding='utf-8')

        index_entries.append({
            'date': date_str,
            'date_display': date_display,
            'topic': topic,
            'filename': filename,
            'msg_count': msg_count,
        })

    index_entries.sort(key=lambda e: e['date'], reverse=True)

    # === INDEX ===
    now = datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')
    idx = [
        "# Claude Chat Export — Master Index", "",
        f"**Exported:** {now}",
        f"**Total conversations:** {len(index_entries)}",
        f"**Total messages:** {total_msgs}",
        f"**Date range:** {earliest_date.strftime('%B %Y') if earliest_date else 'N/A'} — {latest_date.strftime('%B %Y') if latest_date else 'N/A'}",
        "", "---", "",
        "| Date | Topic | Messages |",
        "|------|-------|----------|",
    ]
    for e in index_entries:
        link = f"conversations/{e['filename']}"
        idx.append(f"| {e['date_display']} | [{e['topic'][:80]}]({link}) | {e['msg_count']} |")
    (output_dir / 'index.md').write_text('\n'.join(idx), encoding='utf-8')

    # === MEMORY SUMMARY ===
    mem = ["# Memory Summary for Account Migration", "",
           "Auto-generated from your Claude chat export.",
           "**Review carefully before importing.** Remove anything outdated, sensitive, or irrelevant.", ""]

    mem.append("## Top Discussion Topics\n")
    seen = set()
    for t in all_topics:
        key = sanitize_filename(t[:40])
        if key not in seen:
            seen.add(key)
            mem.append(f"- {t}")
    mem.append("")

    mem.append("## Key Focus Areas (by frequency)\n")
    for word, count in word_freq.most_common(30):
        if count >= 2:
            mem.append(f"- **{word}** ({count} mentions)")
    mem.append("")

    if tool_mentions:
        mem.append("## Tools Used\n")
        for tool, count in tool_mentions.most_common(15):
            mem.append(f"- `{tool}` ({count} uses)")
        mem.append("")

    mem.extend([
        "## Ready-to-Import Memory Edits", "",
        "Copy these into Settings → Capabilities → Memory → View and edit your memory.", 
        "Delete any lines that don't apply:", "",
        "```",
        f"Total conversations migrated: {len(index_entries)}",
        f"Active period: {earliest_date.strftime('%B %Y') if earliest_date else 'N/A'} to {latest_date.strftime('%B %Y') if latest_date else 'N/A'}",
        f"Top focus areas: {', '.join(w for w, _ in word_freq.most_common(10) if _ >= 2)}",
    ])
    if tool_mentions:
        mem.append(f"Frequently used tools: {', '.join(t for t, _ in tool_mentions.most_common(8))}")
    mem.extend([
        "",
        "# Add your own context below:",
        "# User works at [Company] as [Role]",
        "# User prefers [tools/languages/frameworks]",
        "# User is working on [current projects]",
        "# User's communication style is [description]",
        "```", ""
    ])
    (output_dir / 'memory-summary.md').write_text('\n'.join(mem), encoding='utf-8')

    # === STATS ===
    stats = [
        "# Export Statistics", "",
        f"- **Total conversations:** {len(index_entries)}",
        f"- **Total messages:** {total_msgs}",
        f"- **Your messages:** {total_user}",
        f"- **Claude's messages:** {total_assistant}",
        f"- **Date range:** {earliest_date.strftime('%B %d, %Y') if earliest_date else 'N/A'} — {latest_date.strftime('%B %d, %Y') if latest_date else 'N/A'}",
        "", "## Monthly Activity", "",
    ]
    max_count = max(monthly_counts.values()) if monthly_counts else 1
    for month in sorted(monthly_counts.keys()):
        bar_len = int((monthly_counts[month] / max_count) * 30)
        bar = '█' * bar_len
        stats.append(f"  {month}  {bar} {monthly_counts[month]}")
    stats.append("")
    (output_dir / 'stats.md').write_text('\n'.join(stats), encoding='utf-8')

    # === RESULT ===
    result = {
        'conversations': len(index_entries),
        'messages': total_msgs,
        'user_messages': total_user,
        'assistant_messages': total_assistant,
        'earliest': earliest_date.strftime('%B %d, %Y') if earliest_date else 'N/A',
        'latest': latest_date.strftime('%B %d, %Y') if latest_date else 'N/A',
        'monthly': dict(monthly_counts),
        'output_dir': str(output_dir),
    }

    return result, fixes, warnings


# === ENTRY POINT ===
if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 parser.py <export.zip|export.json> <output-dir>")
        sys.exit(1)
    result, fixes, warnings = run_migration(sys.argv[1], sys.argv[2])
    if result:
        print(f"\n✅ Processed {result['conversations']} conversations, {result['messages']} messages")
        if fixes:
            print(f"\n🔧 Auto-fixes applied ({len(fixes)}):")
            for f in fixes:
                print(f"   • {f}")
        if warnings:
            print(f"\n⚠️  Warnings ({len(warnings)}):")
            for w in warnings:
                print(f"   • {w}")
    else:
        print("\n❌ Migration failed:")
        for w in warnings:
            print(f"   • {w}")
```

---

## RESPONSE STYLE GUIDELINES

Throughout this wizard:
- **Be warm and encouraging.** Many users doing this are non-technical.
- **One step at a time.** Never dump all steps at once. Wait for confirmation before proceeding.
- **Fix silently, report briefly.** Auto-heal what you can. Don't burden the user with technical details unless they ask.
- **Always validate.** After every processing step, show a clear report of what worked and what didn't.
- **Never dead-end.** Every error state must have a next step or workaround.
- **Celebrate completion.** When migration is done, acknowledge the achievement.
