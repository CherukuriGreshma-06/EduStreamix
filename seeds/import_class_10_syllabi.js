require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Video = require('../models/Video');

const SOURCE_FILES = [
  {
    board: 'CBSE',
    collection: 'CBSE_Syllabi',
    file: 'C:/Users/Greshma/OneDrive/Documents/EduStreamX.CBSE_Syllabi.json'
  },
  {
    board: 'SSC',
    collection: 'SSC_Syllabi',
    file: 'C:/Users/Greshma/OneDrive/Documents/EduStreamX.SSC_Syllabi.json'
  },
  {
    board: 'ICSE',
    collection: 'ICSE_Syllabi',
    file: 'C:/Users/Greshma/OneDrive/Documents/EduStreamX.ICSE_Syllabi.json'
  }
];

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam'
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toSyllabusDoc(rawDoc) {
  return {
    grade: Number(rawDoc.grade),
    subject: rawDoc.subject,
    units: (rawDoc.units || []).map(unit => ({
      name: unit.name || unit.chapterName || unit.unitName || 'Chapter',
      resources: (unit.resources || []).map(resource => ({
        link: resource.link,
        lang: resource.lang || 'en',
        isOriginal: Boolean(resource.isOriginal)
      })).filter(resource => resource.link)
    }))
  };
}

function toVideoDocs(board, syllabusDoc) {
  const videos = [];

  for (const unit of syllabusDoc.units || []) {
    for (const resource of unit.resources || []) {
      if (!resource.link) continue;

      videos.push({
        grade: String(syllabusDoc.grade),
        board,
        subject: syllabusDoc.subject,
        chapter: unit.name,
        url: resource.link,
        language: LANGUAGE_NAMES[resource.lang] || resource.lang || 'English'
      });
    }
  }

  return videos;
}

async function importBoard({ board, collection, file }) {
  const sourceDocs = readJson(file).map(toSyllabusDoc);
  const collectionHandle = mongoose.connection.db.collection(collection);

  await collectionHandle.deleteMany({ grade: 10 });
  if (sourceDocs.length) {
    await collectionHandle.insertMany(sourceDocs);
  }

  const videoDocs = sourceDocs.flatMap(doc => toVideoDocs(board, doc));
  await Video.deleteMany({ grade: '10', board });
  if (videoDocs.length) {
    await Video.insertMany(videoDocs);
  }

  const chapterCount = sourceDocs.reduce((sum, doc) => sum + (doc.units || []).length, 0);
  console.log(`${board}: imported ${sourceDocs.length} subjects, ${chapterCount} chapters, ${videoDocs.length} videos`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing. Add it to .env before importing syllabi.');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);

  for (const source of SOURCE_FILES) {
    console.log(`Reading ${path.basename(source.file)}...`);
    await importBoard(source);
  }

  await mongoose.disconnect();
  console.log('Class 10 syllabi import complete.');
}

main().catch(async error => {
  console.error('Import failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // Ignore disconnect errors during failure cleanup.
  }
  process.exit(1);
});
