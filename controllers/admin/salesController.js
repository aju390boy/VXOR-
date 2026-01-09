const Order = require("../../model/order.js");
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');


async function getSalesData(query) {
    const { filter, startDate, endDate } = query;
    let dateFilter = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
   switch (filter) {
    case 'daily':
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter = { $gte: startOfDay, $lte: endOfDay };
        break;
    case 'weekly':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        dateFilter = { $gte: startOfWeek };
        break;
    case 'monthly':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        dateFilter = { $gte: startOfMonth };
        break;
    case 'yearly':
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        dateFilter = { $gte: startOfYear };
        break;
    case 'custom':
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $gte: start, $lte: end };
        }
        break;
}
    const matchStage = { payment_status: 'COMPLETED' };
    if (Object.keys(dateFilter).length > 0) {
        matchStage.createdAt = dateFilter;
    }
    const summaryResult = await Order.aggregate([
        { $match: matchStage },

        {
            $group: {
                _id: null,
                totalSalesAmount: { $sum: '$total_amount' },
                total_offer_applied:{$sum:'$total_offer_applied'},
                totalDiscount: { $sum: { $add: ['$total_offer_applied', '$coupon_discount'] } },
                orderCount: { $sum: 1 }
            }
        }
    ]);
    const orders = await Order.find(matchStage)
        .populate('user_id', 'firstname lastname')
        .sort({ createdAt: -1 })
        .lean();
    const summary = summaryResult[0] || { totalSalesAmount: 0, totalDiscount: 0, orderCount: 0 };
    return { summary, orders };
}


exports.renderSalesPage = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        let dateFilter = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        switch (filter) {
    case 'daily': {
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter = { $gte: startOfDay, $lte: endOfDay };
        break;
    }
    case 'weekly': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        dateFilter = { $gte: startOfWeek, $lte: endOfWeek };
        break;
    }
    case 'monthly': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        dateFilter = { $gte: startOfMonth, $lte: endOfMonth };
        break;
    }
    case 'yearly': {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);
        dateFilter = { $gte: startOfYear, $lte: endOfYear };
        break;
    }
    case 'custom': {
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { $gte: start, $lte: end };
        }
        break;
    }
    default:
        break;
}
        const matchStage = { payment_status: 'COMPLETED' };
        if (Object.keys(dateFilter).length > 0) {
            matchStage.createdAt = dateFilter;
        }

        
        const summaryResult = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalSalesAmount: { $sum: '$total_amount' },
                    totalDiscount: { $sum: { $add: ['$total_offer_applied', '$coupon_discount'] } },
                    orderCount: { $sum: 1 }
                }
            }
        ]);
        const summary = summaryResult[0] || { totalSalesAmount: 0, totalDiscount: 0, orderCount: 0 };
        
      
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
         const totalSales = await Order.countDocuments(matchStage);
          const totalPages = Math.ceil(totalSales / limit);
        const orders = await Order.find(matchStage)
            .skip(skip)
            .limit(limit)
            .populate('user_id', 'firstname lastname')
            .sort({ createdAt: -1 })
            .lean();

        res.render('admin/sales', {
            summary,
            orders,
            currentPage: page,
            totalPages,
            query: req.query,
            currentPage:'sales',
            layout: false
        });

    } catch (error) {
        console.error('Error rendering sales page:', error);
        res.status(500).send('Server Error');
    }
};






