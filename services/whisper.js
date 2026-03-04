const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const transcribeAudio = async (audioPath) => {
  try {
    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio file not found');
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'text');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 60000
      }
    );

    if (!response.data) {
      throw new Error('Whisper returned empty transcription');
    }

    return response.data;

  } catch (err) {
    throw new Error(`Transcription failed: ${err.message}`);
  }
};

module.exports = { transcribeAudio };