import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { Layout } from './components/Layout'
import { SessionGuard } from './components/SessionGuard'
import { LoadingBlock } from './components/ui/LoadingBlock'
import { Login } from './pages/Login'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const ChairmanDashboard = lazy(() =>
  import('./pages/ChairmanDashboard').then((m) => ({ default: m.ChairmanDashboard }))
)
const AssetIntelligence = lazy(() => import('./pages/AssetIntelligence').then((m) => ({ default: m.AssetIntelligence })))
const RiskModule = lazy(() => import('./pages/RiskModule').then((m) => ({ default: m.RiskModule })))
const DecisionCentre = lazy(() => import('./pages/DecisionCentre').then((m) => ({ default: m.DecisionCentre })))
const NextActions = lazy(() => import('./pages/NextActions').then((m) => ({ default: m.NextActions })))
const Communications = lazy(() => import('./pages/Communications').then((m) => ({ default: m.Communications })))
const ImportHub = lazy(() => import('./pages/ImportHub').then((m) => ({ default: m.ImportHub })))
const ReportingCentre = lazy(() => import('./pages/ReportingCentre').then((m) => ({ default: m.ReportingCentre })))
const Snapshots = lazy(() => import('./pages/Snapshots').then((m) => ({ default: m.Snapshots })))
const ComplianceTracker = lazy(() => import('./pages/ComplianceTracker').then((m) => ({ default: m.ComplianceTracker })))
const MasterData = lazy(() => import('./pages/MasterData').then((m) => ({ default: m.MasterData })))
const CashBankingRegister = lazy(() =>
  import('./pages/CashBankingRegister').then((m) => ({ default: m.CashBankingRegister }))
)
const RealEstateRegister = lazy(() =>
  import('./pages/RealEstateRegister').then((m) => ({ default: m.RealEstateRegister }))
)
const PublicSecuritiesRegister = lazy(() =>
  import('./pages/PublicSecuritiesRegister').then((m) => ({ default: m.PublicSecuritiesRegister }))
)
const LiabilitiesRegister = lazy(() =>
  import('./pages/LiabilitiesRegister').then((m) => ({ default: m.LiabilitiesRegister }))
)
const EntityExposure = lazy(() => import('./pages/EntityExposure').then((m) => ({ default: m.EntityExposure })))
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue').then((m) => ({ default: m.ApprovalQueue })))
const ComplianceCalendar = lazy(() =>
  import('./pages/ComplianceCalendar').then((m) => ({ default: m.ComplianceCalendar }))
)
const DataMaintenance = lazy(() => import('./pages/DataMaintenance').then((m) => ({ default: m.DataMaintenance })))
const AuditTrail = lazy(() => import('./pages/AuditTrail').then((m) => ({ default: m.AuditTrail })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const Treasury = lazy(() => import('./pages/Treasury').then((m) => ({ default: m.Treasury })))
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const AdminUsers = lazy(() => import('./pages/AdminUsers').then((m) => ({ default: m.AdminUsers })))
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

function RequireLead({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'lead') return <Navigate to="/" replace />
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
                    <Home />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/chairman"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <ChairmanDashboard />
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
              path="/communications"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <Communications />
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
              path="/reports/:slug?"
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
              path="/compliance/calendar"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <ComplianceCalendar />
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
              path="/data/cash"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <CashBankingRegister />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/data/real-estate"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <RealEstateRegister />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/data/securities"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <PublicSecuritiesRegister />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/data/liabilities"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <LiabilitiesRegister />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/entities"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <EntityExposure />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <PrivateRoute>
                  <RequireWriteRole>
                    <Suspense fallback={<RouteFallback />}>
                      <ApprovalQueue />
                    </Suspense>
                  </RequireWriteRole>
                </PrivateRoute>
              }
            />
            <Route
              path="/maintenance"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <DataMaintenance />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PrivateRoute>
                  <RequireLead>
                    <Suspense fallback={<RouteFallback />}>
                      <AdminUsers />
                    </Suspense>
                  </RequireLead>
                </PrivateRoute>
              }
            />
            <Route
              path="/help"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <Help />
                  </Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <Settings />
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
