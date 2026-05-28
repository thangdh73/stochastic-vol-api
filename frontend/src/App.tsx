import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { WorkflowProvider } from './context/WorkflowContext'
import { ChartsPage } from './pages/Charts'
import { Dashboard } from './pages/Dashboard'
import { DependencyWorkbenchPage } from './pages/DependencyWorkbench'
import { ExpectationCurvePage } from './pages/ExpectationCurve'
import { ExportPage } from './pages/Export'
import { GroupWorkbenchPage } from './pages/GroupWorkbench'
import { InputWorkbenchPage } from './pages/InputWorkbench'
import { AreaPage } from './pages/Area'
import { ChancePage } from './pages/Chance'
import { CorrelationsPage } from './pages/Correlations'
import { HcYieldPage } from './pages/HcYield'
import { NetPayPage } from './pages/NetPay'
import { NrvInputPage } from './pages/NrvInput'
import { ProspectSetupPage } from './pages/ProspectSetup'
import { QaqcPage } from './pages/Qaqc'
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
      <WorkflowProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="setup" element={<ProspectSetupPage />} />
              <Route path="input" element={<InputWorkbenchPage />} />
              <Route path="dependency" element={<DependencyWorkbenchPage />} />
              <Route path="output" element={<ResultsPage />} />
              <Route path="group" element={<GroupWorkbenchPage />} />
              <Route path="tornado" element={<TornadoWorkbenchPage />} />
              <Route path="expectation-curve" element={<ExpectationCurvePage />} />
              <Route path="prospect" element={<ProspectSetupPage />} />
              <Route path="area" element={<AreaPage />} />
              <Route path="net-pay" element={<NetPayPage />} />
              <Route path="nrv" element={<NrvInputPage />} />
              <Route path="hc-yield" element={<HcYieldPage />} />
              <Route path="chance" element={<ChancePage />} />
              <Route path="correlations" element={<CorrelationsPage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="charts" element={<ChartsPage />} />
              <Route path="qaqc" element={<QaqcPage />} />
              <Route path="export" element={<ExportPage />} />
              <Route path="setup/prospect" element={<Navigate to="/prospect" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WorkflowProvider>
    </QueryClientProvider>
  )
}
