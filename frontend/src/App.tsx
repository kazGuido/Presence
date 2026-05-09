import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { CapacitorNotificationBridge } from './components/CapacitorNotificationBridge';
import { EmployeeShell } from './components/EmployeeShell';
import { AttendByToken } from './pages/AttendByToken';
import { EmployeeController } from './pages/EmployeeController';
import { EmployeeLogin } from './pages/EmployeeLogin';
import { EmployeeMagic } from './pages/EmployeeMagic';
import {
  EmployeeConfirmation,
  EmployeeHistorique,
  EmployeeLoading,
  EmployeeParametres,
  EmployeePointer,
} from './pages/EmployeePages';
import { EmployeeScanKiosk } from './pages/EmployeeScanKiosk';
import { EmployerLogin, EmployerRegister } from './pages/EmployerAuth';
import {
  EmployerDashboard,
  EmployerEmployees,
  EmployerGeofenceReview,
  EmployerSchedules,
  EmployerShell,
  EmployerSites,
} from './pages/EmployerPortal';
import { EmployerJournal } from './pages/EmployerJournal';
import { EmployerSessions } from './pages/EmployerSessions';
import { EmployerSettings } from './pages/EmployerSettings';
import { EmployerWelcome } from './pages/EmployerWelcome';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        closeButton
        expand={false}
        toastOptions={{
          duration: 10_000,
          classNames: {
            toast: 'font-sans border border-primary/15 shadow-lg',
            title: 'font-semibold text-on-surface',
            description: 'text-on-surface-variant',
            actionButton: '!bg-primary !text-on-primary',
            cancelButton: 'border border-outline/30',
          },
        }}
      />
      <CapacitorNotificationBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/employer/login" replace />} />
        <Route path="/employer/login" element={<EmployerLogin />} />
        <Route path="/employer/register" element={<EmployerRegister />} />
        <Route path="/employer" element={<EmployerShell />}>
          <Route index element={<EmployerDashboard />} />
          <Route path="welcome" element={<EmployerWelcome />} />
          <Route path="geofence-review" element={<EmployerGeofenceReview />} />
          <Route path="sites" element={<EmployerSites />} />
          <Route path="schedules" element={<EmployerSchedules />} />
          <Route path="employees" element={<EmployerEmployees />} />
          <Route path="sessions" element={<EmployerSessions />} />
          <Route path="journal" element={<EmployerJournal />} />
          <Route path="settings" element={<EmployerSettings />} />
        </Route>
        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/employee/magic" element={<EmployeeMagic />} />
        <Route path="/employee/scan-kiosk/:kioskToken" element={<EmployeeScanKiosk />} />
        <Route path="/employee/scan-kiosk" element={<EmployeeScanKiosk />} />
        <Route path="/employee" element={<EmployeeShell />}>
          <Route index element={<EmployeePointer />} />
          <Route path="loading" element={<EmployeeLoading />} />
          <Route path="historique" element={<EmployeeHistorique />} />
          <Route path="parametres" element={<EmployeeParametres />} />
          <Route path="confirmation" element={<EmployeeConfirmation />} />
          <Route path="controller" element={<EmployeeController />} />
        </Route>
        <Route path="/attend/:token" element={<AttendByToken />} />
      </Routes>
    </BrowserRouter>
  );
}
