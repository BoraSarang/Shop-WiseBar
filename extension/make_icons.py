#!/usr/bin/env python3
"""익스텐션 아이콘 PNG 생성 (표준 라이브러리만 사용) — 남색 원 + 하락 화살표"""
import math
import struct
import zlib
import os

OUT = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT, exist_ok=True)

BG = (0, 0, 0, 0)          # 투명
BLUE = (45, 74, 224, 255)  # #2D4AE0
WHITE = (255, 255, 255, 255)


def make_png(size, pixels):
    """RGBA 픽셀 리스트 → PNG 바이트"""
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("4B", *pixels[y * size + x]) for x in range(size))
        for y in range(size)
    )
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def render(size):
    pixels = [list(BG) for _ in range(size * size)]
    cx = cy = size / 2
    radius = size * 0.46
    r2 = radius * radius

    def setpx(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            pixels[y * size + x] = list(color)

    # 원
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r2:
                pixels[y * size + x] = list(BLUE)

    # 하락 라인 (좌상 → 우하, 두께)
    def draw_line(x0, y0, x1, y1, thickness, color):
        steps = int(max(abs(x1 - x0), abs(y1 - y0), 1) * 2)
        for i in range(steps + 1):
            t = i / steps
            px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for ox in range(-thickness, thickness + 1):
                for oy in range(-thickness, thickness + 1):
                    if ox * ox + oy * oy <= thickness * thickness:
                        setpx(int(round(px + ox)), int(round(py + oy)), color)

    # 화살촉 (우하단 삼각형)
    def draw_arrow(x0, y0, x1, y1, thickness, color):
        # 화살촉 두 갈래
        ax, ay = x1 - (x1 - x0) * 0.14, y1 - (y1 - y0) * 0.14
        for i in range(int(thickness) * 3):
            t = i / (thickness * 3)
            # 갈래 1 (위)
            bx = ax - (x1 - x0) * 0.12 * t + (y1 - y0) * 0.10
            by = ay - (y1 - y0) * 0.12 * t - (x1 - x0) * 0.10
            setpx(int(round(bx)), int(round(by)), color)
            # 갈래 2 (아래)
            bx = ax - (x1 - x0) * 0.12 * t - (y1 - y0) * 0.10
            by = ay - (y1 - y0) * 0.12 * t + (x1 - x0) * 0.10
            setpx(int(round(bx)), int(round(by)), color)

    s = size
    draw_line(s * 0.24, s * 0.38, s * 0.64, s * 0.62, max(1, int(s * 0.045)), WHITE)
    draw_arrow(s * 0.24, s * 0.38, s * 0.66, s * 0.64, max(1, int(s * 0.06)), WHITE)
    return make_png(size, pixels)


for size in (16, 48, 128):
    with open(os.path.join(OUT, f"icon{size}.png"), "wb") as f:
        f.write(render(size))
    print(f"icon{size}.png 생성 완료")
