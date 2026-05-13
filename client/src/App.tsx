import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { Layout } from './components/Layout'
import { SessionGuard } from './components/SessionGuard'
import { LoadingBlock } from './components/ui/LoadingBlock'
import { Login } from './pages/Login'

const CommandCentre = lazy(() => import('./pages/CommandCentre').then((m) => ({ default: m.CommandCentre })))
const AssetIntelligence = lazy(() => import('./pages/AssetIntelligence').then((m) => ({ default: m.AssetIntelligence })))
const RiskModule = lazy(() => import('./pages/RiskModule').then((m) => ({ default: m.RiskModule })))
const DecisionCentre = lazy(() => import('./pages/DecisionCentre').then((m) => ({ default: m.DecisionCentre })))
const NextActions = lazy(() => import('./pages/NextActions').then((m) => ({ default: m.NextActions })))
const ImportHub = lazy(() => import('./pages/ImportHub').then((m) => ({ default: m.ImportHub })))
const ReportingCentre = lazy(() => import('./pages/ReportingCentre').then((m) => ({ default: m.ReportingCentre })))
const Snapshots = lazy(() => import('./pages/Snapshots').then((m) => ({ default: m.Snapshots })))
const ComplianceTracker = lazy(() => import('./pages/ComplianceTracker').then((m) => ({ default: m.ComplianceTracker })))
const MasterData = lazy(() => import('./pages/MasterData').then((m) => ({ default: m.MasterData })))
const AuditTrail = lazy(() => import('./pages/AuditTrail').then((m) => ({ default: m.AuditTrail })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const Treasury = lazy(() => import('./pages/Treasury').then((m) => ({ default: m.Treasury })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

function RouteFallback() {
  return (
    <div className="p-6 md:p-10">
      <LoadingBlock label="Loading module…" />
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function RequireWriteRole({ children }: { children: React.ReactNode }) {
  const { canWrite } = useAuth()
  if (!canWrite) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireAuditRole({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user || user.role === 'viewer') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <SessionGuard />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <CommandCentre />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/search"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <SearchPage />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/treasury"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <Treasury />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/assets"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <AssetIntelligence />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/risk"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <RiskModule />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/decisions"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <DecisionCentre />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/actions"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <NextActions />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/import"
              element={
                <PrivateRoute>
                  <RequireWriteRole>
                    <Suspense fallback={<RouteFallback />}>
                      <ImportHub />
                    </Suspense>
                  </RequireWriteRole>
                </PrivateRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <PrivateRoute>
                  <RequireAuditRole>
                    <Suspense fallback={<RouteFallback />}>
                      <AuditTrail />
                    </Suspense>
                  </RequireAuditRole>
                </PrivateRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <ReportingCentre />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/snapshots"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <Snapshots />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <ComplianceTracker />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/data/master"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <MasterData />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="*"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <NotFound />
                  </Suspense>
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
