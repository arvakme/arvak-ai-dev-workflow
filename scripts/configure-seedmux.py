#!/usr/bin/env python3
"""Persist Seedmux's supported YOLO defaults without editing generated shims.

Python 3.11+. Dry run by default; --apply writes backups and atomic replacements.
Codex's base config also covers smx-team and resume paths that omit its YOLO flag.
"""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile
import tomllib

AGENTS = ("claude", "codex", "grok", "opencode", "kimi", "agy")


def statement_lines(lines):
    """Locate statements, excluding comments and multiline TOML string bodies."""
    quote = None
    for number, line in enumerate(lines):
        starts_statement = quote is None
        i = 0
        while i < len(line):
            if quote:
                if quote[0] == '"' and line[i] == "\\":
                    i += 2
                    continue
                if line.startswith(quote, i):
                    i += len(quote)
                    if len(quote) == 3:
                        # TOML permits one or two extra quotes before a triple close.
                        while i < len(line) and line[i] == quote[0]:
                            i += 1
                    quote = None
                else:
                    i += 1
            elif line[i] == "#":
                break
            elif line[i] in ('"', "'"):
                quote = line[i] * (3 if line.startswith(line[i] * 3, i) else 1)
                i += len(quote)
            else:
                i += 1
        if starts_statement:
            yield number, line[:i].strip()


def set_value(text, table, key, value):
    """Edit a simple scalar in an existing canonical table, preserving other text."""
    parsed = tomllib.loads(text)
    current = parsed
    for part in table:
        current = current.get(part, {})
        if not isinstance(current, dict):
            raise ValueError(f"Expected table: {table}")
    if current.get(key) == value:
        return text
    header = "[" + ".".join(json.dumps(part) for part in table) + "]" if table else None
    # Table names used here have an equivalent bare spelling for agents.
    names = [header, "[agents]"] if table == ("agents",) else [header]
    lines = text.splitlines(keepends=True)
    statements = dict(statement_lines(lines))
    start, end = 0, len(lines)
    if table:
        found = [i for i, line in statements.items() if line in names]
        if not found:
            if current:
                raise ValueError(f"Non-canonical table spelling; edit manually: {table}")
            result = text.rstrip() + f"\n\n{header}\n{key} = {json.dumps(value)}\n"
            tomllib.loads(result)
            return result
        start = found[0] + 1
    for i, line in statements.items():
        if i >= start and line.startswith("["):
            end = i
            break
    pattern = re.compile(r"^\s*" + re.escape(key) + r"\s*=")
    matches = [i for i in range(start, end) if i in statements and pattern.match(lines[i])]
    if key in current and not matches:
        raise ValueError(f"Non-canonical key spelling; edit manually: {key}")
    replacement = f"{key} = {json.dumps(value)}\n"
    if matches:
        lines[matches[0]] = replacement
    else:
        lines.insert(start, replacement)
    result = "".join(lines)
    actual = tomllib.loads(result)
    for part in table:
        actual = actual[part]
    if actual.get(key) != value:
        raise ValueError(f"Setting did not take effect: {table}.{key}")
    return result


def plan(home):
    seedmux = home / ".seedmux/config.toml"
    codex = home / ".codex/config.toml"
    if not seedmux.is_file() or not codex.is_file():
        raise ValueError("Install Seedmux and Codex before applying these personal defaults")
    result = []
    for path in [seedmux, home / ".seedmux/config.local.toml"]:
        if not path.exists():
            continue
        before = path.read_text()
        after = before
        for agent in AGENTS:
            after = set_value(after, ("agents",), f"{agent}_yolo", True)
        if after != before:
            result.append((path, before, after))
    before = codex.read_text()
    parsed = tomllib.loads(before)
    after = set_value(before, (), "approval_policy", "never")
    # Preserve whichever supported sandbox vocabulary the user already chose.
    if "default_permissions" in parsed:
        if "sandbox_mode" in parsed or "sandbox_workspace_write" in parsed:
            raise ValueError("Codex config mixes permissions vocabularies; resolve before applying")
        after = set_value(after, (), "default_permissions", ":danger-full-access")
    else:
        after = set_value(after, (), "sandbox_mode", "danger-full-access")
    if after != before:
        result.append((codex, before, after))
    return result


def apply(changes):
    for path, before, _ in changes:
        if path.read_text() != before:
            raise RuntimeError(f"Config changed concurrently: {path}")
    for path, before, after in changes:
        mode = path.stat().st_mode & 0o777
        # Keep backups beside the originals; never commit personal configuration.
        with tempfile.NamedTemporaryFile(prefix=path.name + ".before-yolo-", dir=path.parent,
                                         delete=False, mode="w") as backup:
            backup.write(before)
        with tempfile.NamedTemporaryFile(prefix=path.name + ".", dir=path.parent,
                                         delete=False, mode="w") as output:
            output.write(after)
            temp = output.name
        try:
            os.chmod(temp, mode)
            if path.read_text() != before:
                raise RuntimeError(f"Config changed concurrently: {path}")
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
        print(f"Updated {path}; backup: {backup.name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="persist defaults; default is dry-run")
    parser.add_argument("--home", type=Path, default=Path.home(), help="configuration home (test seam)")
    args = parser.parse_args()
    changes = plan(args.home.expanduser())
    if args.apply:
        apply(changes)
    else:
        for path, _, _ in changes:
            print(f"Would update {path}")
    print("Seedmux: " + ", ".join(f"{name}_yolo=true" for name in AGENTS))
    print("Codex: approval_policy=never, full filesystem/network access; explicit CLI flags still override defaults")
    print("Existing running sessions keep their current permissions; restart/resume to use new defaults")


if __name__ == "__main__":
    main()
