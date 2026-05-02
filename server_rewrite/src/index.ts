import cors from "cors";
import express from "express";
import { classifySong } from "./api/classify.js";
import { addSongListeningTime } from "./api/listen.js";
import { getTopListens } from "./api/top-listens.js";
import { getVideos } from "./api/videos.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/top-listens", getTopListens);
app.post("/add-listening-time", addSongListeningTime);
app.post("/classify", classifySong);
app.get("/videos", getVideos);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
