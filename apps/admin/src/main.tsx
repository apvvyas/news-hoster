import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AuthProvider } from './auth'
import { AdminLayout } from './components/AdminLayout'
import { ConfirmProvider } from './components/ConfirmProvider'
import { CategoriesPage } from './pages/Categories'
import { DashboardPage } from './pages/Dashboard'
import { FeedsPage } from './pages/Feeds'
import { LoginPage } from './pages/Login'
import { PostEditorPage } from './pages/PostEditor'
import { PostsPage } from './pages/Posts'
import { QueuePage } from './pages/Queue'
import { SettingsPage } from './pages/Settings'
import { SitesPage } from './pages/Sites'
import { UsersPage } from './pages/Users'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } })

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <AdminLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/posts', element: <PostsPage /> },
      { path: '/posts/:id', element: <PostEditorPage /> },
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/queue', element: <QueuePage /> },
      { path: '/feeds', element: <FeedsPage /> },
      { path: '/sites', element: <SitesPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]

// The demo runs inside an embedded page, so it keeps its location in memory.
const router = __DEMO__
  ? createMemoryRouter(routes, { initialEntries: ['/'] })
  : createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || undefined })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
