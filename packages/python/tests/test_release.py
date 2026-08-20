from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1] / "scripts"


def load(name: str) -> object:
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_release_metadata() -> None:
    metadata = load("release_metadata")
    assert metadata.resolve("python-v0.1.0") == {  # type: ignore[attr-defined]
        "version": "0.1.0",
        "prerelease": "false",
    }
    with pytest.raises(ValueError, match="does not match"):
        metadata.resolve("python-v0.2.0")  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="must start"):
        metadata.resolve("v0.1.0")  # type: ignore[attr-defined]


def test_release_notes_cases() -> None:
    notes = load("release_notes")
    changelog = "# Changelog\n\n## 2.0.0\n\n- Current\n\n## 1.0.0\n\n- Oldest\n"
    assert notes.extract("2.0.0", changelog) == "- Current\n"  # type: ignore[attr-defined]
    assert notes.extract("1.0.0", changelog) == "- Oldest\n"  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="missing"):
        notes.extract("3.0.0", changelog)  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="duplicate"):
        notes.extract("2.0.0", changelog + "\n## 2.0.0\n\n- Again\n")  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="empty"):
        notes.extract("2.0.0", "## 2.0.0\n\n## 1.0.0\n\n- Old\n")  # type: ignore[attr-defined]
