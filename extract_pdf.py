import pymupdf
doc = pymupdf.open(r'C:\Users\Lenovo\Desktop\方二教授：从趋势当增长.pdf')
print(f'Total pages: {doc.page_count}')
for i in range(doc.page_count):
    page = doc[i]
    text = page.get_text()
    images = page.get_images()
    blocks = page.get_text('dict')
    # Check for text blocks
    text_blocks = [b for b in blocks.get('blocks', []) if b.get('type') == 0]
    image_blocks = [b for b in blocks.get('blocks', []) if b.get('type') == 1]
    print(f'Page {i+1}: text_len={len(text.strip())}, raw_imgs={len(images)}, text_blocks={len(text_blocks)}, img_blocks={len(image_blocks)}')
    if text.strip():
        print(f'  Text preview: {text[:300]}')
doc.close()
