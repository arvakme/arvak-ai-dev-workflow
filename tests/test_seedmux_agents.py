"""Exercise the shipped Seedmux CLI against a fake curl bridge, never a real agent.

Integration fixtures come from the installed, hash-pinned application, not a vendored
copy. Set SEEDMUX_TEAM_VENDOR_SCRIPT to that script on other test machines. Only
HOME references in the temporary executable are redirected to SMX_TEST_HOME; the
process's actual HOME and all personal configuration remain untouched.
"""
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import shlex
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("seedmux_agents", ROOT / "scripts/configure-seedmux-agents.py")
m = importlib.util.module_from_spec(SPEC)
# dataclasses resolves its module through sys.modules.
import sys
sys.modules[SPEC.name] = m
SPEC.loader.exec_module(m)
ADAPTER = importlib.util.spec_from_file_location('seedmux_local', ROOT / 'scripts/seedmux-local.py')
adapter = importlib.util.module_from_spec(ADAPTER)
ADAPTER.loader.exec_module(adapter)
VENDOR = Path(os.environ.get("SEEDMUX_TEAM_VENDOR_SCRIPT", "/Applications/Seedmux.app/Contents/Resources/team/smx-team"))
PANE = "11111111-1111-4111-8111-111111111111"


class ProtectionTests(unittest.TestCase):
    def test_unknown_source_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unknown"):
            m.patch(b"#!/bin/bash\necho unknown upstream\n")


