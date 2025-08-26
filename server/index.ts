import "dotenv/config";
import express from "express";
import cors from "cors";

// Import all routes
import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import clientRoutes from "./routes/clients";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import cashflowRoutes from "./routes/cashflow";
import billingRoutes from "./routes/billing";
import invoiceRoutes from "./routes/invoices";
import publicationRoutes from "./routes/publications";
import notificationRoutes from "./routes/notifications";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "Law SaaS Backend"
    });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/clients", clientRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/cashflow", cashflowRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/publications", publicationRoutes);
  app.use("/api/notifications", notificationRoutes);

  return app;
}
