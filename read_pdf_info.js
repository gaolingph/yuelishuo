const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\\\wxid_mk1z4birnl0x22_aa32\\\\msg\\\\file\\\\2026-07\\\\乐说英语品牌手册.pdf';

// Read the xref table to find object offsets
const xrefOffset = 443169459;

const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(200000);
const bytesRead = fs.readSync(fd, buf, 0, 200000, xrefOffset);
fs.closeSync(fd);

const xrefContent = buf.toString('binary', 0, bytesRead);

// Parse xref table - find entries for objects 1 (Root), and the last few objects (near 4236 which is Info)
// The xref format is: obj_num generation status\n offset gen status\n
const lines = xrefContent.split('\n');
console.log('First few lines:');
for (let i = 0; i < 10 && i < lines.length; i++) {
    console.log(i + ': ' + lines[i]);
}

// Find the Info object (4236) and Root (1)
// Object 1 is at line 2 (after "xref" and "0 4237")
// Let's read specific objects from the file

// Parse structured data
let objNum = 0;
const entries = {};
for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if this is a normal entry with format "0000000000 65535 f" or "0000000016 00000 n"
    const match = line.match(/^(\d{10}) (\d{5}) ([fn])$/);
    if (match) {
        entries[objNum] = {
            offset: parseInt(match[1], 10),
            gen: parseInt(match[2], 10),
            status: match[3]
        };
        objNum++;
    } else if (line === '') {
        continue;
    } else {
        // Might be a subsection header like "0 4237" - skip
        console.log('Skipping line:', line);
    }
}

console.log('\nTotal entries parsed:', Object.keys(entries).length);

// Root is object 1
const root = entries[1];
console.log('\nRoot (obj 1):', JSON.stringify(root));

// Info should be object 4236
const info = entries[4236];
console.log('Info (obj 4236):', JSON.stringify(info));

// Also check object 4235 and nearby
for (let i = 4230; i <= 4236; i++) {
    if (entries[i]) {
        console.log('Obj', i, ':', JSON.stringify(entries[i]));
    }
}

// Or find the last "n" status entries
console.log('\nLast 10 entries:');
const keys = Object.keys(entries).map(Number).sort((a,b) => a-b);
for (const k of keys.slice(-10)) {
    console.log(k, ':', JSON.stringify(entries[k]));
}

// Read the Info object if found
if (info && info.offset > 0) {
    const fd2 = fs.openSync(pdfPath, 'r');
    const buf2 = Buffer.alloc(5000);
    const br2 = fs.readSync(fd2, buf2, 0, 5000, info.offset);
    fs.closeSync(fd2);
    console.log('\n=== Info object ===');
    console.log(buf2.toString('binary', 0, br2).substring(0, 1000));
}

// Read Root object (1) - catalog
if (root && root.offset > 0) {
    const fd3 = fs.openSync(pdfPath, 'r');
    const buf3 = Buffer.alloc(5000);
    const br3 = fs.readSync(fd3, buf3, 0, 5000, root.offset);
    fs.closeSync(fd3);
    console.log('\n=== Root catalog ===');
    console.log(buf3.toString('binary', 0, br3).substring(0, 1000));
}
