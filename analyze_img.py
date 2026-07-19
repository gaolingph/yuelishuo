from PIL import Image
import os

base = r'C:\Users\Lenovo\xwechat_files\wxid_mk1z4birnl0x22_aa32\temp\RWTemp\2026-07\9e20f478899dc29eb19741386f9343c8'
files = ['188d95d19261f71d859f64867cbf416e.png', '6283e473db2b77e19dde8cba8e7a4319.png', '87df10c4af9a2dcb6fcbf0e99cd4cfad.png']

with open('C:\\Users\\Lenovo\\ZCodeProject\\img_analysis.txt', 'w', encoding='utf-8') as out:
    for fname in files:
        f = os.path.join(base, fname)
        if not os.path.exists(f):
            out.write(f'{fname}: NOT FOUND\n')
            continue
        img = Image.open(f)
        w, h = img.size
        out.write(f'=== {fname} ({w}x{h}) ===\n')
        
        # Scan top/middle/bottom for dominant colors
        regions = {
            'top': range(0, min(200, h)),
            'mid': range(h//2-50, h//2+50),
            'bot': range(max(0, h-200), h),
        }
        for rname, yrange in regions.items():
            r_total, g_total, b_total = 0, 0, 0
            count = 0
            for y in yrange:
                for x in range(0, w, 10):
                    try:
                        p = img.getpixel((x, y))
                        r_total += p[0]
                        g_total += p[1]
                        b_total += p[2]
                        count += 1
                    except:
                        pass
            if count:
                out.write(f'  {rname}: avg RGB({r_total//count},{g_total//count},{b_total//count})\n')
        
        # Try to detect if it has a gradient background
        # Sample vertical strip in middle
        out.write(f'  Vertical center strip:\n')
        x = w // 2
        for y_rel in [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
            y = int(h * y_rel)
            if y < h:
                p = img.getpixel((x, y))
                out.write(f'    y={y_rel:.0%}: RGB{p}\n')
        out.write('\n')

print('Done')
