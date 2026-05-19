import { Router, type IRouter } from "express";
import healthRouter from "./health";
import uploadRouter from "./upload";
import uiRouter from "./ui";

const router: IRouter = Router();

router.use(healthRouter);
router.use(uploadRouter);
router.use(uiRouter);

export default router;
