import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import { EtfDetail, EtfList } from "./pages/Etf";
import Learn from "./pages/Learn";
import Reports from "./pages/Reports";
import Ask from "./pages/Ask";
import { CompanyDetail, CompanyList } from "./pages/Company";
import { Login, Settings, Strategy } from "./pages/Misc";

// 단일 HTML 파일은 file:// 로 열리므로 주소 대신 # 뒤로 화면을 나눈다
const Router = import.meta.env.VITE_STANDALONE ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="etf" element={<EtfList />} />
          <Route path="etf/:code" element={<EtfDetail />} />
          <Route path="company" element={<CompanyList />} />
          <Route path="company/:ticker" element={<CompanyDetail />} />
          <Route path="learn" element={<Learn />} />
          <Route path="learn/:id" element={<Learn />} />
          <Route path="strategy" element={<Strategy />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ask" element={<Ask />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </React.StrictMode>,
);
