# Process Architecture — Claude Migrator

## System Overview

Claude Migrator is a **zero-dependency Python parser** paired with a **Claude skill file** that together provide guided, self-healing account migration.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE MIGRATOR                          │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  SKILL.md    │    │  Parser Script   │    │  Output Files │  │
│  │              │    │                  │    │              │  │
│  │ Interactive  │───▶│ parse_claude_    │───▶│ index.md     │  │
│  │ wizard with  │    │ export.py        │    │ memory.md    │  │
│  │ branching    │    │                  │    │ stats.md     │  │
│  │ logic        │    │ Self-healing     │    │ convos/*.md  │  │
│  └──────────────┘    └──────────────────┘    └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Input Processing

```
ZIP file
  └── Extracted files
       ├── conversations.json  ──┐
       ├── chats.json           ──┼── Each JSON file parsed for conversations
       ├── account.json          ──┤   (metadata files detected and skipped)
       └── *.json               ──┘

                    ▼

          Parse Conversations
          ├── Try: top-level array with chat_messages
          ├── Try: top-level array with messages  
          ├── Try: object.conversations[]
          ├── Try: object.chats[]
          ├── Try: object.data[]
          ├── Try: object.chat_histories[]
          ├── Try: single conversation object
          └── Detect: ChatGPT mapping format → warn
```

### Self-Healing Pipeline

Each fix runs in sequence. Fixes are **additive** — they don't interfere with each other.

```
Raw Conversations
       │
       ▼
┌─ Fix 1: Name Untitled ────────────────────────────┐
│  IF name is empty:                                 │
│    SET name = first user message (truncated 80ch)  │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ Fix 2: Normalize Timestamps ─────────────────────┐
│  TRY: Unix epoch → datetime                       │
│  TRY: ISO 8601 variants (6 formats)               │
│  TRY: fromisoformat fallback                       │
│  ELSE: mark as "Unknown date"                      │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ Fix 3: Flatten Content Blocks ───────────────────┐
│  IF content is list:                               │
│    Extract type=text → plain text                  │
│    Extract type=tool_use → [Tool: name]            │
│    Extract type=tool_result → nested text           │
│    Extract type=image/document → [Image]/[Document]│
│  ELSE: use as-is                                   │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ Fix 4: Deduplicate ─────────────────────────────┐
│  Group by UUID                                     │
│  IF duplicate UUID found:                          │
│    KEEP version with more messages                 │
│    DISCARD shorter version                         │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ Fix 5: Platform Detection ──────────────────────┐
│  IF any conversation has "mapping" key:            │
│    FLAG as ChatGPT export                          │
│    WARN user but continue parsing                  │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ Fix 6: Encoding Fallback ───────────────────────┐
│  TRY: UTF-8                                       │
│  TRY: UTF-8 with BOM                              │
│  TRY: Latin-1                                      │
│  TRY: CP1252 (Windows)                             │
│  FALLBACK: UTF-8 with replacement characters       │
└────────────────────────────────────────────────────┘
       │
       ▼
Clean Conversations → Generate Output
```

### Output Generation

```
Clean Conversations
       │
       ├──▶ Per-conversation Markdown files
       │    Format: YYYY-MM-DD_topic-slug.md
       │    Contains: title, date, message count, full transcript
       │
       ├──▶ index.md
       │    Sorted by date (newest first)
       │    Table: date | topic (linked) | message count
       │
       ├──▶ memory-summary.md
       │    Topics (deduplicated)
       │    Keywords (frequency-filtered, stop-words removed)
       │    Tools used
       │    Ready-to-paste memory edits template
       │
       └──▶ stats.md
            Total counts (conversations, messages, user/assistant split)
            Date range
            Monthly activity bar chart (text-based)
```

---

## Error Recovery

### ZIP Recovery

```
Corrupted ZIP
       │
       ├── zipfile.testzip() identifies bad entries
       │   └── Skip bad entries, extract good ones
       │
       └── BadZipFile exception
           └── Report to user: "Re-download your export"
```

### JSON Recovery

```
Truncated JSON (common with large exports)
       │
       ├── json.loads() fails at position N
       │   └── Trim to position N
       │       └── Count open brackets/braces
       │           └── Close them
       │               └── Re-parse
       │                   ├── Success → use recovered data
       │                   └── Failure → report to user
```

---

## Skill Wizard Routing

The SKILL.md implements a state machine:

```
STATES:
  S0  → Determine goal (export/import/full)
  S1  → Export walkthrough (5 sub-steps with confirmations)
  S2  → File processing (automatic)
  S3  → Validation report (automatic)  
  S4  → Review memory summary (interactive)
  S5  → Import walkthrough (4 sub-steps with confirmations)
  S6  → Verification and archiving

TRANSITIONS:
  S0 → S1  (user chose export or full)
  S0 → S2  (user chose import or uploaded file)
  S1 → S2  (export complete, file uploaded)
  S2 → S3  (parsing complete)
  S3 → S4  (user wants import)
  S3 → END (user wants download only)
  S4 → S5  (summary approved)
  S4 → S4  (summary needs edits)
  S5 → S6  (import complete)
  S6 → END (migration complete)

ERROR STATES:
  Any → TROUBLESHOOT → resume at last state
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Dependencies | None (Python 3.8+ stdlib only) |
| Memory usage | Linear with export size |
| Parse speed | ~1000 conversations/second |
| Max tested | 10,000+ conversations |
| Output size | ~1.2x input size (Markdown overhead) |
