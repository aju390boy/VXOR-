const Wishlist = require('../../model/wishlist.js');
const Cart = require('../../model/cart.js');

exports.addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;
        let wishlist = await Wishlist.findOne({ user_id: userId });
        let cart = await Cart.findOne({userId:userId});
    const isProductExistInCart=cart.items.some(item => item.productId.toString()=== productId);
     if(isProductExistInCart){
          return res.status(409).json({success:false,message:'Product already in cart'})
        }
        if (!wishlist) {
            wishlist = new Wishlist({ user_id: userId, products: [] });
        }
        const isProductExist = wishlist.products.some(item => item.product_id.toString() === productId);
        if (isProductExist) {
            return res.status(409).json({ success: false, message: 'Product is already in your wishlist.' });
        }
        wishlist.products.push({ product_id: productId });
        await wishlist.save();
        res.status(200).json({ success: true, message: 'Product added to wishlist successfully.' });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};



// exports.removeFromWishlist = async (req, res) => {
//     try {
//         const userId = req.user._id;
//         const { productId } = req.params;

//         await Wishlist.updateOne(
//             { user_id: userId },
//             { $pull: { products: { product_id: productId } } }
//         );

//         res.status(200).json({ success: true, message: 'Item removed from wishlist.' });
//     } catch (error) {
//         console.error("Error removing from wishlist:", error);
//         res.status(500).json({ success: false, message: 'Server error.' });
//     }
// };

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const wishlist = await Wishlist.findOne({ user_id: userId });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found.' });
    }
    const productIndex = wishlist.products.findIndex(item => item.product_id.toString() === productId);
    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not found in wishlist.' });
    }
    wishlist.products.splice(productIndex, 1);
    await wishlist.save();
    res.status(200).json({ success: true, message: 'Product removed from wishlist successfully.' });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};