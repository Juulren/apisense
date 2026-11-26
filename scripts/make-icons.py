"""Draws the app's mark at any size and writes the icons the app uses.

The design is "Logo Vectorial Apisense" from the project's Stitch board, which
only exports it as a 200 x 200 picture: too small for a launcher icon. It is
redrawn here, in that picture's coordinates, so it stays sharp. Needs Pillow.

Run from the repository root: python scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

CREAM = "#FFFBEB"
RIM = "#FDEB9A"
AMBER = "#F59E0B"
ORANGE = "#D97706"
BROWN = "#B45309"
BLUE = "#2793CC"
SUPER = 4  # drawn this much larger, then reduced: smooth edges


def rgba(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    return (*(int(color[i : i + 2], 16) for i in (1, 3, 5)), alpha)


def mirrored(points):
    return [(200 - x, y) for x, y in points]


class Canvas:
    """Draws in the 200-unit coordinates of the original, placed on a square."""

    def __init__(self, size: int, scale: float, center: tuple[float, float]):
        self.size = size * SUPER
        self.scale = scale * SUPER
        self.center = center
        self.image = Image.new("RGBA", (self.size, self.size), (0, 0, 0, 0))

    def at(self, point):
        return tuple(
            self.size / 2 + (v - c) * self.scale for v, c in zip(point, self.center)
        )

    def layer(self, paint):
        # A layer of its own, so a see-through color lets what is below show.
        top = Image.new("RGBA", self.image.size, (0, 0, 0, 0))
        paint(ImageDraw.Draw(top))
        self.image.alpha_composite(top)

    def fill(self, points, color, alpha=255):
        self.layer(lambda d: d.polygon([self.at(p) for p in points], fill=rgba(color, alpha)))

    def stroke(self, points, color, width, closed=False):
        path = [self.at(p) for p in points]
        if closed:
            path.append(path[0])
        w = max(1, round(width * self.scale))

        def paint(d):
            d.line(path, fill=rgba(color), width=w, joint="curve")
            for x, y in path:  # round ends and corners
                d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=rgba(color))

        self.layer(paint)

    def shade(self, points, top, bottom):
        """A shape that goes from one color at its top to another at its tip."""
        shape = [self.at(p) for p in points]
        mask = Image.new("L", self.image.size, 0)
        ImageDraw.Draw(mask).polygon(shape, fill=255)
        first, last = min(y for _, y in shape), max(y for _, y in shape)
        fade = Image.new("RGBA", self.image.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(fade)
        a, b = rgba(top), rgba(bottom)
        for y in range(int(first), int(last) + 1):
            t = (y - first) / max(1, last - first)
            color = tuple(round(i + (j - i) * t) for i, j in zip(a, b))
            d.line([(0, y), (self.size, y)], fill=color)
        layer = Image.new("RGBA", self.image.size, (0, 0, 0, 0))
        layer.paste(fade, (0, 0), mask)
        self.image.alpha_composite(layer)

    def circle(self, center, radius, color):
        x, y = self.at(center)
        r = radius * self.scale
        self.layer(lambda d: d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(color)))

    def result(self, size: int) -> Image.Image:
        return self.image.resize((size, size), Image.LANCZOS)


def bee(c: Canvas) -> None:
    blue = [(81, 97), (67.4, 87.4), (42.6, 100), (57.6, 124.8), (86.5, 110.4)]
    upper = [(90, 102), (75, 72.5), (37.6, 80), (25, 100), (42.6, 125), (75, 113), (86.5, 109.3)]
    lower = [(42.6, 125), (42.6, 167.4), (75, 152.4), (75, 113.5)]
    for side in (lambda p: p, mirrored):
        c.fill(side(blue), "#38A3D8", 24)
        c.stroke(side(blue), BLUE, 1.3)
        c.stroke(side(lower), ORANGE, 1.35)
        c.stroke(side(upper), ORANGE, 1.7)

    # The body: the upper half is tinted and lets the wing lines show faintly.
    head = [(100, 47.6), (120, 64.5), (120, 97.6), (80, 97.6), (80, 64.5)]
    c.fill(head, "#FEF0BC", 150)
    c.stroke([(80, 97.6), (80, 140), (100, 157.5), (120, 140), (120, 97.6)], BROWN, 1.4)
    c.stroke(head, BROWN, 1.9, closed=True)

    diamond = [(100, 85.3), (115, 107.6), (100, 132.4), (85, 107.6)]
    c.fill(diamond, "#FEF0BC", 150)
    c.stroke([(80, 98), (87, 104.2)], BROWN, 1.6)
    c.stroke([(120, 98), (113, 104.2)], BROWN, 1.6)
    c.stroke(diamond, ORANGE, 1.7, closed=True)
    c.stroke([(100, 85.8), (100, 132)], "#C0600B", 1.6)
    c.stroke([(85, 107.6), (100, 117.4), (115, 107.6)], BROWN, 1.1)

    # Antennae: a rounded outer end, a flat inner one.
    antenna = [(66.9, 36.6), (82.5, 54.7), (89, 48.8), (73.3, 32.4)]
    for side in (lambda p: p, mirrored):
        tip = side([(70.3, 34.8)])[0]
        c.circle(tip, 4.25, ORANGE)
        c.fill(side(antenna), AMBER)
        c.stroke(side([(73.3, 32.4), (89, 48.8), (82.5, 54.7), (66.9, 36.6)]), ORANGE, 1.1)
        c.circle(tip, 3.2, AMBER)

    # The sting: a hollow triangle.
    c.shade([(89.6, 157.4), (110.4, 157.4), (100, 179)], "#E8890A", BROWN)
    c.stroke([(89.6, 157.4), (110.4, 157.4), (100, 179)], BROWN, 1.1, closed=True)
    c.fill([(94.6, 158.2), (105.4, 158.2), (100, 169.4)], CREAM)


def badge(size: int) -> Image.Image:
    """The mark in its cream circle, as the board shows it."""
    c = Canvas(size, size / 200, (100, 100))
    c.circle((100, 100), 93, RIM)
    c.circle((100, 100), 92, CREAM)
    bee(c)
    return c.result(size)


def launcher_foreground(size: int) -> Image.Image:
    """Android crops launcher icons: the bee stays inside the safe circle."""
    c = Canvas(size, size * 3.6 / 1024, (100, 105.5))
    bee(c)
    return c.result(size)


def square_icon(size: int) -> Image.Image:
    """For where one flat square is wanted: older launchers and iOS."""
    c = Canvas(size, size * 4.9 / 1024, (100, 105.5))
    bee(c)
    flat = Image.new("RGBA", (size, size), rgba(CREAM))
    flat.alpha_composite(c.result(size))
    return flat.convert("RGB")


def main() -> None:
    assets = Path("assets")
    for name, image in (
        ("brand-logo.png", badge(512)),
        ("adaptive-icon.png", launcher_foreground(1024)),
        ("icon.png", square_icon(1024)),
    ):
        image.save(assets / name, optimize=True)
        print(assets / name, image.size, (assets / name).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
