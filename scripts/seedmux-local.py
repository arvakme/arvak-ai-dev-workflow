#!/usr/bin/env python3
"""External Seedmux CLI adapter. Keeps app-owned assets untouched.

Uses the installed app's reviewed launcher and bridge; no scheduler or daemon.
Unchanged upstream launcher hashes work across app releases. Unknown launchers
fail closed until reviewed. Run --doctor to check compatibility without agents.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile

spec = importlib.util.spec_from_file_location('seedmux_agent_patch', Path(__file__).resolve().with_name('configure-seedmux-agents.py'))
patcher = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = patcher
spec.loader.exec_module(patcher)


CONFIG_PATH = Path.home() / '.config/agent-stuff/config/local/seedmux/agents.json'


def load_agents(path):
    """Accept argv data, never shell fragments; reject typos before creating panes."""
    config = json.loads(path.read_text())
    if not isinstance(config, dict) or set(config) != {'schema_version', 'agents'} or config['schema_version'] != 1:
        raise ValueError('agents.json requires schema_version=1 and agents')
    agents = config['agents']
    if not isinstance(agents, dict) or set(agents) != {'devin', 'cursor-agent', 'agy'}:
        raise ValueError('agents.json requires devin, cursor-agent and agy; cursor is an alias')
    for name, item in agents.items():
        if not isinstance(item, dict) or set(item) != {'command', 'args', 'model_flag', 'prompt_flag'}:
            raise ValueError(f'{name}: expected command, args, model_flag, prompt_flag')
        if not isinstance(item['args'], list):
            raise ValueError(f'{name}: args must be an argv array')
        for value in [item['command'], item['model_flag'], item['prompt_flag'], *item['args']]:
            if not isinstance(value, str) or not value or any(ord(c) < 32 for c in value):
                raise ValueError(f'{name}: arguments must be nonempty strings without control characters')
        if item['command'].startswith('-') or any(not item[k].startswith('-') for k in ('model_flag', 'prompt_flag')):
            raise ValueError(f'{name}: invalid executable or argument flag')
    return agents


def build(source, entrypoint, agents):
    text = patcher.patch(source).decode()
    text = patcher.replace_exact(text, '# BUTLER_EXTRA_AGENTS_CONFIG',
                                 'export SMX_EXTRA_AGENTS=' + shlex.quote(json.dumps(agents, sort_keys=True)), 1)
    old = 'SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"'
    text = patcher.replace_exact(text, old, 'SELF=' + shlex.quote(str(entrypoint)), 1)
    # App installs its own assets. The external copy must never replace them or
    # overwrite selected skill entrypoints. Workers re-enter through our wrapper.
    start = text.index('sync_skills() {')
    end = text.index('# ----', text.index('CLI_PUB="$SMX_BIN"', start))
    text = text[:start] + 'sync_skills() { :; }\nCLI_PUB="$SELF"\n\n' + text[end:]
    return text.encode()


def prepare(app, entrypoint, cache, agents):
    source = app / 'Contents/Resources/team/smx-team'
    content = build(source.read_bytes(), entrypoint, agents)
    key = hashlib.sha256(content).hexdigest()
    cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = cache / (key + '.sh')
    if not target.exists() or target.read_bytes() != content:
        with tempfile.NamedTemporaryFile(dir=cache, delete=False) as handle:
            staged = Path(handle.name)
            handle.write(content)
        try:
            staged.chmod(0o700)
            subprocess.run(['/bin/bash', '-n', str(staged)], check=True, capture_output=True)
            os.replace(staged, target)
        finally:
            staged.unlink(missing_ok=True)
    return target


def main():
    # Existing workers can still reply if a future upstream launch path changes.
    # Only launching/discussion and the compatibility probe need adaptation.
    if sys.argv[1:] and sys.argv[1] not in ('spawn', 'discuss', '--doctor'):
        official = Path.home() / '.seedmux/bin/smx-team'
        if not official.is_file():
            print('Seedmux CLI is missing; open Seedmux to restore app assets.', file=sys.stderr)
            return 1
        os.execv(str(official), [str(official), *sys.argv[1:]])
    app = Path(os.environ.get('BUTLER_SEEDMUX_APP', '/Applications/Seedmux.app'))
    entrypoint = Path(__file__).absolute()
    # Keep the user-owned symlink in envelopes, not the cache or app bundle.
    invoked = Path(sys.argv[0]).absolute()
    if invoked.is_file():
        entrypoint = invoked
    cache = Path.home() / '.cache/butler/seedmux'
    try:
        agents = load_agents(CONFIG_PATH)
        if sys.argv[1:] == ['--doctor']:
            # Build and syntax-check through stdin; doctor must not create cache files.
            source = (app / 'Contents/Resources/team/smx-team').read_bytes()
            content = build(source, entrypoint, agents)
            subprocess.run(['/bin/bash', '-n'], input=content, check=True, capture_output=True)
            print(json.dumps({'ok': True, 'entrypoint': str(entrypoint),
                              'config': str(CONFIG_PATH), 'agents': [*agents, 'cursor'],
                              'upstream_sha256': patcher.digest(source)}))
            return 0
        path = prepare(app, entrypoint, cache, agents)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Seedmux adapter needs review: {error}. Official files were not changed.', file=sys.stderr)
        return 1
    os.execv('/bin/bash', ['/bin/bash', str(path), *sys.argv[1:]])


if __name__ == '__main__':
    sys.exit(main())
