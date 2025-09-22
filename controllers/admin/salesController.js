const Order = require("../../model/order.js");
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');


async function getSalesData(query) {
    const { filter, startDate, endDate } = query;

    let dateFilter = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
        case 'daily':
            dateFilter = { $gte: today };
            break;
        case 'weekly':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            dateFilter = { $gte: startOfWeek };
            break;
        case 'monthly':
            dateFilter = { $gte: new Date(today.getFullYear(), today.getMonth(), 1) };
            break;
        case 'yearly':
            dateFilter = { $gte: new Date(today.getFullYear(), 0, 1) };
            break;
        case 'custom':
            if (startDate && endDate) {
                dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };
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
                totalDiscount: { $sum: { $add: ['$offerDiscount', '$couponDiscount'] } },
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
            case 'daily':
                dateFilter = { $gte: today };
                break;
            case 'weekly':
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                dateFilter = { $gte: startOfWeek };
                break;
            case 'monthly':
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                dateFilter = { $gte: startOfMonth };
                break;
            case 'yearly':
                const startOfYear = new Date(today.getFullYear(), 0, 1);
                dateFilter = { $gte: startOfYear };
                break;
            case 'custom':
                if (startDate && endDate) {
                    dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };
                }
                break;
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
                    totalDiscount: { $sum: { $add: ['$offerDiscount', '$couponDiscount'] } },
                    orderCount: { $sum: 1 }
                }
            }
        ]);
        const summary = summaryResult[0] || { totalSalesAmount: 0, totalDiscount: 0, orderCount: 0 };
        
       
        const orders = await Order.find(matchStage)
            .populate('user_id', 'firstname lastname')
            .sort({ createdAt: -1 })
            .lean();

        res.render('admin/sales', {
            summary,
            orders,
            query: req.query,
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
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Total Sales: Rs. ${(summary.totalSalesAmount || 0).toFixed(2)}`);
    doc.text(`Total Orders: ${summary.orderCount || 0}`);
    doc.text(`Total Discount: Rs. ${(summary.totalDiscount || 0).toFixed(2)}`);
    doc.text(`Total Offer Applied: Rs. ${(summary.total_offer_applied || 0).toFixed(2)}`);
    doc.moveDown(2);
    const cols = {
      orderId: 50,
      date: 160,
      customer: 240,
      amount: 380,
      offerApplied: 470,
    };
    doc.fontSize(10).font('Helvetica-Bold');
    const tableTop = doc.y;
    doc.text('Order ID', cols.orderId, tableTop);
    doc.text('Date', cols.date, tableTop);
    doc.text('Customer', cols.customer, tableTop);
    doc.text('Amount', cols.amount, tableTop, { width: 70, align: 'right' });
    doc.text('Offer Applied', cols.offerApplied, tableTop, { width: 70, align: 'right' });
    doc.moveTo(cols.orderId, tableTop + 15).lineTo(560, tableTop + 15).stroke();
    doc.font('Helvetica');
    let y = tableTop + 25;
    orders.forEach(order => {
      if (y > 750) {
        doc.addPage();
        y = 50;
        doc.font('Helvetica-Bold');
        doc.text('Order ID', cols.orderId, y);
        doc.text('Date', cols.date, y);
        doc.text('Customer', cols.customer, y);
        doc.text('Amount', cols.amount, y, { width: 70, align: 'right' });
        doc.text('Offer Applied', cols.offerApplied, y, { width: 70, align: 'right' });
        doc.moveTo(cols.orderId, y + 15).lineTo(560, y + 15).stroke();
        doc.font('Helvetica');
        y += 25;
      }

      const orderId = order.order_id ? (order.order_id.length > 15 ? order.order_id.substring(0, 15) + '...' : order.order_id) : 'N/A';
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';
      const customerName = order.user_id ? `${order.user_id.firstname || ''} ${order.user_id.lastname || ''}`.trim() || 'N/A' : 'N/A';
      const amountText = `Rs. ${(order.total_amount || 0).toFixed(2)}`;
      const offerAppliedText = `Rs. ${((order.total_offer_applied != null ? order.total_offer_applied : 0)).toFixed(2)}`;
    
      doc.text(orderId, cols.orderId, y);
      doc.text(orderDate, cols.date, y);
      doc.text(customerName, cols.customer, y);
      doc.text(amountText, cols.amount, y, { width: 70, align: 'right' });
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

    // Add Summary
    worksheet.addRow(['Sales Report Summary']);
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.addRow([]);
    worksheet.addRow(['Total Sales', `Rs. ${summary.totalSalesAmount?.toFixed(2) || '0.00'}`]);
    worksheet.addRow(['Total Orders', summary.orderCount || 0]);
    worksheet.addRow(['Total Discount', `Rs. ${summary.totalDiscount?.toFixed(2) || '0.00'}`]);
    worksheet.addRow([]);

    // Add Table Headers
    worksheet.addRow(['Order ID', 'Date', 'Customer', 'Amount', 'Discount', 'Payment Method']);
    worksheet.getRow(7).font = { bold: true };

    // Add Data Rows
    orders.forEach(order => {
      worksheet.addRow([
        order.order_id || 'N/A',
        order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
        order.user_id ? `${order.user_id.firstname || ''} ${order.user_id.lastname || ''}`.trim() : 'N/A',
        order.total_amount || 0,
        (order.offerDiscount || 0) + (order.couponDiscount || 0),
        order.payment_method || 0
      ]);
    });

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).send('Server Error');
  }
};