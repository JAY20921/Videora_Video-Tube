require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI + '/videotube').then(async () => {
  const db = mongoose.connection.collection('videos');
  const videos = await db.find({ hlsUrl: { $exists: true, $ne: "" } }).toArray();
  console.log(`Found ${videos.length} videos with HLS urls`);
  if (videos.length > 0) {
      console.log(videos[0].title, videos[0].hlsUrl);
  }
  process.exit(0);
});
