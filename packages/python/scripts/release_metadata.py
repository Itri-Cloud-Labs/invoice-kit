from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from packaging.version import InvalidVersion, Version


def resolve(tag: str) -> dict[str, str]:
    if not tag.startswith("python-v"):
        raise ValueError("Python release tags must start with python-v.")
    tag_version = tag.removeprefix("python-v")
    manifest = Path(__file__).parents[1] / "pyproject.toml"
    match = re.search(r'^version = "([^"]+)"$', manifest.read_text(), re.MULTILINE)
    if not match:
        raise ValueError("Python package version is missing from pyproject.toml.")
    package_version = match.group(1)
    if tag_version != package_version:
        raise ValueError(
            f"Tag version {tag_version} does not match Python package version {package_version}."
        )
    try:
        parsed = Version(package_version)
    except InvalidVersion as error:
        raise ValueError(f"Invalid Python package version: {package_version}.") from error
    return {"version": package_version, "prerelease": str(parsed.is_prerelease).lower()}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: release_metadata.py <tag> <output-path>")
    with Path(sys.argv[2]).open("a", encoding="utf-8") as handle:
        for name, value in resolve(sys.argv[1]).items():
            handle.write(f"{name}={value}{os.linesep}")


if __name__ == "__main__":
    main()
