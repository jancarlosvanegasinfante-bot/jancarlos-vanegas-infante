fetch('http://localhost:3000/api/admin/seed', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
