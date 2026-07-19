const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
    const filePath = 'C:\\Users\\Lenovo\\Desktop\\方二教授：从趋势当增长.pdf';
    const buffer = fs.readFileSync(filePath);
    
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    
    console.log('=== Extracted Text ===');
    console.log(result.text);
}

main().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
});
