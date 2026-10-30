# /// script
# requires-python = ">=3.9"
# dependencies = ["jsonschema>=4.23,<5", "pillow>=10"]
# ///
"""Validate avatar contracts, prepare model context, and compile safe scene data."""
import argparse
import json
import math
import shutil
import struct
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

from jsonschema import Draft202012Validator

SKILL = Path(__file__).resolve().parents[1]
ASSETS = SKILL / "assets"


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def load(path):
    def reject(value):
        raise ValueError("Non-finite JSON number: " + value)
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique_object, parse_constant=reject)


def validate(kind, value):
    schema = load(ASSETS / (kind + ".schema.json"))
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(value), key=lambda e: str(list(e.path)))
    if errors:
        raise ValueError("; ".join("$." + ".".join(map(str, e.path)) + ": " + e.message for e in errors[:5]))
    if kind == "scene":
        previous = None
        for index, command in enumerate(value["commands"]):
            time = command["time"]
            if not math.isfinite(time) or time >= value["duration"]:
                raise ValueError("Command time must be finite and inside [0, duration)")
            if previous is not None and time - previous < 0.5 - 1e-9:
                raise ValueError("Commands must be increasing and at least 0.5 s apart (index %d)" % index)
            previous = time
    if kind == "rig":
        for name, bounds in value["plannedChannels"].items():
            if not all(math.isfinite(n) for n in bounds) or bounds[0] > bounds[1]:
                raise ValueError("Invalid range for " + name)
        motion = value["motionProfile"]
        if motion["swayDegrees"] + motion["gestureLeanDegrees"] > value["limits"]["maximumBodyRotationDeg"]:
            raise ValueError("Combined body rotation exceeds rig limit")
    if kind == "portrait":
        mouth = value["mouth"]
        for name, box in [("mouth", mouth)] + [("eyes.boxes[%d]" % i, b) for i, b in enumerate(value.get("eyes", {}).get("boxes", []))]:
            if box["x"] + box["width"] > 1 or box["y"] + box["height"] > 1:
                raise ValueError(name + " box must fit the base canvas")
        ids = [layer["id"] for layer in value.get("layers", [])]
        if len(ids) != len(set(ids)):
            raise ValueError("Layer ids must be unique")
        for layer in value.get("layers", []):
            motion = layer.get("motion")
            if motion and "origin" not in layer:
                raise ValueError("Layer %s has motion but no origin (pivot)" % layer["id"])
            if motion and motion.get("active", 3.6) > motion.get("cycle", 5.4):
                raise ValueError("Layer %s: motion.active must not exceed motion.cycle" % layer["id"])
    return value


def source_asset(asset, root):
    if asset.startswith("data:image/"):
        return None
    url = urlsplit(asset)
    if url.scheme or url.netloc or Path(unquote(url.path)).is_absolute():
        raise ValueError("Use project-relative image paths or data:image assets: " + asset)
    path = (root / unquote(url.path)).resolve()
    if root.resolve() not in path.parents:
        raise ValueError("Asset escapes project: " + asset)
    if not path.is_file():
        raise ValueError("Missing asset: " + str(path))
    return path


def image_paths(pack):
    if pack.get("kind") == "talking-portrait":
        return [pack["base"]] + [layer["src"] for layer in pack.get("layers", [])]
    layers = pack["layers"]
    return [layers["base"]] + list(layers["eyes"].values()) + list(layers["mouth"].values()) + list(layers["poses"].values())


def check_pack_files(pack, root):
    # Portrait layers with explicit width/height are placed parts, not full-canvas layers: skip the size match.
    placed = {layer["src"] for layer in pack.get("layers", []) if "width" in layer or "height" in layer} \
        if pack.get("kind") == "talking-portrait" else set()
    for asset in image_paths(pack):
        path = source_asset(asset, root)
        if path and path.suffix.lower() == ".png":
            header = path.read_bytes()[:24]
            if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
                raise ValueError("Invalid PNG: " + asset)
            if asset not in placed and list(struct.unpack(">II", header[16:24])) != pack.get("size", pack.get("gridSize")):
                raise ValueError("PNG dimensions do not match gridSize: " + asset)


