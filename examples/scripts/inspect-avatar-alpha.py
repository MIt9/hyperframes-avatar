# /// script
# requires-python = ">=3.9"
# dependencies = ["Pillow>=10,<12"]
# ///
"""Read-only alpha diagnostics; does not modify artwork."""
import json
import sys
from PIL import Image

for path in sys.argv[1:]:
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    alpha = image.getchannel("A")
    samples = {}
    for x, y in [(0.05, 0.05), (0.5, 0.05), (0.9, 0.15), (0.1, 0.4), (0.9, 0.6), (0.5, 0.5), (0.5, 0.75), (0.05, 0.9)]:
        samples[f"{x},{y}"] = image.getpixel((int(x * width), int(y * height)))
    histogram = alpha.histogram()
    print(json.dumps({"path": path, "size": image.size, "alphaRange": alpha.getextrema(),
                      "transparent": histogram[0], "lowAlpha": sum(histogram[1:230]),
                      "highAlpha": sum(histogram[230:]), "samples": samples}))
