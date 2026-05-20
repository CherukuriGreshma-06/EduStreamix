/* ════════════════════════════════════════════════
   Seed Script — Seed Class 10 subjects & chapters
   Run: node seeds/seed_class_10.js
   ════════════════════════════════════════════════ */

require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('../models/Subject');

const sscClassX = require('./SSC_Class_X');
const cbseClassX = require('./CBSE_Class_X');
const icseClassX = require('./ICSE_Class_X');

const SEED_DATA = [
  // ── CBSE Class 10 ──────────────────────────
  {
    grade: 10,
    board: 'CBSE',
    subject: 'Mathematics',
    chaptersList: cbseClassX.maths
  },
  {
    grade: 10,
    board: 'CBSE',
    subject: 'Science',
    chaptersList: cbseClassX.science
  },
  {
    grade: 10,
    board: 'CBSE',
    subject: 'Social Studies',
    chaptersList: cbseClassX.socialStudies
  },
  {
    grade: 10,
    board: 'CBSE',
    subject: 'English',
    chaptersList: cbseClassX.english
  },
  {
    grade: 10,
    board: 'CBSE',
    subject: 'Hindi',
    chaptersList: cbseClassX.hindi
  },

  // ── SSC Class 10 ───────────────────────────
  {
    grade: 10,
    board: 'SSC',
    subject: 'Mathematics',
    chaptersList: sscClassX.mathematics
  },
  {
    grade: 10,
    board: 'SSC',
    subject: 'Physics',
    chaptersList: sscClassX.physics
  },
  {
    grade: 10,
    board: 'SSC',
    subject: 'Biology',
    chaptersList: sscClassX.biology
  },
  {
    grade: 10,
    board: 'SSC',
    subject: 'Social Studies',
    chaptersList: sscClassX.socialStudies
  },
  {
    grade: 10,
    board: 'SSC',
    subject: 'Telugu',
    chaptersList: sscClassX.telugu
  },
  {
    grade: 10,
    board: 'SSC',
    subject: 'Hindi-2',
    chaptersList: sscClassX.hindi_2
  },
  {
    grade: 10,
    board: 'SSC',
    subject: 'English',
    chaptersList: sscClassX.english
  },

  // ── ICSE Class 10 ──────────────────────────
  {
    grade: 10,
    board: 'ICSE',
    subject: 'Physics',
    chaptersList: icseClassX.physics
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'Chemistry',
    chaptersList: icseClassX.chemistry
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'Biology',
    chaptersList: icseClassX.biology
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'Mathematics',
    chaptersList: icseClassX.maths
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'history_civics',
    chaptersList: icseClassX.history_civics
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'Geography',
    chaptersList: icseClassX.geography
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'Economics',
    chaptersList: icseClassX.economics
  },
  {
    grade: 10,
    board: 'ICSE',
    subject: 'English',
    chaptersList: icseClassX.english
  }
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    console.log('Clearing existing Class 10 subjects...');
    const deleteResult = await Subject.deleteMany({ grade: 10 });
    console.log(`Deleted ${deleteResult.deletedCount} existing Class 10 subjects.`);

    console.log('Preparing new subjects...');
    const subjectsToInsert = SEED_DATA.map(item => {
      const units = [
        {
          unitName: 'General',
          chapters: item.chaptersList.map((chapName, index) => ({
            lessonNo: String(index + 1),
            chapterName: chapName,
            videos: [],
            pdfUrl: '',
            pdfTitle: '',
            keyMoments: [],
            quizQuestions: [],
            summary: ''
          }))
        }
      ];

      return {
        grade: item.grade,
        board: item.board,
        subject: item.subject,
        units: units
      };
    });

    console.log(`Inserting ${subjectsToInsert.length} Class 10 subjects...`);
    const insertResult = await Subject.insertMany(subjectsToInsert);
    console.log(`✅ Successfully seeded ${insertResult.length} Class 10 subjects!`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