def compile_scene(scene, pack, envelope=None, design=None, scale=4, position="bottom-right", rendering="pixelated"):
    validate("scene", scene)
    portrait = pack.get("kind") == "talking-portrait"
    validate("portrait" if portrait else "pack", pack)
    if scene["characterId"] != pack["id"]:
        raise ValueError("scene.characterId must match pack.id")
    if design is not None:
        validate("design", design)
        if design["id"] != pack["id"] or design["status"] != "validated":
            raise ValueError("Design must match the pack and be marked validated after layer QA")
    for command in scene["commands"]:
        if portrait:
            if command["pose"] != "idle" or command.get("emotion", "open") != "open":
                raise ValueError("Portrait profile supports idle and an audio-driven mouth, not independent arms/eyes")
            if command.get("bounce"):
                raise ValueError("Portrait profile has no bounce: blinking, layer sway and pause-timed body beats are automatic")
            continue
        if command["pose"] not in pack["layers"]["poses"]:
            raise ValueError("Pack does not contain pose: " + command["pose"])
        if command.get("emotion") == "surprised" and "surprised" not in pack["layers"]["eyes"]:
            raise ValueError("Pack lacks surprised eye artwork")
    if envelope is None:
        envelope = {"audioFps": 30, "audioEnvelope": []}
    audio_schema = {
        "type": "object", "additionalProperties": False, "required": ["audioFps", "audioEnvelope"],
        "properties": {"audioFps": {"type": "number", "exclusiveMinimum": 0, "maximum": 240},
                       "audioEnvelope": {"type": "array", "items": {"type": "number", "minimum": 0, "maximum": 1}}},
    }
    errors = list(Draft202012Validator(audio_schema).iter_errors(envelope))
    if errors:
        raise ValueError("Invalid audio envelope: " + errors[0].message)
    if not math.isfinite(envelope["audioFps"]) or any(not math.isfinite(value) for value in envelope["audioEnvelope"]):
        raise ValueError("Audio envelope values must be finite")
    if not math.isfinite(scale) or not 0 < scale <= 12:
        raise ValueError("scale must be finite and in (0, 12]")
    motion = load(ASSETS / "motion-presets.json")[scene["motionPreset"]]
    if portrait:
        return {"pack": pack, **envelope, "width": scale * 96, "position": position}
    return {"pack": pack, **envelope, "poseKeyframes": scene["commands"], "motionProfile": motion,
            "scale": scale, "position": position, "imageRendering": rendering}


def _pil():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise ValueError("Pillow is required for grid/overlay/sample: run through `uv run` (inline dependencies)")
    return Image, ImageDraw


def grid(image, out, step=0.1):
    """Copy of the image with a labelled normalized grid, so a vision model can read x/y/width/height of features."""
    Image, ImageDraw = _pil()
    if not 0 < step <= 0.5:
        raise ValueError("step must be in (0, 0.5]")
    picture = Image.open(image).convert("RGBA")
    background = Image.new("RGBA", picture.size, (255, 255, 255, 255))
    background.alpha_composite(picture)
    draw = ImageDraw.Draw(background)
    w, h = picture.size
    for i in range(int(1 / step) + 1):
        v = round(i * step, 4)
        draw.line([(v * w, 0), (v * w, h)], fill=(255, 0, 0, 255), width=1)
        draw.line([(0, v * h), (w, v * h)], fill=(0, 0, 255, 255), width=1)
        draw.text((v * w + 3, 3), "x%.2f" % v, fill=(255, 0, 0, 255))
        draw.text((3, v * h + 3), "y%.2f" % v, fill=(0, 0, 255, 255))
    write_new_image(background, out)


def overlay(pack, image, out):
    """Draw mouth/eye boxes and layer pivots on the base, to check measured coordinates before building."""
    Image, ImageDraw = _pil()
    validate("portrait", pack)
    picture = Image.open(image).convert("RGBA")
    if list(picture.size) != pack["size"]:
        raise ValueError("Image size %s does not match pack.size %s" % (list(picture.size), pack["size"]))
    background = Image.new("RGBA", picture.size, (255, 255, 255, 255))
    background.alpha_composite(picture)
    draw = ImageDraw.Draw(background)
    w, h = pack["size"]
    boxes = [("mouth", pack["mouth"], (255, 0, 0, 255))] + [("eye", b, (0, 160, 0, 255)) for b in pack.get("eyes", {}).get("boxes", [])]
    for label, b, color in boxes:
        draw.rectangle([b["x"] * w, b["y"] * h, (b["x"] + b["width"]) * w, (b["y"] + b["height"]) * h], outline=color, width=3)
        draw.text((b["x"] * w, b["y"] * h - 12), label, fill=color)
    for layer in pack.get("layers", []):
        if "origin" in layer:
            x, y = layer["origin"]
            draw.ellipse([x - 8, y - 8, x + 8, y + 8], outline=(255, 0, 255, 255), width=3)
            draw.text((x + 10, y - 6), layer["id"], fill=(255, 0, 255, 255))
    write_new_image(background, out)


