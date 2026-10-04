"""Pin the size and MD5 of every file a region pack downloads (model, map, icon atlas).

The app checks each download against these and discards anything else (truncated,
corrupted, an error page). Run after any pack file or pack JSON changes, e.g. after
training/vision/build_pack.py or build_icon_atlas.py:

    python3 tools/packs/pin_checksums.py

URLs must point into this repo (`.../critterboard/main/<path>`): the local file at
<path> is what gets hashed, so commit and push it together with the updated JSON.
"""
import hashlib, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]


def local_file(url):
    m = re.search(r"/critterboard/main/(.+)$", url)
    if not m or not (ROOT / m.group(1)).is_file():
        raise SystemExit(f"no local file for {url}")
    return ROOT / m.group(1)


def checksum(url):
    path = local_file(url)
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            md5.update(chunk)
    return path.stat().st_size, md5.hexdigest()


def pin(obj, url_key, bytes_key, md5_key):
    """Set bytes/md5 right after the URL key, keeping the rest of the key order."""
    if url_key not in obj:
        return obj
    size, md5 = checksum(obj[url_key])
    out = {}
    for k, v in obj.items():
        if k in (bytes_key, md5_key):
            continue
        out[k] = v
        if k == url_key:
            out[bytes_key], out[md5_key] = size, md5
    return out


for pack_path in sorted((ROOT / "packs").glob("*.json")):
    if pack_path.name == "manifest.json":
        continue
    pack = json.loads(pack_path.read_text())
    pack = pin(pack, "modelUrl", "modelBytes", "modelMd5")
    pack = pin(pack, "mapUrl", "mapBytes", "mapMd5")
    if "icons" in pack:
        pack["icons"] = pin(pack["icons"], "url", "bytes", "md5")
    pack_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n")
    print(f"pinned {pack_path.name}")
