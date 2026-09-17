#!/usr/bin/env python3
"""Add Devin and Cursor to Seedmux's CLI launcher (not its native menu).

Seedmux 0.1.60/build 61 only. Dry run: python3 scripts/configure-seedmux-agents.py
Apply: add --apply. Restore: --restore BACKUP --apply. Every write has a backup.
An app update/reinstall may replace ~/.seedmux/bin/smx-team. Run this script again;
unknown vendor or locally edited scripts are refused until explicitly reviewed.
No application bundle, permission config, agent session or scheduler is created.
"""
import argparse
from dataclasses import dataclass
import fcntl
import hashlib
import os
from pathlib import Path
import plistlib
import stat
import subprocess
import tempfile

VENDOR_SHA256 = "98de064f43c29240ba4b3abef6a61ffbf0926b559c9823d366687bf5105af298"
LEGACY_DEVIN_SHA256 = "ef39a449d2ed647d626f0430265f48663ec6206bacf86eccb847497e65e7eebf"
SUPPORTED_VERSION = ("0.1.60", "61")
MARKER = "# >>> workstation Seedmux extra agents v1"
BASE_AGENTS = "claude|codex|grok|opencode|kimi|agy"
EXTRA_AGENTS = BASE_AGENTS + "|devin|cursor-agent|cursor"
DEVIN_OLD = '        devin)    LAUNCH="devin ${MODEL_ARG}--permission-mode dangerous -- \'$ENVELOPE\'" ;;\n'
AGY_HEADER = "# ---- agy(Antigravity CLI)专用(1.2.2 实测) ----"
MODEL_CHECK = '''    case "$MODEL" in *[!A-Za-z0-9._/:-]*)
        echo "错误:--model 只放行 A-Za-z0-9._/:-(要穿 shell 拼接层)" >&2; exit 2 ;; esac'''
CURSOR_CHECK = '''    if [ "$AGENT" = cursor ]; then AGENT=cursor-agent; fi
    if [ "$AGENT" = cursor-agent ]; then
        smx_cursor_model "$MODEL" || exit 2
    else
''' + MODEL_CHECK + '''
    fi'''
HELPERS = r'''# >>> workstation Seedmux extra agents v1
# Managed by scripts/configure-seedmux-agents.py; launch only through the official bridge.
# Cursor --yolo respects explicit deny rules. --trust applies to this invocation's cwd.
# Devin's workspace trust switch is invocation-local; no global trust rule is written.
smx_cursor_model() {
    SMX_MODEL="$1" /usr/bin/python3 -c '
import os, re, sys
model = os.environ["SMX_MODEL"]
if model and (len(model) > 512 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/:,=\[\]-]*", model)):
    sys.stderr.write("错误:Cursor model 仅支持模型标识及 [key=value,...] 参数\n")
    sys.exit(2)
'
}
smx_extra_launch() {
    SMX_AGENT="$1" SMX_MODEL="$2" SMX_PROMPT="$3" /usr/bin/python3 -c '
import os, shlex
agent, model, prompt = (os.environ[key] for key in ("SMX_AGENT", "SMX_MODEL", "SMX_PROMPT"))
args = {
    "devin": ["devin", "--permission-mode", "dangerous", "--respect-workspace-trust", "false"],
    "cursor-agent": ["cursor-agent", "--yolo", "--sandbox", "disabled", "--trust"],
    "agy": ["agy", "--dangerously-skip-permissions"],
}[agent]
if model:
    args += ["--model", model]
args += ["-i", prompt] if agent == "agy" else ["--", prompt]
print(shlex.join(args))
'
}
# <<< workstation Seedmux extra agents v1

'''
CLAUDE_LINE = '        claude)   LAUNCH="claude ${MODEL_ARG}--dangerously-skip-permissions \'$ENVELOPE\'" ;;\n'
EXTRA_CASES = '''        devin|cursor-agent) LAUNCH="$(smx_extra_launch "$AGENT" "$MODEL" "$ENVELOPE")" ;;
'''
AGY_OLD = '                  LAUNCH="agy ${MODEL_ARG}--dangerously-skip-permissions -i \'$ENVELOPE\'" ;;'
AGY_NEW = '                  LAUNCH="$(smx_extra_launch agy "$MODEL" "$ENVELOPE")" ;;'
EDITS = (
    (BASE_AGENTS, EXTRA_AGENTS, 3),
    (AGY_HEADER, HELPERS + AGY_HEADER, 1),
    (MODEL_CHECK, CURSOR_CHECK, 1),
    (CLAUDE_LINE, CLAUDE_LINE + EXTRA_CASES, 1),
    (AGY_OLD, AGY_NEW, 1),
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def replace_exact(text, old, new, count):
    if text.count(old) != count:
        raise ValueError("Unknown smx-team structure; refusing to replace launch code")
    return text.replace(old, new)


def patch(source):
    """Known vendor and the user's existing Devin patch converge to the same result."""
    text = source.decode("utf-8")
    if MARKER in text:
        restored = text
        for old, new, count in reversed(EDITS):
            restored = replace_exact(restored, new, old, count)
        if digest(restored.encode()) != VENDOR_SHA256:
            raise ValueError("Patched smx-team has other changes; review before reapplying")
        return source
    checksum = digest(source)
    if checksum == LEGACY_DEVIN_SHA256:
        text = replace_exact(text, f'    case "$AGENT" in {BASE_AGENTS}|devin)',
                             f'    case "$AGENT" in {BASE_AGENTS})', 1)
        text = replace_exact(text, DEVIN_OLD, "", 1)
    if digest(text.encode()) != VENDOR_SHA256:
        raise ValueError("Unknown vendor/local smx-team version; existing changes were not overwritten")
    for old, new, count in EDITS:
        text = replace_exact(text, old, new, count)
    return text.encode()


def check_vendor(app):
    with (app / "Contents/Info.plist").open("rb") as handle:
        info = plistlib.load(handle)
    version = (str(info.get("CFBundleShortVersionString")), str(info.get("CFBundleVersion")))
    vendor = app / "Contents/Resources/team/smx-team"
    if version != SUPPORTED_VERSION or digest(vendor.read_bytes()) != VENDOR_SHA256:
        raise ValueError("Unreviewed Seedmux app version/script; only 0.1.60 build 61 is supported")


def identity(info):
    return (info.st_dev, info.st_ino, info.st_mtime_ns, info.st_size, stat.S_IMODE(info.st_mode))


@dataclass(frozen=True)
class Change:
    path: Path
    before: bytes
    after: bytes
    identity: tuple
    mode: int


def plan(path, app, restore=None):
    check_vendor(app)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode):
        raise ValueError("smx-team must be a regular file, not a symlink")
    before = path.read_bytes()
    after = patch(before)
    if restore is not None:
        after = restore.read_bytes()
        if digest(after) not in {VENDOR_SHA256, LEGACY_DEVIN_SHA256}:
            raise ValueError("Restore backup is not a reviewed original smx-team")
    if before == after:
        return None
    return Change(path, before, after, identity(info), stat.S_IMODE(info.st_mode))


