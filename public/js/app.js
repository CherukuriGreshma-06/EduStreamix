/* ════════════════════════════════════════════════
   EduStreamix — Client-Side Study Page Logic
   ════════════════════════════════════════════════ */
(function () {
  'use strict';

  const GRADE = window.__GRADE__;
  const BOARD = window.__BOARD__;
  const SUBJECT = window.__SUBJECT__;
  const DISPLAY_SUBJECT = window.__DISPLAY_SUBJECT__ || SUBJECT;
  let LANGUAGE = window.__LANGUAGE__ || 'English';
  let currentChapterData = null;
  let ytPlayer = null;

  // Inject YouTube API
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  if(firstScriptTag) firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  else document.head.appendChild(tag);

  // DOM
  const chaptersSection = document.getElementById('chapters-section');
  const chaptersList = document.getElementById('chapters-list');

  const videoSection = document.getElementById('video-section');

  async function getFinalChapters(grade, board, subject, selectedLanguage) {
    const cacheKey = `chapters_v4_${selectedLanguage}_${grade}_${board}_${subject}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    
    const params = new URLSearchParams({ grade, board, subject, lang: selectedLanguage });
    const res = await fetch('/api/chapters?' + params.toString());
    const data = await res.json();
    
    if (data.chapters) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data.chapters));
      return data.chapters;
    }
    return [];
  }

  // ── Load Chapters on Init ─────────────────
  async function showChapters() {
    hideAllSections();
    chaptersSection.style.display = '';
    chaptersList.innerHTML = `
      <div class="loader-spinner" style="margin: 0 auto;"></div>
      ${Array(3).fill('<div class="skeleton-item" style="margin-top:1rem;"></div>').join('')}
    `;
    try {
      const finalChapters = await getFinalChapters(GRADE, BOARD, SUBJECT, LANGUAGE);
      
      if (!finalChapters || !finalChapters.length) {
        chaptersList.innerHTML = '<p class="no-data-msg">No chapters found.</p>';
        return;
      }

      chaptersList.innerHTML = '';
      
      const units = {};
      finalChapters.forEach(ch => {
        const u = ch.unitName || 'General';
        if (!units[u]) units[u] = [];
        units[u].push(ch);
      });

      for (const [unitName, chaps] of Object.entries(units)) {
        const table = document.createElement('table');
        table.className = 'chapters-table';
        
        const thead = document.createElement('thead');
        
        // Use the ALREADY TRANSLATED unitName from the data!
        // Do NOT pass it through window.t() again!
        const unitNameLabel = unitName;
        
        // Translate static UI labels
        const lessonNoLabel = window.t ? window.t('Lesson No.') : 'Lesson No.';
        const chapterTitleLabel = window.t ? window.t('Chapter Title') : 'Chapter Title';
        const colspan = 2;

        thead.innerHTML = `
          <tr class="unit-title-row">
            <th colspan="${colspan}">${unitNameLabel}</th>
          </tr>
          <tr class="col-headers-row">
            <th>${lessonNoLabel}</th>
            <th>${chapterTitleLabel}</th>
          </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        chaps.forEach(ch => {
          const tr = document.createElement('tr');
          tr.className = 'chapter-row';
          tr.addEventListener('click', () => {
            currentChapterData = ch;
            showVideoMode(LANGUAGE);
          });
          
          tr.innerHTML = `
            <td class="col-lesson">${ch.lessonNo || '-'}</td>
            <td class="col-title">${ch.chapterName || '-'}</td>
          `;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        
        chaptersList.appendChild(table);
      }
    } catch (e) {
      console.error(e);
      chaptersList.innerHTML = '<p class="no-data-msg error-msg">Error loading chapters.</p>';
    }
  }


  // ── Video Mode ────────────────────────────
  async function showVideoMode(selectedLanguage = LANGUAGE, instantSwitch = false) {
    const titleEl = document.getElementById('video-title');
    const metaEl = document.getElementById('video-meta');
    const loader = document.getElementById('video-loader');
    
    // Handle YT Player Div
    const wrapper = document.getElementById('video-wrapper');
    let placeholder = document.getElementById('video-iframe-container');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.id = 'video-iframe-container';
      placeholder.style.cssText = 'display:none; position:absolute; top:0; left:0; width:100%; height:100%;';
      wrapper.appendChild(placeholder);
    }

    if (!instantSwitch) {
      hideAllSections();
      videoSection.style.display = '';
      loader.style.display = 'flex';
      placeholder.style.display = 'none';
      titleEl.textContent = window.t ? window.t('Loading video...') : 'Loading video...';
      titleEl.setAttribute('data-i18n', 'Loading video...');
      metaEl.innerHTML = '';

      // Reset components
      document.getElementById('quiz-section').style.display = 'none';
    }

    try {
      let videoData = null;
      let cachedFlag = false;

      // Use the direct link from the database if available
      if (currentChapterData.link) {
        let videoId = '';
        if (currentChapterData.link.includes('embed/')) {
          videoId = currentChapterData.link.split('embed/')[1].split('?')[0];
        } else if (currentChapterData.link.includes('v=')) {
          videoId = currentChapterData.link.split('v=')[1].split('&')[0];
        }
        
        if (videoId) {
          videoData = {
            youtubeVideoId: videoId,
            title: currentChapterData.chapterName + ' — ' + DISPLAY_SUBJECT
          };
          cachedFlag = true;
        } else {
          // If it's not a YouTube video, just open it in a new tab and return
          window.open(currentChapterData.link, '_blank');
          hideAllSections();
          chaptersSection.style.display = '';
          return;
        }
      }

      // Fallback to /api/video if no direct link
      if (!videoData) {
        const params = new URLSearchParams({
          chapter: currentChapterData.originalChapterName || currentChapterData.chapterName, 
          grade: GRADE, 
          language: selectedLanguage, 
          board: BOARD, 
          subject: SUBJECT
        });
        const res = await fetch('/api/video?' + params.toString());
        const data = await res.json();

        if (!data.video) {
          titleEl.textContent = 'No video found';
          loader.innerHTML = '<p class="no-data-msg error-msg">No video found for this topic.</p>';
          return;
        }
        videoData = data.video;
        cachedFlag = data.cached;
      }
      
      const langCodes = { 'English':'en', 'Hindi':'hi', 'Telugu':'te', 'Tamil':'ta', 'Kannada':'kn', 'Malayalam':'ml' };
      const code = langCodes[selectedLanguage] || 'en';

      if (ytPlayer) {
        ytPlayer.destroy();
        ytPlayer = null;
      }
      
      let placeholder = document.getElementById('video-iframe-container');
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.id = 'video-iframe-container';
        placeholder.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%;';
        wrapper.appendChild(placeholder);
      } else {
        placeholder.style.display = 'block';
      }

      ytPlayer = new YT.Player('video-iframe-container', {
        videoId: videoData.youtubeVideoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 1,
          hl: code,
          cc_lang_pref: code
        },
        events: {
          'onReady': (event) => {
             try {
               event.target.loadModule('captions');
               event.target.setOption('captions', 'track', { languageCode: code });
             } catch(e) {}
          }
        }
      });
      
      loader.style.display = 'none';
      const defaultTitle = currentChapterData.chapterName + ' — ' + DISPLAY_SUBJECT;
      titleEl.textContent = videoData.title || defaultTitle;
      titleEl.removeAttribute('data-i18n'); // Use actual video title or translated string

      let meta = '';
      if (videoData.viewCount) meta += '<span>👁️ ' + Number(videoData.viewCount).toLocaleString() + ' views</span>';
      if (videoData.likeCount) meta += '<span>👍 ' + Number(videoData.likeCount).toLocaleString() + ' likes</span>';
      if (cachedFlag) meta += '<span>⚡ Cached</span>';
      metaEl.innerHTML = meta;

      if (!instantSwitch) {
        showQuiz();
      }
    } catch (e) {
      titleEl.textContent = 'Error loading video';
      loader.innerHTML = '<p class="no-data-msg error-msg">Could not load video.</p>';
    }
  }

  // ── Quiz (AI-powered with fallback) ────────
  async function showQuiz() {
    const section = document.getElementById('quiz-section');
    const body = document.getElementById('quiz-body');
    const actions = document.getElementById('quiz-actions');
    const result = document.getElementById('quiz-result');
    const retake = document.getElementById('quiz-retake-btn');
    const submit = document.getElementById('quiz-submit-btn');

    section.style.display = '';
    result.style.display = 'none';
    retake.style.display = 'none';
    actions.style.display = 'none';
    body.innerHTML = '<div class="loader-spinner" style="margin: 0 auto;"></div><p style="text-align:center;margin-top:0.5rem;color:var(--text-secondary,#aaa);">Generating AI quiz…</p>';

    let questions = [];
    let isAI = false;

    // 1. Try AI-generated quiz
    try {
      const topicName = currentChapterData.originalChapterName || currentChapterData.chapterName;
      const res = await fetch('/api/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: BOARD,
          grade: GRADE,
          subject: SUBJECT,
          focusTopic: topicName,
          difficulty: 'medium',
          numQuestions: 5
        })
      });
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        // Normalise AI response to match existing quiz format
        questions = data.questions.map(q => ({
          question: q.question,
          options: q.options,
          answer: q.correctAnswerIndex,
          explanation: q.explanation || ''
        }));
        isAI = true;
      }
    } catch (e) {
      console.warn('AI quiz generation failed, falling back to static quiz:', e.message);
    }

    // 2. Fallback to hardcoded quiz data
    if (!questions.length) {
      let pool = currentChapterData.quizQuestions;
      if (!pool || pool.length === 0) {
        pool = (window.QUIZ_DATA && window.QUIZ_DATA[SUBJECT]) ? window.QUIZ_DATA[SUBJECT] : (window.QUIZ_DATA ? window.QUIZ_DATA['General'] : []);
      }
      if (!pool || pool.length === 0) { section.style.display = 'none'; return; }
      questions = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    }

    // 3. Translate if needed
    if (LANGUAGE !== 'English' && LANGUAGE !== 'en') {
      const textsToTranslate = [];
      questions.forEach(q => {
        if (!textsToTranslate.includes(q.question)) textsToTranslate.push(q.question);
        q.options.forEach(opt => { if (!textsToTranslate.includes(opt)) textsToTranslate.push(opt); });
        if (q.explanation && !textsToTranslate.includes(q.explanation)) textsToTranslate.push(q.explanation);
      });
      if (textsToTranslate.length > 0) {
        try {
          const res = await fetch('/translate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: textsToTranslate, targetLang: LANGUAGE })
          });
          const translations = await res.json();
          questions = questions.map(q => ({
            ...q,
            question: translations[q.question] || q.question,
            options: q.options.map(opt => translations[opt] || opt),
            explanation: q.explanation ? (translations[q.explanation] || q.explanation) : ''
          }));
        } catch (e) { console.error("Quiz translation failed", e); }
      }
    }

    // 4. Render questions
    actions.style.display = '';
    body.innerHTML = '';
    if (isAI) {
      const badge = document.createElement('div');
      badge.className = 'ai-quiz-badge';
      badge.innerHTML = '✨ AI-Generated Quiz';
      body.appendChild(badge);
    }
    questions.forEach((q, qi) => {
      const div = document.createElement('div');
      div.className = 'quiz-question';
      div.dataset.answer = q.answer !== undefined ? q.answer : q.correctAnswer;
      div.dataset.explanation = q.explanation || '';
      let html = '<p>' + (qi+1) + '. <span>' + q.question + '</span></p>';
      q.options.forEach((opt, oi) => {
        html += '<label class="quiz-option"><input type="radio" name="q' + qi + '" value="' + oi + '"> <span>' + opt + '</span></label>';
      });
      div.innerHTML = html;
      body.appendChild(div);
    });

    // 5. Submit handler
    submit.onclick = () => {
      let score = 0;
      const qDivs = body.querySelectorAll('.quiz-question');
      qDivs.forEach((qDiv) => {
        const correct = parseInt(qDiv.dataset.answer);
        const selected = qDiv.querySelector('input:checked');
        const opts = qDiv.querySelectorAll('.quiz-option');
        if (opts[correct]) opts[correct].classList.add('correct');
        if (selected) {
          const val = parseInt(selected.value);
          if (val === correct) { score++; }
          else { if (opts[val]) opts[val].classList.add('wrong'); }
        }
        qDiv.querySelectorAll('input').forEach(inp => inp.disabled = true);
        // Show explanation if available
        const explanation = qDiv.dataset.explanation;
        if (explanation) {
          const expDiv = document.createElement('div');
          expDiv.className = 'quiz-explanation';
          expDiv.innerHTML = '💡 ' + explanation;
          qDiv.appendChild(expDiv);
        }
      });
      actions.style.display = 'none';
      result.style.display = '';
      result.textContent = (window.t ? window.t('Score') : 'Score') + ': ' + score + ' / ' + qDivs.length;
      result.className = 'quiz-result ' + (score >= (qDivs.length * 0.8) ? 'good' : score >= (qDivs.length * 0.4) ? 'ok' : 'bad');
      retake.style.display = '';
    };

    retake.onclick = showQuiz;
  }


  // ── Helpers ───────────────────────────────
  function hideAllSections() {
    chaptersSection.style.display = 'none';
    videoSection.style.display = 'none';
    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
      ytPlayer.stopVideo();
    }
  }

  document.addEventListener('languageChanged', (e) => {
    const newLang = e.detail;
    LANGUAGE = newLang;

    // Update YT Captions seamlessly without reload
    if (ytPlayer && typeof ytPlayer.setOption === 'function') {
      const langCodes = { 'English':'en', 'Hindi':'hi', 'Telugu':'te', 'Tamil':'ta', 'Kannada':'kn', 'Malayalam':'ml' };
      const code = langCodes[newLang] || 'en';
      try {
        ytPlayer.setOption('captions', 'track', { languageCode: code });
      } catch(err) {
        console.warn('Captions update failed', err);
      }
    }

    // Always re-render dynamically generated elements like chapters and quiz
    if (chaptersSection.style.display !== 'none' || !window.chaptersInitiallyLoaded) {
      window.chaptersInitiallyLoaded = true;
      showChapters();
    }
  });

  // ── Back Buttons ──────────────────────────
  document.getElementById('back-from-video').addEventListener('click', showChapters);

  // ── Init ───────────────────────────────────
  // showChapters() is intentionally not called here anymore.
  // It waits for 'languageChanged' event from i18n.js to ensure window.t is fully ready before caching translations!
})();
