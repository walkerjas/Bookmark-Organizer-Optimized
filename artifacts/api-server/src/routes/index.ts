import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bookmarksRouter from "./bookmarks";
import collectionsRouter from "./collections";
import tagsRouter from "./tags";
import importsRouter from "./imports";
import faviconRouter from "./favicon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bookmarksRouter);
router.use(collectionsRouter);
router.use(tagsRouter);
router.use(importsRouter);
router.use(faviconRouter);

export default router;
