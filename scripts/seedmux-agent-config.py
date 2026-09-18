#!/usr/bin/env python3
"""The shared argv schema for the Seedmux launcher and read-only doctor."""
import json
from pathlib import Path
import sys


def load_agents(path):
    """Accept argv data, never shell fragments; reject typos before creating panes."""
    config = json.loads(path.read_text())
    if not isinstance(config, dict) or set(config) != {'schema_version', 'agents'} or type(config['schema_version']) is not int or config['schema_version'] != 1:
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
        command = item['command']
        if command.startswith('~/'):
            item['command'] = str(Path.home() / command[2:])
        elif command.startswith('~'):
            raise ValueError(f'{name}: use ~/ or an absolute executable path')
    return agents



def main():
    if len(sys.argv) != 2:
        print('Usage: seedmux-agent-config.py PATH', file=sys.stderr)
        return 2
    try:
        load_agents(Path(sys.argv[1]))
    except (OSError, ValueError):
        print('Invalid or unreadable agent configuration; contents omitted.', file=sys.stderr)
        return 1
    print('Agent configuration is valid.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
