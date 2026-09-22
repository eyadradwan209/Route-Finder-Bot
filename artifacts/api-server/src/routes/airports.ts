import { Router } from "express";
import { addAirport, removeAirport, listAirports } from "../bot/airports";

const router = Router();

router.get("/airports", async (_req, res) => {
  res.json({ airports: await listAirports() });
});

router.post("/airports", async (req, res) => {
  const raw = (req.body as { codes?: string; code?: string }).codes ?? (req.body as { code?: string }).code ?? "";
  const codes = String(raw)
    .split(/[\s,]+/)
    .map((c) => c.toUpperCase().trim())
    .filter(Boolean);

  if (codes.length === 0) {
    res.status(400).json({ error: "At least one airport code is required" });
    return;
  }

  const added: string[] = [];
  const existing: string[] = [];
  for (const code of codes) {
    if (await addAirport(code)) added.push(code);
    else existing.push(code);
  }

  res.json({ added, existing, airports: await listAirports() });
});

router.delete("/airports/:code", async (req, res) => {
  const code = req.params["code"]?.toUpperCase().trim();
  if (!code) {
    res.status(400).json({ error: "Airport code is required" });
    return;
  }
  const removed = await removeAirport(code);
  if (!removed) {
    res.status(404).json({ error: `${code} is not in the featured airports list` });
    return;
  }
  res.json({ removed: code, airports: await listAirports() });
});

export default router;
