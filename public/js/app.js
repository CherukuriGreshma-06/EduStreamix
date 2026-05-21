// ---------------- GLOBALS ----------------
let videoData = null;
let cachedFlag = false;

const chaptersSection = document.getElementById('chaptersSection');
const videoSection = document.getElementById('videoSection');

const DISPLAY_SUBJECT = window.__DISPLAY_SUBJECT__ || sessionStorage.getItem('subject') || '';

// ---------------- FETCH CHAPTERS ----------------
async function getFinalChapters(apiUrl, cacheKey) {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    console.log("API DATA:", data);

    if (data.error) {
      console.error('Chapters API error:', data.error);
      return [];
    }

    // Case 1: { chapters: [...] }
    if (data.chapters) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data.chapters));
      return data.chapters;
    }

    // Case 2: direct array []
    if (Array.isArray(data)) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    }

    return [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

// ---------------- SHOW CHAPTERS ----------------
async function showChapters(apiUrl) {
  const finalChapters = await getFinalChapters(apiUrl, 'chapters');

  console.log("FINAL CHAPTERS:", finalChapters);

  const container = document.getElementById('chaptersContainer');
  if (!container) return;
  container.innerHTML = '';

  finalChapters.forEach(ch => {
    const tr = document.createElement('tr');
    tr.className = 'chapter-row';

    tr.onclick = () => {
      showVideoMode(ch);
    };

    const tdLesson = document.createElement('td');
    tdLesson.className = 'col-lesson';
    tdLesson.innerText = ch.lessonNo || '-';

    const tdTitle = document.createElement('td');
    tdTitle.className = 'col-title';
    // Create clickable link for chapter name
    const titleLink = document.createElement('a');
    titleLink.href = '#';
    titleLink.innerText = ch.chapterName;
    titleLink.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent row click
      showVideoMode(ch);
    });
    tdTitle.appendChild(titleLink);

    const tdLink = document.createElement('td');
    tdLink.className = 'col-link';
    if (ch.link) {
      tdLink.innerHTML = `<a href="${ch.link}" target="_blank" rel="noopener">Watch</a>`;
    } else {
      tdLink.innerHTML = '<span>-</span>';
    }

    tr.appendChild(tdLesson);
    tr.appendChild(tdTitle);
    tr.appendChild(tdLink);
    container.appendChild(tr);
  });
}

// ---------------- SHOW VIDEO ----------------
async function showVideoMode(currentChapterData) {

  // Reset
  videoData = null;
  cachedFlag = false;

  // 1. Check resources array first
  if (currentChapterData.resources && currentChapterData.resources.length > 0) {
    const link = currentChapterData.resources[0].link;
    console.log("VIDEO LINK FROM RESOURCES:", link);
    useVideoLink(link, currentChapterData.chapterName);
    return;
  }

  // 2. Check direct link property
  if (currentChapterData.link) {
    console.log("VIDEO LINK FROM DIRECT PROPERTY:", currentChapterData.link);
    useVideoLink(currentChapterData.link, currentChapterData.chapterName);
    return;
  }

  // 3. Fallback: Fetch video dynamically from YouTube API via /api/video
  try {
    const chapterName = currentChapterData.chapterName;
    const grade = window.__GRADE__ || '10';
    const board = window.__BOARD__ || '';
    const subject = window.__SUBJECT__ || '';
    const appLang = localStorage.getItem('appLang') || 'English';

    const url = `/api/video?chapter=${encodeURIComponent(chapterName)}&grade=${grade}&board=${board}&subject=${encodeURIComponent(subject)}&language=${appLang}`;
    console.log("Fetching video from:", url);

    // Show a loading state in the player UI
    const title = document.getElementById('videoTitle');
    const iframe = document.getElementById('videoFrame');

    hideAllSections();
    videoSection.style.display = '';
    title.innerText = "Loading video...";
    iframe.src = "";

    const res = await fetch(url);
    const data = await res.json();

    if (data?.error) {
      alert(data.error || "No video found for this chapter.");
      goBack();
      return;
    }

    if (data && data.video) {
      const vid = data.video;
      videoData = {
        youtubeVideoId: vid.youtubeVideoId,
        title: vid.title || (chapterName + ' — ' + DISPLAY_SUBJECT)
      };
      renderVideo();
    } else {
      alert("No video found for this chapter.");
      goBack();
    }
  } catch (err) {
    console.error("Error fetching video:", err);
    alert("Error loading video.");
    goBack();
  }
}

// ---------------- PLAY SPECIFIC LINK ----------------
function useVideoLink(link, chapterName) {
  let videoId = '';

  // Handle embed link
  if (link.includes('embed/')) {
    videoId = link.split('embed/')[1].split('?')[0];
  }
  // Handle watch link
  else if (link.includes('v=')) {
    videoId = link.split('v=')[1].split('&')[0];
  }

  if (videoId) {
    videoData = {
      youtubeVideoId: videoId,
      title: chapterName + ' — ' + DISPLAY_SUBJECT
    };
    cachedFlag = true;
    renderVideo();
  } else {
    // fallback: open direct link
    window.open(link, '_blank');
  }
}

