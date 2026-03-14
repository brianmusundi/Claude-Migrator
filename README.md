# Claude Migrator

**Migrate your Claude chat history, memory, and context between accounts.**

Anthropic doesn't support direct account-to-account chat transfer. This tool bridges that gap — export from one Claude account, parse and validate your data, and import context into another account (personal → team, team → team, etc).

Built by St1ng3r254. Works for anyone with two Claude accounts.

---

## How It Works

### High-Level Flow

```mermaid
flowchart LR
    A["🔐 Source Account"] -->|Export ZIP| B["⚙️ Parser"]
    B -->|Validates & Fixes| C["📁 Organized Files"]
    C -->|Memory Summary| D["🧠 Target Account"]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#16213e,stroke:#0f3460,color:#fff
    style C fill:#0f3460,stroke:#53a8b6,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
```

### Detailed Process Flow

```mermaid
flowchart TD
    START([🚀 Start Migration]) --> Q{What do you need?}

    Q -->|"Full Migration"| E1
    Q -->|"Export Only"| E1
    Q -->|"Import Only"| P1

    subgraph EXPORT ["Phase 1: Export"]
        E1[Log into Source Account] --> E2[Settings → Privacy]
        E2 --> E3[Click Export Data]
        E3 --> E4[Check Email for Link]
        E4 --> E5{Link received?}
        E5 -->|Yes| E6[Download ZIP within 24h]
        E5 -->|No| E5A[Check Spam / Wait / Retry]
        E5A --> E4
        E6 --> E7[Upload ZIP to Claude]
    end

    subgraph PARSE ["Phase 2: Process & Validate"]
        E7 --> P1[Detect File Type]
        P1 --> P2{Valid ZIP/JSON?}
        P2 -->|No| P2A[Self-Heal: Repair ZIP / Recover JSON]
        P2A --> P2
        P2 -->|Yes| P3[Extract Conversations]
        P3 --> P4[Run 6 Auto-Fix Checks]
        P4 --> P5[Generate Validation Report]
        P5 --> P6[Create Output Files]
    end

    subgraph IMPORT ["Phase 3: Import"]
        P6 --> I1[Review Memory Summary]
        I1 --> I2{Summary OK?}
        I2 -->|Edit needed| I1
        I2 -->|Approved| I3[Log into Target Account]
        I3 --> I4[Settings → Capabilities → Memory]
        I4 --> I5{Import method?}
        I5 -->|Manual| I6[Add edits one by one]
        I5 -->|Bulk| I7[Paste full summary]
        I6 --> I8[Verify: Ask Claude what it remembers]
        I7 --> I8
        I8 --> I9[Optional: Seed critical context]
        I9 --> DONE([✅ Migration Complete])
    end

    style START fill:#e94560,stroke:#1a1a2e,color:#fff
    style DONE fill:#53a8b6,stroke:#1a1a2e,color:#fff
    style EXPORT fill:#1a1a2e11,stroke:#e94560
    style PARSE fill:#16213e11,stroke:#0f3460
    style IMPORT fill:#0f346011,stroke:#53a8b6
```

### Self-Healing Pipeline

```mermaid
flowchart LR
    subgraph AUTO_FIX ["🔧 6 Automatic Fixes"]
        direction TB
        F1["1️⃣ Unnamed Conversations\nAuto-title from first message"]
        F2["2️⃣ Malformed Timestamps\nUnix, ISO, partial dates"]
        F3["3️⃣ Structured Content\nFlatten text/tool/image blocks"]
        F4["4️⃣ Duplicate Conversations\nMerge by UUID, keep longest"]
        F5["5️⃣ Wrong Platform\nDetect ChatGPT/Gemini exports"]
        F6["6️⃣ Encoding Issues\nUTF-8/Latin-1/CP1252 fallback"]
    end

    IN[/"Upload ZIP"/] --> AUTO_FIX --> OUT[/"Clean Output"/]

    style AUTO_FIX fill:#16213e,stroke:#0f3460,color:#fff
    style IN fill:#e94560,stroke:#1a1a2e,color:#fff
    style OUT fill:#53a8b6,stroke:#1a1a2e,color:#fff
```

