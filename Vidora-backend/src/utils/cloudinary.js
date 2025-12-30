import {v2 as cloudinary}  from 'cloudinary';
import fs from 'fs';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});                            

 const uploadOnCloudinary = async (localFilePath, folder) => {
    try {
        if(!localFilePath){
            throw new Error("File path is required");
        }
        // Upload file to Cloudinary
       const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",

        })
        //File uploaded successfully
        // console.log("File uploaded to Cloudinary successfully", response.url);
        fs.unlinkSync(localFilePath)

        return response;
    }
    catch (error) {
if (localFilePath && fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
}
        console.error("Error uploading file to Cloudinary", error);
        return null;
    }
}


export  {uploadOnCloudinary};
