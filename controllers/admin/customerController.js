const User = require('../../model/user.js');

exports.getCustomers = async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 5;

  const query = {
    $or: [
      { firstname: { $regex: search, $options: 'i' } },
      { lastname: { $regex: search, $options: 'i' } }
    ]
  };

  const totalCustomers = await User.countDocuments(query);
  const customers = await User.find(query)
    .sort({ createdAt: -1 }) 
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalPages = Math.ceil(totalCustomers / limit);

  const formattedCustomers = customers.map(c => ({
    ...c,
    name: `${c.firstname} ${c.lastname}`,
   joined: c.createdAt.toLocaleDateString('en-IN')
  }));

  
  res.render('admin/customers', {
    customers: formattedCustomers,
    search,
    currentPage: page,
    totalPages,
    layout:false
  });
};


exports.blockCustomer = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { status: 'blocked' });
  res.redirect('/admin/customers');
};

exports.unblockCustomer = async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { status: 'active' });
  res.redirect('/admin/customers');
};

exports.getCustomersAjax = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const searchQuery = new RegExp(search, 'i');
        const isNumeric = /^\d+$/.test(search);
        const mobileMatch = isNumeric ? [{ mobile: parseInt(search) }] : [];
        const pipeline = [
            {
                $addFields: {
                    name: {
                        $concat: [
                            { $ifNull: ['$firstname', ''] },
                            ' ',
                            { $ifNull: ['$lastname', ''] }
                        ]
                    }
                }
            },
            {
                $match: {
                    $or: [
                        { name: { $regex: searchQuery } },
                        { email: { $regex: searchQuery } },
                        ...mobileMatch
                    ]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: limit
            }
        ];
        const countPipeline = [
            {
                $addFields: {
                    name: {
                        $concat: [
                            { $ifNull: ['$firstname', ''] },
                            ' ',
                            { $ifNull: ['$lastname', ''] }
                        ]
                    }
                }
            },
            {
                $match: {
                    $or: [
                        { name: { $regex: searchQuery } },
                        { email: { $regex: searchQuery } },
                        ...mobileMatch
                    ]
                }
            },
            {
                $count: 'total'
            }
        ];

        const customers = await User.aggregate(pipeline);
        const totalCustomersResult = await User.aggregate(countPipeline);
        const totalCustomers = totalCustomersResult.length > 0 ? totalCustomersResult[0].total : 0;
        const totalPages = Math.ceil(totalCustomers / limit);

        const formattedCustomers = customers.map((c, index) => ({
    number: (page - 1) * limit + index + 1,
    name: `${c.firstname} ${c.lastname}`,
    email: c.email,
    mobile: c.mobile,
    status: c.status,
    joined: c.createdAt ? c.createdAt.toLocaleDateString('en-IN') : 'N/A',
    _id: c._id
}));

res.json({ customers: formattedCustomers, totalPages, currentPage: page });

    } catch (err) {
        console.error('Search failed:', err);
        res.status(500).json({ error: 'Search failed' });
    }
};