import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js'; 
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js';

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

export {registerUser}