import {v2 as cloudinary}  from 'cloudinary';
import fs from 'fs';
import { promisify } from 'util';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});                            
const unlinkAsync = promisify(fs.unlink);
const UPLOAD_TIMEOUT_MS = 30000;

 const uploadOnCloudinary = async (localFilePath, folder) => {
    try {
        if(!localFilePath){
            throw new Error("File path is required");
        }
        // folder controls the Cloudinary destination (e.g. avatars, coverImages)
        const uploadPromise = cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder
        });
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Cloudinary upload timeout")), UPLOAD_TIMEOUT_MS);
        });
        let response;
        try {
            response = await Promise.race([uploadPromise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
        await unlinkAsync(localFilePath).catch(() => {});

        return response;
    }
    catch (error) {
        if (localFilePath && fs.existsSync(localFilePath)) {
            await unlinkAsync(localFilePath).catch(() => {});
        }
        console.error("Error uploading file to Cloudinary", error);
        return null;
    }
}


export  {uploadOnCloudinary};
