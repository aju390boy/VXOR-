const multer = require('multer');

function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ message: "File size is too large." });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ message: "Too many files uploaded." });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ message: "Unexpected file field." });
      default:
        return res.status(400).json({ message: "File upload error: " + err.message });
    }
  } else if (err && err.code === 'FILE_TYPE_ERROR') {
    return res.status(400).json({ message: err.message });
  } else if (err) {
    console.error("Unexpected file upload error:", err);
    return res.status(500).json({ message: "An unexpected error occurred during file upload." });
  }
  next();
}

module.exports = {multerErrorHandler};
