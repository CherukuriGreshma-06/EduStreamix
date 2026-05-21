const fs = require('fs');
const path = require('path');

const SOURCE_FILES = [
  { board: 'CBSE', file: path.join(__dirname, 'CBSE_Video.json') },
  { board: 'SSC', file: path.join(__dirname, 'SSC_Video.json') },
  { board: 'ICSE', file: path.join(__dirname, 'ICSE_Video.json') }
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateBoard({ board, file }) {
  const docs = readJson(file);
  let chapterCount = 0;
  let videoCount = 0;

  for (const doc of docs) {
    if (!doc.grade || !doc.subject || !Array.isArray(doc.units)) {
      throw new Error(`${board}: invalid subject document in ${path.basename(file)}`);
    }

    for (const unit of doc.units) {
      if (!unit.name) {
        throw new Error(`${board}: chapter is missing a name in ${doc.subject}`);
      }

      chapterCount += 1;
      videoCount += (unit.resources || []).filter(resource => resource.link).length;
    }
  }

  console.log(`${board}: ${docs.length} subjects, ${chapterCount} chapters, ${videoCount} videos`);
}

try {
  for (const source of SOURCE_FILES) {
    validateBoard(source);
  }

  console.log('Local Class 10 data is ready. No MongoDB import is needed.');
} catch (error) {
  console.error('Validation failed:', error.message);
  process.exit(1);
}
