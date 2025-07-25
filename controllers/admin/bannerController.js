const Banner = require('../../model/banner.js');
const multer = require('multer');
const path = require('path');

// 🔧 Multer setup (inside controller, like you said)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/banners');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('images/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images allowed!'), false);
  }
};

exports.upload = multer({ storage, fileFilter });

// 📄 GET – All banners
exports.getBannerPage = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.render('admin/banner', { banners });
  } catch (err) {
    console.error('❌ Error loading banners:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

// ➕ ADD new banner
exports.addBanner = async (req, res) => {
  try {
    const { title, description } = req.body;
    const images = req.files.map(file => file.filename);

    const banners = images.map(img => ({
      title,
      description,
      image: img,
      createdBy: req.user ? req.user._id : null
    }));

    await Banner.insertMany(banners);
    res.redirect('/admin/banner');
  } catch (err) {
    console.error("Banner upload error:", err.message);
    res.status(500).send("Failed to upload");
  }
};


// 🔁 UPDATE existing banner
exports.updateBanner = async (req, res) => {
  try {
    const { title, description, link, status } = req.body;
    const updateData = {
      title,
      description,
      link,
      isActive: status === 'active'
    };

    if (req.file) {
      updateData.image = req.file.filename;
    }

    await Banner.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin/banners');
  } catch (err) {
    console.error('❌ Error updating banner:', err.message);
    res.status(500).send('Error updating banner');
  }
};
