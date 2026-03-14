#!/usr/bin/env python3
"""
Claude Account Migrator — Export Parser

Parses a Claude data export ZIP file and produces:
  - Individual Markdown files per conversation
  - A master index with metadata
  - A memory summary for importing into another account
  - Export statistics

Usage:
    python3 parse_claude_export.py <path-to-export.zip> <output-directory>

The export ZIP typically contains JSON files with conversation data.
This script handles known Claude export formats and warns about
unrecognized structures.
"""

import json
import os
import re
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def sanitize_filename(text, max_len=60):
    """Turn arbitrary text into a safe, readable filename slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = text.strip('-')
    return text[:max_len] if text else 'untitled'


def extract_topic(messages, conversation_name=''):
    """Derive a short topic label from conversation name or first user message."""
    if conversation_name and conversation_name.strip():
        return conversation_name.strip()
    for msg in messages:
        role = msg.get('role', msg.get('sender', ''))
        if role in ('user', 'human'):
            text = ''
            content = msg.get('content', msg.get('text', ''))
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                text = ' '.join(
                    block.get('text', '') for block in content
                    if isinstance(block, dict) and block.get('type') == 'text'
                )
            if text.strip():
                first_line = text.strip().split('\n')[0][:120]
                return first_line
    return 'Untitled Conversation'


def extract_date(conversation):
    """Pull the best available timestamp from a conversation object."""
    for key in ('created_at', 'updated_at', 'create_time', 'timestamp'):
        val = conversation.get(key)
        if val:
            try:
                if isinstance(val, (int, float)):
                    return datetime.utcfromtimestamp(val)
                return datetime.fromisoformat(val.replace('Z', '+00:00'))
            except (ValueError, TypeError, OSError):
                continue
    return None


def format_message(msg):
    """Render a single message as Markdown."""
    role = msg.get('role', msg.get('sender', 'unknown'))
    content = msg.get('content', msg.get('text', ''))

    # Normalize role labels
    role_label = {
        'user': '**You**',
        'human': '**You**',
        'assistant': '**Claude**',
        'system': '**System**',
    }.get(role.lower() if isinstance(role, str) else '', f'**{role}**')

    # Extract text from structured content blocks
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get('type') == 'text':
                    parts.append(block.get('text', ''))
                elif block.get('type') == 'tool_use':
                    parts.append(f"*[Tool call: {block.get('name', 'unknown')}]*")
                elif block.get('type') == 'tool_result':
                    parts.append(f"*[Tool result]*")
                elif block.get('type') == 'image':
                    parts.append('*[Image]*')
                elif block.get('type') == 'document':
                    parts.append('*[Document]*')
            elif isinstance(block, str):
                parts.append(block)
        text = '\n\n'.join(p for p in parts if p.strip())
    elif isinstance(content, str):
        text = content
    else:
        text = str(content) if content else '*[empty]*'

    return f"{role_label}:\n{text}\n"


def parse_conversations(data):
    """
    Accept raw parsed JSON and return a list of conversation dicts.
    Handles multiple known export structures.
    """
    conversations = []

    # Structure 1: Top-level list of conversations
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and ('chat_messages' in item or 'messages' in item):
                conversations.append(item)
            elif isinstance(item, dict) and 'mapping' in item:
                # ChatGPT-style (unlikely but handle gracefully)
                conversations.append(item)
        if not conversations:
            # Maybe the list itself is messages from a single conversation
            if all(isinstance(m, dict) and ('role' in m or 'sender' in m) for m in data):
                conversations.append({'messages': data, 'name': 'Exported Conversation'})

    # Structure 2: Dict with a conversations key
    elif isinstance(data, dict):
        for key in ('conversations', 'chats', 'data', 'chat_histories'):
            if key in data and isinstance(data[key], list):
                conversations = data[key]
                break
        if not conversations:
            # Maybe the dict IS a single conversation
            if 'chat_messages' in data or 'messages' in data:
                conversations = [data]

    return conversations


def get_messages(conv):
    """Extract the message list from a conversation object."""
    for key in ('chat_messages', 'messages', 'conversation'):
        if key in conv and isinstance(conv[key], list):
            return conv[key]
    # Handle mapping-style (ChatGPT exports)
    if 'mapping' in conv:
        mapping = conv['mapping']
        msgs = []
        for node in mapping.values():
            if isinstance(node, dict) and node.get('message'):
                msgs.append(node['message'])
        return sorted(msgs, key=lambda m: m.get('create_time', 0))
    return []


def generate_memory_summary(all_conversations):
    """
    Analyze all conversations to extract recurring themes, tools,
    preferences, projects, and other context suitable for memory import.
    """
    user_messages = []
    topics = []
    tool_mentions = Counter()
    word_freq = Counter()

    # Common stop words to filter
    stop_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
        'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
        'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
        'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
        'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
        'or', 'if', 'while', 'about', 'up', 'that', 'this', 'it', 'its',
        'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they',
        'them', 'what', 'which', 'who', 'whom', 'these', 'those', 'am',
        'hi', 'hello', 'thanks', 'thank', 'please', 'okay', 'ok', 'yes',
        'no', 'get', 'got', 'like', 'also', 'one', 'two', 'use', 'using',
        'used', 'want', 'need', 'make', 'know', 'think', 'see', 'look',
        'help', 'let', 'try', 'give', 'go', 'going', 'come', 'take',
        'dont', "don't", 'im', "i'm", 'ive', "i've", 'well', 'still',
        'something', 'anything', 'thing', 'things', 'way', 'right', 'now',
    }

    for conv in all_conversations:
        messages = get_messages(conv)
        topic = extract_topic(messages, conv.get('name', conv.get('title', '')))
        topics.append(topic)

        for msg in messages:
            role = msg.get('role', msg.get('sender', ''))
            if role in ('user', 'human'):
                content = msg.get('content', msg.get('text', ''))
                if isinstance(content, list):
                    content = ' '.join(
                        b.get('text', '') for b in content
                        if isinstance(b, dict) and b.get('type') == 'text'
                    )
                if isinstance(content, str):
                    user_messages.append(content)
                    words = re.findall(r'\b[a-zA-Z]{3,}\b', content.lower())
                    for w in words:
                        if w not in stop_words:
                            word_freq[w] += 1

            # Track tool usage
            content_raw = msg.get('content', '')
            if isinstance(content_raw, list):
                for block in content_raw:
                    if isinstance(block, dict) and block.get('type') == 'tool_use':
                        tool_mentions[block.get('name', 'unknown')] += 1

    # Build summary
    lines = []
    lines.append("# Memory Summary for Account Migration")
    lines.append("")
    lines.append("This summary was auto-generated from your Claude chat export.")
    lines.append("**Review carefully before importing.** Remove anything outdated, sensitive, or irrelevant.")
    lines.append("")

    lines.append("## Top Discussion Topics")
    lines.append("")
    # Deduplicate similar topics
    seen = set()
    unique_topics = []
    for t in topics:
        key = sanitize_filename(t[:40])
        if key not in seen:
            seen.add(key)
            unique_topics.append(t)
    for t in unique_topics[:30]:
        lines.append(f"- {t}")
    lines.append("")

    lines.append("## Frequently Referenced Keywords")
    lines.append("")
    lines.append("These words appeared most often in your messages (potential areas of focus):")
    lines.append("")
    for word, count in word_freq.most_common(40):
        lines.append(f"- **{word}** ({count} mentions)")
    lines.append("")

    if tool_mentions:
        lines.append("## Tools Used")
        lines.append("")
        for tool, count in tool_mentions.most_common(20):
            lines.append(f"- `{tool}` ({count} uses)")
        lines.append("")

    lines.append("## Suggested Memory Edits for Target Account")
    lines.append("")
    lines.append("Copy these into **Settings → Capabilities → Memory → View and edit your memory** on the target account.")
    lines.append("Adjust as needed:")
    lines.append("")
    lines.append("```")
    lines.append("# --- PASTE BELOW INTO MEMORY EDITS ---")
    lines.append("# Delete any lines that are no longer relevant")
    lines.append("")
    lines.append(f"# Total conversations migrated: {len(all_conversations)}")
    lines.append(f"# Top keywords: {', '.join(w for w, _ in word_freq.most_common(15))}")
    if tool_mentions:
        lines.append(f"# Frequently used tools: {', '.join(t for t, _ in tool_mentions.most_common(10))}")
    lines.append("")
    lines.append("# Add your own context lines below, e.g.:")
    lines.append("# User works at [Company] as [Role]")
    lines.append("# User prefers [coding language / framework]")
    lines.append("# User is working on [project name]")
    lines.append("```")
    lines.append("")

    return '\n'.join(lines)


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 parse_claude_export.py <export.zip> <output-dir>")
        sys.exit(1)

    zip_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not zip_path.exists():
        print(f"Error: File not found: {zip_path}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    conv_dir = output_dir / 'conversations'
    conv_dir.mkdir(exist_ok=True)

    print(f"📦 Parsing Claude export: {zip_path}")
    print(f"📁 Output directory: {output_dir}")
    print()

    # --- Extract and locate JSON data ---
    all_conversations = []
    json_files_found = []
    other_files = []

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for name in zf.namelist():
            if name.endswith('.json'):
                json_files_found.append(name)
                try:
                    raw = zf.read(name)
                    data = json.loads(raw)
                    convs = parse_conversations(data)
                    if convs:
                        all_conversations.extend(convs)
                        print(f"  ✅ {name}: {len(convs)} conversation(s)")
                    else:
                        print(f"  ⚠️  {name}: parsed but no conversations found (may be account metadata)")
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"  ❌ {name}: failed to parse ({e})")
            else:
                other_files.append(name)

    if not all_conversations:
        print("\n⚠️  No conversations found in the export.")
        print("   This could mean:")
        print("   - The export format has changed")
        print("   - The ZIP contains only account metadata, not chat history")
        print("   - The file is not a Claude data export")
        print(f"\n   Files in ZIP: {json_files_found + other_files}")
        sys.exit(1)

    print(f"\n📊 Found {len(all_conversations)} total conversation(s)")
    print()

    # --- Process each conversation ---
    index_entries = []
    monthly_counts = Counter()
    total_messages = 0
    total_user_messages = 0
    total_assistant_messages = 0

    for i, conv in enumerate(all_conversations):
        messages = get_messages(conv)
        if not messages:
            continue

        conv_name = conv.get('name', conv.get('title', ''))
        topic = extract_topic(messages, conv_name)
        date = extract_date(conv)
        date_str = date.strftime('%Y-%m-%d') if date else 'unknown-date'
        date_display = date.strftime('%B %d, %Y') if date else 'Unknown date'

        if date:
            monthly_counts[date.strftime('%Y-%m')] += 1

        slug = sanitize_filename(topic)
        filename = f"{date_str}_{slug}.md"

        # Handle filename collisions
        counter = 1
        while (conv_dir / filename).exists():
            filename = f"{date_str}_{slug}_{counter}.md"
            counter += 1

        # Count messages
        msg_count = len(messages)
        user_count = sum(1 for m in messages if m.get('role', m.get('sender', '')) in ('user', 'human'))
        assistant_count = sum(1 for m in messages if m.get('role', m.get('sender', '')) in ('assistant',))
        total_messages += msg_count
        total_user_messages += user_count
        total_assistant_messages += assistant_count

        # Build conversation Markdown
        lines = []
        lines.append(f"# {topic}")
        lines.append("")
        lines.append(f"**Date:** {date_display}")
        lines.append(f"**Messages:** {msg_count} ({user_count} from you, {assistant_count} from Claude)")
        if conv.get('uuid') or conv.get('id'):
            lines.append(f"**Original ID:** `{conv.get('uuid', conv.get('id'))}`")
        lines.append("")
        lines.append("---")
        lines.append("")

        for msg in messages:
            lines.append(format_message(msg))
            lines.append("---")
            lines.append("")

        conv_file = conv_dir / filename
        conv_file.write_text('\n'.join(lines), encoding='utf-8')

        index_entries.append({
            'date': date_str,
            'date_display': date_display,
            'topic': topic,
            'filename': filename,
            'msg_count': msg_count,
            'user_count': user_count,
        })

    # Sort index by date descending
    index_entries.sort(key=lambda e: e['date'], reverse=True)

    # --- Write master index ---
    idx_lines = []
    idx_lines.append("# Claude Chat Export — Master Index")
    idx_lines.append("")
    idx_lines.append(f"**Exported:** {datetime.now().strftime('%B %d, %Y at %H:%M UTC')}")
    idx_lines.append(f"**Total conversations:** {len(index_entries)}")
    idx_lines.append(f"**Total messages:** {total_messages}")
    idx_lines.append("")
    idx_lines.append("---")
    idx_lines.append("")
    idx_lines.append("| Date | Topic | Messages |")
    idx_lines.append("|------|-------|----------|")
    for entry in index_entries:
        link = f"conversations/{entry['filename']}"
        idx_lines.append(f"| {entry['date_display']} | [{entry['topic'][:80]}]({link}) | {entry['msg_count']} |")
    idx_lines.append("")

    (output_dir / 'index.md').write_text('\n'.join(idx_lines), encoding='utf-8')

    # --- Write memory summary ---
    memory_md = generate_memory_summary(all_conversations)
    (output_dir / 'memory-summary.md').write_text(memory_md, encoding='utf-8')

    # --- Write stats ---
    stats_lines = []
    stats_lines.append("# Export Statistics")
    stats_lines.append("")
    stats_lines.append(f"- **Total conversations:** {len(index_entries)}")
    stats_lines.append(f"- **Total messages:** {total_messages}")
    stats_lines.append(f"- **Your messages:** {total_user_messages}")
    stats_lines.append(f"- **Claude's messages:** {total_assistant_messages}")
    stats_lines.append(f"- **JSON files in export:** {len(json_files_found)}")
    stats_lines.append(f"- **Other files in export:** {len(other_files)}")
    stats_lines.append("")
    stats_lines.append("## Monthly Activity")
    stats_lines.append("")
    for month in sorted(monthly_counts.keys()):
        bar = '█' * min(monthly_counts[month], 50)
        stats_lines.append(f"- **{month}:** {monthly_counts[month]} conversations {bar}")
    stats_lines.append("")

    (output_dir / 'stats.md').write_text('\n'.join(stats_lines), encoding='utf-8')

    # --- Done ---
    print(f"✅ Migration output ready at: {output_dir}/")
    print(f"   📄 index.md — Master conversation index")
    print(f"   🧠 memory-summary.md — Memory summary for import")
    print(f"   📊 stats.md — Export statistics")
    print(f"   💬 conversations/ — {len(index_entries)} conversation files")
    print()
    print("Next steps:")
    print("  1. Review memory-summary.md and remove outdated/sensitive items")
    print("  2. Log into your TARGET Claude account")
    print("  3. Go to Settings → Capabilities → Memory → View and edit your memory")
    print("  4. Add relevant memory edits from the summary")
    print("  5. Optionally upload the conversations/ folder to Google Drive for reference")


if __name__ == '__main__':
    main()