exports.downloadPdfReport = async (req, res) => {
  try {
    const { summary, orders } = await getSalesData(req.query);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
    doc.pipe(res);

    // Header
    doc.font('Helvetica-Bold').fontSize(22).text('Sales Report', { align: 'center' });
    doc.moveDown(1);
    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(12).text('VXOR Private Limited', 50, headerY);
    doc.font('Helvetica').fontSize(10);
    doc.text('Atlantic junction', 50, headerY + 15);
    doc.text('City: panampilly avenue', 50, headerY + 30);
    doc.text('District: ernakulam', 50, headerY + 45);
    doc.text('State: kerala', 50, headerY + 60);
    doc.text('Pincode: 682020', 50, headerY + 75);
    doc.text('Contact: 7559842946', 50, headerY + 90);
    doc.text('Mail: arunmon4444@gmail.com', 50, headerY + 105);

    // Summary Box
    const rightX = 350;
    const summaryY = headerY;
    const summaryW = 190;
    const summaryH = 110;
    doc.rect(rightX, summaryY, summaryW, summaryH).stroke();

    doc.font('Helvetica-Bold').fontSize(12).text('Summary', rightX + 10, summaryY + 10);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total Sales: Rs. ${(summary.totalSalesAmount || 0).toFixed(2)}`, rightX + 10, summaryY + 30);
    doc.text(`Total Orders: ${summary.orderCount || 0}`, rightX + 10, summaryY + 45);
    doc.text(`Total Discount (Coupons): Rs. ${(summary.totalDiscount || 0).toFixed(2)}`, rightX + 10, summaryY + 60);
    doc.text(`Total Offer Applied: Rs. ${(summary.total_offer_applied || 0).toFixed(2)}`, rightX + 10, summaryY + 75);

    const netRevenue =
      (summary.totalSalesAmount || 0) -
      (summary.totalDiscount || 0) -
      (summary.total_offer_applied || 0);
    doc.text(`Net Revenue: Rs. ${netRevenue.toFixed(2)}`, rightX + 10, summaryY + 90);

    doc.moveDown(6);

    // Table columns
    const cols = {
      orderId: 50,
      date: 170,
      customer: 240,
      amount: 300,
      couponApplied: 390,
      offerApplied: 470,
    };

    doc.fontSize(9).font('Helvetica-Bold');
    let tableTop = doc.y;

    // Table Header
    doc.text('Order ID', cols.orderId, tableTop);
    doc.text('Date', cols.date, tableTop);
    doc.text('Customer', cols.customer, tableTop);
    doc.text('Amount', cols.amount, tableTop, { width: 70, align: 'right' });
    doc.text('Coupon Applied', cols.couponApplied, tableTop, { width: 70, align: 'right' });
    doc.text('Offer Applied', cols.offerApplied, tableTop, { width: 70, align: 'right' });
    doc.moveTo(cols.orderId, tableTop + 15).lineTo(560, tableTop + 15).stroke();

    doc.font('Helvetica');

    let y = tableTop + 25;

    orders.forEach(order => {
      if (y > 850) {
        doc.addPage();
        y = 50;
        // Re-draw table header on new page
        doc.font('Helvetica-Bold');
        doc.text('Order ID', cols.orderId, y);
        doc.text('Date', cols.date, y);
        doc.text('Customer', cols.customer, y);
        doc.text('Amount', cols.amount, y, { width: 70, align: 'right' });
        doc.text('Coupon Applied', cols.couponApplied, y, { width: 70, align: 'right' });
        doc.text('Offer Applied', cols.offerApplied, y, { width: 70, align: 'right' });
        doc.moveTo(cols.orderId, y + 15).lineTo(560, y + 15).stroke();
        doc.font('Helvetica');
        y += 25;
      }

      const orderId = order.order_id
        ? (order.order_id.length > 15 ? order.order_id.substring(0, 15) + '...' : order.order_id)
        : 'N/A';
      const orderDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString()
        : 'N/A';
      const customerName = order.user_id
        ? `${order.user_id.firstname || ''} ${order.user_id.lastname || ''}`.trim() || 'N/A'
        : 'N/A';
      const amountText = `Rs. ${(order.total_amount || 0).toFixed(2)}`;
      const couponAppliedText = `Rs. ${(order.coupon_discount != null ? order.coupon_discount : 0).toFixed(2)}`;
      const offerAppliedText = `Rs. ${(order.total_offer_applied != null ? order.total_offer_applied : 0).toFixed(2)}`;

      doc.text(orderId, cols.orderId, y);
      doc.text(orderDate, cols.date, y);
      doc.text(customerName, cols.customer, y);
      doc.text(amountText, cols.amount, y, { width: 70, align: 'right' });
      doc.text(couponAppliedText, cols.couponApplied, y, { width: 70, align: 'right' });
      doc.text(offerAppliedText, cols.offerApplied, y, { width: 70, align: 'right' });
      y += 25;
    });

    doc.end();

  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).send('Server Error');
  }
};



exports.downloadExcelReport = async (req, res) => {
  try {
    const { summary, orders } = await getSalesData(req.query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    // === Header ===
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    // === Company Info (rows 3 to 11) ===
    worksheet.getCell('A3').value = 'VXOR Private Limited';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A4').value = 'Atlantic junction';
    worksheet.getCell('A5').value = 'City: panampilly avenue';
    worksheet.getCell('A6').value = 'District: ernakulam';
    worksheet.getCell('A7').value = 'State: kerala';
    worksheet.getCell('A8').value = 'Pincode: 682020';
    worksheet.getCell('A9').value = 'Contact: 7559842946';
    worksheet.getCell('A10').value = 'Mail: arunmon4444@gmail.com';

    // === Summary Info block on right (merge cells for a box) ===
    worksheet.mergeCells('E3:G3');
    worksheet.getCell('E3').value = 'Summary';
    worksheet.getCell('E3').font = { bold: true };
    worksheet.getCell('E4').value = `Total Sales: Rs. ${(summary.totalSalesAmount || 0).toFixed(2)}`;
    worksheet.getCell('E5').value = `Total Orders: ${summary.orderCount || 0}`;
    worksheet.getCell('E6').value = `Total Discount: Rs. ${(summary.totalDiscount || 0).toFixed(2)}`;
    worksheet.getCell('E7').value = `Total Offer Applied: Rs. ${(summary.total_offer_applied || 0).toFixed(2)}`;

    // Add some spacing before table
    worksheet.addRow([]);
    worksheet.addRow([]);

    // === Table Headers ===
    worksheet.addRow(['Order ID', 'Date', 'Customer', 'Amount', 'Coupon Applied', 'Offer Applied']);
    worksheet.getRow(14).font = { bold: true };

    // === Add orders data ===
    orders.forEach(order => {
      const orderId = order.order_id || 'N/A';
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';
      const customerName = order.user_id ? `${order.user_id.firstname || ''} ${order.user_id.lastname || ''}`.trim() : 'N/A';
      const amount = order.total_amount || 0;
      const couponApplied = order.coupon_discount || 0;
      const offerApplied = order.total_offer_applied || 0;

      worksheet.addRow([orderId, orderDate, customerName, amount, couponApplied, offerApplied]);
    });
    worksheet.columns = [
      { key: 'orderId', width: 20 },
      { key: 'date', width: 15 },
      { key: 'customer', width: 25 },
      { key: 'amount', width: 15 },
      { key: 'couponApplied', width: 15 },
      { key: 'offerApplied', width: 15 },
    ];

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).send('Server Error');
  }
};