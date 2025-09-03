const Order=require('../../model/order.js');
const User=require('../../model/user.js');
const Product=require('../../model/product.js')



const PDFDocument = require('pdfkit');

exports.getSingleOrder = async (req, res) => {
    console.log('order detail page hitted')
    try {
        const { orderId } = req.params;
        const TAX_RATE = 0.05; // Use consistent tax rate

        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is missing.' });
        }

        const order = await Order.findOne({ _id: orderId })
            .populate('user_id', 'firstname lastname email')
            .populate('address_id')
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants isDeleted'
            })
            .lean();

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        
        // Re-calculate totals on the server-side for accuracy
        let subtotal = 0;
        const items = order.products.map(productItem => {
            const product = productItem.product_id;
            let imageUrl = 'https://via.placeholder.com/96';
            
            const colorVariant = product?.colorVariants?.find(c => c.colorName === productItem.colorName);
            if (colorVariant && colorVariant.images.length > 0) {
                imageUrl = `/uploads/products/${colorVariant.images[0]}`;
                
            }
            console.log(`hellooooooo${colorVariant}`)

            const itemPrice = productItem.price * productItem.quantity;
            subtotal += itemPrice;

            return {
                ...productItem,
                title: product?.title || 'Product Not Found',
                image: imageUrl,
                color: productItem.colorName,
                size: productItem.size
            };
        });

        const tax = subtotal * TAX_RATE;
        const shippingCost = 0; // Assuming free shipping for now
        const total = subtotal + tax + shippingCost;
        
        const orderDataForEJS = {
            ...order,
            products: items, 
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            shippingCost: shippingCost.toFixed(2),
            total: total.toFixed(2)
        };
        
        res.render('admin/orderDetail', { order: orderDataForEJS, layout: false });

    } catch (err) {
        console.error('Error fetching single order:', err);
        res.status(500).json({ message: 'Failed to fetch order details.' });
    }
};

exports.cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { reason } = req.body;

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, 'products._id': itemId },
            { 
                $set: {
                    'products.$.status': 'CANCELLED',
                    'products.$.cancellation_reason': reason,
                    'products.$.cancellation_date': new Date()
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order or item not found.' });
        }

        res.status(200).json({ message: 'Item cancelled successfully.', order: updatedOrder });
    } catch (err) {
        console.error('Error cancelling order item:', err);
        res.status(500).json({ message: 'Failed to cancel order item.' });
    }
};

exports.processReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { action } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action.' });
        }
        
        let statusUpdate = {};
        if (action === 'approve') {
            statusUpdate = { 'products.$.status': 'RETURNED', payment_status: 'REFUNDED' };
        } else if (action === 'reject') {
            statusUpdate = { 'products.$.status': 'DELIVERED', payment_status: 'COMPLETED' };
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, 'products._id': itemId, 'products.status': 'RETURN REQUESTED' },
            { $set: statusUpdate },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Return request not found.' });
        }

        res.status(200).json({ message: `Return request ${action}d successfully.`, order: updatedOrder });
    } catch (err) {
        console.error('Error processing return request:', err);
        res.status(500).json({ message: 'Failed to process return request.' });
    }
};


exports.updateProductStatusInOrder = async (req, res) => {
    const { orderId, productId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        const productItem = order.products.id(productId);
        if (!productItem) {
            return res.status(404).json({ message: 'Product not found in this order.' });
        }

        const currentStatus = productItem.status;
        let newStatus = '';
        let newPaymentStatus = order.payment_status;

        if (action === 'approve') {
            if (currentStatus === 'CANCELLATION REQUESTED' || currentStatus === 'RETURN REQUESTED') {
                
                // --- NEW: RESTOCK INVENTORY LOGIC ---
                await Product.updateOne(
                    { 
                        _id: productItem.product_id, 
                        'colorVariants.colorName': productItem.colorName,
                        'colorVariants.variants.size': productItem.size
                    },
                    { 
                        $inc: { 'colorVariants.$[c].variants.$[v].stock': productItem.quantity }
                    },
                    {
                        arrayFilters: [
                            { 'c.colorName': productItem.colorName },
                            { 'v.size': productItem.size }
                        ]
                    }
                );
                // --- END: NEW LOGIC ---

                if (currentStatus === 'CANCELLATION REQUESTED') {
                    newStatus = 'CANCELLED';
                    newPaymentStatus = 'FAILED'; // Or 'REFUNDED' if payment was captured
                } else { // RETURN REQUESTED
                    newStatus = 'RETURNED';
                    newPaymentStatus = 'REFUNDED';
                }
            }
        } else if (action === 'reject') {
            if (currentStatus === 'CANCELLATION REQUESTED') {
                newStatus = 'PACKED'; // Revert to a safe, non-final status
            } else if (currentStatus === 'RETURN REQUESTED') {
                newStatus = 'DELIVERED'; // Revert to delivered status
            }
        }

        if (newStatus) {
            productItem.status = newStatus;
            order.payment_status = newPaymentStatus;
            await order.save();
            res.status(200).json({ message: `Request successfully ${action}d and inventory updated.`, order });
        } else {
            res.status(400).json({ message: 'Invalid action or status for this item.' });
        }
    } catch (err) {
        console.error('Error updating product status:', err);
        res.status(500).json({ message: 'Failed to update product status.' });
    }
};