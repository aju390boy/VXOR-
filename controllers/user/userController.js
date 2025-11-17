const Product = require('../../model/product.js');
const User = require('../../model/user.js')
const Category = require('../../model/category.js')



const formatProductForHomepage = (product) => {
    let displayPrice = null;
    let displayImageUrl = '/uploads/products/placeholder.png';
    if (product.colorVariants && product.colorVariants.length > 0) {
        const firstVariant = product.colorVariants[0];
        if (firstVariant.images && firstVariant.images.length > 0) {
            const firstImage = firstVariant.images[0];
            displayImageUrl = firstImage.startsWith('http')
                ? firstImage
                : `/uploads/products/${firstImage}`;
        }
        let minPrice = Infinity;
        product.colorVariants.forEach(colorVariant => {
            if (colorVariant.variants && colorVariant.variants.length > 0) {
                colorVariant.variants.forEach(sizeVariant => {
                    if (typeof sizeVariant.price === 'number') {
                        minPrice = Math.min(minPrice, sizeVariant.price);
                    }
                });
            }
        });
        displayPrice = minPrice !== Infinity ? minPrice : null;
    }
    return {
        _id: product._id,
        title: product.title,
        rating: product.rating || 0,
        display_price: displayPrice,
        display_image_url: displayImageUrl,
    };
};

exports.getHome = async (req, res) => {
    try {
        const rawBestSellers = await Product.find({ $and:[{bestSellers: true} ,{isDeleted:false},{isListed:true}]}).limit(5).lean();
        const rawTopRated = await Product.find({ $and:[{rating: { $gte: 3 } },{isDeleted:false},{isListed:true}]}).limit(5).lean();
        const rawWhatsNew = await Product.find({$and:[{isDeleted:false},{isListed:true}]}).sort({ createdAt: -1 }).limit(5).lean();
        const bestSellers = rawBestSellers.map(formatProductForHomepage);
        const topRated = rawTopRated.map(formatProductForHomepage);
        const whatsNew = rawWhatsNew.map(formatProductForHomepage);
        const message = req.session.message;
        delete req.session.message;
        return res.render('user/home', {
            bestSellers,
            topRated,
            whatsNew,
            title: 'User Home',
            message,
            user:req.user
        });
    } catch (error) {
        console.error("Error fetching home page data:", error);
        res.status(500).send("Error loading home page.");
    }
};
exports.getUserProfile = async (req, res) => {
  try {
    const sessionUser = req.session.user;
    if (!sessionUser || !sessionUser._id) {
      return res.redirect('/login');
    }
    const user = await User.findById(sessionUser._id);
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.render('user/profile', { user ,title: 'User Profile'});
  } catch (err) {
    console.error(" Error in getUserProfile:", err);
    res.status(500).send("Server Error");
  }
};



