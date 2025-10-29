import cors from "cors";
import express from "express";
import { analyseVideo } from "./api/analyse.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use("/analyse", analyseVideo);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
