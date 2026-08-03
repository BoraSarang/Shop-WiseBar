from PIL import Image, ImageDraw

def draw_icon(size):
    S = size
    k = S / 128.0
    def P(x, y): return (int(x*k), int(y*k))
    im = Image.new("RGBA", (S, S), (0,0,0,0))
    bg = Image.new("RGBA", (S, S))
    top, bottom = (57,73,171), (124,93,200)
    for y in range(S):
        t = y/(S-1)
        c = tuple(int(top[i]+(bottom[i]-top[i])*t) for i in range(3))
        for x in range(S): bg.putpixel((x,y), c+(255,))
    mask = Image.new("L", (S,S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,S-1,S-1], radius=int(28*k), fill=255)
    im = Image.composite(bg, im, mask)
    d = ImageDraw.Draw(im)

    # 열린 뚜껑(뒤로 젖혀진 판)
    d.polygon([P(50,34), P(92,34), P(86,44), P(42,44)], fill=(214,222,255,255))
    # 윗면
    d.polygon([P(42,44), P(86,44), P(92,58), P(36,58)], fill=(232,237,255,255))
    # 박스 앞면
    d.rounded_rectangle([P(32,58), P(96,104)], radius=int(4*k), fill=(255,255,255,255))
    # 앞면 상단 라인(입체감)
    d.line([P(32,58), P(96,58)], fill=(206,214,248,255), width=max(1,int(2*k)))
    # 중앙 테이프(리본)
    d.rectangle([P(62,58), P(68,104)], fill=(238,240,250,255))

    # 가격 그래프 라인 (박스 위를 지나며 상승)
    pts = [(28,86),(46,72),(64,78),(84,52),(104,44)]
    d.line([P(x,y) for x,y in pts], fill=(105,240,174,255),
           width=max(2,int(8*k)), joint="curve")
    # 마지막 포인트
    x,y = pts[-1]
    r = int(7*k)
    d.ellipse([P(x-r,y-r), P(x+r,y+r)], fill=(105,240,174,255),
              outline=(255,255,255,255), width=max(1,int(3*k)))
    return im

base = draw_icon(128)
base.save("/Users/lee/Documents/Apps/Shop WiseBar/extension/icons/icon128.png")
for s in (48, 16):
    draw_icon(s).save(f"/Users/lee/Documents/Apps/Shop WiseBar/extension/icons/icon{s}.png")
print("done")
