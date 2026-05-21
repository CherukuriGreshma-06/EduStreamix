/* ──────────────────────────────────────────────
   Study Controller — All study-related logic
   ────────────────────────────────────────────── */

const Subject = require('../models/Subject');
const Video = require('../models/Video');
const { fetchBestVideo } = require('../services/youtubeService');
const fs = require('fs');
const path = require('path');
const translate = require('google-translate-api-x');
const mongoose = require('mongoose');

function _escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _normalizeString(value) {
  return String(value || '').trim().toLowerCase();
}

// ── Curriculum mapping (example subjects per class + board) ──
const CURRICULUM = {
  10: {
    CBSE: ['Mathematics', 'Science', 'Social Studies', 'English', 'Hindi'],
    SSC: ['Mathematics', 'Physics', 'Biology', 'Social Studies', 'Telugu', 'Hindi-2', 'English'],
    ICSE: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'History & Civics', 'Geography', 'Economics', 'English']
  }
};

const LANGUAGE_CODES = {
  English: 'en',
  Hindi: 'hi',
  Telugu: 'te',
  Tamil: 'ta',
  Kannada: 'kn',
  Malayalam: 'ml'
};

function _getDbSubject(board, grade, subject) {
  if (board === 'ICSE' && grade === 10 && subject === 'history_civics') {
    return 'History & Civics';
  }

  return subject;
}

function _getVideoId(url) {
  let vidId = String(url || '').split('embed/')[1] || String(url || '').split('v=')[1] || String(url || '');
  if (vidId.includes('&')) vidId = vidId.split('&')[0];
  if (vidId.includes('?')) vidId = vidId.split('?')[0];
  return vidId;
}

/**
 * GET /  — Render landing page
 */
exports.renderLanding = (req, res) => {
  res.render('landing');
};

/**
 * GET /boards  — Render board selection page (Step 2)
 * Query params: grade
 */
exports.renderBoards = (req, res) => {
  const { grade } = req.query;
  res.render('boards', {
    selectedGrade: grade || '8'
  });
};



/**
 * GET /subjects  — Render subjects page (Step 3)
 * Query params: grade, board
 */
exports.renderSubjects = (req, res) => {
  const { grade, board, language } = req.query;
  res.render('subjects', {
    selectedGrade: grade || '8',
    selectedBoard: board || 'CBSE',
    selectedLanguage: language || 'English'
  });
};

/**
 * GET /study  — Render study page (chapters, video player)
 * Query params: grade, board, subject
 */
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

/**
 * GET /api/subjects?grade=8&board=CBSE
 * Returns list of subjects for a given class and board
 */
exports.getSubjects = (req, res) => {
  const { grade, board } = req.query;

  if (!grade || !board) {
    return res.status(400).json({ error: 'grade and board are required' });
  }

  const gradeNum = parseInt(grade, 10);
  const subjects = CURRICULUM[gradeNum]?.[board.toUpperCase()];

  if (!subjects) {
    return res.status(404).json({ error: 'No subjects found for this class and board' });
  }

  res.json({ grade: gradeNum, board: board.toUpperCase(), subjects });
};

/**
 * GET /api/chapters?grade=8&board=CBSE&subject=Mathematics
 * Returns chapters from MongoDB, or a default list if not seeded
 */
