import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureEmptyDataBaseline } from "@/lib/storageMigration";

ensureEmptyDataBaseline();

createRoot(document.getElementById("root")!).render(<App />);
