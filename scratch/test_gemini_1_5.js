require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  console.log('API Key present:', !!process.env.GEMINI_API_KEY);
  console.log('API Key starts with:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 8) + '...' : 'MISSING');
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Simulate exact same prompt the quiz controller sends
    const prompt = `
You are an expert educational MCQ test generator for the Indian education system.

Create a multiple-choice question (MCQ) test based on:

- Board: ICSE
- Grade: 10
- Subject: Physics
- Topic: Force
- Difficulty: medium
- Number of Questions: 5

Rules:
- Questions must match the syllabus and grade level.
- Questions should be educational and accurate.
- Provide 4 options for each question.
- Only one option should be correct.
- Include a short explanation for the correct answer.
- Estimate average completion time in seconds.

Return ONLY valid JSON.
No markdown.
No backticks.

Format:
{
  "avgTimeSeconds": 300,
  "questions": [
    {
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswerIndex": 0,
      "explanation": "Explanation here"
    }
  ]
}
`;

    console.log('\nSending request to Gemini 1.5 Flash...');
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    
    // Strip code fences
    if (text.startsWith('```json')) {
      text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    const parsed = JSON.parse(text);
    console.log('\n✅ AI Quiz generated successfully!');
    console.log('Number of questions:', parsed.questions.length);
    parsed.questions.forEach((q, i) => {
      console.log(`\nQ${i+1}: ${q.question}`);
      q.options.forEach((opt, j) => {
        console.log(`  ${j === q.correctAnswerIndex ? '✓' : ' '} ${opt}`);
      });
      console.log(`  Explanation: ${q.explanation}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
