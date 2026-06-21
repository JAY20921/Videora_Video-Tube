import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI + '/videotube').then(async () => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('subscriptions');
        const duplicates = await collection.aggregate([
            { $group: { _id: { subscriber: '$subscriber', channel: '$channel' }, count: { $sum: 1 }, docs: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();
        console.log('Duplicates found:', duplicates.length);
        for (const doc of duplicates) {
            const [keep, ...remove] = doc.docs;
            await collection.deleteMany({ _id: { $in: remove } });
        }
        await collection.createIndex({ subscriber: 1, channel: 1 }, { unique: true });
        console.log('Index created successfully');
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
