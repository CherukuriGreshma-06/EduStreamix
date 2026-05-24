const fs = require('fs');
const path = require('path');
const translate = require('google-translate-api-x');
const localSyllabus = require('../services/localSyllabusService');

exports.renderLanding = (req, res) => {
  res.render('landing');
};

exports.renderBoards = (req, res) => {
  const { grade } = req.query;
  res.render('boards', {
    selectedGrade: grade || '10'
  });
};

exports.renderSubjects = (req, res) => {
  const { grade, board, language } = req.query;
  res.render('subjects', {
    selectedGrade: grade || '10',
    selectedBoard: board || 'CBSE',
    selectedLanguage: language || 'English'
  });
};

exports.renderStudy = (req, res) => {
  const { grade, board, subject, language } = req.query;
  res.render('study', {
    selectedGrade: grade || null,
    selectedBoard: board || null,
    selectedSubject: subject || null,
    selectedLanguage: language || null,
    displaySubject: subject || null
  });
};

exports.getSubjects = (req, res) => {
  const { grade, board } = req.query;

  if (!grade || !board) {
    return res.status(400).json({ error: 'grade and board are required' });
  }

  const gradeNum = parseInt(grade, 10);
  const boardUp = board.toUpperCase();
  const subjects = localSyllabus.getSubjects(gradeNum, boardUp);

  if (!subjects.length) {
    return res.status(404).json({ error: 'No subjects found for this class and board' });
  }

  res.json({ grade: gradeNum, board: boardUp, subjects });
};

exports.getChapters = (req, res) => {
  const { grade, board, subject } = req.query;

  if (!grade || !board || !subject) {
    return res.status(400).json({ error: 'grade, board, and subject are required' });
  }

  const gradeNum = parseInt(grade, 10);
  const boardUp = board.toUpperCase();
  const chapters = localSyllabus.getChapters(gradeNum, boardUp, subject);

  if (!chapters.length) {
    return res.status(404).json({ error: 'No chapters found for this class, board, and subject' });
  }

  res.json({
    grade: gradeNum,
    board: boardUp,
    subject,
    chapters
  });
};

exports.getVideo = (req, res) => {
  const { chapter, grade, language, board, subject } = req.query;

  if (!chapter || !grade || !language || !board || !subject) {
    return res.status(400).json({ error: 'chapter, grade, language, board, and subject are required' });
  }

  const gradeNum = parseInt(grade, 10);
  const boardUp = board.toUpperCase();
  const resource = localSyllabus.getVideo(gradeNum, boardUp, subject, chapter, language);

  if (!resource?.link) {
    return res.status(404).json({ error: 'No video found for this chapter' });
  }

  res.json({
    cached: true,
    video: {
      youtubeVideoId: localSyllabus.extractVideoId(resource.link),
      title: `${chapter} (${language})`,
      embedUrl: resource.link,
      viewCount: 0,
      likeCount: 0
    }
  });
};

exports.renderAdmin = (req, res) => {
  res.render('admin');
};

exports.uploadPdf = async (req, res) => {
  const { grade, board, subject, chapterName, pdfDataUrl, pdfTitle } = req.body;

  if (!grade || !board || !subject || !chapterName || !pdfDataUrl) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const matches = pdfDataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const uploadDir = path.join(__dirname, '../public/uploads/pdfs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeChapter = chapterName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeSubject = subject.replace(/\s/g, '');
    const fileName = `grade${grade}_${board}_${safeSubject}_${safeChapter}_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      pdfUrl: `/uploads/pdfs/${fileName}`,
      pdfTitle: pdfTitle || chapterName
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
};

exports.translateBatch = async (req, res) => {
  try {
    const { texts, lang, targetLang } = req.body;
    const reqLang = targetLang || lang;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'Invalid texts array' });
    }

    if (reqLang === 'en' || reqLang === 'English') {
      const fallback = {};
      texts.forEach(text => {
        fallback[text] = text;
      });
      return res.json(fallback);
    }

    const langCodes = {
      English: 'en',
      Hindi: 'hi',
      Telugu: 'te',
      Tamil: 'ta',
      Kannada: 'kn',
      Malayalam: 'ml'
    };
    const target = langCodes[reqLang] || reqLang;

    const resolved = await Promise.all(texts.map(async text => {
      if (!text || text === '-') {
        return { original: text, translated: text };
      }

      try {
        const response = await translate(text, { to: target });
        return { original: text, translated: response.text };
      } catch (_) {
        return { original: text, translated: text };
      }
    }));

    const results = {};
    resolved.forEach(item => {
      results[item.original] = item.translated;
    });

    res.json(results);
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
};
