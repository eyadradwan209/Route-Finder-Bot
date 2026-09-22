import { Router, type IRouter } from "express";
import healthRouter from "./health";
import uploadRouter from "./upload";
import uiRouter from "./ui";
import discordRouter from "./discord";
import airportsRouter from "./airports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(discordRouter);
router.use(airportsRouter);
router.use(uiRouter);

export default router;
