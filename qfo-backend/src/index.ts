import express from "express";
import cors, { CorsOptions } from "cors";
import { env } from "./env";
import { authRouter } from "./auth/routes";
import stripeRouter from "./stripe/routes";

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/stripe", stripeRouter);

app.listen(env.PORT, () => {
  console.log(`API listening at http://localhost:${env.PORT}`);
});
