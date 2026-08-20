from __future__ import annotations

import re
import sys
from pathlib import Path


def extract(version: str, changelog: str) -> str:
    matches = list(re.finditer(rf"^## {re.escape(version)}\s*$", changelog, re.MULTILINE))
    if len(matches) != 1:
        qualifier = "missing" if not matches else "duplicate"
        raise ValueError(f"Changelog section for {version} is {qualifier}.")
    start = matches[0].end()
    next_heading = re.search(r"^## \S+\s*$", changelog[start:], re.MULTILINE)
    end = start + next_heading.start() if next_heading else len(changelog)
    notes = changelog[start:end].strip()
    if not notes:
        raise ValueError(f"Changelog section for {version} is empty.")
    return notes + "\n"


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: release_notes.py <version> <output-path>")
    changelog = (Path(__file__).parents[1] / "CHANGELOG.md").read_text()
    Path(sys.argv[2]).write_text(extract(sys.argv[1], changelog))


if __name__ == "__main__":
    main()
