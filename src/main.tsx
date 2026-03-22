import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./routes";
import { SidebarProvider } from "./components/dashboard/sidebar/SidebarContext";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidebarProvider>
      <AppRouter />
    </SidebarProvider>
  </React.StrictMode>
);
