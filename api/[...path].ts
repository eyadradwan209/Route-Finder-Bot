import express from "express";
import cors from "cors";
import healthRouter from "../artifacts/api-server/src/routes/health";
import uploadRouter from "../artifacts/api-server/src/routes/upload";
import airportsRouter from "../artifacts/api-server/src/routes/airports";
import uiRouter from "../artifacts/api-server/src/routes/ui";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = express.Router();
router.use(healthRouter);
router.use(uploadRouter);
router.use(airportsRouter);
router.use(uiRouter);

app.use("/api", router);
app.use("/", router);

export default app;
