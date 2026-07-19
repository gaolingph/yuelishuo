// Try using pdfjs-dist directly (which pdf-parse depends on)
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

async function main() {
  const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';
  
  console.log('Loading PDF document...');
  
  // Load document with limited operations
  const loadingTask = pdfjsLib.getDocument({
    url: pdfPath,
    useSystemFonts: true,
    standardFontDataUrl: null,
    disableFontFace: true,
    isEvalSupported: false,
    enableXfa: false
  });
  
  const pdfDoc = await loadingTask.promise;
  
  console.log('PDF loaded successfully!');
  console.log('Number of pages:', pdfDoc.numPages);
  
  // Get metadata
  try {
    const meta = await pdfDoc.getMetadata();
    console.log('Metadata:', JSON.stringify(meta.info, null, 2));
  } catch(e) {
    console.log('Metadata error:', e.message);
  }
  
  // Try first few pages
  for (let p = 1; p <= Math.min(5, pdfDoc.numPages); p++) {
    try {
      console.log(`\n--- Page ${p} ---`);
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const strings = textContent.items.map(item => item.str).filter(s => s.trim());
      console.log('Text items:', strings.length);
      if (strings.length > 0) {
        console.log(strings.join(' ').substring(0, 500));
      }
    } catch(e) {
      console.log(`Page ${p} error:`, e.message);
    }
  }
  
  await pdfDoc.destroy();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  if (err.stack) console.error(err.stack.substring(0, 1000));
});
