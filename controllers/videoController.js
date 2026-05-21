const localSyllabus = require('../services/localSyllabusService');

exports.getVideo = (req, res) => {
  const { chapter, grade, language, board, subject } = req.query;

  if (!chapter || !grade || !language || !board || !subject) {
    return res.status(400).json({ error: 'chapter, grade, language, board, and subject are required' });
  }

  const resource = localSyllabus.getVideo(
    parseInt(grade, 10),
    board.toUpperCase(),
    subject,
    chapter,
    language
  );

  if (!resource?.link) {
    return res.status(404).json({ error: 'Video not found' });
  }

  res.json({
    chapter,
    url: resource.link,
    language,
    youtubeVideoId: localSyllabus.extractVideoId(resource.link)
  });
};
