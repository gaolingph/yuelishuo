const mammoth = require('mammoth');

async function main() {
  try {
    const result = await mammoth.extractRawText({
      path: 'C:\\Users\\Lenovo\\ZCodeProject\\temp_doc.docx'
    });
    console.log(result.value);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
