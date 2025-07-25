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
    .sort({ createdAt: -1 }) // latest first
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
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  const isNumeric = /^\d+$/.test(search);
  const query = {
  $or: [
    { firstname: { $regex: search, $options: 'i' } },
    { lastname: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
    ...(isNumeric ? [{ mobile: Number(search) }] : [])
  ]
};

  const totalCustomers = await User.countDocuments(query);
  const customers = await User.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const formattedCustomers = customers.map((c, index) => ({
    number: index + 1,
    name: `${c.firstname} ${c.lastname}`,
    email: c.email,
    mobile:c.mobile,
    status: c.status,
    joined: c.join_date.toLocaleDateString('en-IN'),
    _id: c._id
  }));

  res.json({ customers: formattedCustomers });
};