def sample(image, x, y, radius=3):
    """Median colour (#rrggbb) around a normalized point of the opaque image: for eyes.color / palette values."""
    Image, _ = _pil()
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise ValueError("x and y are normalized, in [0, 1]")
    picture = Image.open(image).convert("RGBA")
    px, py = round(x * (picture.width - 1)), round(y * (picture.height - 1))
    pixels = [picture.getpixel((i, j)) for i in range(max(0, px - radius), min(picture.width, px + radius + 1))
              for j in range(max(0, py - radius), min(picture.height, py + radius + 1))]
    opaque = [p for p in pixels if p[3] > 200]
    if not opaque:
        raise ValueError("Point is transparent: sample a point on the character")
    return "#%02X%02X%02X" % tuple(sorted(p[c] for p in opaque)[len(opaque) // 2] for c in range(3))


def _hex(color):
    if not (isinstance(color, str) and len(color) == 7 and color[0] == "#"):
        raise ValueError("Colour must look like #00FF00")
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def chroma(image, out, key="#00FF00", tolerance=60, softness=50):
    """Flat-colour background -> real alpha. Pixels near `key` become transparent; the edge ramp is un-mixed from the key
    (c = (p - (1-a)*key) / a), which removes the coloured fringe. The character must not contain the key colour."""
    Image, _ = _pil()
    k = _hex(key)
    if tolerance < 0 or softness <= 0:
        raise ValueError("tolerance must be >= 0 and softness > 0")
    picture = Image.open(image).convert("RGB")
    w, h = picture.size
    dist = lambda p: math.dist(p, k)
    dominant = [i for i in range(3) if k[i] >= 128]   # channels the key is made of (green: [1], magenta: [0, 2])
    others = [i for i in range(3) if k[i] < 128] if len(dominant) < 3 else []
    corners = [picture.getpixel(c) for c in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if any(dist(c) > tolerance + softness for c in corners):
        raise ValueError("Image corners are not the key colour %s: regenerate on a flat background of that colour" % key)
    pixels, result, clear, edge = picture.getdata(), [], 0, 0
    for p in pixels:
        d = dist(p)
        if d <= tolerance:
            result.append((0, 0, 0, 0)); clear += 1
        else:
            a = min(1.0, (d - tolerance) / softness)
            if others and min(p[i] for i in dominant) - max(p[i] for i in others) >= 20 and d < tolerance + 2.5 * softness:
                # key-tinted pixel beyond the ramp (thin whisker/hair mixed into the background): smallest alpha that
                # can explain it as foreground over the key colour
                a = min(a, max([p[i] / 255 for i in others] + [1 - p[i] / k[i] for i in dominant]))
            if a >= 0.98:
                result.append(p + (255,))
                continue
            a = max(a, 1 / 255)
            c = [max(0, min(255, round((p[i] - (1 - a) * k[i]) / a))) for i in range(3)]
            if others:  # edge-only despill: thin hairs/whiskers are almost pure key colour, un-mixing alone leaves a tint
                limit = max(c[i] for i in others)
                for i in dominant:
                    c[i] = min(c[i], limit)
            result.append(tuple(c) + (round(a * 255),)); edge += 1
    keyed = Image.new("RGBA", (w, h))
    keyed.putdata(result)
    if clear == w * h:
        raise ValueError("Everything was keyed out: the character contains the key colour; choose another --key")
    path = Path(out)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as output:
        keyed.save(output, format="PNG")
    return {"transparentPct": round(100 * clear / (w * h), 1), "edgePixels": edge}


def composite(image, out):
    """The RGBA image side by side on white, near-black and magenta: halos and fringes show on at least one of them."""
    Image, _ = _pil()
    picture = Image.open(image).convert("RGBA")
    sheet = Image.new("RGBA", (picture.width * 3, picture.height))
    for i, color in enumerate(((255, 255, 255, 255), (17, 17, 17, 255), (255, 0, 255, 255))):
        tile = Image.new("RGBA", picture.size, color)
        tile.alpha_composite(picture)
        sheet.paste(tile, (i * picture.width, 0))
    write_new_image(sheet, out)


def write_new_image(image, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as output:
        image.convert("RGB").save(output, format="PNG")


def write_new(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as output:
        output.write(content)


def emit_config(path, config):
    text = json.dumps(config, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    write_new(path, ("export default " + text + ";\n") if Path(path).suffix in (".js", ".mjs") else text + "\n")


def prompt(design):
    validate("design", design)
    identity = design["identity"]
    features = [identity[key] for key in ("kind", "presentation", "hair", "outfit", "silhouette") if key in identity]
    features.extend(identity.get("features", []))
    return "\n".join([
        "Use case: stylized-concept. Asset: character model sheet for animation.",
        "Character: " + "; ".join(features) + ".",
        "Style: " + design["render"]["style"] + "; " + design["render"]["shading"] + ".",
        "Palette: " + ", ".join(key + "=" + value for key, value in design["palette"].items()) + ".",
        "Framing: " + str(design["render"]["referenceCanvas"]) + "; background: one flat solid " + design["render"]["background"] + " colour, no shadow, no gradient, no floor, no texture.",
        "Poses: " + ", ".join(design["poseSet"]) + ". Keep consistent proportions, separate figures and complete species-appropriate extremities.",
        "Invariants: " + "; ".join(identity["invariants"]) + ".",
        "Avoid: " + "; ".join(design["avoid"]) + ". No labels or watermarks.",
        "This is reference art; do not claim the result is an aligned transparent layer pack.",
    ])


def scaffold(args):
    scene = load(args.scene)
    pack = load(args.pack)
    config = compile_scene(scene, pack, scale=args.scale, position=args.position, rendering=args.rendering)
    root = Path(args.project).resolve()
    if root.exists():
        raise ValueError("Scaffold requires a new directory; target already exists")
    asset_root = Path(args.asset_root or Path(args.pack).parent).resolve()
    check_pack_files(pack, asset_root)
    gsap = Path(args.gsap).resolve()
    if not gsap.is_file():
        raise ValueError("Provide an existing local GSAP bundle with --gsap")
    audio = Path(args.audio).resolve() if args.audio else None
    if audio and not audio.is_file():
        raise ValueError("Audio does not exist")
    shutil.copytree(ASSETS / "runtime", root)
    (root / "lib").mkdir()
    shutil.copyfile(gsap, root / "lib/gsap.min.js")
    for asset in image_paths(pack):
        source = source_asset(asset, asset_root)
        if source:
            destination = root / unquote(urlsplit(asset).path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not destination.exists():
                shutil.copyfile(source, destination)
    audio_markup = ""
    if audio:
        audio_file = root / "assets/audio" / ("voice" + audio.suffix.lower())
        audio_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(audio, audio_file)
        envelope_file = root / "assets/avatar/envelope.json"
        envelope_file.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["node", str(root / "scripts/audio-envelope.js"), str(audio_file), str(envelope_file), "30"], check=True, stdout=subprocess.DEVNULL)
        config = compile_scene(scene, pack, load(envelope_file), scale=args.scale, position=args.position, rendering=args.rendering)
        audio_markup = '<audio id="voice" class="clip" src="assets/audio/' + audio_file.name + '" data-start="0" data-duration="' + str(scene["duration"]) + '" data-track-index="2" data-volume="1"></audio>'
    emit_config(root / "assets/avatar/config.js", config)
    for template in ("index.html", "compositions/avatar.html"):
        text = (ASSETS / "templates" / (template + ".template")).read_text(encoding="utf-8")
        write_new(root / template, text.replace("__DURATION__", str(scene["duration"])).replace("__AUDIO__", audio_markup))
    print(json.dumps({"ok": True, "project": str(root), "duration": scene["duration"]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    check = commands.add_parser("validate")
    check.add_argument("kind", choices=["design", "rig", "scene", "pack", "portrait"])
    check.add_argument("file")
    generate = commands.add_parser("prompt")
    generate.add_argument("--design", required=True)
    generate.add_argument("--out")
    brief = commands.add_parser("brief")
    brief.add_argument("--pack", required=True)
    grid_parser = commands.add_parser("grid")
    grid_parser.add_argument("image")
    grid_parser.add_argument("--out", required=True)
    grid_parser.add_argument("--step", type=float, default=0.1)
    chroma_parser = commands.add_parser("chroma")
    chroma_parser.add_argument("image")
    chroma_parser.add_argument("--out", required=True)
    chroma_parser.add_argument("--key", default="#00FF00")
    chroma_parser.add_argument("--tolerance", type=float, default=60)
    chroma_parser.add_argument("--softness", type=float, default=50)
    composite_parser = commands.add_parser("composite")
    composite_parser.add_argument("image")
    composite_parser.add_argument("--out", required=True)
    overlay_parser = commands.add_parser("overlay")
    overlay_parser.add_argument("--pack", required=True)
    overlay_parser.add_argument("--image", required=True)
    overlay_parser.add_argument("--out", required=True)
    sample_parser = commands.add_parser("sample")
    sample_parser.add_argument("image")
    sample_parser.add_argument("x", type=float)
    sample_parser.add_argument("y", type=float)
    compile_parser = commands.add_parser("compile")
    scaffold_parser = commands.add_parser("scaffold")
    for subparser in (compile_parser, scaffold_parser):
        subparser.add_argument("--scene", required=True)
        subparser.add_argument("--pack", required=True)
        subparser.add_argument("--scale", type=float, default=4)
        subparser.add_argument("--position", choices=["bottom-left", "bottom-right"], default="bottom-right")
        subparser.add_argument("--rendering", choices=["pixelated", "auto"], default="pixelated")
    compile_parser.add_argument("--envelope")
    compile_parser.add_argument("--design")
    compile_parser.add_argument("--asset-root")
    compile_parser.add_argument("--out", required=True)
    scaffold_parser.add_argument("--asset-root")
    scaffold_parser.add_argument("--project", required=True)
    scaffold_parser.add_argument("--gsap", required=True)
    scaffold_parser.add_argument("--audio")
    args = parser.parse_args()
    if args.action == "validate":
        validate(args.kind, load(args.file))
        print(json.dumps({"ok": True, "kind": args.kind}))
    elif args.action == "grid":
        grid(args.image, args.out, args.step)
        print(json.dumps({"ok": True, "output": args.out}))
    elif args.action == "chroma":
        print(json.dumps({"ok": True, "output": args.out, **chroma(args.image, args.out, args.key, args.tolerance, args.softness)}))
    elif args.action == "composite":
        composite(args.image, args.out)
        print(json.dumps({"ok": True, "output": args.out}))
    elif args.action == "overlay":
        overlay(load(args.pack), args.image, args.out)
        print(json.dumps({"ok": True, "output": args.out}))
    elif args.action == "sample":
        print(json.dumps({"ok": True, "color": sample(args.image, args.x, args.y)}))
    elif args.action == "prompt":
        text = prompt(load(args.design)) + "\n"
        if args.out:
            write_new(args.out, text)
        else:
            print(text, end="")
    elif args.action == "brief":
        pack = load(args.pack)
        portrait = pack.get("kind") == "talking-portrait"
        validate("portrait" if portrait else "pack", pack)
        print(json.dumps({"task": "Return one scene JSON object only. Do not generate code, artwork or RMS.",
                          "version": 1, "characterId": pack["id"], "required": ["duration", "motionPreset", "commands"],
                          "poses": ["idle"] if portrait else [p for p in ("idle", "point_viewer", "point_up", "shrug", "fist") if p in pack["layers"]["poses"]],
                          "emotions": ["open", "surprised"] if not portrait and "surprised" in pack["layers"]["eyes"] else ["open"],
                          "motionPresets": ["off", "subtle", "lively"],
                          "commandKeys": ["time", "pose", "emotion", "bounce"],
                          "timing": "seconds, increasing, >=0.5 s apart, 0 <= time < duration",
                          "notSupported": ["phonemes", "headTilt", "gaze", "brow controls", "new pose names"]
                          + (["arm or hand gestures", "scratching", "eye emotions"] if portrait else []),
                          "automatic": (["mouth from RMS", "blinking"] if pack.get("eyes") else ["mouth from RMS"])
                          + ["layer sway: " + layer["id"] for layer in pack.get("layers", []) if "motion" in layer]
                          + ["pauses-only body beats"] if portrait else ["mouth from RMS", "blinking"]}, separators=(",", ":")))
    elif args.action == "compile":
        pack = load(args.pack)
        if args.asset_root:
            check_pack_files(validate("portrait" if pack.get("kind") == "talking-portrait" else "pack", pack), Path(args.asset_root).resolve())
        config = compile_scene(load(args.scene), pack, load(args.envelope) if args.envelope else None,
                               load(args.design) if args.design else None, args.scale, args.position, args.rendering)
        emit_config(args.out, config)
        print(json.dumps({"ok": True, "output": args.out, "commands": len(load(args.scene)["commands"])}))
    elif args.action == "scaffold":
        scaffold(args)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        sys.exit(1)