def assert_unchanged(change):
    if identity(change.path.lstat()) != change.identity or change.path.read_bytes() != change.before:
        raise RuntimeError("smx-team changed concurrently; no replacement was made")


def apply(change):
    """Lock cooperating writers, validate twice, then atomically replace; never chmod live code."""
    if change is None:
        return None
    with change.path.open("rb") as original:
        fcntl.flock(original, fcntl.LOCK_EX)
        assert_unchanged(change)
        staged = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".smx-team-agents-", dir=change.path.parent,
                                             delete=False) as output:
                staged = Path(output.name)
                output.write(change.after)
                output.flush()
                os.fsync(output.fileno())
            os.chmod(staged, change.mode)
            subprocess.run(["/bin/bash", "-n", str(staged)], check=True, capture_output=True)
            assert_unchanged(change)
            with tempfile.NamedTemporaryFile(prefix="smx-team.before-agents-", dir=change.path.parent,
                                             delete=False) as output:
                backup = Path(output.name)
                output.write(change.before)
                output.flush()
                os.fsync(output.fileno())
            os.chmod(backup, change.mode)
            assert_unchanged(change)
            os.replace(staged, change.path)
            return backup
        finally:
            if staged is not None and staged.exists():
                staged.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write a backup and atomically update the CLI")
    parser.add_argument("--script", type=Path, default=Path.home() / ".seedmux/bin/smx-team")
    parser.add_argument("--seedmux-app", type=Path, default=Path("/Applications/Seedmux.app"))
    parser.add_argument("--restore", type=Path, help="restore a reviewed pre-patch backup (dry run unless --apply)")
    args = parser.parse_args()
    try:
        change = plan(args.script.expanduser(), args.seedmux_app.expanduser(), args.restore)
        if change is None:
            print("Already configured; no files changed")
        elif args.apply:
            backup = apply(change)
            print(f"Updated {change.path}\nBackup: {backup}")
        else:
            print(f"Would update {change.path}; no files changed (use --apply)")
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Refused: {error}\n")
    if args.restore is not None:
        print("Restore mode: capabilities follow the exact backup; no running agent is changed.")
        return
    print("CLI only: smx-team spawn --agent devin|cursor-agent|cursor|agy; native menu unchanged")
    print("YOLO defaults: Devin dangerous; Cursor --yolo --sandbox disabled; agy --dangerously-skip-permissions")
    print("Trust: Devin skips only this launch's workspace check; Cursor --trust uses the current cwd; agy keeps official exact-workspace pretrust")
    print("Explicit deny rules, authentication and server policy still apply. Running agents keep their existing permissions.")
    print("App upgrades may replace the CLI. Re-run after upgrade; unknown versions require a reviewed patch update.")


if __name__ == "__main__":
    main()
