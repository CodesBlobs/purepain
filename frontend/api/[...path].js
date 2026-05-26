module.exports = async function handler(req, res) {
  const pathParts = req.query.path || [];
  const qs = req.url.split('?')[1] || '';
  const target = `${process.env.BACKEND_URL}/${pathParts.join('/')}${qs ? '?' + qs : ''}`;

  const headers = {};
  if (req.headers['content-type'])  headers['content-type']  = req.headers['content-type'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

  const opts = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method) && req.body) {
    opts.body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(target, opts);
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Backend unreachable', detail: err.message });
  }
};
