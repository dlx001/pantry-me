import express from "express";
import * as kroger from './stores/kroger';
import * as walmart from './stores/walmart';
import { requireAuth } from "@clerk/clerk-sdk-node";

interface StoreHandler {
  getLocation: (req: express.Request, res: express.Response) => Promise<any>;
  getProduct: (req: express.Request, res: express.Response) => Promise<any>;
}

const router = express.Router();
const storeHandlers: Record<string, StoreHandler> = {
  kroger,
  walmart,
};


router.get('/location', requireAuth(async (req: any, res: any) => {
  const { store, latlong } = req.query;
  if (!store || !latlong) return res.sendStatus(400);
  const handler = storeHandlers[store as string]?.getLocation;
  if (!handler) return res.status(400).json({ error: 'Unknown store' });
  return handler(req, res);
}));

router.get('/product', requireAuth(async (req: any, res: any) => {
  const { store, item } = req.query;
  if (!store || !item) return res.sendStatus(400);
  const handler = storeHandlers[store as string]?.getProduct;
  if (!handler) return res.status(400).json({ error: 'Unknown store' });
  return handler(req, res);
}));



export default router;
