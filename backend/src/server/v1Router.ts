import express, { Request, Response, NextFunction } from "express";
import { gatewayRouter } from "./gateway.js";
import { db } from "./db.js";
import {
  KROMA_API_URL,
  getKromaApiKey,
  getAvailableModels,
  ensureModelRegistry,
} from "./modelRegistry.js";

export const v1Router = express.Router();

// GET /v1 -> Info gateway + model registered.
v1Router.get("/", async (req: Request, res: Response) => {
  const apiKey = getKromaApiKey();

  await ensureModelRegistry();

  res.json({
    status: "ok",
    name: "KroomBridge API Gateway",
    version: "1.0.0",
    description: "OpenAI Compatible Endpoint natively integrated with Kroma AI & 9r (LiteLLM)",
    models_registered: getAvailableModels().length,
    models: getAvailableModels(),
  });
});

// GET /v1/models — daftar model gabungan Kroma + 9r (yang aktif)
v1Router.get("/models", async (req: Request, res: Response) => {
  await ensureModelRegistry();

  const models = getAvailableModels().map((id) => ({
    id,
    object: "model",
    created: 0,
    owned_by: id.split("/")[0] || "unknown",
  }));

  res.json({ object: "list", data: models });
});

// Proxy all other /v1/* requests (like /models, /chat/completions) to the gateway router
// simulating a call to /gateway/kroma/v1/*
v1Router.use((req: Request, res: Response, next: NextFunction) => {
  // Rewrite request to go through gateway middleware & proxy
  req.url = `/kroma/v1${req.url}`;
  req.baseUrl = `/gateway`;

  // Pass control to gatewayRouter
  gatewayRouter(req, res, next);
});
