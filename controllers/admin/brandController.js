const Brand = require('../../model/brand.js');
const fs = require('fs'); 
const path = require('path');
const multer = require('multer');


// --- Multer Configuration for Brand Images ---
const brandStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/uploads/brands');
        // Ensure the directory exists
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

exports.uploadBrandImage = multer({
    storage: brandStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Image files only (jpeg, jpg, png, gif)!"));
    }
});


exports.getBrands = async (req, res) => {
    try {
        const brands = await Brand.find();
        res.render('admin/brand', { brands, layout: false, error: req.flash('error'), success: req.flash('success') });
    } catch (err) {
        console.error("Error fetching brands:", err.message);
        req.flash('error', 'Error fetching brands.');
        res.status(500).redirect('/admin/dashboard'); // Redirect to dashboard or appropriate error page
    }
};

exports.addBrand = async (req, res) => {
    try {
        const { name, description, offer, isListed } = req.body;
        const imageFile = req.file; // Multer makes the uploaded file available here

        // Basic validation: Check if brand name already exists
        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existingBrand) {
            // If exists, delete the uploaded file to prevent clutter
            if (imageFile) {
                fs.unlinkSync(imageFile.path); // Delete the temp uploaded file
            }
            req.flash('error', 'Brand with this name already exists.');
            return res.redirect('/admin/brand');
        }

        if (!imageFile) {
            req.flash('error', 'Brand image is required.');
            return res.redirect('/admin/brand');
        }

        const newBrand = new Brand({
            name: name.trim(),
            description: description ? description.trim() : '',
            offer: parseFloat(offer) || 0,
            image: imageFile.filename, // Store just the filename
            isListed: isListed === 'on'
        });
        await newBrand.save();
        req.flash('success', 'Brand added successfully!');
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error adding brand:", err.message);
        // If an error occurs after file upload, delete the uploaded file
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error', `Error adding brand: ${err.message}`);
        res.status(500).redirect('/admin/brand');
    }
};

exports.toggleBrandStatus = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (!brand) {
            req.flash('error', 'Brand not found.');
            return res.status(404).redirect('/admin/brand');
        }
        brand.isListed = !brand.isListed;
        await brand.save();
        req.flash('success', 'Brand status updated successfully!');
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error toggling brand status:", err.message);
        req.flash('error', `Error toggling brand status: ${err.message}`);
        res.status(500).redirect('/admin/brand');
    }
};


exports.editBrand = async (req, res) => {
    try {
        const { name, description, offer } = req.body;
        const brandId = req.params.id;
        const imageFile = req.file; // New uploaded image (if any)

        // Check for duplicate name for other brands
        const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: brandId }
        });

        if (existingBrand) {
            if (imageFile) {
                fs.unlinkSync(imageFile.path); // Delete new uploaded file if name conflicts
            }
            req.flash('error', 'Another brand with this name already exists.');
            return res.redirect('/admin/brand');
        }

        const brandToUpdate = await Brand.findById(brandId);
        if (!brandToUpdate) {
            if (imageFile) {
                fs.unlinkSync(imageFile.path);
            }
            req.flash('error', 'Brand not found for editing.');
            return res.status(404).redirect('/admin/brand');
        }

        // Prepare update data
        const updateData = {
            name: name.trim(),
            description: description ? description.trim() : '',
            offer: parseFloat(offer) || 0,
        };

        // Handle image update
        if (imageFile) {
            // Delete old image if it exists
            if (brandToUpdate.image) {
                const oldImagePath = path.join(__dirname, '../../../public/uploads/brands', brandToUpdate.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = imageFile.filename; // Set new image filename
        }

        await Brand.findByIdAndUpdate(brandId, updateData, { new: true, runValidators: true });

        req.flash('success', 'Brand updated successfully!');
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error editing brand:", err.message);
        if (req.file) { // Clean up any newly uploaded file on error
            fs.unlinkSync(req.file.path);
        }
        req.flash('error', `Error editing brand: ${err.message}`);
        res.status(500).redirect('/admin/brand');
    }
};

exports.deleteBrand = async (req, res) => {
    try {
        const brandId = req.params.id;
        const deletedBrand = await Brand.findByIdAndDelete(brandId);

        if (!deletedBrand) {
            req.flash('error', 'Brand not found for deletion.');
            return res.status(404).redirect('/admin/brand');
        }

        // Delete the associated image file from the server
        if (deletedBrand.image) {
            const imagePath = path.join(__dirname, '../../../public/uploads/brands', deletedBrand.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        req.flash('success', 'Brand deleted successfully!');
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error deleting brand:", err.message);
        req.flash('error', `Error deleting brand: ${err.message}`);
        res.status(500).redirect('/admin/brand');
    }
};