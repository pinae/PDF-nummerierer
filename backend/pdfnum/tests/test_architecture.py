"""Architecture guard: the stamping library must stay framework-free (see AGENTS.md)."""

import ast
from pathlib import Path

STAMPING_DIR = Path(__file__).resolve().parents[2] / "stamping"


def _imported_modules(source: str) -> set[str]:
    modules = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            modules.add(node.module)
    return modules


def test_stamping_package_exists():
    assert (STAMPING_DIR / "__init__.py").is_file()


def test_stamping_package_does_not_import_django():
    offenders = {
        str(path.relative_to(STAMPING_DIR)): sorted(
            m for m in _imported_modules(path.read_text()) if m.split(".")[0] == "django"
        )
        for path in STAMPING_DIR.rglob("*.py")
    }
    offenders = {path: mods for path, mods in offenders.items() if mods}

    assert offenders == {}
