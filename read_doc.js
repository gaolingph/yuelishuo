const fs = require('fs');
const WordExtractor = require('word-extractor');

async function main() {
    try {
        // Copy file to temp first to handle Chinese path
        const src = 'C:\\Users\\Lenovo\\Desktop\\单词速记推广话术.doc';
        const tmp = 'C:\\Users\\Lenovo\\ZCodeProject\\temp_promo.doc';
        fs.copyFileSync(src, tmp);
        
        const extractor = new WordExtractor();
        const doc = await extractor.extract(tmp);
        console.log(doc.getBody());
    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
