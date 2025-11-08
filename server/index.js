import cors from "cors";
import express from "express";
import { analyseVideo } from "./api/analyse.js";
import { classifySong } from "./api/classify.js";
import { addSongListeningTime } from "./api/listen.js";
import { getTopListens } from "./api/top-listens.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.text({ type: "application/json" }));

app.use("/listen", addSongListeningTime);
app.use("/analyse", analyseVideo);
app.use("/top-listens", getTopListens);
app.use("/classify", classifySong);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
