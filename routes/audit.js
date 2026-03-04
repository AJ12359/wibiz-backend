const express = require('express');
const router = express.Router();
const { extractAudioFromUrl } = require('../services/extractor');
const { transcribeAudio } = require('../services/whisper');
const { auditBrand, auditByUrl } = require('../services/auditor');
const fs = require('fs');

const TRANSCRIPTION_PLATFORMS = ['TikTok', 'YouTube'];

const PLATFORM_URL_PATTERNS = {
  TikTok: ['tiktok.com'],
  YouTube: ['youtube.com', 'youtu.be'],
  Instagram: ['instagram.com'],
  Facebook: ['facebook.com', 'fb.com', 'fb.watch'],
  'X (Twitter)': ['twitter.com', 'x.com'],
  LinkedIn: ['linkedin.com'],
};

const validateUrl = (url) => {
  try { new URL(url); return true; } catch { return false; }
};

const detectPlatformFromUrl = (url) => {
  for (const [platform, patterns] of Object.entries(PLATFORM_URL_PATTERNS)) {
    if (patterns.some(p => url.includes(p))) return platform;
  }
  return null;
};

const withTimeout = (promise, ms, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    )
  ]);
};

const retry = async (fn, retries = 3, delay = 1000, label = 'Operation') => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = i === retries - 1;
      const isRateLimit = err.message?.includes('Rate limit') || err.message?.includes('429');
      if (isLast) throw err;
      if (isRateLimit) {
        console.warn(`[${label}] Rate limit — waiting 60s`);
        await new Promise(r => setTimeout(r, 60000));
      } else {
        console.warn(`[${label}] Attempt ${i + 1} failed: ${err.message} — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
};

router.post('/', async (req, res) => {
  const { url, script, platform } = req.body;
  let audioPath = null;

  // Input validation
  if (!platform || typeof platform !== 'string') {
    return res.status(400).json({ error: 'Platform is required' });
  }
  if (!url && !script) {
    return res.status(400).json({ error: 'Either a video URL or script is required' });
  }
  if (script && script.trim().length < 5) {
    return res.status(400).json({ error: 'Script is too short to audit' });
  }
  if (script && script.length > 10000) {
    return res.status(400).json({ error: 'Script too long — max 10,000 characters' });
  }
  if (url && !validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  if (url) {
    const detectedPlatform = detectPlatformFromUrl(url);
    if (!detectedPlatform) {
      return res.status(400).json({
        error: 'Unsupported URL',
        message: 'URL not recognized. Supported: TikTok, YouTube, Instagram, Facebook, LinkedIn, X.'
      });
    }
  }

  try {
    let result;

    if (url) {
      if (TRANSCRIPTION_PLATFORMS.includes(platform)) {
        // ── YouTube / TikTok → extract audio → Whisper → audit ──
        try {
          audioPath = await withTimeout(extractAudioFromUrl(url), 60000, 'Audio extraction');
        } catch (err) {
          return res.status(422).json({
            error: 'Audio extraction failed',
            message: err.message.includes('timed out')
              ? 'Video took too long to process. Try a shorter video.'
              : `Could not extract audio: ${err.message}`
          });
        }

        let transcript;
        try {
          transcript = await retry(
            () => withTimeout(transcribeAudio(audioPath), 60000, 'Transcription'),
            3, 2000, 'Whisper'
          );
        } catch (err) {
          return res.status(422).json({
            error: 'Transcription failed',
            message: err.message.includes('timed out')
              ? 'Transcription took too long. Try a shorter video.'
              : `Could not transcribe audio: ${err.message}`
          });
        }

        if (!transcript || transcript.trim().length < 5) {
          return res.status(422).json({
            error: 'Empty transcription',
            message: 'No speech detected. Please paste the script manually instead.'
          });
        }

        result = await retry(
          () => withTimeout(auditBrand(transcript, platform), 30000, 'Brand audit'),
          3, 2000, 'Auditor'
        );

      } else {
        // ── Instagram / Facebook / LinkedIn / X → URL context audit ──
        result = await retry(
          () => withTimeout(auditByUrl(url, platform), 30000, 'URL audit'),
          3, 2000, 'Auditor'
        );
      }

    } else {
      // ── Script mode ──
      result = await retry(
        () => withTimeout(auditBrand(script, platform), 30000, 'Brand audit'),
        3, 2000, 'Auditor'
      );
    }

    return res.json(result);

  } catch (err) {
    console.error('[Audit] Error:', err.message);

    if (err.message?.includes('Rate limit') || err.message?.includes('429')) {
      return res.status(429).json({ error: 'Rate limit reached', message: 'Wait 1 minute and try again.' });
    }
    if (err.message?.includes('timed out')) {
      return res.status(408).json({ error: 'Request timed out', message: 'The request took too long. Please try again.' });
    }

    return res.status(500).json({ error: 'Audit failed', message: err.message || 'Something went wrong.' });

  } finally {
    if (audioPath) {
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch (cleanupErr) {
        console.warn('[Cleanup] Could not delete temp file:', cleanupErr.message);
      }
    }
  }
});

module.exports = router;