@unittest.skipUnless(VENDOR.is_file(), "Requires the reviewed Seedmux 0.1.60 vendor script")
class AgentPatchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="seedmux-agents-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.vendor = VENDOR.read_bytes()
        self.assertEqual(m.digest(self.vendor), m.VENDOR_SHA256, "New vendor must be reviewed, not silently skipped")
        self.app = self.root / "Seedmux.app"
        resources = self.app / "Contents/Resources/team"
        resources.mkdir(parents=True)
        (resources / "smx-team").write_bytes(self.vendor)
        (self.app / "Contents/Info.plist").write_bytes(plistlib.dumps({
            "CFBundleShortVersionString": "0.1.60", "CFBundleVersion": "61"}))
        self.target = self.root / "smx-team"
        self.target.write_bytes(self.vendor)
        self.target.chmod(0o751)

    def legacy(self):
        text = self.vendor.decode().replace(
            f'    case "$AGENT" in {m.BASE_AGENTS})', f'    case "$AGENT" in {m.BASE_AGENTS}|devin)')
        text = text.replace(m.CLAUDE_LINE, m.CLAUDE_LINE + m.DEVIN_OLD)
        self.assertEqual(m.digest(text.encode()), m.LEGACY_DEVIN_SHA256)
        return text.encode()

    def test_vendor_and_existing_devin_patch_are_supported_and_idempotent(self):
        expected = m.patch(self.vendor)
        self.assertEqual(m.patch(self.legacy()), expected)
        self.assertEqual(m.patch(expected), expected)
        self.assertEqual(expected.count(m.MARKER.encode()), 1)
        # The authoritative scheduler, bridge, and existing pretrust implementations stay intact.
        for start in ["req() {", "agy_pretrust() {"]:
            # Check actual function bodies, without copying them into this repository.
            def function(text):
                return text.split(start, 1)[1].split("\n}\n", 1)[0]
            self.assertEqual(function(expected.decode()), function(self.vendor.decode()))

    def test_external_cache_survives_app_update_without_touching_official_files(self):
        cache = self.root / 'cache'
        entrypoint = self.root / 'user bin/smx-team'
        first = adapter.prepare(self.app, entrypoint, cache)
        self.assertEqual(self.target.read_bytes(), self.vendor)
        info = self.app / 'Contents/Info.plist'
        info.write_bytes(plistlib.dumps({'CFBundleShortVersionString': '9.0.0'}))
        self.assertEqual(adapter.prepare(self.app, entrypoint, cache), first)
        vendor = self.app / 'Contents/Resources/team/smx-team'
        vendor.write_bytes(b'#!/bin/bash\necho unknown update\n')
        with self.assertRaises(ValueError):
            adapter.prepare(self.app, entrypoint, cache)
        self.assertEqual(self.target.read_bytes(), self.vendor)

    def test_external_cli_never_self_installs_and_envelopes_use_external_entry(self):
        cli, cwd, env, requests, output, trust = self.mock_cli()
        # An official regenerated CLI at its own location is not an output target.
        official = Path(env['SMX_TEST_HOME']) / '.seedmux/bin/smx-team'
        external = self.root / 'user-entry'
        external.write_bytes(adapter.build(self.vendor, external).replace(b'$HOME', b'$SMX_TEST_HOME'))
        external.chmod(0o700)
        official.write_text('# official app-owned placeholder\n')
        before = official.read_bytes()
        result = subprocess.run([str(external), 'spawn', '--agent', 'cursor', '--cwd', str(cwd), '--prompt', 'test'],
                                env=env, cwd=cwd, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(official.read_bytes(), before)
        body = json.loads(requests.read_text().splitlines()[-1])['body']
        self.assertIn(str(external), body['launch'])

    def mock_cli(self):
        isolated = self.root / "home O'Brien $dollars `not-a-command`"
        path = isolated / '.seedmux/bin/smx-team'
        path.parent.mkdir(parents=True)
        path.write_bytes(adapter.build(self.vendor, path).replace(b'$HOME', b'$SMX_TEST_HOME'))
        path.chmod(0o700)
        mockbin = self.root / 'mockbin'
        mockbin.mkdir()
        requests = self.root / 'bridge.jsonl'
        argv = self.root / 'argv.json'
        curl = mockbin / 'curl'
        curl.write_text('''#!/usr/bin/python3
import json, os, sys
args = sys.argv[1:]
url = next(arg for arg in args if arg.startswith('http://'))
body = json.loads(args[args.index('--data-binary')+1]) if '--data-binary' in args else None
with open(os.environ['SMX_TEST_REQUESTS'], 'a') as f:
    f.write(json.dumps({'url': url, 'body': body}) + '\\n')
print(json.dumps({'ok': True, 'paneId': '11111111-1111-4111-8111-111111111111'}))
''')
        curl.chmod(0o700)
        for agent in ['devin', 'cursor-agent', 'agy']:
            executable = mockbin / agent
            executable.write_text('''#!/usr/bin/python3
import json, os, sys
with open(os.environ['SMX_TEST_ARGV'], 'w') as f:
    json.dump(sys.argv[1:], f)
''')
            executable.chmod(0o700)
        config = self.root / 'bridge-config.json'
        config.write_text(json.dumps({'port': 65535, 'token': 'isolated-test-only'}))
        cwd = self.root / "cwd O'Brien 空格"
        cwd.mkdir()
        trust = isolated / '.gemini/antigravity-cli/settings.json'
        trust.parent.mkdir(parents=True)
        trust.write_text(json.dumps({'model': 'preserve-existing', 'trustedWorkspaces': ['/previous/exact/root'], 'nested': {'keep': True}}))
        env = {**os.environ, 'SMX_TEST_HOME': str(isolated), 'SEEDMUX_PANE_ID': PANE,
               'SEEDMUX_TEAM_BRIDGE_PATH': str(config), 'SMX_TEST_REQUESTS': str(requests),
               'SMX_TEST_ARGV': str(argv), 'PATH': str(mockbin) + os.pathsep + os.environ['PATH']}
        return path, cwd, env, requests, argv, trust

    def test_real_cli_mock_bridge_launch_arguments_quoting_trust_and_send(self):
        cli, cwd, env, requests, output, trust = self.mock_cli()
        content = "user's task; $(do-not-run) `still-text`\nsecond line"
        evidence = []
        for agent, model in [('devin', 'claude-opus-4.6'), ('cursor-agent', 'claude-opus-4-8[context=1m,effort=high]'),
                             ('cursor', ''), ('agy', 'gemini-3.1-pro')]:
            with self.subTest(agent=agent):
                result = subprocess.run([str(cli), 'spawn', '--agent', agent, '--model', model,
                                         '--cwd', str(cwd), '--prompt', content],
                                        cwd=cwd, env=env, capture_output=True, text=True, timeout=15)
                self.assertEqual(result.returncode, 0, result.stderr)
                captured = json.loads(requests.read_text().splitlines()[-1])
                self.assertTrue(captured['url'].endswith('/spawn'))
                body = captured['body']
                self.assertEqual(body['cwd'], str(cwd.resolve()))
                self.assertFalse(body['focus'])
                self.assertEqual(body['near'], PANE)
                canonical = 'cursor-agent' if agent == 'cursor' else agent
                parsed = shlex.split(body['launch'])
                self.assertEqual(parsed[0], canonical)
                if model:
                    self.assertEqual(parsed[parsed.index('--model')+1], model)
                else:
                    self.assertNotIn('--model', parsed)
                if canonical == 'devin':
                    self.assertEqual(parsed[parsed.index('--permission-mode')+1], 'dangerous')
                    self.assertEqual(parsed[parsed.index('--respect-workspace-trust')+1], 'false')
                    self.assertEqual(parsed[-2], '--')
                elif canonical == 'cursor-agent':
                    self.assertIn('--yolo', parsed)
                    self.assertIn('--trust', parsed)
                    self.assertEqual(parsed[parsed.index('--sandbox')+1], 'disabled')
                    self.assertEqual(parsed[-2], '--')
                else:
                    self.assertIn('--dangerously-skip-permissions', parsed)
                    self.assertEqual(parsed[-2], '-i')
                task = result.stdout.split('task=')[-1].split()[0]
                taskdir = Path(env['SMX_TEST_HOME']) / '.seedmux/team/tasks' / task
                self.assertIn(content, (taskdir/'prompt.md').read_text())
                self.assertIn(str(taskdir/'prompt.md'), parsed[-1])
                self.assertEqual(json.loads((taskdir/'meta.json').read_text())['agent'], canonical)
                # Execute only the argument recorder, through the same shell as the bridge.
                ran = subprocess.run(['/bin/zsh', '-f', '-c', body['launch']], cwd=cwd, env=env, capture_output=True, text=True)
                self.assertEqual(ran.returncode, 0, ran.stderr)
                self.assertEqual(json.loads(output.read_text()), parsed[1:])
                evidence.append({'agent': agent, 'request': captured, 'executed_argv': json.loads(output.read_text())})
        saved = json.loads(trust.read_text())
        self.assertEqual(saved['model'], 'preserve-existing')
        self.assertEqual(saved['nested'], {'keep': True})
        self.assertEqual(saved['trustedWorkspaces'], ['/previous/exact/root', str(cwd.resolve())])
        sent = subprocess.run([str(cli), 'send', '--to', PANE, '--text', "wake ' $literal"],
                              cwd=cwd, env=env, capture_output=True, text=True)
        self.assertEqual(sent.returncode, 0, sent.stderr)
        captured = json.loads(requests.read_text().splitlines()[-1])
        self.assertTrue(captured['url'].endswith('/send'))
        self.assertEqual(captured['body'], {'to': PANE, 'text': "wake ' $literal", 'enter': True})
        evidence.append({'followup': captured, 'agy_settings': saved})
        if os.environ.get('SEEDMUX_AGENT_TEST_EVIDENCE'):
            Path(os.environ['SEEDMUX_AGENT_TEST_EVIDENCE']).write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')

    def test_invalid_model_is_rejected_before_bridge_and_no_sessions_are_started(self):
        cli, cwd, env, requests, _, _ = self.mock_cli()
        for model in ['x; touch injected', '$(false)', '--yolo', 'model\nsecond']:
            result = subprocess.run([str(cli), 'spawn', '--agent', 'cursor-agent', '--model', model,
                                     '--cwd', str(cwd), '--prompt', 'test'],
                                    cwd=cwd, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2, (model, result.stderr))
        self.assertFalse(requests.exists())


if __name__ == '__main__':
    unittest.main()
