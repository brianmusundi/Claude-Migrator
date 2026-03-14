# Flow Diagrams — Claude Migrator

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render natively on GitHub.

---

## 1. User Decision Tree

```mermaid
flowchart TD
    START([User triggers skill]) --> Q{What do you need?}
    
    Q -->|"Full Migration"| FULL["Start at Phase 1\n(Export → Process → Import)"]
    Q -->|"Export Only"| EXP["Start at Phase 1\n(Export → Process → Download)"]
    Q -->|"Import Only\nor uploads file"| IMP["Start at Phase 2\n(Process → Import)"]
    
    FULL --> P1[Phase 1: Export Guide]
    EXP --> P1
    IMP --> P2[Phase 2: Process & Validate]
    
    P1 --> P2
    P2 --> P3{User wants import?}
    P3 -->|Yes| P4[Phase 3: Import Guide]
    P3 -->|No| DL[Download Files]
    P4 --> DONE([Complete])
    DL --> DONE

    style START fill:#e94560,color:#fff
    style DONE fill:#53a8b6,color:#fff
```

---

## 2. Export Process (Phase 1)

```mermaid
flowchart TD
    E0[Confirm source account access] --> E1[Open claude.ai]
    E1 --> E2[Click initials → Settings]
    E2 --> E3[Navigate to Privacy tab]
    
    E3 --> E3A{Can find Privacy tab?}
    E3A -->|No| E3B["Try: Data Controls tab\nScroll down in Settings\nCheck plan supports export"]
    E3B --> E3A
    E3A -->|Yes| E4[Click Export Data]
    
    E4 --> E5[Wait for email]
    E5 --> E5A{Email received?}
    E5A -->|No, < 4 hours| E5B[Check spam folder\nVerify account email]
    E5A -->|No, > 4 hours| E5C[Request new export]
    E5B --> E5A
    E5C --> E4
    E5A -->|Yes| E6[Click download link]
    
    E6 --> E6A{Download successful?}
    E6A -->|Link expired| E6B[Request new export]
    E6B --> E4
    E6A -->|Yes| E7[Upload ZIP to Claude]

    style E0 fill:#1a1a2e,color:#fff
    style E7 fill:#53a8b6,color:#fff
```

---

## 3. Processing Pipeline (Phase 2)

```mermaid
flowchart TD
    UP[/"User uploads file"/] --> DET{Detect file type}
    
    DET -->|".zip"| ZIP[Extract ZIP contents]
    DET -->|".json"| JSON[Parse JSON directly]
    DET -->|"Other"| ERR1["❌ Ask for ZIP or JSON"]
    
    ZIP --> ZIPOK{ZIP valid?}
    ZIPOK -->|Corrupted| REPAIR["🔧 Auto-repair:\nExtract salvageable files\nSkip corrupted entries"]
    ZIPOK -->|Valid| SCAN[Scan for JSON files]
    REPAIR --> SCAN
    
    SCAN --> PARSE[Parse each JSON file]
    JSON --> PARSE
    
    PARSE --> DETECT{Platform detection}
    DETECT -->|Claude format| OK[Continue]
    DETECT -->|ChatGPT mapping| WARN["⚠️ Warn: Wrong platform\nParse anyway"]
    WARN --> OK
    
    OK --> FIX["🔧 Run 6 auto-fixes"]
    
    subgraph FIXES ["Self-Healing Checks"]
        F1["Fix 1: Name untitled conversations"]
        F2["Fix 2: Normalize timestamps"]
        F3["Fix 3: Flatten content blocks"]
        F4["Fix 4: Deduplicate by UUID"]
        F5["Fix 5: Detect wrong platform"]
        F6["Fix 6: Fix encoding"]
    end
    
    FIX --> F1 --> F2 --> F3 --> F4 --> F5 --> F6
    
    F6 --> GEN[Generate output files]
    
    subgraph OUTPUT ["Generated Files"]
        O1["📄 index.md"]
        O2["🧠 memory-summary.md"]
        O3["📊 stats.md"]
        O4["💬 conversations/*.md"]
    end
    
    GEN --> O1 & O2 & O3 & O4
    
    O1 & O2 & O3 & O4 --> REPORT[Show validation report]

    style UP fill:#e94560,color:#fff
    style REPORT fill:#53a8b6,color:#fff
    style FIXES fill:#16213e22,stroke:#0f3460
    style OUTPUT fill:#0f346022,stroke:#53a8b6
```

---

## 4. Import Process (Phase 3)

```mermaid
flowchart TD
    R[Review memory summary] --> ROK{Summary approved?}
    ROK -->|"Needs edits"| EDIT[User requests changes]
    EDIT --> R
    ROK -->|Approved| LOGIN[Log into target account]
    
    LOGIN --> NAV[Settings → Capabilities → Memory]
    NAV --> NAVOK{Found Memory section?}
    NAVOK -->|No| HELP["Check:\n• Toggle Memory ON\n• Different tab name\n• Admin may need to enable"]
    HELP --> NAVOK
    NAVOK -->|Yes| METHOD{Import method?}
    
    METHOD -->|"Manual (< 15 items)"| MAN[Add edits one at a time]
    METHOD -->|"Bulk import available"| BULK[Paste full summary]
    
    MAN --> VERIFY[Start new chat:\n'What do you remember about me?']
    BULK --> WAIT["Wait up to 24 hours"] --> VERIFY
    
    VERIFY --> VOK{Memory reflected?}
    VOK -->|Missing items| ADD[Add missing edits manually]
    ADD --> VERIFY
    VOK -->|Looks good| SEED["Optional: Seed critical context\nin a new conversation"]
    
    SEED --> ARCHIVE["Upload conversations/\nto Google Drive"]
    ARCHIVE --> DONE([✅ Migration Complete])

    style R fill:#1a1a2e,color:#fff
    style DONE fill:#53a8b6,color:#fff
```

---

## 5. Error Recovery Flows

```mermaid
flowchart LR
    subgraph ZIP_ERRORS ["ZIP Errors"]
        ZE1["Corrupted ZIP"] -->|"Auto"| ZE1F["Extract what's salvageable"]
        ZE2["0-byte file"] -->|"Manual"| ZE2F["Re-download export"]
        ZE3["Not a ZIP"] -->|"Auto"| ZE3F["Try as raw JSON"]
    end
    
    subgraph JSON_ERRORS ["JSON Errors"]
        JE1["Truncated JSON"] -->|"Auto"| JE1F["Close open brackets\nRecover partial data"]
        JE2["Encoding error"] -->|"Auto"| JE2F["Try UTF-8 → Latin-1\n→ CP1252 → replace"]
        JE3["No conversations key"] -->|"Auto"| JE3F["Try alternate keys:\nchats, data, chat_histories"]
    end
    
    subgraph IMPORT_ERRORS ["Import Errors"]
        IE1["Memory not visible"] -->|"Manual"| IE1F["Toggle ON in Settings\nCheck plan/admin"]
        IE2["Import button missing"] -->|"Manual"| IE2F["Use manual Add method"]
        IE3["Memory not updating"] -->|"Wait"| IE3F["Allow 24h processing time"]
    end

    style ZIP_ERRORS fill:#e9456022,stroke:#e94560
    style JSON_ERRORS fill:#0f346022,stroke:#0f3460
    style IMPORT_ERRORS fill:#53a8b622,stroke:#53a8b6
```
