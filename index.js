const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;
// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet);
    res.json(jsonData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process the uploaded file' });
  }
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});