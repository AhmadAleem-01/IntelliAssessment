import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { ProjectDetailPage } from './features/projects/ProjectDetailPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { TemplateEditorPage } from './features/templates/TemplateEditorPage';
import { AssessmentPage } from './features/assessments/AssessmentPage';
import { AssessmentsListPage } from './features/assessments/AssessmentsListPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SeedDemoPage } from './features/admin/SeedDemoPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/:templateId/edit" element={<TemplateEditorPage />} />
        <Route path="/assessments" element={<AssessmentsListPage />} />
        <Route path="/assessments/:assessmentId" element={<AssessmentPage />} />
        {/* Admin / demo seeding — not linked from the nav, accessed by URL only. */}
        <Route path="/admin/seed" element={<SeedDemoPage />} />
      </Route>
    </Routes>
  );
}

export default App;
