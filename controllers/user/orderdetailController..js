const Order = require('../../model/order');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');


exports.getOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params; 
        const userId = req.user._id;
        const TAX_RATE = 0.05;
        const message=req.session.message;
        delete req.session.message;

        const order = await Order.findOne({ _id: orderId, user_id: userId })
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants'
            })
            .populate('address_id')
            .populate('coupon_id')
            .lean();

        if (!order) {
           req.session.message={icon:'error',titile:'Error',text:'Order doesnot exists  '}
           return res.redirect('/user/orderDetail');
        }
        // Is it possible to cancel ANY item in the order?
        order.canCancelAll = order.products.some(p => ['CONFIRMED', 'PROCESSING', 'PACKED'].includes(p.status));
        // Is it possible to return ANY item in the order?
        order.canReturnAll = order.products.some(p => p.status === 'DELIVERED');
        // Determine cancel/return eligibility for EACH item
        order.products.forEach(item => {
            if (!item.product_id) { 
                item.canCancel = false;
                item.canReturn = false;
                return;
            }
            item.canCancel = ['CONFIRMED', 'PROCESSING', 'PACKED'].includes(item.status);
            item.canReturn = item.status === 'DELIVERED';
        });
        // This logic correctly reconstructs the totals for display
        let originalSubtotal = 0;
        let totalAfterOffers = 0;
        order.products.forEach(item => {
            if (!item.product_id) return;
            const sizeVariant = item.product_id.colorVariants.find(c => c.colorName === item.colorName)?.variants.find(s => s.size === item.size);
            const pricePaid = item.price;
            const originalPrice = sizeVariant ? sizeVariant.price : pricePaid;
            originalSubtotal += originalPrice * item.quantity;
            totalAfterOffers += pricePaid * item.quantity;
        });
        const offerDiscount = originalSubtotal - totalAfterOffers;
        const totalBeforeTax = order.total_amount / (1 + TAX_RATE);
        const couponDiscount = totalAfterOffers - totalBeforeTax;
        const totals = {
            originalSubtotal: originalSubtotal.toFixed(2),
            offerDiscount: offerDiscount.toFixed(2),
            couponDiscount: couponDiscount > 0 ? couponDiscount.toFixed(2) : '0.00',
            tax: (order.total_amount - totalBeforeTax).toFixed(2),
            grandTotal: order.total_amount.toFixed(2)
        };

        // New improved order status tracking logic
    const progressSteps = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];
    const specialStatuses = ['CANCELLED', 'RETURNED', 'CANCELLATION REQUESTED', 'RETURN REQUESTED'];

    const totalProducts = order.products.length;

    // Count how many products in each progress step
    const progressCounts = progressSteps.reduce((acc, step) => {
      acc[step] = order.products.filter(p => p.status === step).length;
      return acc;
    }, {});

    // Count products for each special status
    const specialCounts = specialStatuses.reduce((acc, status) => {
      acc[status] = order.products.filter(p => p.status === status).length;
      return acc;
    }, {});

    // Prepare segments for progress bar
    const progressSegments = progressSteps.map(step => ({
      status: step,
      count: progressCounts[step],
      percent: totalProducts ? (progressCounts[step] / totalProducts) * 100 : 0
    }));

    const specialSegments = specialStatuses.map(status => ({
      status,
      count: specialCounts[status],
      percent: totalProducts ? (specialCounts[status] / totalProducts) * 100 : 0
    }));
        res.render('user/orderDetail', { order, totals,message ,progressSteps,progressSegments,specialSegments});
    } catch (error) {
        console.error('Error fetching order details:', error);
        req.session.message={icon:'error',title:'Error!',text:'Error fetching order details'}
        res.status(500).redirect('/user/orderDetail');
    }
};

