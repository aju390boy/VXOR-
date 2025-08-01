const Category = require('../../model/category');

exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('admin/category', { categories, layout: false });
    } catch (err) {
        console.error("Error fetching categories:", err.message);
        res.status(500).send("Internal Server Error: Could not retrieve categories.");
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { name, description, offer, isListed } = req.body;
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCategory) {
            const categories = await Category.find(); 
            return res.render('admin/category', { 
                categories, 
                layout: false, 
                error: 'Category with this name already exists.'
            });
        }

        const newCategory = new Category({
            name: name.trim(),
            description: description ? description.trim() : '', 
            offer: parseFloat(offer) || 0, 
            isListed: isListed === 'on'
        });
        await newCategory.save();
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error adding category:", err.message);
        res.status(500).send("Internal Server Error: Could not add category.");
    }
};

exports.toggleCategoryStatus = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).send("Category not found.");
        }
        category.isListed = !category.isListed;
        await category.save();
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error toggling status:", err.message);
        res.status(500).send("Internal Server Error: Could not toggle category status.");
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
             const categories = await Category.find(); 
             return res.render('admin/category', { 
                categories, 
                layout: false, 
                error: 'Another category with this name already exists.'
             });
        }
        await Category.findByIdAndUpdate(categoryId, {
            name: name.trim(), 
            description: description ? description.trim() : '', 
            offer: parseFloat(offer) || 0, 
        }, { new: true, runValidators: true });
        
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error editing category:", err.message);
        res.status(500).send("Internal Server Error: Could not edit category.");
    }
};

// DELETE category
exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const deletedCategory = await Category.findByIdAndDelete(categoryId);
        if (!deletedCategory) {
            return res.status(404).send("Category not found.");
        }
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error deleting category:", err.message);
        res.status(500).send("Internal Server Error: Could not delete category.");
    }
};