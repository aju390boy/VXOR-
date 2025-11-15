const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const categoryController = require('../../controllers/admin/categoryController.js');

router.get('/',isAuthenticated, categoryController.getCategories);
router.post('/add',isAuthenticated, categoryController.addCategory);
router.post('/toggle/:id',isAuthenticated, categoryController.toggleCategoryStatus);
router.get('/edit/:id',isAuthenticated, categoryController.loadEditForm);
router.post('/edit/:id',isAuthenticated, categoryController.editCategory);
router.post('/delete/:id', isAuthenticated,categoryController.deleteCategory);

module.exports = router;