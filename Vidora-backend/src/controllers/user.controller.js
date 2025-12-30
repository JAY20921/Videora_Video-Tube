import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import  jwt  from 'jsonwebtoken';
import mongoose from 'mongoose';


const generateAccessAndRefreshTokens = async(userId)=>{
    try{    

      const user =   await User.findById(userId);
      const refreshToken = user.generateRefreshToken()
      const accessToken = user.generateAccessToken()

      user.refreshToken = refreshToken
     await user.save({ validateBeforeSave: false })

     return { refreshToken, accessToken }
    }
    catch(error){
        throw new ApiError(500, "Something Went Wrong while generating access token")
    }
}

const registerUser = asyncHandler(async (req,res) => {
   //Getting User Details from Frontend

    const {fullName, email, username, password } = req.body

    console.log("fullName: ", fullName ,"email: ", email,"username: ", username,"password: ", password);

   //validation - not empty

   if (
  !fullName?.trim() ||
  !email?.trim() ||
  !username?.trim() ||
  !password?.trim()
) {
  throw new ApiError(400, "All fields (fullName, email, username, password) are required");
}




   //Check if user already exists: username or email

     const existingUser = await  User.findOne({
              $or: [{username}, {email}]
        });
    
    if(existingUser){
        throw new ApiError(409,"User with given username or email already exists");
    }

    // console.log(req.files)

    //check for images, check for avatar

    const avatarLocalPath  = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError (400,"Avatar image is required");
    }
   

    //upload images to cloudinary, avatar 

    const avatar  =  await uploadOnCloudinary(avatarLocalPath, "avatars")
    let coverImage = null;
    if (coverImageLocalPath) {
            coverImage = await uploadOnCloudinary(coverImageLocalPath, "coverImages");
            }

    
    


    if(!avatar){
        throw new ApiError(500,"Error uploading avatar image");
    }

    //create user object and save to db

    const user = await  User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase(),
        password,
    })

   
    //remove password and refreshToken from response
 const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    

    //check if user is created successfully

    if(!createdUser){
        throw new ApiError(500,"Something went Wrong while registering User")
    }

    //return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User register Successfully!")
    )


}  )

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Validation
  if (!email && !username) {
    throw new ApiError(400, "Username or Email is required");
  }

  // Build the query dynamically (no lowercase)
  const query = [];
  if (email) query.push({ email });
  if (username) query.push({ username });

  const user = await User.findOne({ $or: query });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is not valid");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = { httpOnly: true, secure: true };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully")
    );
});


const logoutUser = asyncHandler(async (req, res) => {
await User.findByIdAndUpdate(    
    req.user._id,
    {
        $unset: {
            refreshToken: 1
        }
    },
    {
        new: true,

    })
    const options = {
        httpOnly : true,
        secure: true
    }
    return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User Logged Out Successfully !!!"))


})

const refreshAccessToken = asyncHandler(async(req,res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

   if(!incomingRefreshToken){
    throw new ApiError(401, "Unauthorized Request")
   }

try {
       const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET   
    )
    
    const user = await User.findById(decodedToken?._id)
    if(!user){
        throw new ApiError("Invalid refresh Token")
    }
    
    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(" Refresh Token is expired or used")
    }
    
    
    
    const options ={
        httpOnly: true,
        secure: true
    }
       const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);
       
    return res
            .status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",newRefreshToken,options)
            .json(
                new ApiResponse(200, {accessToken,refreshToken : newRefreshToken},
                    "AcessToken refreshed."
    
    
                )
            )
} catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token")
}
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body;
    
    const user = await User.findById(req.user?._id)
    
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password")

    }
    
    user.password = newPassword;
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200, {},"Password Changed Successfully!"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json( new ApiResponse(200,req.user,"Current User Fetched Successfully."))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required");
    }

  const user = await User.findByIdAndUpdate(req.user?._id,{
    $set:{
        fullName,
        email
    }
  },{new:true}).select("-password")

  return res
            .status(200)
            .json(new ApiResponse(200, user, "Account Details Updated Successfully"))

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
         throw new ApiError(400, "Error while uploading on avatar")
    }

   const user = await User.findByIdAndUpdate(req.user?._id,{
    $set:{
        avatar: avatar.url
    }
   },{new:true}).select("-password")


   return res.status(200)
            .json(
                new ApiResponse(200, user, "Avatar updated SuccessFully")
            )
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const CoverImageLocalPath = req.file?.path

    if(!CoverImageLocalPath){
        throw new ApiError(400, "CoverImage is missing")
    }
    const coverImage = await uploadOnCloudinary(CoverImageLocalPath)
    if(!coverImage.url){
         throw new ApiError(400, "Error while uploading on CoverImage")
    }

   const user = await User.findByIdAndUpdate(req.user?._id,{
    $set:{
        coverImage: coverImage.url
    }
   },{new:true}).select("-password")
   
   return res.status(200)
            .json(
                new ApiResponse(200, user, "CoverImageUpdated SuccessFully")
            )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
   const {username} =  req.params
   
   if(!username?.trim()){
    throw new ApiError(400, "Username is missing.")

   }

   const channel = await User.aggregate([
    {
        $match:{
            username: username?.toLowerCase(),

        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField:"_id",
            foreignField:"channel",
            as: "subscribers"
        }
    },
    {
       $lookup:{
            from: "subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount : {
                $size: "$subscribers"
            },
             channelsSubscribedToCount : {
                $size: "$subscribedTo"
            },
            isSubscribed: {
                $cond:{
                    if:{$in:[req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project:{
            fullName: 1,
            username: 1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1

        }
    }
   ])


   if(!channel?.length){
    throw new ApiError(404,"Channel Does not Exist");
   }

   return res
            .status(200)
            .json(
                new ApiResponse(200, channel[0],"User Channel fetched Successfully")
            )





})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }

        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as:"watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project:{
                                        fullName: 1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    }
                ]

            }
        },
        {
            $addFields:{
                owner:{
                    $first: "$owner"
                }
            }
        }
    ])


    return res
            .status(200)
            .json(new ApiResponse(200, user[0].watchHistory, "Watch History fetched Successfully"))
})




export { registerUser,loginUser,logoutUser,refreshAccessToken , 
        changeCurrentPassword,getCurrentUser,updateAccountDetails,
        updateUserAvatar, updateUserCoverImage,getUserChannelProfile,
        getWatchHistory};