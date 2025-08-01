const Product = require('../../model/product.js');
const User = require('../../model/user.js')
const Category = require('../../model/category.js')



const formatProductForHomepage = (product) => {
    let displayPrice = null;
    let displayImageUrl = '/uploads/products/placeholder.png'; 

    if (product.colorVariants && product.colorVariants.length > 0) {
        let minPrice = Infinity;
        product.colorVariants.forEach(colorVariant => {
            if (colorVariant.images && colorVariant.images.length > 0) {
                if (displayImageUrl === '/uploads/products/placeholder.png') {
                    displayImageUrl = `/uploads/products/${colorVariant.images[0]}`;
                }
            }
            if (colorVariant.variants && colorVariant.variants.length > 0) {
                colorVariant.variants.forEach(sizeVariant => {
                    if (sizeVariant.price !== undefined && typeof sizeVariant.price === 'number' && sizeVariant.price < minPrice) {
                        minPrice = sizeVariant.price;
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
        const rawBestSellers = await Product.find({ bestSellers: true }).limit(5).lean();
        const rawTopRated = await Product.find({ rating: { $gte: 4 } }).limit(5).lean();
        const rawWhatsNew = await Product.find({}).sort({ createdAt: -1 }).limit(5).lean();
        const bestSellers = rawBestSellers.map(formatProductForHomepage);
        const topRated = rawTopRated.map(formatProductForHomepage);
        const whatsNew = rawWhatsNew.map(formatProductForHomepage);

        return res.render('user/home', {
            bestSellers,
            topRated,
            whatsNew,
            title: 'User Home'
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



