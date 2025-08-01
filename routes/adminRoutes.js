const express = require('express');
const router = express.Router();
const multer=require('multer');

const dashboardController=require('../controllers/admin/dashboardController.js')
const customerController=require('../controllers/admin/customerController.js')
const authController=require('../controllers/admin/authController.js')
const productController = require('../controllers/admin/productController.js');
const { isAuthenticated, isNotAuthenticated } = require('../middlewares/admin/viewsMiddleware.js');
const brandController=require('../controllers/admin/brandController.js')
const addProductController=require('../controllers/admin/addProductController.js')
const {
  addCategory,
  getCategories,
  toggleCategoryStatus,
  loadEditForm,
  editCategory,
  deleteCategory
} = require('../controllers/admin/catController.js');



router.route('/login')
.get( isNotAuthenticated,authController.getAdminLoginPage)
.post( authController.postAdminLogin);



///Customers\\\\
router.get('/customers', isAuthenticated, customerController.getCustomers);
router.post('/customers/:id/block', isAuthenticated, customerController.blockCustomer);
router.post('/customers/:id/unblock',  isAuthenticated,customerController.unblockCustomer);
router.get('/customers-search', customerController.getCustomersAjax);





router.get('/offers', isAuthenticated, (req, res) => {
  res.render('admin/offers');
});




// category management 
router.get('/category',isAuthenticated, getCategories);
router.post('/category/add', addCategory);
router.post('/category/toggle/:id', toggleCategoryStatus);
router.get('/category/edit/:id', loadEditForm);
router.post('/category/edit/:id', editCategory);
router.post('/category/delete/:id', deleteCategory);



router.route('/editproduct/:id')
.get(isAuthenticated, addProductController.getEditProductPage)
.post( isAuthenticated,
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
   addProductController.updateProduct
);
// products
router.get('/products',isAuthenticated, productController.getAllProducts);
router.post('/products/delete/:id', productController.softDelete);
router.post('/products/restore/:id', productController.softRestore);
router.get('/products-search', productController.getProductsAjax);


///Brand Routes\\\\
router.get('/brand', isAuthenticated,brandController.getBrands);
router.post('/brand/add', brandController.uploadBrandImage.single('image'), brandController.addBrand);
router.post('/brand/toggle/:id', brandController.toggleBrandStatus);
router.post('/brand/edit/:id', brandController.uploadBrandImage.single('image'), brandController.editBrand);
router.post('/brand/delete/:id', brandController.deleteBrand);


//Add Products\\\
router.route('/addproducts')
.get(isAuthenticated,addProductController.getAddProductPage)
.post(addProductController.upload.any(), 
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
router.get('/dashboard',isAuthenticated, dashboardController.getDashboard);

////logout\\\\
router.post('/logout', authController.logoutUser);

module.exports = router;
