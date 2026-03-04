const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Temp upload folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config — URL input only, no file upload
const upload = multer({ dest: uploadDir });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0', service: 'WiBiz Audit Backend' });
});

// Routes
const auditRouter = require('./routes/audit');
app.use('/api/audit', auditRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`WiBiz Audit Backend running on port ${PORT}`);
});

module.exports = app;