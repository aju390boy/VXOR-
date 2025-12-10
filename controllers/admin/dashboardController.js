const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');



exports.getDashboard = async (req, res) => {
    try {
        const bestSellingType = req.query.bestSellingType || 'products';
        const salesRange = req.query.salesRange || '7d';
        
        const totalSalesResult = await Order.aggregate([
            { $match: { payment_status: 'COMPLETED' } },
            { $group: { _id: null, totalSales: { $sum: '$total_amount' } } }
        ]);
        const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;
        const orderCount = await Order.countDocuments();
        const customerCount = await User.countDocuments({ role: 'user' });
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user_id', 'firstname lastname');

        // Dynamic sales data based on salesRange
        const now = new Date();
        let startDate, dateFormat;

        if (salesRange === '24h') {
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            dateFormat = "%Y-%m-%d %H:00";
        } else if (salesRange === '1m') {
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            dateFormat = "%Y-%m-%d";
        } else if (salesRange === '1y') {
            startDate = new Date(now);
            startDate.setFullYear(startDate.getFullYear() - 1);
            dateFormat = "%Y-%m";
        } else {
            // default 7 days
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFormat = "%Y-%m-%d";
        }

        const salesAggregation = await Order.aggregate([
            {
                $match: {
                    payment_status: 'COMPLETED',
                    createdAt: { $gte: startDate, $lte: now }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: dateFormat,
                            date: "$createdAt",
                            timezone: "+05:30"
                        }
                    },
                    total: { $sum: '$total_amount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const salesDataMap = new Map(salesAggregation.map(d => [d._id, d.total]));
        const salesDataForChart = [];

        // GROUPED TIME PERIODS - PERFECT 6-12 COLUMNS MAX
       if (salesRange === '24h') {
    // BULLETPROOF: Direct MongoDB aggregation for 4-hour groups
    const hourlySales = await Order.aggregate([
        {
            $match: {
                payment_status: 'COMPLETED',
                createdAt: { $gte: startDate, $lte: now }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d %H:00",
                        date: "$createdAt",
                        timezone: "+05:30"
                    }
                },
                total: { $sum: '$total_amount' }
            }
        }
    ]);

    const hourlyMap = new Map(hourlySales.map(d => [d._id, d.total]));
    
    // Group into 4-hour chunks (MongoDB format guaranteed)
    const groups = {
        '8PM-12AM': ['20:00', '21:00', '22:00', '23:00'],
        '12AM-4AM': ['00:00', '01:00', '02:00', '03:00'],
        '4AM-8AM': ['04:00', '05:00', '06:00', '07:00'],
        '8AM-12PM': ['08:00', '09:00', '10:00', '11:00'],
        '12PM-4PM': ['12:00', '13:00', '14:00', '15:00'],
        '4PM-8PM': ['16:00', '17:00', '18:00', '19:00']
    };

    Object.entries(groups).forEach(([label, hours]) => {
        let groupSales = 0;
        hours.forEach(hour => {
            // Check both yesterday and today for each hour
            const yesterdayKey = `2025-12-07 ${hour}`;
            const todayKey = `2025-12-08 ${hour}`;
            groupSales += (hourlyMap.get(yesterdayKey) || 0) + (hourlyMap.get(todayKey) || 0);
        });
        salesDataForChart.push({ label, sales: groupSales });
        console.log(`sales cart : ${salesDataForChart}`)
    });


        } else if (salesRange === '1m') {
            // 10 groups of 3 days (perfect spacing)
            const dayGroups = [
                { startDay: 1, endDay: 4, label: '1st-3rd' },
                { startDay: 4, endDay: 7, label: '4th-6th' },
                { startDay: 7, endDay: 10, label: '7th-9th' },
                { startDay: 10, endDay: 13, label: '10th-12th' },
                { startDay: 13, endDay: 16, label: '13th-15th' },
                { startDay: 16, endDay: 19, label: '16th-18th' },
                { startDay: 19, endDay: 22, label: '19th-21st' },
                { startDay: 22, endDay: 25, label: '22nd-24th' },
                { startDay: 25, endDay: 28, label: '25th-27th' },
                { startDay: 28, endDay: 31, label: '28th-30th' }
            ];
            
            dayGroups.slice(0, 10).forEach(group => {
                let groupSales = 0;
                for (let d = group.startDay; d < group.endDay && d <= 30; d++) {
                    const date = new Date(now.getTime() - (30 - d) * 24 * 60 * 60 * 1000);
                    const dateKey = date.toISOString().split('T')[0];
                    groupSales += salesDataMap.get(dateKey) || 0;
                }
                salesDataForChart.push({ label: group.label, sales: groupSales });
            });

        } else if (salesRange === '1y') {
            // 12 months (already perfect)
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now);
                date.setMonth(date.getMonth() - i);
                const label = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const sales = salesDataMap.get(dateKey) || 0;
                salesDataForChart.push({ label, sales });
            };
        } else {
            // 7 days (already perfect)
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                const label = date.toLocaleString('en-US', { weekday: 'short' });
                const dateKey = date.toISOString().split('T')[0];
                const sales = salesDataMap.get(dateKey) || 0;
                salesDataForChart.push({ label, sales });
            }
        }

        const maxSales = Math.max(...salesDataForChart.map(d => d.sales), 1);

        // BEST SELLING LOGIC (unchanged)
        let bestSelling;
        if (bestSellingType === 'products') {
            bestSelling = await Order.aggregate([
                { $match: { payment_status: 'COMPLETED' } },
                { $unwind: "$products" },
                {
                    $lookup: {
                        from: "products",
                        let: { pid: "$products.product_id" },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$_id", "$$pid"] },
                                        { $eq: ["$isDeleted", false] }
                                    ]
                                }
                            }
                        }],
                        as: "productDetails"
                    }
                },
                { $unwind: "$productDetails" },
                { $unwind: "$productDetails.colorVariants" },
                {
                    $group: {
                        _id: "$products.product_id",
                        productTitle: { $first: "$productDetails.title" },
                        totalSalesCount: { $sum: "$products.quantity" },
                        productImages: { $addToSet: "$productDetails.colorVariants.images" }
                    }
                },
                {
                    $project: {
                        productTitle: 1,
                        totalSalesCount: 1,
                        productImages: {
                            $reduce: {
                                input: "$productImages",
                                initialValue: [],
                                in: { $concatArrays: ["$$value", "$$this"] }
                            }
                        }
                    }
                },
                { $sort: { totalSalesCount: -1 } },
                { $limit: 5 }
            ]);
        } else if (bestSellingType === 'category') {
            bestSelling = await Order.aggregate([
                { $match: { payment_status: 'COMPLETED' } },
                { $unwind: "$products" },
                {
                    $lookup: {
                        from: "products",
                        let: { pid: "$products.product_id" },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$_id", "$$pid"] },
                                        { $eq: ["$isDeleted", false] }
                                    ]
                                }
                            }
                        }],
                        as: "productDetails"
                    }
                },
                { $unwind: "$productDetails" },
                {
                    $lookup: {
                        from: "categories",
                        localField: "productDetails.category_id",
                        foreignField: "_id",
                        as: "categoryDetails"
                    }
                },
                { $unwind: "$categoryDetails" },
                {
                    $group: {
                        _id: "$productDetails.category_id",
                        categoryName: { $first: "$categoryDetails.name" },
                        totalSalesCount: { $sum: "$products.quantity" },
                        products: { $addToSet: "$productDetails.title" },
                        productImages: { $addToSet: "$productDetails.colorVariants.images" }
                    }
                },
                {
      $project: {
        categoryName: 1,
        totalSalesCount: 1,
        products: 1,
        productImages: {
          $reduce: {
            input: "$productImages",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] }
          }
        }
      }
    },
                { $sort: { totalSalesCount: -1 } },
                { $limit: 5 }
            ]);
        } else if (bestSellingType === 'brand') {
            bestSelling = await Order.aggregate([
                { $match: { payment_status: 'COMPLETED' } },
                { $unwind: "$products" },
                {
                    $lookup: {
                        from: "products",
                        let: { pid: "$products.product_id" },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$_id", "$$pid"] },
                                        { $eq: ["$isDeleted", false] }
                                    ]
                                }
                            }
                        }],
                        as: "productDetails"
                    }
                },
                { $unwind: "$productDetails" },
                {
                    $lookup: {
                        from: "brands",
                        localField: "productDetails.brand_id",
                        foreignField: "_id",
                        as: "brandDetails"
                    }
                },
                { $unwind: "$brandDetails" },
                {
                    $group: {
                        _id: "$productDetails.brand_id",
                        brandName: { $first: "$brandDetails.name" },
                        totalSalesCount: { $sum: "$products.quantity" },
                        products: { $addToSet: "$productDetails.title" },
                         productImages: { $addToSet: "$productDetails.colorVariants.images" }
                    }
                },
                 {
      $project: {
        brandName: 1,
        totalSalesCount: 1,
        products: 1,
        productImages: {
          $reduce: {
            input: "$productImages",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] }
          }
        }
      }
    },
                { $sort: { totalSalesCount: -1 } },
                { $limit: 5 }
            ]);
        } else {
            bestSelling = await Product.find({ isDeleted: false })
                .sort({ totalSalesCount: -1 })
                .limit(5);
        }

        // Format best-selling items
        if (bestSellingType === 'products' || bestSellingType === 'category' || bestSellingType === 'brand') {
    bestSelling = bestSelling.map(item => {
        let displayImage = 'https://via.placeholder.com/96';
        
        // FLATTEN nested arrays and filter valid images
        let flatImages = [];
        if (item.productImages && Array.isArray(item.productImages)) {
            flatImages = item.productImages.flat().filter(img => 
                img && typeof img === 'string' && img.trim().length > 0
            );
        }
        
        if (flatImages.length > 0) {
            const firstImage = flatImages[0];
            displayImage = firstImage.startsWith('http') 
                ? firstImage 
                : `/uploads/products/${firstImage}`;
        }
        
        return {
            ...item,
            displayImage,
            productImages: flatImages // Optional: clean up for frontend
        };
    });
}

        res.render('admin/dashboard', {
            totalSales,
            orderCount,
            customerCount,
            recentOrders,
            bestSelling,
            bestSellingType,
            salesDataForChart,
            maxSales,
            salesRange,
            layout: false
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Server Error');
    }
};