exports.getChapters = async (req, res) => {
  const { grade, board, subject } = req.query;

  if (!grade || !board || !subject) {
    return res.status(400).json({ error: 'grade, board, and subject are required' });
  }

  const gradeNum = parseInt(grade, 10);
  const boardUp = board.toUpperCase();

  try {
    // 0. Map subject names to database names if necessary
    let dbSubject = _getDbSubject(boardUp, gradeNum, subject);

    const subjectRegex = new RegExp(`^${_escapeRegex(dbSubject)}$`, 'i');

    // 1. Try to fetch from the new CBSE_Syllabi or SSC_Syllabi collections first
    const collectionName = boardUp + '_Syllabi';
    if (mongoose.connection && mongoose.connection.db) {
      const collection = mongoose.connection.db.collection(collectionName);
      const doc = await collection.findOne({ grade: gradeNum, subject: subjectRegex });
      
      if (doc && doc.units && doc.units.length > 0) {
        const chapters = [];
        doc.units.forEach((unit, i) => {
          if (unit.chapters && unit.chapters.length > 0) {
            unit.chapters.forEach((ch, j) => {
              let link = null;
              if (ch.videos && ch.videos.length > 0) {
                const vid = ch.videos[0];
                link = vid.embedUrl || (vid.youtubeVideoId ? `https://www.youtube.com/embed/${vid.youtubeVideoId}` : null);
              }
              chapters.push({
                unitName: unit.unitName || unit.name || 'General',
                lessonNo: ch.lessonNo || String(j + 1),
                chapterName: ch.chapterName || ch.name || 'Chapter ' + (j + 1),
                type: link ? 'Video' : (ch.type || 'Topic'),
                link
              });
            });
          } else {
            let link = null;
            if (unit.resources && unit.resources.length > 0) {
              link = unit.resources[0].link;
            }
            chapters.push({
              unitName: unit.unitName || unit.name || 'General',
              lessonNo: String(i + 1),
              chapterName: unit.name || unit.chapterName || 'Chapter ' + (i + 1),
              type: link ? 'Video' : 'Topic',
              link
            });
          }
        });
        return res.json({ grade: gradeNum, board: boardUp, subject, chapters });
      }
    }

    // 2. Fallback to the original Subject schema
    const doc = await Subject.findOne(
      { grade: gradeNum, board: boardUp, subject: subjectRegex },
      { 'units.unitName': 1, 'units.chapters.lessonNo': 1, 'units.chapters.chapterName': 1, 'units.chapters.type': 1, 'units.chapters.pdfUrl': 1, 'units.chapters.pdfTitle': 1, 'units.chapters.keyMoments': 1, 'units.chapters.quizQuestions': 1, 'units.chapters.summary': 1, 'units.chapters.videos': 1 }
    ).lean();

    if (doc && doc.units && doc.units.length > 0) {
      const chapters = [];
      doc.units.forEach(unit => {
        unit.chapters.forEach(ch => {
          // Extract the first available video link (embedUrl or youtubeVideoId)
          let link = null;
          if (ch.videos && ch.videos.length > 0) {
            const vid = ch.videos[0];
            link = vid.embedUrl || (vid.youtubeVideoId ? `https://www.youtube.com/embed/${vid.youtubeVideoId}` : null);
          }

          chapters.push({
            unitName: unit.unitName,
            lessonNo: ch.lessonNo,
            chapterName: ch.chapterName,
            type: link ? 'Video' : (ch.type || 'Topic'),
            link: link,
            pdfUrl: ch.pdfUrl,
            pdfTitle: ch.pdfTitle,
            keyMoments: ch.keyMoments,
            quizQuestions: ch.quizQuestions,
            summary: ch.summary,
            originalChapterName: ch.chapterName
          });
        });
      });
      return res.json({ grade: gradeNum, board: boardUp, subject, chapters });
    }
  } catch (err) {
    console.warn('getChapters DB lookup failed (MongoDB may be offline):', err.message);
  }

  // 3. Fallback: return default chapters when DB is unavailable or not seeded
  const defaultList = _getDefaultChapters(subject, gradeNum, boardUp);
  const formattedChapters = defaultList.map((name, index) => ({
    unitName: 'General',
    lessonNo: String(index + 1),
    chapterName: name,
    type: 'Video',
    link: null
  }));

  res.json({
    grade: gradeNum,
    board: boardUp,
    subject,
    chapters: formattedChapters
  });
};

/**
 * GET /api/video?chapter=Kinematics&grade=8&language=English&board=CBSE&subject=Science
 * 1. Checks MongoDB cache for existing video
 * 2. If not found, fetches from YouTube API
 * 3. Saves to MongoDB and returns embed data
 */
