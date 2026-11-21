import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export const requireDeviceApiKey: RequestHandler = (req, res, next) => {
  const expectedKey = process.env.DEVICE_API_KEY;
  if (!expectedKey) {
    res.status(503).json({
      error: "Scanner verification is not configured: DEVICE_API_KEY is missing.",
    });
    return;
  }

  const suppliedKey = req.header("x-device-api-key");
  if (!suppliedKey) {
    res.status(401).json({ error: "Scanner API key is missing or invalid." });
    return;
  }

  const expectedBuffer = Buffer.from(expectedKey, "utf8");
  const suppliedBuffer = Buffer.from(suppliedKey, "utf8");
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    res.status(401).json({ error: "Scanner API key is missing or invalid." });
    return;
  }

  next();
};
