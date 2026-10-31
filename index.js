const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// The only input this service accepts is a workbook, so bound both the upload
// and the range the parser is allowed to walk. SheetJS takes a worksheet's
// declared <dimension> on trust, and sheet_to_json walks every cell in it, so
// an unbounded read is a loop an attacker controls with a few bytes of XML.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 10000;
const MAX_IMPORT_COLUMNS = 256;

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

// The declared range of the sheet, taken from the full range SheetJS records
// when sheetRows truncated the read. Null when the sheet has no range at all.
function declaredRange(sheet) {
  const ref = sheet && (sheet['!fullref'] || sheet['!ref']);
  if (typeof ref !== 'string') return null;
  try {
    const range = xlsx.utils.decode_range(ref);
    return { rows: range.e.r - range.s.r + 1, columns: range.e.c - range.s.c + 1 };
  } catch (error) {
    return null;
  }
}

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'A workbook is required in the "file" field' });
    }
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer', sheetRows: MAX_IMPORT_ROWS + 1 });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(400).json({ error: 'The workbook has no sheets' });
    }
    const range = declaredRange(sheet);
    if (range && (range.rows > MAX_IMPORT_ROWS || range.columns > MAX_IMPORT_COLUMNS)) {
      return res.status(413).json({
        error: `Workbook declares ${range.rows} rows x ${range.columns} columns; the import limit is ${MAX_IMPORT_ROWS} rows x ${MAX_IMPORT_COLUMNS} columns.`,
      });
    }
    const jsonData = xlsx.utils.sheet_to_json(sheet);
    res.json(jsonData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process the uploaded file' });
  }
});

// Multer rejects a file past the size cap before the route runs; answer that
// with the status a client can act on instead of the generic error page.
app.use((error, req, res, next) => {
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `The upload limit is ${MAX_UPLOAD_BYTES} bytes.` });
  }
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
