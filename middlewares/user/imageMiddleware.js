const profileController = require('../../controllers/user/profileController.js');

const imageUploadMiddleware = (req, res, next) => {
  profileController.upload.single('profileImage')(req, res, (err) => {
    if (err) {
      if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'File upload error.' });
    }
    next();
  });
};

module.exports = { imageUploadMiddleware };