#!/usr/bin/env python3
"""똑바(Shop WiseBar) 확장 아이콘 생성 — 파랑 그라데이션 원 + 하락 꺾은선 (v0.9.1)"""
from PIL import Image, ImageDraw

S = 512  # 슈퍼샘플 크기 (128*4)
SS = 4   # 안티앨리어싱 배율

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_icon(size):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = img.load()

    # 1) 원형 그라데이션 배경: 상단 #5B8BFF → 하단 #1E3FD1 (라운드가 살짝 있는 원)
    top = (91, 139, 255)
    bot = (30, 63, 209)
    cx = cy = S / 2
    R = S * 0.94 / 2  # 여유 있게 크게 (16px에서도 원이 잘 보이도록)
    for y in range(S):
        t = y / S
        col = lerp(top, bot, t)
        for x in range(S):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= R * R:
                px[x, y] = col + (255,)

    d = ImageDraw.Draw(img)

    # 2) 흰색 하락 꺾은선 (굵게, 라운드 캡)
    pts = [(S*0.28, S*0.34), (S*0.46, S*0.44), (S*0.62, S*0.56), (S*0.74, S*0.66)]
    lw = S * 0.115
    d.line(pts, fill=(255, 255, 255, 255), width=int(lw), joint="curve")

    # 3) 하락 화살표 머리 (끝점에서 왼쪽-아래로)
    ex, ey = pts[-1]
    a = S * 0.10  # 화살표 길이
    d.line([(ex - a*0.55, ey - a*0.55), (ex, ey)], fill=(255, 255, 255, 255), width=int(lw*0.75), joint="curve")
    d.line([(ex + a*0.35, ey - a*0.30), (ex, ey)], fill=(255, 255, 255, 255), width=int(lw*0.75), joint="curve")

    # 4) 슈퍼샘플 다운스케일
    out = img.resize((size, size), Image.LANCZOS)
    return out

for size in (16, 48, 128):
    make_icon(size).save(f"extension/icons/icon{size}.png")
    print(f"icon{size}.png 저장 완료")
