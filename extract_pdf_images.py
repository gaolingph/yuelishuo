import pymupdf, os
doc = pymupdf.open(r'C:\Users\Lenovo\Desktop\方二教授：从趋势当增长.pdf')
outdir = r'C:\Users\Lenovo\ZCodeProject\pdf_images'
os.makedirs(outdir, exist_ok=True)
for i in range(doc.page_count):
    page = doc[i]
    # Render page to image at 300 DPI
    pix = page.get_pixmap(dpi=300)
    path = os.path.join(outdir, f'page_{i+1:02d}.png')
    pix.save(path)
    print(f'Saved page {i+1}: {path} ({pix.width}x{pix.height})')
doc.close()
print('Done')