---

## Quick Start

### Option A: Use the Claude Skill (Recommended)

1. Install the `claude-account-migrator.skill` file in your Claude account
2. Start a new conversation and say: **"I need to migrate my Claude data"**
3. Claude walks you through everything step by step

### Option B: Run the Parser Manually

```bash
# Clone this repo
git clone https://github.com/YOUR_USERNAME/claude-migrator.git
cd claude-migrator

# Run the parser on your export file
python3 scripts/parse_claude_export.py your-export.zip ./output

# Review output
ls output/
# index.md  memory-summary.md  stats.md  conversations/
```

No dependencies required — pure Python 3.8+ standard library.

---

## Output Structure

```
output/
├── index.md                        # Master index — all conversations with dates, topics, message counts
├── memory-summary.md               # Context summary ready to import into target account
├── stats.md                        # Usage statistics with monthly activity chart
└── conversations/                  # Individual Markdown files
    ├── 2025-06-15_server-build.md
    ├── 2025-07-01_network-config.md
    └── ...
```

---

## Staff Migration Guide

### Step 1: Export from Your Personal Account

1. Go to [claude.ai](https://claude.ai) and log into your **personal** account
2. Click your initials (bottom-left) → **Settings** → **Privacy**
3. Click **"Export data"**
4. Check your email, download the ZIP within 24 hours

### Step 2: Process Your Export

Upload the ZIP to a Claude conversation (with the skill installed) or run the parser script.

### Step 3: Review the Memory Summary

Open `memory-summary.md` and remove anything outdated, personal, or irrelevant.

### Step 4: Import into Team Account

1. Log into your **team** Claude account
2. Go to **Settings → Capabilities → Memory → View and edit your memory**
3. Add each relevant memory edit, or use the bulk Import Memory feature
4. Verify by asking Claude: *"What do you remember about me?"*

### Step 5: Archive

Upload the `conversations/` folder to Google Drive for searchable reference.

---

## Process Charts

### What Gets Migrated

| Data Type | Migrated? | Method |
|-----------|-----------|--------|
| Memory & Preferences | ✅ Yes | Imported into target account memory |
| Chat History (full text) | ✅ Yes | Archived as searchable Markdown files |
| Recurring Topics & Context | ✅ Yes | Summarized in memory edits |
| Tool Usage Patterns | ✅ Yes | Documented in export summary |
| Live Conversation Sessions | ❌ No | Cannot continue threads in new account |
| File Attachments | ❌ No | Not included in Claude exports |

### Supported Export Formats

| Format | Detected? | Notes |
|--------|-----------|-------|
| Claude ZIP export | ✅ | Primary format — fully supported |
| Claude JSON (direct) | ✅ | Individual JSON files from export |
| ChatGPT export | ⚠️ | Detected and warned — parsed if possible |
| Gemini export | ⚠️ | Basic detection |
| Other formats | ❌ | Will report "no conversations found" |

### Troubleshooting

| Problem | Solution |
|---------|----------|
| No export button | Go to Settings → Privacy (available on all plans) |
| Email never arrives | Check spam, verify email in Settings → Account, wait up to 4h |
| Download link expired | Request new export (Settings → Privacy) |
| ZIP won't open | Re-download, or parser auto-repairs if partially corrupted |
| No conversations found | Export may only contain metadata — verify you had saved chats |
| Garbled characters | Parser auto-fixes encoding (UTF-8/Latin-1/CP1252 fallback) |
| Memory not appearing | Allow up to 24 hours after import |
| Wrong things remembered | Edit in Settings → Capabilities → Memory → View and edit |

---

## Repository Structure

```
claude-migrator/
├── README.md                           # This file
├── LICENSE                             # MIT License
├── SKILL.md                            # Claude skill file (single-file wizard)
├── scripts/
│   └── parse_claude_export.py          # Standalone parser script
└── docs/
    ├── flow-diagram.md                 # Mermaid source for flow diagrams
    ├── staff-migration-guide.md        # Printable staff guide
    └── process-architecture.md         # Technical architecture details
```

---

## License

MIT — use freely, modify as needed.

---

## Contact

St1ng3r254
