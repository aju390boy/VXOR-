const Brand = require('../../model/brand.js');
const fs = require('fs'); 
const path = require('path');
const multer = require('multer');

const brandStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/uploads/brands');
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
    limits: { fileSize: 5 * 1024 * 1024 }, 
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
        res.render('admin/brand', { brands, layout: false });
    } catch (err) {
        console.error("Error fetching brands:", err.message);
        res.status(500).redirect('/admin/dashboard'); 
    }
};

exports.addBrand = async (req, res) => {
    try {
        const { name, description, offer, isListed } = req.body;
        const imageFile = req.file; 
        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existingBrand) {
            if (imageFile) {
                fs.unlinkSync(imageFile.path); 
            }
            return res.redirect('/admin/brand');
        }
        if (!imageFile) {
           
            return res.redirect('/admin/brand');
        }
        const newBrand = new Brand({
            name: name.trim(),
            description: description ? description.trim() : '',
            offer: parseFloat(offer) || 0,
            image: imageFile.filename, 
            isListed: isListed === 'on'
        });
        await newBrand.save();
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error adding brand:", err.message);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).redirect('/admin/brand');
    }
};

exports.toggleBrandStatus = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (!brand) {
            
            return res.status(404).redirect('/admin/brand');
        }
        brand.isListed = !brand.isListed;
        await brand.save();
        
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error toggling brand status:", err.message);
        res.status(500).redirect('/admin/brand');
    }
};


exports.editBrand = async (req, res) => {
    try {
        const { name, description, offer } = req.body;
        const brandId = req.params.id;
        const imageFile = req.file; 
        const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: brandId }
        });

        if (existingBrand) {
            if (imageFile) {
                fs.unlinkSync(imageFile.path); 
            }
            
            return res.redirect('/admin/brand');
        }

        const brandToUpdate = await Brand.findById(brandId);
        if (!brandToUpdate) {
            if (imageFile) {
                fs.unlinkSync(imageFile.path);
            }
           
            return res.status(404).redirect('/admin/brand');
        }
        const updateData = {
            name: name.trim(),
            description: description ? description.trim() : '',
            offer: parseFloat(offer) || 0,
        };
        if (imageFile) {
            if (brandToUpdate.image) {
                const oldImagePath = path.join(__dirname, '../../../public/uploads/brands', brandToUpdate.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = imageFile.filename; 
        }

        await Brand.findByIdAndUpdate(brandId, updateData, { new: true, runValidators: true });

       
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error editing brand:", err.message);
        if (req.file) { 
            fs.unlinkSync(req.file.path);
        }
       
        res.status(500).redirect('/admin/brand');
    }
};

exports.deleteBrand = async (req, res) => {
    try {
        const brandId = req.params.id;
        const deletedBrand = await Brand.findByIdAndDelete(brandId);

        if (!deletedBrand) {
           
            return res.status(404).redirect('/admin/brand');
        }
        if (deletedBrand.image) {
            const imagePath = path.join(__dirname, '../../../public/uploads/brands', deletedBrand.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        res.redirect('/admin/brand');
    } catch (err) {
        console.error("Error deleting brand:", err.message);
        
        res.status(500).redirect('/admin/brand');
    }
};