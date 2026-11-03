import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureEmptyDataBaseline, migrateLegacyStorageKeys } from "@/lib/storageMigration";

migrateLegacyStorageKeys();
ensureEmptyDataBaseline();

createRoot(document.getElementById("root")!).render(<App />);
