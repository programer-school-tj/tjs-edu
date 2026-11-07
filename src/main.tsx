import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GlobalContextProviders } from "../components/_globalContextProviders";
import App from "./App";
import "../base.css";

const root = document.getElementById("root");
if (!root) throw new Error("TJS Edu root element was not found");
createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <GlobalContextProviders><App /></GlobalContextProviders>
    </BrowserRouter>
  </React.StrictMode>
);
