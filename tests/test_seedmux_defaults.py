import importlib.util
from pathlib import Path
import tempfile
import tomllib
import unittest
spec = importlib.util.spec_from_file_location('defaults', Path(__file__).resolve().parents[1] / 'scripts/configure-seedmux.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class DefaultsTests(unittest.TestCase):

    def test_preserves_other_settings_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as d:
            h = Path(d)
            (h / '.seedmux').mkdir()
            (h / '.codex').mkdir()
            (h / '.seedmux/config.toml').write_text('# comment\n[agents]\nopencode_yolo = false\n[island]\nenabled = true\n')
            (h / '.seedmux/config.local.toml').write_text('[agents]\ncodex_yolo = false\n')
            (h / '.codex/config.toml').write_text('model = "chosen"\n[features]\nhooks = true\n[projects."/tmp/project"]\ntrust_level = "trusted"\n')
            changes = m.plan(h)
            self.assertEqual(len(changes), 3)
            m.apply(changes)
            self.assertEqual(m.plan(h), [])
            seed = tomllib.loads((h / '.seedmux/config.toml').read_text())
            self.assertTrue(seed['island']['enabled'])
            self.assertEqual(seed['agents'], {a + '_yolo': True for a in m.AGENTS})
            codex = tomllib.loads((h / '.codex/config.toml').read_text())
            self.assertEqual(codex['model'], 'chosen')
            self.assertEqual(codex['approval_policy'], 'never')
            self.assertEqual(codex['sandbox_mode'], 'danger-full-access')
            self.assertTrue(codex['features']['hooks'])
            self.assertEqual(codex['projects']['/tmp/project']['trust_level'], 'trusted')

    def test_multiline_instructions_are_preserved_while_real_keys_change(self):
        for quote in ['"' * 3, "'" * 3]:
            with self.subTest(quote=quote), tempfile.TemporaryDirectory() as d:
                h = Path(d)
                (h / '.seedmux').mkdir()
                (h / '.codex').mkdir()
                (h / '.seedmux/config.toml').write_text('[agents] # preferences\nopencode_yolo = false\n')
                instructions = '\n[agents]\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"\n[other]\n'
                text = 'developer_instructions = ' + quote + instructions + quote + '\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"\n'
                (h / '.codex/config.toml').write_text(text)
                m.apply(m.plan(h))
                actual = tomllib.loads((h / '.codex/config.toml').read_text())
                self.assertEqual(actual['developer_instructions'], tomllib.loads(text)['developer_instructions'])
                self.assertEqual(actual['approval_policy'], 'never')
                self.assertEqual(actual['sandbox_mode'], 'danger-full-access')
                self.assertEqual(m.plan(h), [])

    def test_conflicting_permissions_vocabulary_stops_before_writing(self):
        with tempfile.TemporaryDirectory() as d:
            h = Path(d)
            (h / '.seedmux').mkdir()
            (h / '.codex').mkdir()
            (h / '.seedmux/config.toml').write_text('[agents]\n')
            (h / '.codex/config.toml').write_text('default_permissions = ":workspace"\nsandbox_mode = "workspace-write"\n')
            with self.assertRaises(ValueError):
                m.plan(h)
            self.assertEqual((h / '.seedmux/config.toml').read_text(), '[agents]\n')

    def test_concurrent_edit_is_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'config.toml'
            p.write_text('new=2\n')
            with self.assertRaises(RuntimeError):
                m.apply([(p, 'old=1\n', 'replacement=3\n')])
            self.assertEqual(p.read_text(), 'new=2\n')
if __name__ == '__main__':
    unittest.main()
