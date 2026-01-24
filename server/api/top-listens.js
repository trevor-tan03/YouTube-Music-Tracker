import { getTopListensInPeriod } from "../util/getListeningTime.js";

export async function getTopListens(req, res) {
  try {
    const period = req.query.period || "day";
    const topListens = await getTopListensInPeriod(period);
    res.json(topListens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
