import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';

async function extractText() {
    const filePath = 'C:\\Users\\Lenovo\\Desktop\\方二教授：从趋势当增长.pdf';
    const data = new Uint8Array(fs.readFileSync(filePath));
    
    const doc = await pdfjsLib.getDocument({ data }).promise;
    console.log(`Total pages: ${doc.numPages}`);
    
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        console.log(`\n=== Page ${i} ===`);
        if (text.trim()) {
            console.log(text);
        } else {
            console.log('[No extractable text - image only page]');
        }
        console.log(`Items count: ${content.items.length}`);
    }
    
    await doc.destroy();
}

extractText().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
});
