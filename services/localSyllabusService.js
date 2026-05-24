const fs = require('fs');
const path = require('path');

const SOURCE_FILES = {
  CBSE: path.join(__dirname, '..', 'seeds', 'CBSE_Video.json'),
  SSC: path.join(__dirname, '..', 'seeds', 'SSC_Video.json'),
  ICSE: path.join(__dirname, '..', 'seeds', 'ICSE_Video.json')
};

const LANGUAGE_CODES = {
  English: 'en',
  Hindi: 'hi',
  Telugu: 'te',
  Tamil: 'ta',
  Kannada: 'kn',
  Malayalam: 'ml'
};

let cache = null;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getCanonicalSubject(board, subject) {
  if (board === 'ICSE' && subject === 'History & Civics') {
    return 'history_civics';
  }

  return subject;
}

function loadBoardData(board) {
  const filePath = SOURCE_FILES[board];
  if (!filePath || !fs.existsSync(filePath)) return [];

  return JSON.parse(fs.readFileSync(filePath, 'utf8')).map(doc => ({
    grade: Number(doc.grade),
    board,
    subject: doc.subject,
    units: (doc.units || []).map((unit, index) => ({
      name: unit.name || unit.chapterName || unit.unitName || `Chapter ${index + 1}`,
      resources: unit.resources || []
    }))
  }));
}

function loadData() {
  if (!cache) {
    cache = Object.keys(SOURCE_FILES).reduce((data, board) => {
      data[board] = loadBoardData(board);
      return data;
    }, {});
  }

  return cache;
}

function getSubjects(grade, board) {
  const boardUp = String(board || '').toUpperCase();
  return (loadData()[boardUp] || [])
    .filter(doc => doc.grade === Number(grade))
    .map(doc => doc.subject);
}

function findSubjectDoc(grade, board, subject) {
  const boardUp = String(board || '').toUpperCase();
  const canonicalSubject = getCanonicalSubject(boardUp, subject);

  return (loadData()[boardUp] || []).find(doc => (
    doc.grade === Number(grade) &&
    normalize(doc.subject) === normalize(canonicalSubject)
  ));
}

function getChapters(grade, board, subject) {
  const doc = findSubjectDoc(grade, board, subject);
  if (!doc) return [];

  return doc.units.map((unit, index) => {
    const firstResource = (unit.resources || []).find(resource => resource.link);

    return {
      unitName: unit.name,
      lessonNo: String(index + 1),
      chapterName: unit.name,
      type: firstResource ? 'Video' : 'Topic',
      link: firstResource?.link || null,
      resources: unit.resources || []
    };
  });
}

function getVideo(grade, board, subject, chapter, language) {
  const doc = findSubjectDoc(grade, board, subject);
  if (!doc) return null;

  const unit = doc.units.find(item => normalize(item.name) === normalize(chapter));
  if (!unit) return null;

  const requestedLangCode = LANGUAGE_CODES[language] || normalize(language);
  return (unit.resources || []).find(resource => resource.lang === requestedLangCode) ||
    (unit.resources || []).find(resource => resource.link) ||
    null;
}

function extractVideoId(url) {
  let videoId = String(url || '').split('embed/')[1] || String(url || '').split('v=')[1] || String(url || '');
  if (videoId.includes('&')) videoId = videoId.split('&')[0];
  if (videoId.includes('?')) videoId = videoId.split('?')[0];
  return videoId;
}

module.exports = {
  extractVideoId,
  getChapters,
  getSubjects,
  getVideo
};
