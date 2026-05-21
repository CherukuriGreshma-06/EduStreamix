/* ──────────────────────────────────────────────
   YouTube Data API v3 — Video Search & Ranking
   ────────────────────────────────────────────── */

const axios = require('axios');

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * Fetch the best embeddable YouTube video for a given topic, grade, and language.
 *
 * @param {string} topic     — e.g. "Kinematics"
 * @param {number} grade     — e.g. 8
 * @param {string} language  — "English" | "Hindi" | "Telugu"
 * @param {string} subject   — e.g. "Science"
 * @returns {object|null}    — { youtubeVideoId, title, viewCount, likeCount, embedUrl }
 */
async function fetchBestVideo(topic, grade, language, subject) {
  try {
    const apiKey = process.env.YT_API_KEY;
    if (!apiKey || apiKey === 'YOUR_YOUTUBE_API_KEY_HERE') {
      console.warn('⚠️  YouTube API key not set. Returning placeholder.');
      return _placeholderVideo(topic, grade, language);
    }

    // ── Step 1: Search YouTube ────────────────
    const subjectQuery = subject ? ` ${subject} ` : ' ';
    // Use the same video regardless of language (rely on CC captions)
    const searchQuery = `${topic} class ${grade}${subjectQuery}`;
    const searchRes = await axios.get(YT_SEARCH_URL, {
      params: {
        part:       'snippet',
        q:          searchQuery,
        type:       'video',
        videoEmbeddable: 'true',
        maxResults: 10,
        key:        apiKey
      }
    });

    const videoIds = searchRes.data.items
      .map(item => item.id.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) return null;

    // ── Step 2: Get video statistics ──────────
    const statsRes = await axios.get(YT_VIDEOS_URL, {
      params: {
        part: 'statistics,snippet,status',
        id:   videoIds.join(','),
        key:  apiKey
      }
    });

    // ── Step 3: Filter embeddable & rank ──────
    const ranked = statsRes.data.items
      .filter(v => v.status.embeddable)
      .map(v => ({
        youtubeVideoId: v.id,
        title:          v.snippet.title,
        viewCount:      parseInt(v.statistics.viewCount || '0', 10),
        likeCount:      parseInt(v.statistics.likeCount || '0', 10),
        embedUrl:       `https://www.youtube.com/embed/${v.id}`,
        // Score: views + 2× likes (likes weighted higher as quality signal)
        _score:         parseInt(v.statistics.viewCount || '0', 10) +
                        parseInt(v.statistics.likeCount || '0', 10) * 2
      }))
      .sort((a, b) => b._score - a._score);

    if (ranked.length === 0) return null;

    const best = ranked[0];
    delete best._score;
    return best;

  } catch (err) {
    console.error('YouTube API error:', err.response?.data || err.message);
    return _placeholderVideo(topic, grade, language);
  }
}

/**
 * Returns a placeholder when no API key is configured.
 * Uses a known educational video so the UI still works.
 */
function _placeholderVideo(topic, grade, language) {
  return {
    youtubeVideoId: 'dQw4w9WgXcQ',
    title:          `[Placeholder] ${topic} — Class ${grade} (${language})`,
    viewCount:      0,
    likeCount:      0,
    embedUrl:       'https://www.youtube.com/embed/dQw4w9WgXcQ'
  };
}

module.exports = { fetchBestVideo };
