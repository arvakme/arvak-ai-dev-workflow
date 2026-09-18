#!/usr/bin/env python3
"""Reviewed Seedmux launch adaptations and external entrypoint installer.

Official app scripts are never modified. --apply installs ~/.local/bin/smx-team;
--help documents the install seam. Launcher content is pinned by hash, not app
version, so app-only updates do not require reapplying a patch.
"""
import argparse
import hashlib
import os
from pathlib import Path

VENDOR_SHA256 = "98de064f43c29240ba4b3abef6a61ffbf0926b559c9823d366687bf5105af298"
LEGACY_DEVIN_SHA256 = "ef39a449d2ed647d626f0430265f48663ec6206bacf86eccb847497e65e7eebf"
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
# BUTLER_EXTRA_AGENTS_CONFIG
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
import json, os, shlex
agent, model, prompt = (os.environ[key] for key in ("SMX_AGENT", "SMX_MODEL", "SMX_PROMPT"))
config = json.loads(os.environ["SMX_EXTRA_AGENTS"])[agent]
args = [config["command"], *config["args"]]
if model:
    args += [config["model_flag"], model]
args += [config["prompt_flag"], prompt]
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



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    config = Path.home() / ".config/agent-stuff/config/local/seedmux/agents.json"
    template = Path(__file__).resolve().parents[1] / "config/seedmux/agents.json"
    source = Path(__file__).resolve().with_name("seedmux-local.py")
    link = Path.home() / ".local/bin/smx-team"
    if link.exists() and not link.is_symlink():
        parser.exit(1, f"Refusing to overwrite an existing file: {link}\n")
    if not args.apply:
        print(f"Would link {link} to {source} and initialize {config} if missing; official files remain untouched")
        return
    # Exclusive create: retain every existing personal setting, including symlinks.
    config.parent.mkdir(parents=True, exist_ok=True)
    try:
        with config.open("x") as handle:
            handle.write(template.read_text())
        config.chmod(0o600)
    except FileExistsError:
        pass
    link.parent.mkdir(parents=True, exist_ok=True)
    if link.is_symlink():
        if link.resolve() == source:
            print("Already installed")
            return
        parser.exit(1, f"Refusing to replace an unrelated symlink: {link}\n")
    link.symlink_to(source)
    print(f"Installed {link}; run it with --doctor to check compatibility")


if __name__ == "__main__":
    main()
