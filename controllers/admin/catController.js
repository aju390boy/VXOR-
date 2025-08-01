const { resolveContent } = require('nodemailer/lib/shared');
const Category = require('../../model/category');

exports.getCategories = async (req, res) => {
    try {
        const query = {};
        const page = parseInt(req.query.page) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;
        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);
        const categories = await Category.find(query).skip(skip).limit(limit);
       const message=req.session.message; 
       delete req.session.message;
        res.render('admin/category', { categories, message, currentPage: page,
            totalPages,layout: false });
    } catch (err) {
        console.error("Error fetching categories:", err.message);
        res.status(500).redirect('/admin/category')
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { name, description, offer, isListed } = req.body;
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCategory) {
          
           req.session.message={icon:'error',title:'error',text:'Category is already exist '};
           return res.redirect('/admin/category');
        }

        const newCategory = new Category({
            name: name.trim(),
            description: description ? description.trim() : '', 
            offer: parseFloat(offer) || 0, 
            isListed: isListed === 'on'
        });
        await newCategory.save();
        req.session.message={icon:'success',title:'success',text:'successfully added category'}
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error adding category:", err.message);
        req.session.message={icon:'error',title:'Error',text:'an error occured in server'}
        res.status(500).redirect('/admin/category')
    }
};

exports.toggleCategoryStatus = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            req.session.message = { icon: 'error', title: 'Error', text: 'Category does not exist.' };
            return res.redirect('/admin/category');
        }
        category.isListed = !category.isListed;
        await category.save();
        if (category.isListed) {
            req.session.message = { icon: 'success', title: 'Success', text: 'Category has been listed.' };
        } else {
            req.session.message = { icon: 'error', title: 'Error', text: 'Category has been unlisted.' };
        }
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error toggling status:", err.message);
        req.session.message = { icon: 'error', title: 'Error', text: 'An unexpected error occurred.' };
        res.status(500).redirect('/admin/category');
    }
};
exports.loadEditForm = async (req, res) => {
    try {
        const categories = await Category.find(); 
        res.render('admin/category', { categories, layout: false });
    } catch (err) {
        console.error("Error loading edit form:", err.message);
        res.status(500).send("Internal Server Error: Could not load category edit form.");
    }
};

exports.editCategory = async (req, res) => {
    try {
        const { name, description, offer } = req.body;
        const categoryId = req.params.id;
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') }, 
            _id: { $ne: categoryId }
        });
        if (existingCategory) {
             req.session.message={icon:'error',title:'Error',text:'Category already exist'}
             return res.redirect('/admin/category')
        }
        await Category.findByIdAndUpdate(categoryId, {
            name: name.trim(), 
            description: description ? description.trim() : '', 
            offer: parseFloat(offer) || 0, 
        }, { new: true, runValidators: true });
        req.session.message={icon:'success',title:'Success',text:'Category edited successfully '}
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error editing category:", err.message);
        req.session.message={icon:'error',title:'Error',text:'an error occured in server'}
        res.status(500).redirect('/admin/category')
    }
};

// DELETE category
exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const deletedCategory = await Category.findByIdAndDelete(categoryId);
        
        if (!deletedCategory) {
            // Send a JSON response for an error
            return res.status(404).json({ success: false, message: 'Category not found.' });
        }
        
        // Send a JSON response for success
        res.json({ success: true, message: 'Successfully deleted category.' });
        
    } catch (err) {
        console.error("Error deleting category:", err.message);
        // Send a generic JSON error response
        res.status(500).json({ success: false, message: 'Internal Server Error: Could not delete category.' });
    }
};