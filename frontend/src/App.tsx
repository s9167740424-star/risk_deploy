import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import MainLayout from './components/layout/MainLayout';
import { pruneCache } from './utils/geoCache';
import { loadHints } from './data/hints';
import HomePage from './pages/Home/HomePage';
import AuthPage from './pages/Auth/AuthPage';
import SurveyPage from './pages/Survey/SurveyPage';
import Step1Page from './pages/Step1/Step1Page';
import Step2Page from './pages/Step2/Step2Page';
import Step3Page from './pages/Step3/Step3Page';
import MaterialsPage from './pages/Materials/MaterialsPage';

const App: React.FC = () => {
  const { isAuthenticated, user, isBootstrapping, bootstrap } = useAuthStore();
  const [hintsReady, setHintsReady] = useState(false);

  useEffect(() => {
    void bootstrap();
    pruneCache();
    void loadHints().finally(() => setHintsReady(true));
  }, [bootstrap]);

  if (isBootstrapping || !hintsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-text-secondary font-medium">Загрузка…</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />

        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/app" replace /> : <AuthPage />}
        />

        <Route
          path="/survey"
          element={
            isAuthenticated && !user?.isGuest ? (
              <SurveyPage />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        <Route path="/app" element={<MainLayout />}>
          <Route index element={<Navigate to="/app/step1" replace />} />
          <Route path="step1" element={<Step1Page />} />
          <Route path="step2" element={<Step2Page />} />
          <Route path="step3" element={<Step3Page />} />
          <Route path="materials" element={<MaterialsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
