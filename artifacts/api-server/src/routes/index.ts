import { Router, type IRouter } from "express";
import healthRouter from "./health";
import attendanceRouter from "./attendance";
import authRouter from "./auth";
import locationsRouter from "./locations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(attendanceRouter);
router.use(locationsRouter);

export default router;
