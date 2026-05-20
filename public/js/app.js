// ---------------- GLOBALS ----------------
let videoData = null;
let cachedFlag = false;

const chaptersSection = document.getElementById('chaptersSection');
const videoSection = document.getElementById('videoSection');

const DISPLAY_SUBJECT = sessionStorage.getItem('subject') || '';

// ---------------- FETCH CHAPTERS ----------------
async function getFinalChapters(apiUrl, cacheKey) {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    console.log("API DATA:", data);

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
  container.innerHTML = '';

  finalChapters.forEach(ch => {
    const div = document.createElement('div');
    div.className = 'chapter-card';

    // ✅ IMPORTANT: use chapterName (not name)
    div.innerText = ch.chapterName;

    div.onclick = () => {
      showVideoMode(ch);
    };

    container.appendChild(div);
  });
}

// ---------------- SHOW VIDEO ----------------
function showVideoMode(currentChapterData) {

  // Reset
  videoData = null;
  cachedFlag = false;

  // ✅ FIXED: use resources array
  if (currentChapterData.resources && currentChapterData.resources.length > 0) {

    const link = currentChapterData.resources[0].link;
    console.log("VIDEO LINK:", link);

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
        title: currentChapterData.chapterName + ' — ' + DISPLAY_SUBJECT
      };
      cachedFlag = true;
    } else {
      // fallback: open direct link
      window.open(link, '_blank');
      return;
    }
  }

  renderVideo();
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