////Download invoice///////
exports.downloadSingleInvoice = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.user._id;
        const TAX_RATE = 0.05; 
        const order = await Order.findOne({ order_id: orderId, user_id: userId }) 
            .populate('products.product_id', 'title')
            .populate('address_id')
            .lean();
        if (!order) {
            req.session.message = { type: 'error', text: 'Invoice not found.' };
            return res.redirect(`/user/orders/${orderId}`);
        }
        const item = order.products.find(p => p._id.toString() === itemId);
        if (!item || !item.product_id) {
            req.session.message = { type: 'error', text: 'Item not found in this order.' };
            return res.redirect(`/user/orders/${orderId}`);
        }
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-item-${item.product_id.title.replace(/\s+/g, '-')}.pdf"`);
        doc.pipe(res);
        function generateTableRow(y_pos, item_name, qty_val, price_val, status_val, total_val) {
            doc.fontSize(10).font('Helvetica')
                .text(item_name, 50, y_pos, { width: 230, ellipsis: true })
                .text(qty_val, 280, y_pos, { width: 50, align: 'center' })
                .text(price_val, 330, y_pos, { width: 70, align: 'right' })
                .text(status_val, 400, y_pos, { width: 70, align: 'center' })
                .text(total_val, 0, y_pos, { align: 'right' }); 
        }
        doc.fontSize(24).font('Helvetica-Bold').text('Item Invoice', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(12).font('Helvetica');
        doc.text(`Order Number: ${order.order_id}`);
        doc.text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`);
        doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`);
        doc.text(`Payment Status: ${order.payment_status}`);
        doc.text(`Payment Method: ${order.payment_method}`);
        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text('Shipping Address', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(11);
        const address = order.address_id;
        if (address) {
            doc.text(address.name);
            doc.text(address.address1);
            if (address.address2) doc.text(address.address2);
            doc.text(`${address.city}, ${address.state} - ${address.pincode}`);
            doc.text(`Mobile: ${address.mobile}`);
        } else {
            doc.text('Address not available');
        }
        doc.moveDown();
        const tableTop = doc.y;
        doc.font('Helvetica-Bold').fontSize(11);
        generateTableRow(tableTop, 'Product Name', 'Qty', 'Price Paid', 'Status', 'Total Paid');
        doc.moveTo(50, tableTop + 15).lineTo(doc.page.width - 50, tableTop + 15).stroke();
        let currentY = tableTop + 25; 
        generateTableRow(
            currentY,
            item.product_id.title,
            item.quantity,
            `Rs. ${item.price.toFixed(2)}`,
            item.status,
            `Rs. ${(item.price * item.quantity).toFixed(2)}`
        );
        currentY += 20;
        doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke(); 
        currentY += 15; 
        const summaryLabelX = 300;
        const summaryValueX = doc.page.width - 150;
        const pricePaidPerUnit = item.price;
        const offerDiscountPerUnit = (item.offer_applied || 0); 
        const originalPricePerUnit = pricePaidPerUnit + offerDiscountPerUnit;
        const totalOriginalPrice = originalPricePerUnit * item.quantity;
        const totalOfferDiscount = offerDiscountPerUnit * item.quantity;
        const totalPaidExcludingTax = pricePaidPerUnit * item.quantity; 
        const taxForItem = totalPaidExcludingTax * TAX_RATE;
        const totalForItemWithTax = totalPaidExcludingTax + taxForItem;
        doc.font('Helvetica').fontSize(10);
        doc.text('Original Price:', summaryLabelX, currentY, { width: 100, align: 'right' });
        doc.text(`Rs. ${totalOriginalPrice.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
        currentY += 20;
        if (totalOfferDiscount > 0) {
            doc.fillColor('green').text('Offer Discount:', summaryLabelX, currentY, { width: 100, align: 'right' });
            doc.text(`- Rs. ${totalOfferDiscount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
            doc.fillColor('black'); 
            currentY += 20;
        }
        doc.text('Subtotal (After Offer):', summaryLabelX, currentY, { width: 100, align: 'right' });
        doc.text(`Rs. ${totalPaidExcludingTax.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
        currentY += 20;
        doc.text(`Tax (${(TAX_RATE * 100).toFixed(0)}%):`, summaryLabelX, currentY, { width: 100, align: 'right' });
        doc.text(`Rs. ${taxForItem.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
        currentY += 10;
        doc.moveTo(summaryLabelX - 20, currentY + 5).lineTo(doc.page.width - 50, currentY + 5).stroke(); 
        currentY += 15;
        doc.font('Helvetica-Bold').fontSize(14);
        doc.text('Item Total (Inc. Tax):', summaryLabelX, currentY, { width: 150, align: 'right' });
        doc.text(`Rs. ${totalForItemWithTax.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
        currentY += 30;
        if (order.coupon_discount > 0) {
            doc.moveDown();
            doc.font('Helvetica-Oblique').fontSize(9).text(
                `Note: An order-level coupon discount of Rs. ${order.coupon_discount.toFixed(2)} was applied to the entire order. This invoice reflects the individual item's price and discounts before the order-level coupon.`,
                50, currentY, { align: 'center', width: doc.page.width - 100 }
            );
            currentY = doc.y + 20; 
        }
        doc.fontSize(10).font('Helvetica-Oblique').text(
            'Thank you for your purchase!', 50, doc.page.height - 50, 
            { align: 'center', lineBreak: false }
        );
        doc.end();
    } catch (error) {
        console.error('Error generating single item invoice:', error);
        req.session.message = { type: 'error', text: 'Error generating invoice.' };
        res.redirect(`/user/orders/${req.params.orderId}`);
    }
};
exports.downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user._id; 
        const TAX_RATE = 0.05;

        if (!orderId) {
            req.session.message = { icon: 'error', title: 'Error!', text: 'Order ID is missing' };
            return res.status(400).redirect('/user/orderDetail'); 
        }
        const order = await Order.findOne({ order_id: orderId, user_id: userId })
            .populate('products.product_id')
            .populate('address_id')
            .populate('coupon_id')
            .lean();
        if (!order) {
            req.session.message = { icon: 'error', title: 'Error!', text: 'Invoice not found or you do not have permission to view it.' };
            return res.status(404).redirect('/user/orderDetail');
        }
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${order.order_id}.pdf"`);
        doc.pipe(res);
        doc.fontSize(24).font('Helvetica-Bold').text('Order Invoice', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(12).font('Helvetica');
        doc.text(`Order Number: ${order.order_id}`);
        doc.text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`);
        doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`); 
        doc.text(`Payment Status: ${order.payment_status}`);
        doc.text(`Payment Method: ${order.payment_method}`);
        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text('Shipping Address', { underline: true });
        doc.moveDown(0.5);
        const address = order.address_id;
        if (address) {
            doc.fontSize(12).font('Helvetica');
            doc.text(`${address.name}`);
            doc.text(`${address.address1 || ''}, ${address.address2 || ''}`);
            doc.text(`${address.district || ''}, ${address.state || ''}`);
            doc.text(`${address.pincode || ''}, ${address.country || ''}`);
            doc.text(`Mobile: ${address.mobile || ''}`);
        } else {
            doc.fontSize(12).font('Helvetica').text('Address not available');
        }
        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text('Items in Order', { underline: true });
        doc.moveDown(0.5);
        const tableTop = doc.y;
        const itemX = 50;
        const qtyX = 280;
        const priceX = 340; 
        const statusX = 420;
        const totalX = 500; 
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Product Name', itemX, tableTop, { width: 200 });
        doc.text('Qty', qtyX, tableTop, { width: 50 });
        doc.text('Price', priceX, tableTop, { width: 70 });
        doc.text('Status', statusX, tableTop, { width: 80 });
        doc.text('Total', totalX, tableTop, { align: 'right', width: 50 });
        doc.strokeColor('#aaaaaa')
           .lineWidth(1)
           .moveTo(itemX, tableTop + 18)
           .lineTo(doc.page.width - 50, tableTop + 18)
           .stroke();
        let y = tableTop + 30;
        let subtotal = 0;
        doc.fontSize(10).font('Helvetica'); 
        order.products.forEach(productItem => {
            const product = productItem.product_id;
            const itemTotal = productItem.quantity * productItem.price;
            if (product) {
                doc.text(product.title, itemX, y, { width: 220, ellipsis: true }); 
                doc.text(productItem.quantity, qtyX, y);
                doc.text(`₹${productItem.price.toFixed(2)}`, priceX, y);
                doc.text(productItem.status, statusX, y);
                doc.text(`₹${itemTotal.toFixed(2)}`, totalX, y, { align: 'right' });
                subtotal += itemTotal;
                y += 20; 
            }
        });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica');
        const summaryX = 350; 
        const valueX = 500; 
        doc.strokeColor('#aaaaaa')
           .lineWidth(1)
           .moveTo(summaryX, y + 5)
           .lineTo(doc.page.width - 50, y + 5)
           .stroke();
        y += 15; 
        doc.text(`Subtotal:`, summaryX, y, { width: 100, align: 'right' });
        doc.text(`₹${subtotal.toFixed(2)}`, valueX, y, { align: 'right' });
        y += 15;
        const taxAmount = subtotal * TAX_RATE;
        doc.text(`Tax (${(TAX_RATE * 100).toFixed(0)}%):`, summaryX, y, { width: 100, align: 'right' });
        doc.text(`₹${taxAmount.toFixed(2)}`, valueX, y, { align: 'right' });
        y += 15;
        let couponDiscount = 0;
        if (order.coupon_id && order.coupon_discount) { 
            couponDiscount = order.coupon_discount;
            doc.fillColor('green').text(`Coupon Discount:`, summaryX, y, { width: 100, align: 'right' });
            doc.text(`-₹${couponDiscount.toFixed(2)}`, valueX, y, { align: 'right' });
            doc.fillColor('black'); 
            y += 15;
        }
        const shippingCost = 0.00; 
        doc.text(`Shipping:`, summaryX, y, { width: 100, align: 'right' });
        doc.text(`₹${shippingCost.toFixed(2)}`, valueX, y, { align: 'right' });
        y += 15;
        const grandTotal = subtotal + taxAmount - couponDiscount + shippingCost; 
        doc.strokeColor('#aaaaaa')
           .lineWidth(1)
           .moveTo(summaryX, y + 5) 
           .lineTo(doc.page.width - 50, y + 5)
           .stroke();
        y += 15; 
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(`Total Amount:`, summaryX, y, { width: 80, align: 'right' });
        doc.text(`₹${grandTotal.toFixed(2)}`, valueX, y, { align: 'right' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Oblique').text('Thank you for your business!', {width:100, align: 'left' ,justify:'center'});
        doc.end();
    } catch (error) {
        console.error('Error generating invoice:', error);
        req.session.message = { icon: 'error', title: 'Error!', text: 'Server error occurred while generating invoice.' };
        res.status(500).redirect('/user/orderDetail');
    }
};
///////Cancel///////////
// To request cancellation for a SINGLE item
exports.requestItemCancellation = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'A reason for cancellation is required.' });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId or itemId.' });
    }


    const order=await Order.findById({_id: orderId});
    const product = order.products.find(p => p._id.toString() === itemId.toString());
    const prevStatus = product?.status;
    // Only allow cancellation if item is not already shipped/delivered
    const result = await Order.updateOne(
      { 
        _id: orderId, 
        "products._id": itemId,
        "products.status": { $in: ["CONFIRMED", "PROCESSING", "PACKED"] }
      },
      { 
        $set: { 
          "products.$.prev_status":prevStatus,
          "products.$.status": "CANCELLATION REQUESTED",
          "products.$.cancellation_reason": { reason, requestedAt: new Date() }
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: 'Item cannot be cancelled (status not eligible).' });
    }

    res.json({ success: true, message: 'Cancellation request for the item submitted successfully.' });
  } catch (error) {
    console.error("Error requesting item cancellation:", error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// Cancel the entire order
exports.requestEntireOrderCancellation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'A reason for cancellation is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId.' });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    let updated = false;
    order.order_cancellation_reason = { reason, requestedAt: new Date() };
    for (const product of order.products) {
      if (
        product.status !== 'CANCELLED' &&
        product.status !== 'CANCELLATION REQUESTED' &&
        product.status !== 'RETURNED' &&
        product.status !== 'RETURN REQUESTED'
      ) {
        if (!product.prev_status) {
            product.prev_status = product.status;  // Save previous status before update
         }
        product.status = 'CANCELLATION REQUESTED';
        product.cancellation_reason = {}; // or { reason, requestedAt: new Date() } if per-item reason needed
        updated = true;
      }
    }
    if (!updated) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled (statuses not eligible or no update).' });
    }
    await order.save();
    res.json({ success: true, message: 'Cancellation request for the entire order submitted successfully.' });
  } catch (error) {
    console.error("Error requesting entire order cancellation:", error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/////////Return////////
// To request a return for a SINGLE item
exports.requestItemReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'A reason for return is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId or itemId.' });
    }
    const order=await Order.findById({_id: orderId});
    const product = order.products.find(p => p._id.toString() === itemId.toString());
    const prevStatus = product?.status;
    // Update only if item status is DELIVERED (eligible for return)
    const result = await Order.updateOne(
      {
        _id: orderId,
        "products._id": itemId,
        "products.status": "DELIVERED"
      },
      {
        $set: {
          "products.$.status": prevStatus,
          "products.$.status": "RETURN REQUESTED",
          "products.$.return_reason": { reason, requestedAt: new Date() }
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: 'Item cannot be returned (status not eligible).' });
    }

    res.json({ success: true, message: 'Return request for the item submitted successfully.' });
  } catch (error) {
    console.error("Error requesting item return:", error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Request return for entire order items eligible (DELIVERED)
exports.requestEntireOrderReturn = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'A reason for return is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId.' });
    }
    // Fetch the order to inspect product states
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    let updated = false;
    order.order_return_reason = { reason, requestedAt: new Date() };
    // Update only eligible items
    for (const product of order.products) {
      if (
        product.status !== 'CANCELLED' &&
        product.status !== 'CANCELLATION REQUESTED' &&
        product.status !== 'RETURNED' &&
        product.status !== 'RETURN REQUESTED'
      ) {
        if (!product.prev_status) {
            product.prev_status = product.status;  // Save previous status before update
         }
        product.status = 'RETURN REQUESTED';
        product.return_reason = {}; // or { reason, requestedAt: new Date() } for per-item reason
        updated = true;
      }
    }
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No items eligible for return in this order.' });
    }
    await order.save();
    res.json({ success: true, message: 'Return request for the entire order submitted successfully.' });
  } catch (error) {
    console.error("Error requesting entire order return:", error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};