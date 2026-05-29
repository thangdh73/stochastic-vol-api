import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { routerBasename } from './api/baseUrl'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './context/AuthContext'
import { SaveProjectProvider } from './context/SaveProjectContext'
import { WorkflowProvider } from './context/WorkflowContext'
import { DependencySectionLayout } from './layouts/DependencySectionLayout'
import { InputSectionLayout } from './layouts/InputSectionLayout'
import { OutputSectionLayout } from './layouts/OutputSectionLayout'
import { SetupSectionLayout } from './layouts/SetupSectionLayout'
import { ChartsPage } from './pages/Charts'
import { Dashboard } from './pages/Dashboard'
import { DependencyWorkbenchPage } from './pages/DependencyWorkbench'
import { ExpectationCurvePage } from './pages/ExpectationCurve'
import { ExportPage } from './pages/Export'
import { GroupWorkbenchPage } from './pages/GroupWorkbench'
import { InputHcYieldPage, InputRockVolumePage } from './pages/InputWorkbench'
import { AreaPage } from './pages/Area'
import { ChancePage } from './pages/Chance'
import { CorrelationsPage } from './pages/Correlations'
import { LoginPage } from './pages/Login'
import { NetPayPage } from './pages/NetPay'
import { NrvInputPage } from './pages/NrvInput'
import { ProspectSetupPage } from './pages/ProspectSetup'
import { ResultsPage } from './pages/Results'
import { SimulationPage } from './pages/Simulation'
import { TornadoWorkbenchPage } from './pages/TornadoWorkbench'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={routerBasename()}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route
                element={
                  <WorkflowProvider>
                    <SaveProjectProvider>
                      <Layout />
                    </SaveProjectProvider>
                  </WorkflowProvider>
                }
              >
                <Route index element={<Navigate to="/setup/overview" replace />} />

                <Route path="setup" element={<SetupSectionLayout />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<ProspectSetupPage section="overview" />} />
                  <Route path="structure" element={<Navigate to="/setup/overview" replace />} />
                  <Route path="method" element={<Navigate to="/setup/overview" replace />} />
                  <Route path="prospect" element={<ProspectSetupPage section="metadata" />} />
                </Route>

                <Route path="input" element={<InputSectionLayout />}>
                  <Route index element={<Navigate to="rock-volume" replace />} />
                  <Route path="rock-volume" element={<InputRockVolumePage />} />
                  <Route path="hc-yield" element={<InputHcYieldPage />} />
                  <Route path="nrv" element={<NrvInputPage />} />
                  <Route path="area" element={<AreaPage />} />
                  <Route path="net-pay" element={<NetPayPage />} />
                  <Route path="petro" element={<Navigate to="hc-yield" replace />} />
                  <Route path="petro/hc-yield" element={<Navigate to="hc-yield" replace />} />
                </Route>

                <Route path="dependency" element={<DependencySectionLayout />}>
                  <Route index element={<DependencyWorkbenchPage />} />
                  <Route path="groups" element={<GroupWorkbenchPage />} />
                  <Route path="correlations" element={<CorrelationsPage />} />
                  <Route path="chance" element={<ChancePage />} />
                </Route>

                <Route path="output" element={<OutputSectionLayout />}>
                  <Route index element={<Navigate to="results" replace />} />
                  <Route path="results" element={<ResultsPage />} />
                  <Route path="simulation" element={<SimulationPage />} />
                  <Route path="charts" element={<ChartsPage />} />
                  <Route path="export" element={<ExportPage />} />
                </Route>

                <Route path="tornado" element={<TornadoWorkbenchPage />} />
                <Route path="expectation-curve" element={<ExpectationCurvePage />} />

                <Route path="group" element={<Navigate to="/dependency/groups" replace />} />
                <Route path="setup/groups" element={<Navigate to="/dependency/groups" replace />} />
                <Route path="prospect" element={<Navigate to="/setup/overview" replace />} />
                <Route path="area" element={<Navigate to="/input/area" replace />} />
                <Route path="net-pay" element={<Navigate to="/input/net-pay" replace />} />
                <Route path="nrv" element={<Navigate to="/input/nrv" replace />} />
                <Route path="hc-yield" element={<Navigate to="/input/hc-yield" replace />} />
                <Route path="chance" element={<Navigate to="/dependency/chance" replace />} />
                <Route path="correlations" element={<Navigate to="/dependency/correlations" replace />} />
                <Route path="simulation" element={<Navigate to="/output/simulation" replace />} />
                <Route path="results" element={<Navigate to="/output/results" replace />} />
                <Route path="charts" element={<Navigate to="/output/charts" replace />} />
                <Route path="qaqc" element={<Navigate to="/output/charts" replace />} />
                <Route path="export" element={<Navigate to="/output/export" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                <Route path="*" element={<Navigate to="/setup/overview" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
