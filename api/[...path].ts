import express from "express";
import cors from "cors";
import router from "../artifacts/api-server/src/routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel catch-all functions can receive either the /api-prefixed path
// or the path after /api depending on the routing configuration.
app.use("/api", router);
app.use("/", router);

export default app;