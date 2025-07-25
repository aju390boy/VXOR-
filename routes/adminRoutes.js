const express = require('express');
const router = express.Router();
const multer=require('multer');

const dashboardController=require('../controllers/admin/dashboardController.js')
const customerController=require('../controllers/admin/customerController.js')
const {
  addCategory,
  getCategories,
  toggleCategoryStatus,
  loadEditForm,
  editCategory,
  deleteCategory
} = require('../controllers/admin/catController.js');

const productController = require('../controllers/admin/productController.js');
const { isAuthenticated, isNotAuthenticated } = require('../middlewares/admin/viewsMiddleware.js');
const brandController=require('../controllers/admin/brandController.js')
const addProductController=require('../controllers/admin/addProductController.js')

router.get('/login', isNotAuthenticated, (req, res) => {
  res.render('admin/login'); 
});



///Customers\\\\
router.get('/customers',  customerController.getCustomers);
router.post('/customers/:id/block', isAuthenticated, customerController.blockCustomer);
router.post('/customers/:id/unblock',  isAuthenticated,customerController.unblockCustomer);
router.get('/customers-search', customerController.getCustomersAjax);





router.get('/offers', isAuthenticated, (req, res) => {
  res.render('admin/offers');
});




// GET category management page
router.get('/category', getCategories);
router.post('/category/add', addCategory);
router.post('/category/toggle/:id', toggleCategoryStatus);
router.get('/category/edit/:id', loadEditForm);
router.post('/category/edit/:id', editCategory);
router.post('/category/delete/:id', deleteCategory);




// 🛣️ Show all products
router.get('/products', productController.getAllProducts);
router.post('/products/edit/:id', productController.uploadProductImage, productController.editProduct);
router.post('/products/delete/:id', productController.softDelete);
router.post('/products/restore/:id', productController.softRestore);
router.get('/products-search', productController.getProductsAjax);


///Brand Routes\\\\
router.get('/brand', brandController.getBrands);
router.post('/brand/add', brandController.uploadBrandImage.single('image'), brandController.addBrand);
router.post('/brand/toggle/:id', brandController.toggleBrandStatus);
router.post('/brand/edit/:id', brandController.uploadBrandImage.single('image'), brandController.editBrand);
router.post('/brand/delete/:id', brandController.deleteBrand);


//Add Products\\\
router.get('/addproducts', addProductController.getAddProductPage);


router.post(
    '/addproducts',
    addProductController.upload.any(), 
    (err, req, res, next) => {
        
        if (err instanceof multer.MulterError) {
            console.error("Multer error:", err.message);
            
            return res.status(400).json({ message: "File upload error: " + err.message });
        } else if (err && err.code === 'FILE_TYPE_ERROR') {
            console.error("File type error:", err.message);
            return res.status(400).json({ message: err.message });
        } else if (err) {
           
            console.error("Unknown file upload error:", err);
            return res.status(500).json({ message: "An unexpected error occurred during file upload." });
        }
        next(); 
    },
   
    addProductController.addProduct
);



///Dashboard\\\
router.get('/dashboard', dashboardController.getDashboard);
router.post('/logout', dashboardController.logoutUser);

module.exports = router;
