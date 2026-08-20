from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: check_pypi.py <project> <version> <dist-dir>")
    project, version, dist_dir = sys.argv[1:]
    try:
        with urllib.request.urlopen(f"https://pypi.org/pypi/{project}/{version}/json") as response:
            release = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        Path(os.environ["GITHUB_OUTPUT"]).write_text("publish=true\n")
        return
    remote = {item["filename"]: item["digests"]["sha256"] for item in release["urls"]}
    local = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in Path(dist_dir).iterdir()
        if path.suffix == ".whl" or path.name.endswith(".tar.gz")
    }
    if local != {name: remote.get(name) for name in local}:
        raise RuntimeError(f"PyPI already contains {project} {version} with different artifacts.")
    Path(os.environ["GITHUB_OUTPUT"]).write_text("publish=false\n")


if __name__ == "__main__":
    main()
