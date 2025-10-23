// App entry point: mounts React with Router and React Query.
// Extend providers here when adding global state, themes, or analytics.
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRoutes from "./app/routes";
import "./index.css";

// Single query client instance for caching and deduping across pages
const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Provides React Query cache and devtools integration */}
    <QueryClientProvider client={qc}>
      {/* BrowserRouter manages client-side navigation */}
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