exports.getVideo = async (req, res) => {
  const { chapter, grade, language, board, subject } = req.query;

  if (!chapter || !grade || !language) {
    return res.status(400).json({ error: 'chapter, grade, and language are required' });
  }

  const gradeNum = parseInt(grade, 10);

  // ── 0. Check the new Video model first (Highest Priority) ──
  try {
    const boardUp = board ? board.toUpperCase() : 'SSC';
    const dbSubject = _getDbSubject(boardUp, gradeNum, subject);
    const subjectRegex = new RegExp(`^${_escapeRegex(dbSubject)}$`, 'i');
    const chapterRegex = new RegExp(`^${_escapeRegex(chapter)}$`, 'i');
    const directVideo = await Video.findOne({ 
      grade: String(gradeNum), 
      board: boardUp,
      subject: subjectRegex,
      chapter: chapterRegex 
    });
    if (directVideo) {
      const vidId = _getVideoId(directVideo.url);

      return res.json({
        cached: true,
        video: {
          youtubeVideoId: vidId,
          title: `${chapter} (${directVideo.language})`,
          embedUrl: directVideo.url,
          viewCount: 0,
          likeCount: 0
        }
      });
    }
  } catch (err) {
    console.warn('Video model lookup failed:', err.message);
  }

  // 0b. Check board syllabus collections imported from JSON.
  try {
    const boardUp = board ? board.toUpperCase() : 'SSC';
    const dbSubject = _getDbSubject(boardUp, gradeNum, subject);
    const subjectRegex = new RegExp(`^${_escapeRegex(dbSubject)}$`, 'i');
    const collectionName = boardUp + '_Syllabi';
    const requestedLangCode = LANGUAGE_CODES[language] || String(language || '').toLowerCase();

    if (mongoose.connection && mongoose.connection.db) {
      const doc = await mongoose.connection.db.collection(collectionName).findOne({
        grade: gradeNum,
        subject: subjectRegex
      });

      const unit = (doc?.units || []).find(item => _normalizeString(item.name || item.chapterName) === _normalizeString(chapter));
      const resource = (unit?.resources || []).find(item => item.lang === requestedLangCode) || (unit?.resources || [])[0];

      if (resource?.link) {
        const vidId = _getVideoId(resource.link);
        return res.json({
          cached: true,
          video: {
            youtubeVideoId: vidId,
            title: `${chapter} (${language})`,
            embedUrl: resource.link,
            viewCount: 0,
            likeCount: 0
          }
        });
      }
    }
  } catch (err) {
    console.warn('Syllabus video lookup failed:', err.message);
  }

  // ── 1. Check MongoDB Subject cache ─────────────
  try {
    if (board && subject) {
      const dbSubject = _getDbSubject(board.toUpperCase(), gradeNum, subject);
      const subjectRegex = new RegExp(`^${_escapeRegex(dbSubject)}$`, 'i');
      const doc = await Subject.findOne({
        grade: gradeNum,
        board: board.toUpperCase(),
        subject: subjectRegex
      }).lean();

      if (doc) {
        const normalizedChapter = _normalizeString(chapter);
        for (const unit of doc.units || []) {
          for (const ch of unit.chapters || []) {
            if (_normalizeString(ch.chapterName) === normalizedChapter) {
              const cached = (ch.videos || []).find(v => v.language === language);
              if (cached && cached.youtubeVideoId) {
                return res.json({
                  cached: true,
                  video: {
                    youtubeVideoId: cached.youtubeVideoId,
                    title: cached.title,
                    viewCount: cached.viewCount,
                    likeCount: cached.likeCount,
                    embedUrl: cached.embedUrl || `https://www.youtube.com/embed/${cached.youtubeVideoId}`
                  }
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('getVideo DB cache lookup failed (MongoDB may be offline):', err.message);
  }

  // ── Fetch from YouTube API ────────────────
  try {
    const video = await fetchBestVideo(chapter, gradeNum, language, subject);

    if (!video) {
      return res.status(404).json({ error: 'No suitable video found' });
    }

    // ── Try to cache in MongoDB ──────────────
    if (board && subject) {
      try {
        await _cacheVideo(gradeNum, board.toUpperCase(), subject, chapter, language, video);
      } catch (cacheErr) {
        console.warn('Cache save skipped (MongoDB may be offline):', cacheErr.message);
      }
    }

    res.json({ cached: false, video });
  } catch (err) {
    console.error('getVideo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Save a fetched video into the MongoDB document for future cache hits.
 */
async function _cacheVideo(grade, board, subject, chapterName, language, video) {
  try {
    let doc = await Subject.findOne({ grade, board, subject });

    if (!doc) {
      // Create a new document with the chapter and video
      doc = new Subject({
        grade,
        board,
        subject,
        units: [{
          unitName: 'General',
          chapters: [{
            chapterName,
            videos: [{
              language,
              youtubeVideoId: video.youtubeVideoId,
              title: video.title,
              viewCount: video.viewCount,
              likeCount: video.likeCount,
              embedUrl: video.embedUrl
            }]
          }]
        }]
      });
      await doc.save();
      return;
    }

    // Find or create the chapter, then push the video
    let found = false;
    for (const unit of doc.units) {
      for (const ch of unit.chapters) {
        if (ch.chapterName === chapterName) {
          // Remove existing video for this language if any
          ch.videos = ch.videos.filter(v => v.language !== language);
          ch.videos.push({
            language,
            youtubeVideoId: video.youtubeVideoId,
            title: video.title,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            embedUrl: video.embedUrl
          });
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      // Add chapter to first unit
      doc.units[0].chapters.push({
        chapterName,
        videos: [{
          language,
          youtubeVideoId: video.youtubeVideoId,
          title: video.title,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          embedUrl: video.embedUrl
        }]
      });
    }

    await doc.save();
  } catch (err) {
    console.error('Cache save error:', err.message);
  }
}

/**
 * Default chapters when MongoDB isn't seeded yet.
 */
function _getDefaultChapters(subject, grade, board) {
  let defaults = {
    'Mathematics': ['Number Systems', 'Algebra', 'Geometry', 'Mensuration', 'Statistics'],
    'Science': ['Force and Motion', 'Light', 'Chemical Reactions', 'Cell Biology', 'Ecosystem'],
    'Social Science': ['Indian History', 'Geography', 'Civics', 'Economics'],
    'English': ['Grammar', 'Comprehension', 'Writing Skills', 'Literature'],
    'Hindi': ['व्याकरण', 'गद्य', 'पद्य', 'लेखन'],
    'Physics': ['Kinematics', 'Laws of Motion', 'Work and Energy', 'Waves', 'Optics'],
    'Chemistry': ['Atoms and Molecules', 'Chemical Bonding', 'Acids and Bases', 'Metals and Non-Metals'],
    'Biology': ['Cell Structure', 'Human Body Systems', 'Plant Physiology', 'Genetics', 'Ecology'],
    'General Science': ['Force and Motion', 'Light and Sound', 'Chemical Changes', 'Living World'],
    'Social Studies': ['History of India', 'World Geography', 'Indian Polity', 'Economics'],
    'Telugu': ['వ్యాకరణం', 'గద్యం', 'పద్యం', 'రచన'],
    'Physical Science': ['Kinematics', 'Heat', 'Electricity', 'Chemical Reactions', 'Acids and Bases'],
    'Biological Science': ['Cell Biology', 'Plant Kingdom', 'Animal Kingdom', 'Human Physiology', 'Ecology']
  };

  if (grade === 10 && board === 'CBSE') {
    defaults = {
      'Mathematics': [
        "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry", "Trigonometric Identities", "Heights and Distances", "Circles", "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"
      ],
      'Science': [
        "Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals", "Carbon and Its Compounds", "Life Processes", "Control and Coordination", "How do Organisms Reproduce", "Heredity and Evolution", "Light – Reflection and Refraction", "Human Eye and the Colourful World", "Electricity", "Magnetic Effects of Electric Current", "Sources of Energy"
      ],
      'Social Studies': [
        "The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World", "The Age of Industrialisation", "Print Culture and the Modern World", "Resources and Development", "Forest and Wildlife Resources", "Water Resources", "Agriculture", "Minerals and Energy Resources", "Manufacturing Industries", "Lifelines of National Economy", "Power Sharing", "Federalism", "Gender, Religion and Caste", "Political Parties", "Outcomes of Democracy", "Development", "Sectors of the Indian Economy", "Money and Credit", "Globalisation and the Indian Economy", "Consumer Rights"
      ],
      'English': [
        "A Letter to God", "Nelson Mandela - Long Walk to Freedom", "Stories About Flying", "From the Diary of Anne Frank", "Glimpses of India", "Mijbil the Otter", "Madam Rides the Bus", "The Sermon at Benares", "The Proposal (Play)", "Dust of Snow", "Fire and Ice", "A Tiger in the Zoo", "How to Tell Wild Animals", "The Ball Poem", "Amanda!", "The Trees", "Fog", "The Tale of Custard the Dragon", "For Anne Gregory", "A Triumph of Surgery", "The Thief's Story", "The Midnight Visitor", "A Question of Trust", "Footprints Without Feet", "The Making of a Scientist", "The Necklace", "Bholi", "The Book that Saved the Earth"
      ],
      'Hindi': [
        "सूरदास - पद", "तुलसीदास - राम-लक्ष्मण-परशुराम संवाद", "जयशंकर प्रसाद - आत्मकथ्य", "सूर्यकांत त्रिपाठी 'निराला' - उत्साह", "सूर्यकांत त्रिपाठी 'निराला' - अट नहीं रही है", "नागार्जुन - यह దంతరిత ముసకాన్", "नागार्जुन - फसल", "गिरिजाकुमार माथुर - छाया मत छूना", "ऋतुराज - कन्यादान", "मंगलेश डबराल - संगतकार", "स्वयं प्रकाश - नेताजी का चश्मा", "रामवृक्ष बेनीपुरी - बालगोबिन भगत", "यशपाल - लखनवी अंदाज़", "मन्नू भंडारी - एक कहानी यह भी", "महावीर प्रसाद द्विवेदी - स्त्री शिक्षा के विरोधी कुतर्कों का खंडन", "यतींद्र मिश्र - नौबतखाने में इबादत", "भदंत आनंद कौसल्यायन - संस्कृति"
      ]
    };
  } else if (grade === 10 && board === 'SSC') {
    defaults = {
      'Mathematics': [
        "Real Numbers", "Sets", "Polynomials", "Linear Equations in Two Variables", "Quadratic Equations", "Progressions", "Coordinate Geometry", "Similar Triangles", "Tangents and Secants to Circles", "Mensuration", "Trigonometry", "Applications of Trigonometry", "Probability", "Statistics"
      ],
      'Physics': [
        "Reflection of Light at Curved Surfaces", "Refraction of Light at Curved Surfaces", "Human Eye and Colourful World", "Electric Current", "Electromagnetism", "Chemical Equations", "Acids, Bases and Salts", "Structure of Atom", "Classification of Elements–the Periodic Table", "Chemical Bonding", "Principles of Metallurgy", "Carbon and Its Compounds"
      ],
      'Biology': [
        "Nutrition", "Respiration", "Transportation", "Excretion", "Coordination", "Reproduction", "Heredity and Evolution", "Our Environment", "Natural Resources"
      ],
      'Social Studies': [
        "India: Relief Features", "Ideas of Development", "Production and Employment", "Climate of India", "Indian Rivers and Water Resources", "The Population", "Settlements and Migration", "Rampur: A Village Economy", "Globalisation", "Food Security", "Sustainable Development with Equity", "World Between the World Wars", "National Liberation Movements in the Colonies", "National Movement in India – Partition & Independence (1939–1947)", "The Making of Independent India’s Constitution", "Election Process in India", "Independent India (1947–77)", "Emerging Political Trends (1977–2000)", "Post-War World and India", "Social Movements in Our Times", "The Movement for the Formation of Telangana State"
      ],
      'Telugu': [
        "దానశీలము", "ఎవరికి బాధ మించదు", "వీర తెలంగాణ", "కృష్ణదేవరాయలు", "నగరగీతం", "భాగ్యోదయం", "శతక మాధుర్యం", "లక్ష్మీదేవి", "టీవీభాష్యం", "గోలకొండ పట్టణం", "భిక్ష", "భూమిక", "రామాయణం"
      ],
      'Hindi-2': [
        "बरसते बादल", "ईदगाह", "माँ मुझे आने दे", "कण-कण का अधिकारी", "लोकगीत", "अंतर्राष्ट्रीय स्तर पर हिंदी", "भक्ति पद", "स्वराज्य की नींव", "दक्षिणी गंगा गोदावरी", "नीति दोहे", "जल ही जीवन है", "धरती के सवाल, अंतरिक्ष के जवाब"
      ],
      'English': [
        "Attitude is Altitude", "Every Success Story is also a Story of Great Failures", "I Will Do It", "The Dear Departed – I", "The Dear Departed – II", "The Brave Potter", "The Journey", "Another Woman", "The Never Never Nest", "Rendezvous with Ray", "Maya Bazaar", "A Tribute", "The Storeyed House – I", "The Storeyed House – II", "Abandoned", "Environment", "Or Will the Dreamer Wake", "My Childhood", "A Plea for India", "Unity in Diversity", "Jamaican Fragment", "Once Upon a Time", "What is My Name?"
      ]
    };
  } else if (grade === 10 && board === 'ICSE') {
    defaults = {
      'Physics': [
        "Force", "Work, Power and Energy", "Light", "Sound", "Electricity", "Electromagnetism", "Heat", "Modern Physics"
      ],
      'Chemistry': [
        "Periodic Properties and variations of Properties – Physical and Chemical", "Chemical Bonding", "Study of Acids, Bases and Salts", "Analytical Chemistry", "Mole Concept and Stoichiometry", "Electrolysis", "Metallurgy", "Study of Compounds – Hydrogen Chloride", "Study of Compounds – Ammonia", "Study of Compounds – Nitric Acid", "Study of Compounds – Sulphuric Acid", "Organic Chemistry"
      ],
      'Biology': [
        "Basic Biology", "Plant Physiology", "Human Anatomy and Physiology", "Population", "Human Evolution", "Pollution"
      ],
      'Mathematics': [
        "Commercial Mathematics", "Algebra", "Geometry", "Mensuration", "Trigonometry", "Statistics", "Probability"
      ],
      'history_civics': [
        "The Union Legislature", "The Union Executive", "The Indian National Movement (1857 - 1917)", "Mass Phase of the National Movement (1915-1947)", "The Contemporary World"
      ],
      'Geography': [
        "Interpretation of Topographical Maps", "Map of India", "Climate", "Soil Resources", "Natural Vegetation", "Water Resources", "Mineral and Energy Resources", "Agriculture", "Manufacturing Industries", "Transport", "Waste Management"
      ],
      'Economics': [
        "The Productive Mechanism", "Theory of Demand and Supply", "Market", "Banking in India", "Inflation", "Consumer Awareness"
      ],
      'English': [
        "Julius Caesar", "With the Photographer", "The Elevator", "The Girl Who Can", "The Pedestrian", "The Last Lesson", "Haunted Houses", "The Glove and the Lions", "When Great Trees Fall", "A Considerable Speck", "The Power of Music"
      ]
    };
  }

  return (defaults[subject] || ['Chapter 1', 'Chapter 2', 'Chapter 3'])
    .map((name, i) => ({ unitName: 'General', lessonNo: String(i + 1), chapterName: name }));
}

/**
 * GET /admin  — Render Admin Page
 */
exports.renderAdmin = (req, res) => {
  res.render('admin');
};

/**
 * POST /api/upload-pdf
 * Handles base64 PDF upload and updates the MongoDB schema
 */
exports.uploadPdf = async (req, res) => {
  const { grade, board, subject, chapterName, pdfDataUrl, pdfTitle } = req.body;

  if (!grade || !board || !subject || !chapterName || !pdfDataUrl) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // 1. Decode Base64 PDF
    const matches = pdfDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }

    const buffer = Buffer.from(matches[2], 'base64');

    // 2. Save PDF to disk
    const uploadDir = path.join(__dirname, '../public/uploads/pdfs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeChapter = chapterName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `grade${grade}_${board}_${subject.replace(/\\s/g, '')}_${safeChapter}_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);
    const pdfUrl = `/uploads/pdfs/${fileName}`;

    // 3. Update MongoDB Subject Chapter
    const gradeNum = parseInt(grade, 10);
    const boardUp = board.toUpperCase();

    let doc = await Subject.findOne({ grade: gradeNum, board: boardUp, subject });

    if (!doc) {
      // Create a default if doesn't exist
      doc = new Subject({
        grade: gradeNum,
        board: boardUp,
        subject,
        units: [{
          unitName: 'General',
          chapters: [{
            chapterName,
            pdfUrl,
            pdfTitle: pdfTitle || chapterName
          }]
        }]
      });
      await doc.save();
    } else {
      let found = false;
      for (const unit of doc.units) {
        for (const ch of unit.chapters) {
          if (ch.chapterName === chapterName) {
            ch.pdfUrl = pdfUrl;
            ch.pdfTitle = pdfTitle || chapterName;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        doc.units[0].chapters.push({
          chapterName,
          pdfUrl,
          pdfTitle: pdfTitle || chapterName
        });
      }

      await doc.save();
    }

    res.json({ success: true, pdfUrl });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
};

/**
 * POST /translate-batch
 * Batch translates array of strings
 */
exports.translateBatch = async (req, res) => {
  try {
    const { texts, lang, targetLang } = req.body;
    const reqLang = targetLang || lang;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: "Invalid texts array" });
    }

    if (reqLang === 'en' || reqLang === 'English') {
      const fallback = {};
      texts.forEach(t => fallback[t] = t);
      return res.json(fallback);
    }

    const langCodes = { 'English': 'en', 'Hindi': 'hi', 'Telugu': 'te', 'Tamil': 'ta', 'Kannada': 'kn', 'Malayalam': 'ml' };
    const target = langCodes[reqLang] || reqLang;

    // Robust parallel translation block
    const promises = texts.map(async (text) => {
      if (!text || text === '-') {
        return { original: text, translated: text };
      }
      try {
        const response = await translate(text, { to: target });
        return { original: text, translated: response.text };
      } catch (innerErr) {
        console.error("Error translating:", text);
        return { original: text, translated: text }; // fallback
      }
    });

    const resolved = await Promise.all(promises);
    const results = {};
    resolved.forEach(r => {
      results[r.original] = r.translated;
    });

    res.json(results);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
};
