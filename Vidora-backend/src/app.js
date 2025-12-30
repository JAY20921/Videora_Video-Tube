import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
// Support comma-separated list in CORS_ORIGIN and flexible matching.
const rawOrigins = process.env.CORS_ORIGIN || "";
const allowedOrigins = rawOrigins.split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // allow requests with no origin (eg. curl, mobile apps, same-origin)
        if (!origin) return callback(null, true);

        // if no origins configured, allow all (useful in local/dev)
        if (allowedOrigins.length === 0) return callback(null, true);

        // allow if the incoming origin matches one of the allowed origins
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // otherwise block
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));

app.use(express.json({
    limit: '16kb'
}));
app.use(express.urlencoded({ extended: true , limit: '16kb'}));
app.use(express.static("public"));
app.use(cookieParser());

//routes
import userRouter from "./routes/user.routes.js";
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"

//routes declaration
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)


//routes declaration
app.use("/api/v1/users", userRouter);


export { app }