const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper: strip markdown code fences from AI output
function stripCodeFences(text) {
    if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '').trim();
    }
    return text;
}

// ===== MCQ TEST GENERATION =====
exports.generateTest = async (req, res) => {
    try {
        const {
            board,
            grade,
            subject,
            focusTopic,
            difficulty,
            numQuestions
        } = req.body;

        // Validation
        if (!board || !grade || !subject || !focusTopic) {
            return res.status(400).json({
                error: "Missing required parameters."
            });
        }

        let actualBoard = board;

        if (board === "SSC") {
            actualBoard = "Telangana SSC";
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest"
        });

        const prompt = `
You are an expert educational MCQ test generator for the Indian education system.

Create a multiple-choice question (MCQ) test based on:

- Board: ${actualBoard}
- Grade: ${grade}
- Subject: ${subject}
- Topic: ${focusTopic}
- Difficulty: ${difficulty || 'medium'}
- Number of Questions: ${numQuestions || 5}

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

        const result = await model.generateContent(prompt);

        const response = await result.response;

        let jsonText = stripCodeFences(response.text());

        try {
            const parsed = JSON.parse(jsonText);

            return res.status(200).json({
                avgTimeSeconds:
                    parsed.avgTimeSeconds ||
                    ((numQuestions || 5) * 60),

                questions:
                    parsed.questions || []
            });

        } catch (parseError) {

            console.error(
                "Error parsing Gemini output:",
                jsonText
            );

            return res.status(500).json({
                error: "Failed to parse AI response.",
                rawOutput: jsonText
            });
        }

    } catch (err) {

        console.error("Error generating MCQ test:", err);

        return res.status(500).json({
            error: "Internal server error while generating test."
        });
    }
};
