require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI + '/videotube').then(async () => {
  const db = mongoose.connection.collection('videos');
  await db.updateMany({ status: 'processing' }, { $set: { status: 'ready' } });
  console.log('Fixed videos');
  process.exit(0);
});
