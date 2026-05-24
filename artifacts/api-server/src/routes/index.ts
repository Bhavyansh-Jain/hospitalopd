import { Router, type IRouter } from "express";
import healthRouter from "./health";
import patientsRouter from "./patients";
import visitsRouter from "./visits";
import aiRouter from "./ai";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(patientsRouter);
router.use(visitsRouter);
router.use(aiRouter);
router.use(openaiRouter);

export default router;
