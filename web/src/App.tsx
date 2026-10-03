import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Shell } from './layouts/Shell'
import { liveSource } from './api/live'
import { demoSource } from './api/demo'
import { PageFallback } from './components/ui/Skeleton'

const Landing = lazy(() => import('./pages/marketing/Landing').then((m) => ({ default: m.Landing })))
const Dashboard = lazy(() => import('./pages/app/Dashboard').then((m) => ({ default: m.Dashboard })))
const Projects = lazy(() => import('./pages/app/Projects').then((m) => ({ default: m.Projects })))
const Indexing = lazy(() => import('./pages/app/Indexing').then((m) => ({ default: m.Indexing })))
const UrlDetail = lazy(() => import('./pages/app/UrlDetail').then((m) => ({ default: m.UrlDetail })))
const Backlinks = lazy(() => import('./pages/app/Backlinks').then((m) => ({ default: m.Backlinks })))
const Opportunities = lazy(() => import('./pages/app/Opportunities').then((m) => ({ default: m.Opportunities })))
const Audit = lazy(() => import('./pages/app/Audit').then((m) => ({ default: m.Audit })))
const Keywords = lazy(() => import('./pages/app/Keywords').then((m) => ({ default: m.Keywords })))
const Competitors = lazy(() => import('./pages/app/Competitors').then((m) => ({ default: m.Competitors })))
const Automations = lazy(() => import('./pages/app/Automations').then((m) => ({ default: m.Automations })))
const Reports = lazy(() => import('./pages/app/Reports').then((m) => ({ default: m.Reports })))
const Alerts = lazy(() => import('./pages/app/Alerts').then((m) => ({ default: m.Alerts })))
const Settings = lazy(() => import('./pages/app/Settings').then((m) => ({ default: m.Settings })))
const Admin = lazy(() => import('./pages/app/Admin').then((m) => ({ default: m.Admin })))
const Onboarding = lazy(() => import('./pages/app/Onboarding').then((m) => ({ default: m.Onboarding })))
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Signup })))
const ForgotPassword = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.ResetPassword })))
const Tools = lazy(() => import('./pages/marketing/Tools').then((m) => ({ default: m.Tools })))
const Legal = lazy(() => import('./pages/marketing/Legal').then((m) => ({ default: m.Legal })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/:slug" element={<Tools />} />
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/terms" element={<Legal page="terms" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/app" element={<Shell source={liveSource} />}>
          {appRoutes()}
          <Route path="onboarding" element={<Onboarding />} />
        </Route>
        <Route path="/demo" element={<Shell source={demoSource} />}>
          {appRoutes()}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

/** The same pages serve the live app and the demo. */
function appRoutes() {
  return (
    <>
      <Route index element={<Dashboard />} />
      <Route path="projects" element={<Projects />} />
      <Route path="indexing" element={<Indexing />} />
      <Route path="indexing/:id" element={<UrlDetail />} />
      <Route path="backlinks" element={<Backlinks />} />
      <Route path="opportunities" element={<Opportunities />} />
      <Route path="audit" element={<Audit />} />
      <Route path="keywords" element={<Keywords />} />
      <Route path="competitors" element={<Competitors />} />
      <Route path="automations" element={<Automations />} />
      <Route path="reports" element={<Reports />} />
      <Route path="alerts" element={<Alerts />} />
      <Route path="settings" element={<Settings />} />
      <Route path="admin" element={<Admin />} />
      <Route path="*" element={<NotFound inApp />} />
    </>
  )
}
