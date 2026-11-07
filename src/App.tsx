import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "../pages/_index";
import AdminPage from "../pages/admin";
import AttendancePage from "../pages/attendance";
import ClassesPage from "../pages/classes";
import HelpPage from "../pages/help";
import LoginPage from "../pages/login";
import MaterialsPage from "../pages/materials";
import PayrollPage from "../pages/payroll";
import RegisterPage from "../pages/register";
import ReportsPage from "../pages/reports";
import StaffPage from "../pages/staff";
import StudentsPage from "../pages/students";
import TariffsPage from "../pages/tariffs";
import TimetablePage from "../pages/timetable";

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/admin" element={<AdminPage />} />
    <Route path="/attendance" element={<AttendancePage />} />
    <Route path="/classes" element={<ClassesPage />} />
    <Route path="/help" element={<HelpPage />} />
    <Route path="/materials" element={<MaterialsPage />} />
    <Route path="/payroll" element={<PayrollPage />} />
    <Route path="/reports" element={<ReportsPage />} />
    <Route path="/staff" element={<StaffPage />} />
    <Route path="/students" element={<StudentsPage />} />
    <Route path="/tariffs" element={<TariffsPage />} />
    <Route path="/timetable" element={<TimetablePage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
