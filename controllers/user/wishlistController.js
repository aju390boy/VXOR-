const Wishlist = require('../../model/wishlist.js');

exports.addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        let wishlist = await Wishlist.findOne({ user_id: userId });

        if (!wishlist) {
            // If no wishlist exists for the user, create one
            wishlist = new Wishlist({ user_id: userId, products: [] });
        }

        // Check if the product is already in the wishlist
        const isProductExist = wishlist.products.some(item => item.product_id.toString() === productId);

        if (isProductExist) {
            return res.status(409).json({ success: false, message: 'Product is already in your wishlist.' });
        }

        // Add the new product
        wishlist.products.push({ product_id: productId });
        await wishlist.save();

        res.status(200).json({ success: true, message: 'Product added to wishlist successfully.' });

    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        await Wishlist.updateOne(
            { user_id: userId },
            { $pull: { products: { product_id: productId } } }
        );

        res.status(200).json({ success: true, message: 'Item removed from wishlist.' });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};