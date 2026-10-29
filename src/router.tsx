import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto text-xl font-bold font-mono">
            404
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Page Not Found</h1>
          <p className="text-sm text-neutral-500">
            The page or resource you are looking for does not exist or has been moved.
          </p>
          <div className="pt-2">
            <a
              href="/inventory"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition shadow-sm"
            >
              Back to Inventory
            </a>
          </div>
        </div>
      </div>
    ),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
