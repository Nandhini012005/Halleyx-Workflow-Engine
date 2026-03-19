import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, GitBranch, PlayCircle, ClipboardList, Zap } from 'lucide-react';

import WorkflowListPage from './pages/WorkflowListPage';
import WorkflowEditorPage from './pages/WorkflowEditorPage';
import ExecutionPage from './pages/ExecutionPage';
import AuditLogPage from './pages/AuditLogPage';
import ExecutionDetailPage from './pages/ExecutionDetailPage';

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">Halleyx</div>
        <div className="logo-sub">Workflow Engine</div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        <NavLink to="/workflows" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <GitBranch size={16} /> Workflows
        </NavLink>
        <NavLink to="/audit" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <ClipboardList size={16} /> Audit Log
        </NavLink>
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/workflows" replace />} />
          <Route path="/workflows" element={<WorkflowListPage />} />
          <Route path="/workflows/new" element={<WorkflowEditorPage />} />
          <Route path="/workflows/:id/edit" element={<WorkflowEditorPage />} />
          <Route path="/workflows/:id/execute" element={<ExecutionPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/executions/:id" element={<ExecutionDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
