const express = require('express');

const router = express.Router();

// In-memory sample data
const items = [
  { id: 1, name: 'First item' },
  { id: 2, name: 'Second item' },
];

// GET /api/example
router.get('/', (req, res) => {
  res.json({ message: 'Example route is working', data: items });
});

// GET /api/example/:id
router.get('/:id', (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));

  if (!item) {
    return res.status(404).json({ error: `No item with id ${req.params.id}` });
  }

  res.json({ data: item });
});

// POST /api/example
router.post('/', (req, res) => {
  const { name } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Field "name" is required' });
  }

  const item = { id: items.length + 1, name };
  items.push(item);

  res.status(201).json({ message: 'Item created', data: item });
});

module.exports = router;
