import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EmployeeShell } from './components/EmployeeShell';
import { AttendByToken } from './pages/AttendByToken';
import { EmployeeLogin } from './pages/EmployeeLogin';
import {
  EmployeeConfirmation,
  EmployeeHistorique,
  EmployeeLoading,
  EmployeeParametres,
  EmployeePointer,
} from './pages/EmployeePages';
import { EmployerLogin, EmployerRegister } from './pages/EmployerAuth';
import {
  EmployerDashboard,
  EmployerEmployees,
  EmployerSchedules,
  EmployerShell,
  EmployerSites,
} from './pages/EmployerPortal';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/employer/login" replace />} />
        <Route path="/employer/login" element={<EmployerLogin />} />
        <Route path="/employer/register" element={<EmployerRegister />} />
        <Route path="/employer" element={<EmployerShell />}>
          <Route index element={<EmployerDashboard />} />
          <Route path="sites" element={<EmployerSites />} />
          <Route path="schedules" element={<EmployerSchedules />} />
          <Route path="employees" element={<EmployerEmployees />} />
        </Route>
        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/employee" element={<EmployeeShell />}>
          <Route index element={<EmployeePointer />} />
          <Route path="loading" element={<EmployeeLoading />} />
          <Route path="historique" element={<EmployeeHistorique />} />
          <Route path="parametres" element={<EmployeeParametres />} />
          <Route path="confirmation" element={<EmployeeConfirmation />} />
        </Route>
        <Route path="/attend/:token" element={<AttendByToken />} />
      </Routes>
    </BrowserRouter>
  );
}
