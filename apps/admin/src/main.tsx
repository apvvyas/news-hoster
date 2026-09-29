import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from './auth'
import { AdminLayout } from './components/AdminLayout'
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

const router = createBrowserRouter(
  [
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
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || undefined },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
