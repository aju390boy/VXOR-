const Order = require('../../model/order');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');


exports.getOrderDetail = async (req, res) => {
  try {
    const { orderId, itemId } = req.params; 
    const userId = req.user._id;
    const TAX_RATE = 0.05;
    const message = req.session.message;
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
      req.session.message = { icon: 'error', title: 'Error', text: 'Order does not exist' };
      return res.redirect('/orders');
    }
    order.canCancelAll = order.products.some(p => ['CONFIRMED', 'PROCESSING', 'PACKED'].includes(p.status));
    order.canReturnAll = order.products.every(p => p.status === 'DELIVERED');
    order.products.forEach(item => {
      if (!item.product_id) { 
        item.canCancel = false;
        item.canReturn = false;
      } else {
        item.canCancel = ['CONFIRMED', 'PROCESSING', 'PACKED'].includes(item.status);
        item.canReturn = item.status === 'DELIVERED';
      }
    });
    let originalSubtotal = 0;
    let totalAfterOffers = 0;
    order.products.forEach(item => {
      if (!item.product_id) return;
      const sizeVariant = item.product_id.colorVariants
        .find(c => c.colorName === item.colorName)?.variants.find(s => s.size === item.size);
      const originalPrice = sizeVariant ? sizeVariant.price : item.price;
      originalSubtotal += originalPrice * item.quantity;
      totalAfterOffers += item.price * item.quantity;
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
    const progressSteps = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];
    const specialStatusPriority = ['CANCELLED', 'CANCELLATION REQUESTED', 'RETURNED', 'RETURN REQUESTED'];
    const allSpecialStatuses = [...new Set(order.products
      .map(p => p.status)
      .filter(status => specialStatusPriority.includes(status)))];
    let specialStatusToShow = null;
    for (const status of specialStatusPriority) {
      if (allSpecialStatuses.includes(status)) {
        specialStatusToShow = status;
        break;
      }
    }
    let itemDetail = null;
    let itemStatus = null;
    let itemUpdatedAt = null;
    if (itemId) {
      itemDetail = order.products.find(item => item._id.toString() === itemId);
      if (!itemDetail) {
        req.session.message = { icon: 'error', title: 'Error', text: 'Order item not found' };
        return res.redirect(`/orders/${orderId}`);
      }
      itemStatus = itemDetail.status;
      itemUpdatedAt = itemDetail.updatedAt || order.updatedAt;
    }
    let progressSegments = [];
    let specialSegments = [];
    if (!itemDetail) {
      const totalProducts = order.products.length;
      const progressCounts = progressSteps.reduce((acc, step) => {
        acc[step] = order.products.filter(p => p.status === step).length;
        return acc;
      }, {});
      const specialCounts = specialStatusPriority.reduce((acc, status) => {
        acc[status] = order.products.filter(p => p.status === status).length;
        return acc;
      }, {});
      progressSegments = progressSteps.map(step => ({
        status: step,
        count: progressCounts[step],
        percent: totalProducts ? (progressCounts[step] / totalProducts) * 100 : 0
      }));
      specialSegments = specialStatusPriority.map(status => ({
        status,
        count: specialCounts[status],
        percent: totalProducts ? (specialCounts[status] / totalProducts) * 100 : 0
      }));
    }
    res.render('user/orderDetail', {
      order,
      totals,
      message,
      progressSteps,
      progressSegments,
      specialSegments,
      itemDetail,
      itemStatus,
      itemUpdatedAt,
      specialStatusToShow
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    req.session.message = { icon: 'error', title: 'Error!', text: 'Error fetching order details' };
    res.status(500).redirect('/orders');
  }
};


////Download invoice///////
exports.downloadSingleInvoice = async (req, res) => {

  console.log('invoice hitted........................................')
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
      return res.redirect(`/profile?section=orders`);
    }
    const item = order.products.find(p => p._id.toString() === itemId);
    if (!item || !item.product_id) {
      req.session.message = { type: 'error', text: 'Item not found in this order.' };
      return res.redirect(`/profile?section=orders`);
    }
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-item-${item.product_id.title.replace(/\s+/g, '-')}.pdf"`);
    doc.pipe(res);
    doc.fontSize(24).font('Helvetica-Bold').text('Item Invoice', { align: 'center' });
    doc.moveDown(0.8);
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(13).text('VXOR Private Limited', 50, startY);
    doc.font('Helvetica').fontSize(10)
      .text('Atlantic junction', 50, startY + 15)
      .text('City: panampilly avenue', 50, startY + 30)
      .text('District: ernakulam', 50, startY + 45)
      .text('State: kerala', 50, startY + 60)
      .text('Pincode: 682020', 50, startY + 75)
      .text('Contact: 7559842946', 50, startY + 90)
      .text('Mail: arunmon4444@gmail.com', 50, startY + 105);
    const rightX = 280;
    doc.font('Helvetica-Bold').fontSize(9)
      .text(`Order Number: ${order.order_id}`, rightX, startY);
    doc.font('Helvetica').fontSize(10)
      .text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`, rightX, startY + 16)
      .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, rightX, startY + 32)
      .text(`Payment Status: ${order.payment_status}`, rightX, startY + 48)
      .text(`Payment Method: ${order.payment_method}`, rightX, startY + 64);

    doc.fontSize(10).font('Helvetica-Bold')
      .text('Shipping Address', rightX, startY + 90, { underline: true });
    doc.fontSize(10).font('Helvetica');
    let addressY = startY + 105;
    const address = order.address_id;
    if (address) {
      doc.text(address.name, rightX, addressY);
      doc.text(address.address1, rightX, addressY + 13);
      if (address.address2) doc.text(address.address2, rightX, addressY + 26);
      doc.text(`${address.city}, ${address.state} - ${address.pincode}`, rightX, addressY + 39);
      doc.text(`Mobile: ${address.mobile}`, rightX, addressY + 52);
    } else {
      doc.text('Address not available', rightX, addressY);
    }
    doc.moveDown(5);
    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(11);
    function generateTableRow(y_pos, item_name, qty_val, price_val, status_val, total_val) {
      doc.fontSize(10).font('Helvetica')
        .text(item_name, 50, y_pos, { width: 230, ellipsis: true })
        .text(qty_val, 280, y_pos, { width: 50, align: 'center' })
        .text(price_val, 330, y_pos, { width: 70, align: 'right' })
        .text(status_val, 400, y_pos, { width: 70, align: 'center' })
        .text(total_val, 0, y_pos, { align: 'right' }); 
    }
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
    // Summary as before
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
    res.redirect(`/orders/${req.params.orderId}`);
  }
};
exports.downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;
    const TAX_RATE = 0.05;
    if (!orderId) {
      req.session.message = { icon: 'error', title: 'Error!', text: 'Order ID is missing' };
      return res.status(400).redirect('/orderDetail');
    }
    const order = await Order.findOne({ order_id: orderId, user_id: userId })
      .populate('products.product_id', 'title')
      .populate('address_id')
      .populate('coupon_id')
      .lean();
    if (!order) {
      req.session.message = { icon: 'error', title: 'Error!', text: 'Invoice not found or you do not have permission to view it.' };
      return res.status(404).redirect('/orderDetail');
    }
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${order.order_id}.pdf"`);
    doc.pipe(res);
    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Order Invoice', { align: 'center' });
    doc.moveDown(0.8);
    const startY = doc.y;
    // Company Details (left)
    doc.font('Helvetica-Bold').fontSize(13).text('VXOR Private Limited', 50, startY);
    doc.font('Helvetica').fontSize(10)
      .text('Atlantic junction', 50, startY + 15)
      .text('City: panampilly avenue', 50, startY + 30)
      .text('District: ernakulam', 50, startY + 45)
      .text('State: kerala', 50, startY + 60)
      .text('Pincode: 682020', 50, startY + 75)
      .text('Contact: 7559842946', 50, startY + 90)
      .text('Mail: arunmon4444@gmail.com', 50, startY + 105);
    // Order Meta (right)
    const rightX = 280;
    doc.font('Helvetica-Bold').fontSize(9)
      .text(`Order Number: ${order.order_id}`, rightX, startY);
    doc.font('Helvetica').fontSize(10)
      .text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`, rightX, startY + 16)
      .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, rightX, startY + 32)
      .text(`Payment Status: ${order.payment_status}`, rightX, startY + 48)
      .text(`Payment Method: ${order.payment_method}`, rightX, startY + 64);
    doc.fontSize(10).font('Helvetica-Bold')
      .text('Shipping Address', rightX, startY + 90, { underline: true });
    doc.fontSize(10).font('Helvetica');
    let addressY = startY + 105;
    const address = order.address_id;
    if (address) {
      doc.text(address.name, rightX, addressY);
      doc.text(address.address1, rightX, addressY + 13);
      if (address.address2) doc.text(address.address2, rightX, addressY + 26);
      doc.text(`${address.city}, ${address.state} - ${address.pincode}`, rightX, addressY + 39);
      doc.text(`Mobile: ${address.mobile}`, rightX, addressY + 52);
    } else {
      doc.text('Address not available', rightX, addressY);
    }
    doc.moveDown(5);
    // Items Table Header
    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(11);
    function generateTableRow(y_pos, item_name, qty_val, price_val, status_val, total_val) {
      doc.fontSize(10).font('Helvetica')
        .text(item_name, 50, y_pos, { width: 230, ellipsis: true })
        .text(qty_val, 280, y_pos, { width: 50, align: 'center' })
        .text(price_val, 330, y_pos, { width: 70, align: 'right' })
        .text(status_val, 400, y_pos, { width: 70, align: 'center' })
        .text(total_val, 0, y_pos, { align: 'right' });
    }
    generateTableRow(tableTop, 'Product Name', 'Qty', 'Price Paid', 'Status', 'Total Paid');
    doc.moveTo(50, tableTop + 15).lineTo(doc.page.width - 50, tableTop + 15).stroke();
    let currentY = tableTop + 25;
    let subtotal = 0;
    let totalOfferDiscount = 0;
    let totalOriginalPrice = 0;

    // Items Rows
    order.products.forEach(item => {
      if (!item.product_id) return;
      const pricePaidPerUnit = item.price;
      const offerDiscountPerUnit = (item.offer_applied || 0);
      const originalPricePerUnit = pricePaidPerUnit + offerDiscountPerUnit;
      const itemTotalOriginal = originalPricePerUnit * item.quantity;
      const itemTotalOfferDiscount = offerDiscountPerUnit * item.quantity;
      const itemTotalPaidExcludingTax = pricePaidPerUnit * item.quantity;
      generateTableRow(
        currentY,
        item.product_id.title,
        item.quantity,
        `Rs. ${item.price.toFixed(2)}`,
        item.status,
        `Rs. ${(item.price * item.quantity).toFixed(2)}`
      );
      subtotal += itemTotalPaidExcludingTax;
      totalOfferDiscount += itemTotalOfferDiscount;
      totalOriginalPrice += itemTotalOriginal;
      currentY += 20;
    });
    doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke();
    currentY += 15;
    // Summary Section (Totals)
    const summaryLabelX = 300;
    const summaryValueX = doc.page.width - 150;
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
    doc.text(`Rs. ${subtotal.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
    currentY += 20;
    const taxAmount = subtotal * TAX_RATE;
    doc.text(`Tax (${(TAX_RATE * 100).toFixed(0)}%):`, summaryLabelX, currentY, { width: 100, align: 'right' });
    doc.text(`Rs. ${taxAmount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
    currentY += 10;
    doc.moveTo(summaryLabelX - 20, currentY + 5).lineTo(doc.page.width - 50, currentY + 5).stroke();
    currentY += 15;
    doc.font('Helvetica-Bold').fontSize(14);
    let grandTotal = subtotal + taxAmount;
    if (order.coupon_discount > 0) {
      doc.fillColor('green').font('Helvetica-Bold').fontSize(11)
        .text('Order Level Coupon Discount:', summaryLabelX, currentY, { width: 150, align: 'right' });
      doc.text(`- Rs. ${order.coupon_discount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
      doc.fillColor('black');
      grandTotal -= order.coupon_discount;
      currentY += 25;
    }
    doc.font('Helvetica-Bold').fontSize(14);
    doc.text('Total Amount Payable:', summaryLabelX, currentY, { width: 150, align: 'right' });
    doc.text(`Rs. ${grandTotal.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
    currentY += 30;
    doc.fontSize(10).font('Helvetica-Oblique').text(
      'Thank you for your business!', 50, doc.page.height - 50,
      { align: 'center', lineBreak: false }
    );
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    req.session.message = { icon: 'error', title: 'Error!', text: 'Server error occurred while generating invoice.' };
    res.status(500).redirect('/orderDetail');
  }
};
///////Cancel///////////
// To request cancellation for a SINGLE item
exports.requestItemCancellation = async (req, res) => {
  console.log('hello........................................')
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'A reason for cancellation is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid orderId or itemId.' });
    }
    const order=await Order.findById({_id: orderId});
    const product = order.products.find(p => p._id.toString() === itemId.toString());
    const prevStatus = product?.status;
    const result = await Order.updateOne(
      { 
        _id: orderId, 
        "products._id": itemId,
        "products.status": { $in: ["CONFIRMED", "PROCESSING", "PACKED"] }
      },
      { 
        $set: { 
          "concern": "CANCELLATION", 
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
     order.concern='CANCELLATION';
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
          "concern": "RETURN",
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
    order.concern='RETURN';
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