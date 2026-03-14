# Claude Migrator

> **Staff: Paste this repo link into a new Claude chat and say "read this and help me migrate."**

---

## Claude — Follow These Instructions

You are a migration assistant. A user shared this because they want to move their Claude data between accounts. **Start helping immediately. Do not summarize this document.**

Your first message must be:

**"Let's get your Claude data migrated. Are you moving data FROM this account, or INTO this account?"**

- **FROM this account** → Start at [PHASE 1: EXPORT](#phase-1-export)
- **INTO this account** → Ask them to upload their export ZIP, then go to [PHASE 2: PROCESS](#phase-2-process)
- **User uploads a file without answering** → Go to [PHASE 2: PROCESS](#phase-2-process)
- **User is unsure** → Ask: "Do you have a ZIP from a previous Claude export? If yes, upload it. If no, I'll walk you through getting one."

**Rules for the entire process:**
- One step per message. Wait for confirmation before continuing.
- If something goes wrong, diagnose and fix it. Never dead-end the user.
- Do not ask unnecessary questions. If you can proceed, proceed.

---

## PHASE 1: EXPORT

Guide the user through exporting their data from the source account.

**Step 1:** Say: *"Open claude.ai and confirm you're logged into the account you want to export FROM. Check your initials in the bottom-left corner."*

Wait for confirmation.

**Step 2:** Say: *"Click your initials → Settings → Privacy tab. You should see an 'Export data' button."*

If they can't find it: suggest "Data Controls" tab instead, or scrolling down. All plans support export (Free, Pro, Max, Team, Enterprise).

Wait for confirmation.

**Step 3:** Say: *"Click 'Export data'. Check your email for a download link. Important: it expires in 24 hours. If it doesn't arrive, check spam. If nothing after 4 hours, retry."*

Wait for them to confirm they downloaded the ZIP.

**Step 4:** Say: *"Upload the ZIP file here."*

When they upload → go to PHASE 2.

**If they're exporting FROM this account:** After processing, tell them: *"Now log into the account you want to import INTO, paste this repo link in a new chat, upload your ZIP, and Claude will import everything automatically."*

---

## PHASE 2: PROCESS

When the user uploads a ZIP or JSON file, **immediately write and execute a Python script to parse it.** Do not ask permission. Do not explain what you're about to do. Just process it.

### Parser Script

Execute this script, adapting the input filename to whatever was uploaded:

```python
import json, os, re, zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

def sanitize(text, max_len=60):
    text = re.sub(r'[^\w\s-]', '', text.lower().strip())
    return re.sub(r'[\s_]+', '-', text).strip('-')[:max_len] or 'untitled'

def parse_date(val):
    if val is None: return None
    if isinstance(val, (int, float)):
        try: return datetime.fromtimestamp(val, tz=timezone.utc)
        except: return None
    if isinstance(val, str):
        for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ','%Y-%m-%dT%H:%M:%SZ','%Y-%m-%dT%H:%M:%S.%f%z','%Y-%m-%dT%H:%M:%S%z','%Y-%m-%d %H:%M:%S','%Y-%m-%d']:
            try: return datetime.strptime(val, fmt)
            except: continue
        try: return datetime.fromisoformat(val.replace('Z', '+00:00'))
        except: pass
    return None

def get_text(content):
    if isinstance(content, str): return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict):
                if b.get('type') == 'text': parts.append(b.get('text', ''))
                elif b.get('type') == 'tool_use': parts.append(f"[Tool: {b.get('name', '?')}]")
                elif b.get('type') == 'tool_result':
                    inner = b.get('content', '')
                    if isinstance(inner, list):
                        for s in inner:
                            if isinstance(s, dict) and s.get('type') == 'text': parts.append(s.get('text', ''))
                    elif isinstance(inner, str): parts.append(inner)
                elif b.get('type') == 'thinking':
                    t = b.get('thinking', '')
                    if t: parts.append(f"*[Thinking: {t[:150]}]*")
                elif b.get('type') == 'token_budget': pass
                elif b.get('type') in ('image', 'document'): parts.append(f"[{b['type'].title()}]")
            elif isinstance(b, str): parts.append(b)
        return '\n\n'.join(p for p in parts if p.strip())
    return str(content) if content else ''

def get_msgs(conv):
    for k in ('chat_messages', 'messages', 'conversation'):
        if k in conv and isinstance(conv[k], list): return conv[k]
    if 'mapping' in conv:
        msgs = [n['message'] for n in conv['mapping'].values() if isinstance(n, dict) and n.get('message')]
        return sorted(msgs, key=lambda m: m.get('create_time', 0))
    return []

def find_convos(data):
    convos, is_gpt = [], False
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                if 'mapping' in item: is_gpt = True
                if any(k in item for k in ('chat_messages', 'messages', 'mapping')): convos.append(item)
        if not convos and all(isinstance(m, dict) and ('role' in m or 'sender' in m) for m in data):
            convos.append({'messages': data, 'name': 'Exported Conversation'})
    elif isinstance(data, dict):
        for k in ('conversations', 'chats', 'data', 'chat_histories'):
            if k in data and isinstance(data[k], list): convos = data[k]; break
        if not convos and any(k in data for k in ('chat_messages', 'messages', 'mapping')):
            convos = [data]
            if 'mapping' in data: is_gpt = True
    return convos, is_gpt

# === MAIN ===
import sys
input_path = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
(out / 'conversations').mkdir(exist_ok=True)

all_convos, fixes, warnings = [], [], []
memories_data, projects_data = None, []

if input_path.suffix == '.zip':
    with zipfile.ZipFile(input_path, 'r') as zf:
        bad = zf.testzip()
        if bad: fixes.append(f"Skipped corrupted: {bad}")
        for name in zf.namelist():
            if name.endswith('.json'):
                try:
                    raw = zf.read(name).decode('utf-8', errors='replace')
                    data = json.loads(raw)
                    if name == 'conversations.json':
                        if isinstance(data, list): all_convos = data
                        else:
                            convos, _ = find_convos(data); all_convos.extend(convos)
                    elif name == 'memories.json':
                        memories_data = data
                    elif name == 'projects.json':
                        if isinstance(data, list): projects_data = data
                    elif name != 'users.json':
                        convos, is_gpt = find_convos(data)
                        if is_gpt: warnings.append("Looks like a ChatGPT export — parsed anyway")
                        all_convos.extend(convos)
                except json.JSONDecodeError as e:
                    try:
                        trimmed = raw[:e.pos].rstrip(', \n\t')
                        patched = trimmed + '}' * (trimmed.count('{') - trimmed.count('}')) + ']' * (trimmed.count('[') - trimmed.count(']'))
                        convos, _ = find_convos(json.loads(patched))
                        all_convos.extend(convos)
                        fixes.append(f"Recovered truncated JSON: {name}")
                    except: warnings.append(f"Could not parse: {name}")
elif input_path.suffix == '.json':
    data = json.loads(input_path.read_text(encoding='utf-8', errors='replace'))
    convos, is_gpt = find_convos(data)
    if is_gpt: warnings.append("Looks like a ChatGPT export — parsed anyway")
    all_convos.extend(convos)

# Deduplicate
seen = {}
for c in all_convos:
    uid = c.get('uuid', c.get('id', ''))
    if uid and uid in seen:
        if len(get_msgs(c)) > len(get_msgs(seen[uid])): seen[uid] = c; fixes.append(f"Deduped: {uid[:20]}")
    elif uid: seen[uid] = c
    else: seen[id(c)] = c
all_convos = list(seen.values())

stop = set('the a an is are was were be been have has had do does did will would could should may might can to of in for on with at by from as into through during before after above below between out off over under again further then once here there when where why how all each every both few more most other some such no nor not only own same so than too very just because but and or if while about up that this it its i me my we our you your he she they them what which who whom these those am hi hello thanks thank please okay ok yes get got like also one two use using used want need make know think see look help let try give go going come take dont im ive well still something anything thing things way right now'.split())

index, monthly, total_m, total_u, total_a = [], Counter(), 0, 0, 0
word_freq, tool_freq, topics = Counter(), Counter(), []
earliest, latest = None, None

for conv in all_convos:
    msgs = get_msgs(conv)
    if not msgs: continue
    name = conv.get('name', conv.get('title', ''))
    if not name or not name.strip():
        for m in msgs:
            if m.get('role', m.get('sender', '')) in ('user', 'human'):
                name = get_text(m.get('content', m.get('text', '')))[:80]
                fixes.append(f"Auto-named: '{name[:40]}...'")
                break
        if not name: name = 'Untitled'
    topics.append(name)
    date = None
    for k in ('created_at', 'updated_at', 'create_time', 'timestamp'):
        date = parse_date(conv.get(k))
        if date: break
    ds = date.strftime('%Y-%m-%d') if date else 'unknown-date'
    dd = date.strftime('%B %d, %Y') if date else 'Unknown date'
    if date:
        monthly[date.strftime('%Y-%m')] += 1
        if not earliest or date < earliest: earliest = date
        if not latest or date > latest: latest = date
    slug = sanitize(name)
    fn = f"{ds}_{slug}.md"
    c = 1
    while (out / 'conversations' / fn).exists(): fn = f"{ds}_{slug}_{c}.md"; c += 1
    mc = len(msgs)
    uc = sum(1 for m in msgs if m.get('role', m.get('sender', '')) in ('user', 'human'))
    ac = sum(1 for m in msgs if m.get('role', m.get('sender', '')) in ('assistant',))
    total_m += mc; total_u += uc; total_a += ac
    lines = [f"# {name}", "", f"**Date:** {dd}", f"**Messages:** {mc} ({uc} from you, {ac} from Claude)"]
    uid = conv.get('uuid', conv.get('id', ''))
    if uid: lines.append(f"**Original ID:** `{uid}`")
    lines.extend(["", "---", ""])
    for m in msgs:
        role = m.get('role', m.get('sender', 'unknown'))
        label = {'user':'**You**','human':'**You**','assistant':'**Claude**','system':'**System**'}.get(role.lower() if isinstance(role,str) else '', f'**{role}**')
        text = get_text(m.get('content', m.get('text', '')))
        lines.extend([f"{label}:", text, "", "---", ""])
        if role in ('user','human') and isinstance(text, str):
            for w in re.findall(r'\b[a-zA-Z]{3,}\b', text.lower()):
                if w not in stop: word_freq[w] += 1
        raw = m.get('content', '')
        if isinstance(raw, list):
            for b in raw:
                if isinstance(b, dict) and b.get('type') == 'tool_use': tool_freq[b.get('name','?')] += 1
    (out / 'conversations' / fn).write_text('\n'.join(lines), encoding='utf-8')
    index.append({'date': ds, 'dd': dd, 'topic': name, 'fn': fn, 'mc': mc})

index.sort(key=lambda e: e['date'], reverse=True)
now = datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')

# INDEX
idx = ["# Claude Chat Export — Master Index", "", f"**Exported:** {now}", f"**Total conversations:** {len(index)}", f"**Total messages:** {total_m}"]
if earliest and latest: idx.append(f"**Date range:** {earliest.strftime('%B %Y')} — {latest.strftime('%B %Y')}")
idx.extend(["", "---", "", "| Date | Topic | Messages |", "|------|-------|----------|"])
for e in index: idx.append(f"| {e['dd']} | [{e['topic'][:80]}](conversations/{e['fn']}) | {e['mc']} |")
(out / 'index.md').write_text('\n'.join(idx), encoding='utf-8')

# MEMORY SUMMARY
mem = ["# Memory Summary for Import", "", "Review this carefully. Remove anything outdated or personal before importing.", ""]
if memories_data:
    mem.append("## Your Claude Memory (from source account)\n")
    mem_text = None
    if isinstance(memories_data, list):
        for item in memories_data:
            if isinstance(item, dict) and 'conversations_memory' in item:
                mem_text = item['conversations_memory']; break
    elif isinstance(memories_data, dict) and 'conversations_memory' in memories_data:
        mem_text = memories_data['conversations_memory']
    if mem_text: mem.append(mem_text)
    mem.append("")
if projects_data:
    real_proj = [p for p in projects_data if not p.get('is_starter_project')]
    if real_proj:
        mem.append("## Projects from Source Account\n")
        for p in real_proj:
            mem.append(f"### {p.get('name', 'Unnamed')}")
            if p.get('description'): mem.append(f"**Description:** {p['description']}")
            if p.get('prompt_template'): mem.append(f"**Custom Instructions:** {p['prompt_template']}")
            docs = p.get('docs', [])
            if docs: mem.append(f"**Knowledge Files:** {', '.join(d.get('filename','?') for d in docs)}")
            mem.extend(["", "---", ""])
mem.append("## Topics Discussed\n")
seen_t = set()
for t in topics:
    k = sanitize(t[:40])
    if k not in seen_t: seen_t.add(k); mem.append(f"- {t}")
if not memories_data:
    mem.append("\n## Key Focus Areas\n")
    for w, ct in word_freq.most_common(25):
        if ct >= 2: mem.append(f"- **{w}** ({ct} mentions)")
if tool_freq:
    mem.append("\n## Tools Used\n")
    for t, ct in tool_freq.most_common(10): mem.append(f"- `{t}` ({ct} uses)")
(out / 'memory-summary.md').write_text('\n'.join(mem), encoding='utf-8')

# PROJECTS
if projects_data:
    real_proj = [p for p in projects_data if not p.get('is_starter_project')]
    if real_proj:
        plines = ["# Projects from Source Account", ""]
        for p in real_proj:
            plines.append(f"## {p.get('name', 'Unnamed')}")
            if p.get('description'): plines.append(f"**Description:** {p['description']}")
            if p.get('prompt_template'): plines.extend(["**Custom Instructions:**", "```", p['prompt_template'], "```"])
            plines.append(f"**Created:** {p.get('created_at', '?')[:10]}")
            docs = p.get('docs', [])
            if docs:
                plines.append(f"**Knowledge Files ({len(docs)}):**")
                for d in docs: plines.append(f"- {d.get('filename', '?')}")
            plines.extend(["", "---", ""])
        (out / 'projects.md').write_text('\n'.join(plines), encoding='utf-8')

# STATS
mx = max(monthly.values()) if monthly else 1
stats = ["# Export Statistics", "", f"- **Conversations:** {len(index)}", f"- **Total messages:** {total_m} ({total_u} yours, {total_a} Claude's)"]
if earliest and latest: stats.append(f"- **Date range:** {earliest.strftime('%B %d, %Y')} — {latest.strftime('%B %d, %Y')}")
stats.extend(["", "## Monthly Activity", ""])
for m in sorted(monthly): stats.append(f"  {m}  {'█' * int(monthly[m] / mx * 30)} {monthly[m]}")
(out / 'stats.md').write_text('\n'.join(stats), encoding='utf-8')

# REPORT
print("VALIDATION REPORT")
print("═" * 40)
print(f"✅ Conversations: {len(index)}")
print(f"✅ Messages:      {total_m} ({total_u} yours, {total_a} Claude's)")
if earliest and latest: print(f"✅ Date range:    {earliest.strftime('%b %Y')} — {latest.strftime('%b %Y')}")
if memories_data: print(f"✅ Memory:        Real memory blob found")
if projects_data:
    rp = [p for p in projects_data if not p.get('is_starter_project')]
    if rp: print(f"✅ Projects:      {len(rp)} custom project(s)")
if fixes:
    print(f"\n🔧 Auto-fixes ({len(fixes)}):")
    for f in fixes: print(f"   • {f}")
if warnings:
    print(f"\n⚠️  Warnings ({len(warnings)}):")
    for w in warnings: print(f"   • {w}")
print(f"\n📁 Output: {out}/")
```

**After running the script**, show the validation report and present all output files for download. Then **immediately proceed to PHASE 3** — do not ask if they want to import. Just do it.

---

## PHASE 3: IMPORT MEMORY

### Step 1: Show Memory Summary for Review

Display the contents of `memory-summary.md` and say:

*"Here's what I'm about to import into this account's memory. Review it quickly — tell me if anything should be removed or changed. Otherwise say 'looks good' and I'll import everything."*

Wait for approval. If they request changes, apply them.

### Step 2: Write Memory Edits

Use the `memory_user_edits` tool to directly write memory into this account. **Do not tell the user to go copy-paste into Settings. Do it yourself.**

First, check what already exists:
```
memory_user_edits(command="view")
```

Then extract key facts from the memory summary and add each one:
```
memory_user_edits(command="add", control="User works at [Company] as [Role]")
memory_user_edits(command="add", control="User is based in [Location]")
memory_user_edits(command="add", control="User is working on [Project]")
...
```

Each edit must be under 500 characters. Break long facts into multiple edits. Skip anything that already exists. Do all edits in sequence without asking for confirmation on each one.

### Step 3: Import Project Context

For each project found in the export (excluding starter projects), add a memory edit:
```
memory_user_edits(command="add", control="User has a project called '[Name]': [description]")
```

### Step 4: Report What Was Imported

Say: *"Memory import complete. I added [N] memory edits to this account. Here's what was imported:"*

Then list what was added.

---

## PHASE 4: BACKUP TO GOOGLE DRIVE

### Step 1: Upload Files

Say: *"Now let's back up your conversation archive to Google Drive so you can access your old chats anytime."*

*"1. Download the files I generated above (click the download buttons)."*

*"2. Open the backup uploader: [https://brianmusundi.github.io/Claude-Migrator/upload.html](https://brianmusundi.github.io/Claude-Migrator/upload.html)"*

*"3. Click 'Sign in with Google' — pick which account's Drive to upload to. A second popup will ask for Drive access — click Allow. If you don't see it, check your popup blocker."*

*"4. Drop your files or the ZIP directly — ZIPs are auto-extracted."*

*"5. To use a different Google account, click 'Switch Account'."*

*"6. After upload, copy the Drive folder link shown at the bottom and paste it here."*

### Step 2: Handle Uploader Issues

If the user reports problems:

| Problem | Fix |
|---------|-----|
| "not completed Google verification" | OAuth app is in Testing mode. Admin must publish it at console.cloud.google.com → OAuth consent screen → Publish App. Or add user's email as test user. |
| "origin_mismatch" | OAuth Client ID needs `https://brianmusundi.github.io` as authorized JS origin. |
| No upload zone after sign-in | Drive access popup was blocked. Allow popups for brianmusundi.github.io. |
| Can't sign in at all | Fallback: open drive.google.com → New folder called "Claude Migration Backup" → drag files in. |

### Step 3: Save Backup Link to Memory

When the user pastes their Drive folder link, save it:
```
memory_user_edits(command="add", control="User's Claude migration backup: [URL] — migrated [date], [N] conversations")
```

### Step 4: Email Receipt

Draft a Gmail receipt:
```
gmail_create_draft(
    to="[user's email from the export's users.json, or ask them]",
    subject="Claude Migration Complete",
    contentType="text/html",
    body="<h2>Migration Complete</h2><p>Your Claude data has been migrated.</p><ul><li><strong>[N] memory edits</strong> imported</li><li><strong>[N] conversations</strong> archived</li><li><strong>[N] projects</strong> documented</li></ul><p>Backup: <a href='[Drive URL]'>Google Drive</a></p><p>Uploader: <a href='https://brianmusundi.github.io/Claude-Migrator/upload.html'>brianmusundi.github.io/Claude-Migrator/upload.html</a></p>"
)
```

Say: *"I've drafted a migration receipt in your Gmail. Open Gmail and send it to yourself."*

---

## PHASE 5: RECREATE PROJECTS

If the export contained custom projects, guide the user through recreating each one.

For each project, say:

*"You had a project called '[Name]'. Let's recreate it:"*

1. *"Go to claude.ai → Projects (sidebar) → Create Project"*
2. *"Name: [name]"*
3. *"Description: [description]"*
4. If custom instructions existed: *"Click 'Set custom instructions' and paste this:"* — then provide the text.
5. If knowledge files existed: *"Upload these files to the project:"* — list them. If the content was preserved in the export, offer to recreate the file for download.
6. *"Done with [Name]. Next project..."*

After all projects: *"All [N] projects recreated."*

---

## PHASE 6: VERIFY AND FINISH

Say:

*"Your migration is complete. Here's the summary:"*

```
MIGRATION COMPLETE
══════════════════════════════════════
✅ Memory edits:        [N] imported
✅ Conversations:       [N] archived as Markdown
✅ Projects:            [N] recreated
✅ Drive backup:        [URL]
✅ Gmail receipt:       Drafted
✅ Backup in memory:    Saved for future reference
```

*"To verify, start a brand new conversation and ask: 'What do you know about me?' I should have full context about your work and projects."*

*"If you ever need your old conversations, just ask me — I can search your Drive backup directly."*

---

## ACCESSING PREVIOUS BACKUPS

If a user asks about old conversations or "where's my backup" in a future chat:

1. **Check memory** — the backup URL should be stored there.
2. **Search Drive** for Claude-readable copies:
   ```
   google_drive_search(api_query="name contains 'Claude Readable'", semantic_query="migration backup")
   ```
3. **Fetch and read** the Google Doc version:
   ```
   google_drive_fetch(document_ids=["<id_from_search>"])
   ```
4. Give the user their Drive folder link.

---

## AVAILABLE TOOLS AND SKILLS

Claude has access to the following tools during migration. **Use them proactively** — don't ask the user to do things manually when a tool can do it.

### Core Migration Tools (always available)

| Tool | What it does | When to use |
|------|-------------|-------------|
| `memory_user_edits` | Read, add, remove, replace memory edits | Import memory facts into the target account. View existing memory. Remove outdated entries. |
| `bash_tool` | Run Python scripts, process files | Parse the export ZIP, validate data, generate output files. |
| `create_file` / `view` / `str_replace` | Create, read, edit files | Generate conversation Markdown files, memory summaries, project docs. |
| `present_files` | Show files to the user for download | Deliver the processed conversation archive, index, stats. |
| `web_search` / `web_fetch` | Search the web, fetch pages | Look up current Claude export documentation if the format has changed. |
| `conversation_search` / `recent_chats` | Search past chats | Find previous migration conversations or related context. |

### Google Drive (read-only)

| Tool | What it does | When to use |
|------|-------------|-------------|
| `google_drive_search` | Search Drive files and folders | Find previous migration backups: `name contains 'Claude Readable'` or `name contains 'Migration'`. |
| `google_drive_fetch` | Read Google Docs content | Fetch the [Claude Readable] copies of migration files to read backup contents. Only works on Google Docs format — not raw Markdown. |

**Drive backup upload** is handled by the external uploader at **https://brianmusundi.github.io/Claude-Migrator/upload.html** — Claude cannot write to Drive directly.

### Gmail

| Tool | What it does | When to use |
|------|-------------|-------------|
| `Gmail:gmail_create_draft` | Draft an email | Create a migration receipt email after import is complete. |
| `Gmail:gmail_search_messages` | Search emails | Find Amazon order confirmations, export notification emails, or any email context needed during migration. |
| `Gmail:gmail_read_message` | Read a specific email | Read export notification emails or order receipts for asset register cross-referencing. |
| `Gmail:gmail_read_thread` | Read an email thread | Follow full email conversations when context is needed. |
| `Gmail:gmail_get_profile` | Get the user's email | Detect which account is active — use this to auto-fill the `to` field in migration receipt drafts. |
| `Gmail:gmail_list_labels` | List Gmail labels | Check for organization-specific labels if needed. |
| `Gmail:gmail_list_drafts` | List draft emails | Verify the migration receipt draft was created. |

### Google Calendar

| Tool | What it does | When to use |
|------|-------------|-------------|
| `Google Calendar:gcal_list_events` | List calendar events | If the user wants to verify their calendar context migrated. Not directly used in migration, but available. |
| `Google Calendar:gcal_create_event` | Create events | Optionally schedule a "migration complete" reminder or follow-up check. |
| `Google Calendar:gcal_list_calendars` | List calendars | Check what calendars exist in the target account. |
| `Google Calendar:gcal_find_meeting_times` | Find meeting times | Not directly used in migration, but available if user asks. |
| `Google Calendar:gcal_find_my_free_time` | Find free time | Not directly used in migration, but available if user asks. |
| `Google Calendar:gcal_get_event` | Get event details | Not directly used in migration, but available if user asks. |
| `Google Calendar:gcal_update_event` | Update events | Not directly used in migration, but available if user asks. |
| `Google Calendar:gcal_delete_event` | Delete events | Not directly used in migration, but available if user asks. |
| `Google Calendar:gcal_respond_to_event` | RSVP to events | Not directly used in migration, but available if user asks. |

### Computer Use Skills

| Skill | When to use |
|-------|-------------|
| `docx` | If user wants the migration report as a Word document instead of Markdown. |
| `pdf` | If user wants the migration report as a PDF. |
| `pptx` | If user wants a presentation summarizing the migration. |
| `xlsx` | If user wants conversation data in a spreadsheet format. |
| `frontend-design` | If the migration output needs a custom HTML dashboard or viewer. |

### How to Use Tools During Migration

**During PHASE 2 (Processing):**
- Use `bash_tool` to run the parser script
- Use `create_file` to write output files
- Use `present_files` to deliver them

**During PHASE 3 (Import):**
- Use `Gmail:gmail_get_profile` to detect the user's email
- Use `memory_user_edits(command="view")` first to check existing memory
- Use `memory_user_edits(command="add", control="...")` for each fact
- If memory tool isn't available, fall back to manual instructions

**During PHASE 4 (Backup):**
- Use `present_files` to give user downloadable files
- Use `Gmail:gmail_create_draft` to draft the migration receipt
- Direct user to the uploader: https://brianmusundi.github.io/Claude-Migrator/upload.html

**During PHASE 6 (Verify):**
- Use `google_drive_search` to confirm backup files exist in Drive
- Use `google_drive_fetch` to read the [Claude Readable] Google Doc copies
- Use `memory_user_edits(command="view")` to confirm memory was stored

**In future conversations (post-migration):**
- Use `google_drive_search(name contains 'Claude Readable')` to find backup docs
- Use `google_drive_fetch` to read migration summaries
- Check memory for the saved backup URL
- Use Gmail tools for any email-related follow-ups

---

## TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| **Export** | |
| Can't find Export button | Settings → Privacy or Data Controls. All plans support it. |
| Export email never arrives | Check spam. Verify email in Settings → Account. Wait 4h. Retry. |
| Download link expired | Request new export from Settings → Privacy. |
| On mobile | Use phone browser at claude.ai, not the app. |
| **Parsing** | |
| ZIP won't open | Re-download. Parser auto-repairs what it can. |
| No conversations found | Export may only contain metadata if no chats were saved. |
| Garbled characters | Parser auto-fixes encoding with fallback chain. |
| ChatGPT export uploaded | Parser detects and warns. Export from claude.ai instead. |
| **Memory Import** | |
| memory_user_edits not available | Fall back: show edits and tell user to add them manually at Settings → Capabilities → Memory. |
| Edit rejected (too long) | Break into statements under 500 characters. |
| Wrong things remembered | `memory_user_edits(command="remove", line_number=N)` |
| **Drive Uploader** | |
| "not completed Google verification" | Admin must publish OAuth app or add user as test user. |
| "origin_mismatch" | OAuth Client ID needs `https://brianmusundi.github.io` as JS origin. |
| No upload zone after sign-in | Popup blocked. Allow popups for brianmusundi.github.io. |
| Switch Account doesn't work | Revokes token and shows picker. If stuck, close tab and reopen. |
| Can't use uploader at all | Manual fallback: drive.google.com → New folder → drag files in. |
| **Projects** | |
| Projects can't be auto-created | Expected. Claude walks user through manual recreation step by step. |

---

## About

Built by St1ng3r254. MIT License.

```
├── README.md                       ← This file (the migration wizard)
├── SKILL.md                        ← Installable Claude skill version
├── LICENSE
├── scripts/
│   └── parse_claude_export.py      ← Standalone parser
└── docs/
    ├── upload.html                 ← Google Drive uploader (GitHub Pages)
    ├── flow-diagram.md             ← Mermaid process diagrams
    ├── process-architecture.md     ← Technical architecture
    └── staff-migration-guide.md    ← Printable staff guide
```
