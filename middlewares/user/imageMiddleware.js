const profileController = require('../../controllers/user/profileController.js');

const imageUploadMiddleware = (req, res, next) => {
  console.log('image middleware hitted............')
  profileController.upload.single('profileImage')(req, res, (err) => {
    if (err) {
      if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'File upload error.' });
    }
    console.log('next worked...............')
    next();
  });
};

module.exports = { imageUploadMiddleware };