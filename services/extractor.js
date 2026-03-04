const { exec } = require('youtube-dl-exec');
const path = require('path');

const extractAudioFromUrl = (url) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, '../uploads', `audio_${Date.now()}`);
    const audioPath = `${outputPath}.mp3`;

    exec(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: audioPath,
      noPlaylist: true,
    })
      .then(() => resolve(audioPath))
      .catch((err) => reject(new Error(`Audio extraction failed: ${err.message}`)));
  });
};

module.exports = { extractAudioFromUrl };