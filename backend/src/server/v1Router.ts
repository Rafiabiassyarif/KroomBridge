import express, { Request, Response, NextFunction } from "express";
import { gatewayRouter } from "./gateway.js";
import { db } from "./db.js";

export const v1Router = express.Router();

// GET /v1 -> Info gateway + model registered.
v1Router.get("/", async (req: Request, res: Response) => {
  const meta = db.getMeta();
  const apiKey = meta.apiKeys?.find(k => k.provider === 'kroma')?.key || meta.kromaApiKey || process.env.KROMA_API_KEY;
  const KROMA_API_URL = process.env.KROMA_API_URL || "https://kroma.kroombox.com";
  
  let registeredModels: any[] = [];
  try {
    const kromaRes = await fetch(`${KROMA_API_URL}/v1/models`, {
      method: "GET",
      headers: apiKey ? { "Authorization": `Bearer ${apiKey}`, "x-api-key": apiKey } : {}
    });
    if (kromaRes.ok) {
      const data = await kromaRes.json();
      if (data.data && Array.isArray(data.data)) {
        registeredModels = data.data.map((m: any) => m.id);
      }
    }
  } catch (e) {
    console.error("[v1Router] Error fetching models for info:", e);
  }

  res.json({
    status: "ok",
    name: "KroomBridge API Gateway",
    version: "1.0.0",
    description: "OpenAI Compatible Endpoint natively integrated with Kroma AI",
    models_registered: registeredModels.length,
    models: registeredModels
  });
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
