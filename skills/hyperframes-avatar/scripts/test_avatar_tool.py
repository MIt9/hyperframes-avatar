# /// script
# requires-python = ">=3.9"
# dependencies = ["jsonschema>=4.23,<5", "pillow>=10"]
# ///
import argparse
import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path

import avatar_tool as tool


class AvatarToolTests(unittest.TestCase):
    def setUp(self):
        self.scene = tool.load(tool.ASSETS / "scene.example.json")
        self.pack = tool.load(tool.ASSETS / "demo-pack.json")

    def test_examples_and_schemas(self):
        for kind in ("design", "rig", "scene"):
            tool.validate(kind, tool.load(tool.ASSETS / (kind + ".example.json")))
        tool.validate("pack", self.pack)

    def test_compiles_supported_motion_and_preserves_inputs(self):
        original = copy.deepcopy(self.scene)
        envelope = {"audioFps": 30, "audioEnvelope": [0, 0.2, 0.4]}
        result = tool.compile_scene(self.scene, self.pack, envelope)
        self.assertEqual(result["motionProfile"]["poseTransition"], 0.12)
        self.assertEqual(result["poseKeyframes"], self.scene["commands"])
        self.assertEqual(result["audioEnvelope"], envelope["audioEnvelope"])
        self.assertEqual(self.scene, original)

    def test_unknown_controls_and_emotions_are_rejected(self):
        for key, value in (("headTilt", 10), ("emotion", "happy"), ("pose", "dance")):
            scene = copy.deepcopy(self.scene)
            scene["commands"][1][key] = value
            with self.assertRaises(ValueError):
                tool.compile_scene(scene, self.pack)

    def test_invalid_timing_is_rejected(self):
        for time in (-1, 0, 0.2, self.scene["duration"], float("inf")):
            scene = copy.deepcopy(self.scene)
            scene["commands"][1]["time"] = time
            with self.assertRaises(ValueError):
                tool.validate("scene", scene)

    def test_identity_missing_pose_and_missing_emotion_art(self):
        for change in ("identity", "pose", "eyes"):
            pack = copy.deepcopy(self.pack)
            if change == "identity":
                pack["id"] = "another-character"
            elif change == "pose":
                del pack["layers"]["poses"]["point_up"]
            else:
                del pack["layers"]["eyes"]["surprised"]
            with self.assertRaises(ValueError):
                tool.compile_scene(self.scene, pack)

    def test_unprepared_art_is_not_silently_accepted_as_a_rig(self):
        design = tool.load(tool.ASSETS / "design.example.json")
        scene = copy.deepcopy(self.scene)
        pack = copy.deepcopy(self.pack)
        scene["characterId"] = design["id"]
        pack["id"] = design["id"]
        with self.assertRaisesRegex(ValueError, "validated"):
            tool.compile_scene(scene, pack, design=design)

    def test_envelope_rejects_non_finite_and_out_of_range_samples(self):
        for envelope in ({"audioFps": 0, "audioEnvelope": []}, {"audioFps": 30, "audioEnvelope": [2]},
                         {"audioFps": 30, "audioEnvelope": [float("nan")]}):
            with self.assertRaises(ValueError):
                tool.compile_scene(self.scene, self.pack, envelope)

    def test_duplicate_json_keys_and_overwrite_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text('{"pose":"idle","pose":"fist"}')
            with self.assertRaises(ValueError):
                tool.load(path)
            with self.assertRaises(FileExistsError):
                tool.emit_config(path, {})

    def test_file_checks_reject_missing_and_escaping_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            for asset in ("missing.png", "../outside.png", "https://example.com/avatar.png"):
                with self.assertRaises(ValueError):
                    tool.source_asset(asset, Path(directory))

    def test_prompt_contains_identity_without_claiming_layer_readiness(self):
        design = tool.load(tool.ASSETS / "design.example.json")
        prompt = tool.prompt(design)
        self.assertIn(design["palette"]["hoodie"], prompt)
        self.assertIn(design["identity"]["hair"], prompt)
        self.assertIn("reference art", prompt)

    def test_non_human_tokens_do_not_require_human_skin_or_clothes(self):
        design = tool.load(tool.ASSETS / "design.example.json")
        design["identity"] = {"kind": "striped-cat", "presentation": "friendly tabby",
                              "silhouette": "cat ears and curled tail", "features": ["striped ginger fur", "cat paws"],
                              "invariants": ["same forehead stripes"]}
        design["palette"] = {"ink": "#24283B", "furBase": "#D99D70", "furStripe": "#BA7954"}
        del design["proportions"]["handToHeadWidth"]
        design["proportions"]["pawToHeadWidth"] = 0.22
        result = tool.prompt(design)
        self.assertIn("striped ginger fur", result)
        self.assertIn("cat paws", result)
        self.assertNotIn("hoodie", result)

    def test_scaffold_wires_audio_and_local_runtime(self):
        if not shutil.which("node") or not shutil.which("ffmpeg"):
            self.skipTest("node/ffmpeg unavailable")
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            gsap = base / "gsap.min.js"
            gsap.write_text("/* local test bundle */")
            audio = base / "voice.wav"
            with wave.open(str(audio), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(8000)
                output.writeframes(b"\0\0" * 8000)
            target = base / "new-project"
            args = argparse.Namespace(scene=str(tool.ASSETS / "scene.example.json"), pack=str(tool.ASSETS / "demo-pack.json"),
                                      project=str(target), asset_root=None, gsap=str(gsap), audio=str(audio),
                                      scale=4, position="bottom-right", rendering="pixelated")
            tool.scaffold(args)
            self.assertTrue((target / "src/hyperframes.js").is_file())
            self.assertEqual((target / "lib/gsap.min.js").read_text(), gsap.read_text())
            self.assertIn('src="assets/audio/voice.wav"', (target / "index.html").read_text())
            self.assertNotIn("__DURATION__", (target / "compositions/avatar.html").read_text())
            envelope = tool.load(target / "assets/avatar/envelope.json")
            self.assertEqual(len(envelope["audioEnvelope"]), 30)
            with self.assertRaisesRegex(ValueError, "already exists"):
                tool.scaffold(args)

    def test_portrait_profile_compiles_real_mouth_and_rejects_fake_arm_controls(self):
        pack = tool.load(tool.ASSETS / "portrait.example.json")
        scene = {"version":1,"characterId":pack["id"],"duration":3,"motionPreset":"subtle",
                 "commands":[{"time":0,"pose":"idle"},{"time":1,"pose":"idle"}]}
        envelope = {"audioFps":30,"audioEnvelope":[0,0.2,0.5]}
        result = tool.compile_scene(scene,pack,envelope)
        self.assertEqual(result["audioEnvelope"],envelope["audioEnvelope"])
        self.assertNotIn("accentKeyframes",result)
        self.assertEqual(result["width"],384)
        self.assertEqual(result["pack"]["eyes"]["boxes"][0]["x"],0.405)
        scene["commands"][1]["bounce"]=True
        with self.assertRaisesRegex(ValueError,"no bounce"):
            tool.compile_scene(scene,pack,envelope)
        scene["commands"][1]["bounce"]=False
        scene["commands"][1]["pose"]="point_up"
        with self.assertRaisesRegex(ValueError,"Portrait profile"):
            tool.compile_scene(scene,pack,envelope)

    def test_portrait_validates_eyes_layers_and_motion(self):
        def bad(change):
            pack = copy.deepcopy(tool.load(tool.ASSETS / "portrait.example.json"))
            change(pack)
            with self.assertRaises(ValueError):
                tool.validate("portrait",pack)
        bad(lambda p:p["eyes"]["boxes"].append({"x":0.95,"y":0.2,"width":0.1,"height":0.05}))
        bad(lambda p:p["eyes"].update(color="red"))
        bad(lambda p:p["layers"][0].pop("origin"))
        bad(lambda p:p["layers"][0]["motion"].update(amplitude=45))
        bad(lambda p:p["layers"][0]["motion"].update(active=9))
        bad(lambda p:p["layers"].append(copy.deepcopy(p["layers"][0])))

    def test_brief_lists_only_real_portrait_abilities(self):
        pack = tool.load(tool.ASSETS / "portrait.example.json")
        out = subprocess.run([sys.executable,str(Path(tool.__file__)),"brief","--pack",str(tool.ASSETS / "portrait.example.json")],
                             capture_output=True,text=True,check=True).stdout
        brief = json.loads(out)
        self.assertEqual(brief["poses"],["idle"])
        self.assertIn("layer sway: tail",brief["automatic"])
        self.assertIn("blinking",brief["automatic"])
        self.assertIn("scratching",brief["notSupported"])

    def test_scaffold_copies_portrait_layers_and_checks_sizes(self):
        if not shutil.which("node"):
            self.skipTest("node unavailable")
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            assets = base / "art/assets/avatar"
            assets.mkdir(parents=True)
            pack = tool.load(tool.ASSETS / "portrait.example.json")
            pack["size"] = [200,200]
            Image.new("RGBA",(200,200)).save(assets / "base-mouthless.png")
            Image.new("RGBA",(200,200)).save(assets / "tail.png")
            pack["layers"][0]["origin"] = [50,150]
            (base / "pack.json").write_text(json.dumps(pack))
            (base / "gsap.min.js").write_text("/* local */")
            args = argparse.Namespace(scene=str(tool.ASSETS / "scene.example.json"),pack=str(base / "pack.json"),project=str(base / "out"),
                                      asset_root=str(base / "art"),gsap=str(base / "gsap.min.js"),audio=None,scale=4,
                                      position="bottom-right",rendering="auto")
            scene = tool.load(tool.ASSETS / "scene.example.json")
            scene["characterId"] = "portrait-example"
            scene["commands"] = [{"time":0,"pose":"idle"}]
            (base / "scene.json").write_text(json.dumps(scene))
            args.scene = str(base / "scene.json")
            tool.scaffold(args)
            self.assertTrue((base / "out/assets/avatar/tail.png").is_file())
            self.assertTrue((base / "out/src/motion.js").is_file())
            Image.new("RGBA",(100,100)).save(assets / "tail.png")
            args.project = str(base / "out2")
            with self.assertRaisesRegex(ValueError,"dimensions"):
                tool.scaffold(args)

    def test_chroma_key_makes_clean_alpha_and_rejects_bad_input(self):
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            art = Image.new("RGB", (80, 80), (0, 255, 0))
            draw = ImageDraw.Draw(art)
            draw.ellipse([20, 20, 60, 60], fill=(200, 40, 40))           # character
            draw.ellipse([17, 17, 63, 63], outline=(100, 148, 20), width=1)  # green-mixed edge pixels
            art.save(base / "art.png")
            report = tool.chroma(base / "art.png", base / "keyed.png")
            keyed = Image.open(base / "keyed.png")
            self.assertEqual(keyed.getpixel((2, 2))[3], 0)               # background gone
            self.assertEqual(keyed.getpixel((40, 40)), (200, 40, 40, 255))  # character intact
            self.assertGreater(report["transparentPct"], 40)
            for x in range(80):                                          # no green fringe left on semi-transparent pixels
                r, g, b, a = keyed.getpixel((x, 40))
                if 0 < a < 255:
                    self.assertLess(g, max(r, b) + 40)
            with self.assertRaises(FileExistsError):
                tool.chroma(base / "art.png", base / "keyed.png")
            # a thin white whisker antialiased 35 % into each key colour must not keep a tint
            for name, key in (("green", (0, 255, 0)), ("magenta", (255, 0, 255))):
                whisker = Image.new("RGB", (40, 40), key)
                for x in range(40):
                    whisker.putpixel((x, 20), tuple(round(0.35 * 255 + 0.65 * c) for c in key))
                whisker.save(base / (name + ".png"))
                tool.chroma(base / (name + ".png"), base / (name + "-k.png"), "#%02X%02X%02X" % key)
                r, g, b, a = Image.open(base / (name + "-k.png")).getpixel((20, 20))
                self.assertGreater(a, 0)
                self.assertLess(g - max(r, b) if name == "green" else max(r, b) - g, 30, (name, r, g, b, a))
            Image.new("RGB", (20, 20), (30, 30, 30)).save(base / "dark.png")
            with self.assertRaisesRegex(ValueError, "corners"):
                tool.chroma(base / "dark.png", base / "x.png")
            Image.new("RGB", (20, 20), (0, 255, 0)).save(base / "all.png")
            with self.assertRaisesRegex(ValueError, "Everything"):
                tool.chroma(base / "all.png", base / "y.png")
            tool.composite(base / "keyed.png", base / "sheet.png")
            with Image.open(base / "sheet.png") as sheet:
                self.assertEqual(sheet.size, (240, 80))
                self.assertEqual(sheet.getpixel((2, 2)), (255, 255, 255))
                self.assertEqual(sheet.getpixel((82, 2)), (17, 17, 17))
                self.assertEqual(sheet.getpixel((162, 2)), (255, 0, 255))

    def test_grid_overlay_and_sample_helpers(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            Image.new("RGBA",(100,100),(200,100,50,255)).save(base / "base.png")
            self.assertEqual(tool.sample(base / "base.png",0.5,0.5),"#C86432")
            Image.new("RGBA",(100,100),(0,0,0,0)).save(base / "empty.png")
            with self.assertRaisesRegex(ValueError,"transparent"):
                tool.sample(base / "empty.png",0.5,0.5)
            tool.grid(base / "base.png",base / "grid.png")
            self.assertEqual(Image.open(base / "grid.png").size,(100,100))
            with self.assertRaises(FileExistsError):
                tool.grid(base / "base.png",base / "grid.png")
            pack = tool.load(tool.ASSETS / "portrait.example.json")
            pack["size"] = [100,100]
            tool.overlay(pack,base / "base.png",base / "overlay.png")
            self.assertTrue((base / "overlay.png").is_file())
            pack["size"] = [101,100]
            with self.assertRaisesRegex(ValueError,"does not match"):
                tool.overlay(pack,base / "base.png",base / "overlay2.png")

    def test_portrait_rejects_painted_mouth_and_invalid_box(self):
        for key,value in (("mouthlessBase",False),("mouth",{"style":"human","x":0.99,"y":0.3,"width":0.2,"height":0.1,"ink":"#111111","teeth":"#FFFFFF","tongue":"#AA6666"})):
            pack = tool.load(tool.ASSETS / "portrait.example.json")
            pack[key]=value
            with self.assertRaises(ValueError):
                tool.validate("portrait",pack)


if __name__ == "__main__":
    unittest.main()
