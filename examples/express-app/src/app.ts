import express from "express";
import { flowdoc } from "flowdoc-gen";
import { usersRouter } from "./routes/users.js";
import { authRouter } from "./routes/auth.js";

const app = express();
app.use(express.json());
app.use("/docs", flowdoc());
app.use(usersRouter);
app.use(authRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3456;
app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
  console.log(`Docs    at http://localhost:${PORT}/docs`);
});
