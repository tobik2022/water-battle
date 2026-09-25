from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.graphics.barcode import qrencoder

# URL = 'https://tobik2022.github.io/water-battle/index.html'
URL = 'https://bicik.net/water_battle/'

ROOT = Path(__file__).resolve().parent
qr = qrencoder.QRCode(None, qrencoder.QRErrorCorrectLevel.H)
qr.addData(URL)
qr.make()
modules, scale, border = qr.getModuleCount(), 24, 4
size = (modules + border * 2) * scale
result = Image.new('RGB', (size, size), 'white')
draw = ImageDraw.Draw(result)
for y in range(modules):
    for x in range(modules):
        if qr.isDark(y, x):
            left, top = (x + border) * scale, (y + border) * scale
            draw.rectangle((left, top, left + scale - 1, top + scale - 1), fill='#03111f')
# Keep the original emblem, using the same source panel as the welcome screen.
source = Image.open(ROOT / 'images/water-battle-reference.png').convert('RGB')
w, h = source.size
logo = source.crop((30*w/1536,45*h/838,296*w/1536,264*h/838))
badge_size = 7 * scale
badge = Image.new('RGB', (badge_size, badge_size), '#03111f')
logo.thumbnail((badge_size-8, badge_size-8), Image.Resampling.LANCZOS)
badge.paste(logo, ((badge_size-logo.width)//2, (badge_size-logo.height)//2))
center = size//2
pad = 10
draw.rounded_rectangle((center-badge_size//2-pad, center-badge_size//2-pad, center+badge_size//2+pad, center+badge_size//2+pad), radius=15, fill='white')
result.paste(badge, (center-badge_size//2, center-badge_size//2))
result.save(ROOT / 'images/water-battle-qr.png')
print(f'Created {size}x{size} PNG; error correction H; URL: {URL}')
