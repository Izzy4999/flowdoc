import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const brand = (window as unknown as Record<string, string>)["__FLOWDOC_BRAND__"] ?? "#6366f1";
document.documentElement.style.setProperty("--brand", brand);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<StrictMode><App /></StrictMode>);
