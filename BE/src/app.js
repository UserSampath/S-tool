const express = require("express");
const cors = require("cors");
const exampleRouter = require("./routes/example");
const authRouter = require("./routes/auth");
const plansRouter = require("./routes/plans");
const projectsRouter = require("./routes/projects");
const notesRouter = require("./routes/notes");
const grammarRouter = require("./routes/grammar");
const prRouter = require("./routes/pr");
const quickNotesRouter = require("./routes/quickNotes");
const swatchesRouter = require("./routes/swatches");
const dayTasksRouter = require("./routes/dayTasks");

const app = express();

// Needed for req.ip to reflect the real client when behind a proxy,
// which is what the rate limiter keys on.
app.set("trust proxy", 1);

// In production the browser only ever calls this API from the deployed
// frontend, so ALLOWED_ORIGINS names it. With the variable unset - local
// development - every origin is reflected, so nothing needs configuring to
// run the app on your own machine.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", authRouter);
app.use("/api/plans", plansRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/notes", notesRouter);
app.use("/api/grammar", grammarRouter);
app.use("/api/pr", prRouter);
app.use("/api/quick-notes", quickNotesRouter);
app.use("/api/swatches", swatchesRouter);
app.use("/api/day-tasks", dayTasksRouter);
app.use("/api/example", exampleRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// Error handler. Only errors that deliberately carry a status are safe to
// echo back; anything else is a bug and gets a generic message.
app.use((err, req, res, next) => {
  console.error(err);

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
