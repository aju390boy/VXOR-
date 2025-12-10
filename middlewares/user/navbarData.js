const Category = require("../../model/category.js");
const Brand = require("../../model/brand.js");

const navbarData = async (req, res, next) => {

    console.log('hello................siri')
    res.locals.categories = await Category.find({ isListed: true });
    res.locals.brands = await Brand.find({ isListed: true });
    next();
};

module.exports = {navbarData};