// ---------------- RENDER VIDEO ----------------
function renderVideo() {
  if (!videoData) return;

  hideAllSections();

  videoSection.style.display = '';

  const iframe = document.getElementById('videoFrame');
  const title = document.getElementById('videoTitle');

  iframe.src = `https://www.youtube.com/embed/${videoData.youtubeVideoId}`;
  title.innerText = videoData.title;
}

// ---------------- HELPERS ----------------
function hideAllSections() {
  chaptersSection.style.display = 'none';
  videoSection.style.display = 'none';
}

// ---------------- INITIALIZATION ----------------
document.addEventListener('DOMContentLoaded', () => {
  const grade = window.__GRADE__ || '10';
  const board = window.__BOARD__ || '';
  const subject = window.__SUBJECT__ || '';
  const appLang = localStorage.getItem('appLang') || 'English';

  const apiUrl = `/api/chapters?grade=${grade}&board=${board}&subject=${encodeURIComponent(subject)}&lang=${appLang}`;
  showChapters(apiUrl);
});

// ---------------- AI QUIZ ----------------
let currentQuizData = null;

async function generateQuiz() {
  const aiQuizSection = document.getElementById('aiQuizSection');
  const quizBody = document.getElementById('quizBody');
  const quizActions = document.getElementById('quizActions');
  const quizResult = document.getElementById('quizResult');
  const generateBtn = document.getElementById('generateQuizBtn');

  const grade = window.__GRADE__ || '10';
  const board = window.__BOARD__ || '';
  const subject = window.__SUBJECT__ || '';
  const appLang = localStorage.getItem('appLang') || 'English';
  const chapterName = videoData ? videoData.title.split(' — ')[0] : 'General Topic';

  generateBtn.style.display = 'none';
  aiQuizSection.style.display = 'block';
  quizActions.style.display = 'none';
  quizResult.style.display = 'none';
  
  quizBody.innerHTML = `
    <div class="video-loader" style="position:relative; height: 150px;">
      <div class="loader-spinner"></div>
      <span style="margin-top:1rem;">Generating your AI Quiz...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/generate-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: board,
        grade: grade,
        subject: subject,
        focusTopic: chapterName,
        lang: appLang,
        numQuestions: 5
      })
    });

    const data = await res.json();

    if (data.error) {
      quizBody.innerHTML = `<p style="color:red;">Error: ${data.message}</p>`;
      generateBtn.style.display = 'block';
      return;
    }

    currentQuizData = data;
    renderQuiz(data.questions);

  } catch (err) {
    console.error(err);
    quizBody.innerHTML = `<p style="color:red;">Failed to generate quiz. Please try again.</p>`;
    generateBtn.style.display = 'block';
  }
}

function renderQuiz(questions) {
  const quizBody = document.getElementById('quizBody');
  const quizActions = document.getElementById('quizActions');
  
  if (!questions || questions.length === 0) {
    quizBody.innerHTML = '<p>No questions generated.</p>';
    return;
  }

  let html = '';
  questions.forEach((q, index) => {
    html += `
      <div class="quiz-question" id="q-${index}">
        <p>${index + 1}. ${q.question}</p>
        ${q.options.map((opt, oIndex) => `
          <label class="quiz-option" id="opt-${index}-${oIndex}">
            <input type="radio" name="q-${index}" value="${oIndex}">
            <span>${opt}</span>
          </label>
        `).join('')}
        <div id="exp-${index}" class="quiz-explanation" style="display:none;">
          <strong>Explanation:</strong> ${q.explanation}
        </div>
      </div>
    `;
  });

  quizBody.innerHTML = html;
  quizActions.style.display = 'block';

  document.getElementById('submitQuizBtn').onclick = submitQuiz;
}

function submitQuiz() {
  if (!currentQuizData || !currentQuizData.questions) return;

  let score = 0;
  const questions = currentQuizData.questions;

  questions.forEach((q, index) => {
    const selected = document.querySelector(`input[name="q-${index}"]:checked`);
    const expDiv = document.getElementById(`exp-${index}`);
    expDiv.style.display = 'block'; // Show explanation

    // Mark correct option visually
    const correctLabel = document.getElementById(`opt-${index}-${q.correctAnswerIndex}`);
    if (correctLabel) correctLabel.classList.add('correct');

    if (selected) {
      const selectedIndex = parseInt(selected.value, 10);
      if (selectedIndex === q.correctAnswerIndex) {
        score++;
      } else {
        const wrongLabel = document.getElementById(`opt-${index}-${selectedIndex}`);
        if (wrongLabel) wrongLabel.classList.add('wrong');
      }
    }
  });

  const quizActions = document.getElementById('quizActions');
  const quizResult = document.getElementById('quizResult');
  const generateBtn = document.getElementById('generateQuizBtn');

  quizActions.style.display = 'none';
  quizResult.style.display = 'block';
  
  const percentage = (score / questions.length) * 100;
  let resultClass = 'bad';
  if (percentage >= 80) resultClass = 'good';
  else if (percentage >= 50) resultClass = 'ok';

  quizResult.className = `quiz-result ${resultClass}`;
  quizResult.innerHTML = `You scored ${score} out of ${questions.length}!`;
  
  generateBtn.innerText = 'Generate Another Quiz';
  generateBtn.style.display = 'block';
}