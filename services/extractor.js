const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const extractAudioFromUrl = (url) => {
  return new Promise((resolve, reject) => {
    try {
      const outputPath = path.join(__dirname, '../uploads', `audio_${Date.now()}.mp3`);
      
      // Use yt-dlp to download audio from URL
      execSync(`yt-dlp -x --audio-format mp3 -o "${outputPath}" "${url}"`, {
        timeout: 60000,
        stdio: 'pipe'
      });

      if (!fs.existsSync(outputPath)) {
        reject(new Error('Audio extraction failed — file not created'));
        return;
      }

      resolve(outputPath);
    } catch (err) {
      reject(new Error(`Audio extraction failed: ${err.message}`));
    }
  });
};

module.exports = { extractAudioFromUrl };