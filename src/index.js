// require('dotenv').config({path: './env'})

import dotenv from "dotenv"
import connectDB from "./db/index.js";
// import express from "express";

// const app = express();

import {app} from './app.js'

dotenv.config({
    path: "./.env"
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000 , () => {
console.log(` listening on port " : ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log("MONGO DB connection failed !",err);

})