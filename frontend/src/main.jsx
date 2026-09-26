import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./state/AuthContext.jsx";
import { DataProvider } from "./state/DataContext.jsx";
import { RegionProvider } from "./state/RegionContext.jsx";
import { ToastProvider } from "./state/ToastContext.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <RegionProvider>
            <DataProvider>
              <App />
            </DataProvider>
          </RegionProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
