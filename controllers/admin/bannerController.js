const Banner = require('../../model/banner.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 

const uploadDir = path.join(__dirname, '../../public/uploads/banners');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images allowed!'), false);
  }
};

exports.upload = multer({ storage, fileFilter });
// GET – All banners
exports.getBannerPage = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    const message = req.session.message;
    delete req.session.message;          
    res.render('admin/banner', { 
        banners, 
        message, 
        layout: false, 
        currentPage: 'banner' 
    });
  } catch (err) {
    console.error('Error loading banners:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

// ADD new banner
exports.addBanner = async (req, res) => {
  try {
    const { title, description, startDate, endDate, status } = req.body;
        if (!req.files || req.files.length === 0) {
         req.session.message = { type: 'error', text: 'Please upload an image' };
         return res.redirect('/admin/banner');
    }
    const images = req.files.map(file => file.filename);
    const banners = images.map(img => ({
      title: title || 'Page Banner',
      description,
      image: img,
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: status === 'on', 
      createdBy: req.user ? req.user._id : null
    }));
    await Banner.insertMany(banners);
    req.session.message = { type: 'success', text: 'Banner added successfully' };
    res.redirect('/admin/banner');
  } catch (err) {
    console.error("Banner upload error:", err.message);
    req.session.message = { type: 'error', text: 'Failed to upload banner' };
    res.redirect('/admin/banner');
  }
};

// UPDATE existing banner
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
    console.error(' Error updating banner:', err.message);
    res.status(500).send('Error updating banner');
  }
};


// DELETE Banner
exports.deleteBanner = async (req, res) => {
    try {
        const bannerId = req.params.id;
        const banner = await Banner.findById(bannerId);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found.' });
        }
        if (banner.image) {
            const imagePath = path.join(__dirname, '../../public/uploads/banners', banner.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath); 
            }
        }
        await Banner.findByIdAndDelete(bannerId);
        res.json({ success: true, message: 'Banner deleted successfully.' });
    } catch (err) {
        console.error("Error deleting banner:", err.message);
        res.status(500).json({ success: false, message: 'Failed to delete banner.' });
    }
};