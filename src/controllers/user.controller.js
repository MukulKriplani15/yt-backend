import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js'; 
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) =>{
    try{
        // console.log(1);
        const user = await User.findById(userId);
        // console.log(2);
        const accessToken =  user.generateAccessToken()
        // console.log(3);
        const refreshToken =  user.generateRefreshToken()
        // console.log(4);
        user.refreshToken = refreshToken
        // console.log(5);
        await user.save({validateBeforeSave : false})
        // console.log(6);
        return {accessToken, refreshToken}
    } catch(error){
        // console.log(7);
        throw new ApiError(500,"Something went wrong")
    }
}

const registerUser= asyncHandler(async(req,res) =>{
   
    // get user details from frontend 
    // validation - not empty 
    // check if user already exists: username,email 
    // check for images, check for avatar 
    // upload them to cloudinary ,avatar 
    // create user object - creat entry in db 
    // remove password and refresh token field from respnse 
    // check for user creation 
    // return response 

    const {fullname, email, username, password} = req.body;
     // console.log("email: " , email)

    if([
        fullname,
        email,
        username,
        password
    ].some((field) => field === undefined || field?.trim() === "")
){
throw new ApiError(400,"All fields are required")
    }
 const existedUser = await User.findOne(
    {
        $or:[{email},{username}]
    }
 )
 if(existedUser){
    throw new ApiError(409,"Email or Username already exists")
 }

 const avatarLocalPath = req.files?.avatar?.[0]?.path;
 const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

 if(!avatarLocalPath){
    console.error("No avatar", req.files)
    throw new ApiError(400,"Please upload an avatar")
 }
 const avatar = await uploadOnCloudinary(avatarLocalPath)   
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)

if(!avatar){
    throw new ApiError(400, "Failed to upload avatar" )
}
const user = await User.create(
    {
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    }
)

const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
)
if(!createdUser){
    throw new ApiError(500,"Failed to create user")
}
return res.status(201).json(
    new ApiResponse(200, createdUser, "User registerd successfully")
)
})

const loginUser = asyncHandler(async(req,res) =>{
        //  req body -> data 
        // username or email 
        // find the user 
        // password check 
        // access and refresh token 
        // send cookie

        const {email, username, password} = req.body

        if(!username && !email){
            throw new ApiError(400, "Please provide username or email")
        }
       const user = await User.findOne({
            $or : [{username}, {email}]
        })

        if(!user){
            throw new ApiError(404, "user does not exist")
        }
        const isPasswordValid = await user.isPasswordCorrect(password)

        if(!isPasswordValid){
            throw new ApiError(401, "Invalid password")
        }
     
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

        const loggedInUser = await User.findById(user._id).select("-password -refresh-token")

        const options = {
            httpOnly: true,
            secure: true
        }
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken,
                    refreshToken
                },
                "User logged in Successfully"
        )
        )
})

const logoutUser = asyncHandler(async(req,res) =>{
    await User.findByIdAndUpdate(
        req.user._id,{
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true
        }
     )
     const options = {
        httpOnly: true,
        secure: true,
     }
    return res.status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async(req,res) =>{
     const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

     if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request") 
     }
    try {
         const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
         const user = await User.findById(decodedToken?._id)
    
    if(!user){
        throw new ApiError(401, "Invalid Refresh Token")
    }
        if(incomingRefreshToken != user?.refreshToken){
            throw new ApiError(401, "Refresh tokein is expired or used")
        }
    
        const options = {
            httpOnly : true,
            secure: true
        }
       const {accessToken, newRefreshToken} =  await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken" , refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "User's Access Token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message|| "Invalid refresh token")
    }
   


})

const changeCurrentPassword = asyncHandler(async(req,res) =>{
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old Password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res.status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res) =>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user fetchd successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res) =>{
  const {fullname, email} = req.body
  if(!fullname || !email){
    throw new ApiError(400, "Fullname and email are required")
  }
  const user  = await User.findByIdAndUpdate(req.user?._id,
    {
        $set:{
            fullname,
            email:email
        }
    },
    {new: true}

  ).select("-password")

  return res.status(200)
  .json(new ApiResponse(200,
    user,
    "Account details updated successfully")
  )
})

const updateUserAvatar = asyncHandler(async(req,res) =>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uplaoding avatar")

    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"Avatar Image Updated Successfully")
 )
})

const updateUserCoverImage = asyncHandler(async(req,res) =>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uplaoding avatar")

    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
            coverImage: coverImage.url 
            }
        },
        {new:true}
    ).select("-password")

    return res.status(200)
   .json(new ApiResponse(200,user,"Cover Image Updated Successfully")
)
})

export {registerUser, 
        loginUser,
        logoutUser,
        refreshAccessToken,
        changeCurrentPassword,
        getCurrentUser,
        updateAccountDetails,
        updateUserAvatar,
        updateUserCoverImage}