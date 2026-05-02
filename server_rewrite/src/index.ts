import cors from "cors";
import express from "express";
import { getTopListens } from "./api/top-listens.js";

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3002;

app.post("/top-listens", getTopListens);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
