const Category = require('../../model/category');

exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('admin/category', { categories, layout: false });
    } catch (err) {
        console.error("Error fetching categories:", err.message); // Use console.error for errors
        res.status(500).send("Internal Server Error: Could not retrieve categories.");
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { name, description, offer, isListed } = req.body; // Destructure description and offer
        
        // Basic validation: Check if category name already exists
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCategory) {
            // If category exists, render the page again with an error message
            const categories = await Category.find(); // Re-fetch categories to display
            return res.render('admin/category', { 
                categories, 
                layout: false, 
                error: 'Category with this name already exists.' // Pass an error message
            });
        }

        const newCategory = new Category({
            name: name.trim(), // Trim whitespace from name
            description: description ? description.trim() : '', // Trim description or default to empty string
            offer: parseFloat(offer) || 0, // Ensure offer is a number, default to 0 if invalid
            isListed: isListed === 'on' // 'on' comes from checkbox if checked, undefined if not
        });
        await newCategory.save();
        res.redirect('/admin/category');
    } catch (err) {
        console.error("Error adding category:", err.message);
        // If it's a validation error (e.g., unique name), you might want to send a more specific message
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

// Note: The loadEditForm route currently just renders the main category page.
// The edit modal in EJS uses JavaScript to populate fields.
// So, this controller function doesn't need to pass a specific `category` object for editing directly to EJS.
// It just needs to provide all categories for the main table view.
exports.loadEditForm = async (req, res) => {
    try {
        const categories = await Category.find(); // Fetch all categories for the main table
        // No need to fetch a single category specifically here for the modal,
        // as the modal is populated by client-side JS.
        res.render('admin/category', { categories, layout: false }); // Render the main category page
    } catch (err) {
        console.error("Error loading edit form:", err.message);
        res.status(500).send("Internal Server Error: Could not load category edit form.");
    }
};


exports.editCategory = async (req, res) => {
    try {
        const { name, description, offer } = req.body; // Destructure all fields from the form
        const categoryId = req.params.id;

        // Basic validation: Check for duplicate name for other categories
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') }, 
            _id: { $ne: categoryId } // Exclude the current category being edited
        });

        if (existingCategory) {
            // If another category exists with this name, send an error
            // For a POST request, redirecting with a query param or session flash is common
            // or sending a JSON response if it's an AJAX call.
            // For simplicity, let's redirect with an error message in the session (requires express-session and connect-flash)
            // or just back to the category page with a generic error for now.
             const categories = await Category.find(); 
             return res.render('admin/category', { 
                categories, 
                layout: false, 
                error: 'Another category with this name already exists.'
             });
        }


        await Category.findByIdAndUpdate(categoryId, {
            name: name.trim(), // Trim name
            description: description ? description.trim() : '', // Trim description or set to empty
            offer: parseFloat(offer) || 0, // Ensure offer is a number
        }, { new: true, runValidators: true }); // `new: true` returns the updated doc, `runValidators` ensures schema validation
        
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