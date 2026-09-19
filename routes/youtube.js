const express = require('express');
const ytSearch = require('yt-search');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

function cleanQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

// Admin-only YouTube discovery API.
// Playback stays on YouTube's official embed player; this endpoint does not
// download or proxy copyrighted audio/video.
router.get('/search', adminAuth, async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({ success: false, error: 'Enter a song, artist, or video to search.' });
  }

  if (query.length < 2) {
    return res.status(400).json({ success: false, error: 'Search must contain at least 2 characters.' });
  }

  try {
    const result = await ytSearch(query);
    const videos = Array.isArray(result?.videos) ? result.videos : [];

    const songs = videos
      .filter((video) => video && video.videoId && video.title)
      .slice(0, 20)
      .map((video) => ({
        title: String(video.title),
        id: String(video.videoId),
        url: String(video.url || `https://www.youtube.com/watch?v=${video.videoId}`),
        thumbnail: String(video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`),
        views: Number.isFinite(Number(video.views)) ? Number(video.views) : 0,
        duration: video.duration?.toString?.() || 'Live',
        published: video.ago || video.uploadDate || '',
        author: video.author?.name || video.author?.channelName || '',
      }));

    res.set('Cache-Control', 'private, max-age=30');
    return res.json({ success: true, query, songs });
  } catch (error) {
    console.error('Admin YouTube search error:', error);
    return res.status(502).json({
      success: false,
      error: 'YouTube search is temporarily unavailable. Please try again.',
    });
  }
});

module.exports = router;
