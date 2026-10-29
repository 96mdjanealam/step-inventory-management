import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Inventory Management System',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: DefaultNotFound,
})

function DefaultNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center mx-auto text-xl font-bold font-mono">
          404
        </div>
        <h1 className="text-xl font-bold text-neutral-900">Page Not Found</h1>
        <p className="text-sm text-neutral-500">
          The page or resource you are looking for does not exist or may have been moved.
        </p>
        <div className="pt-2">
          <Link
            to="/inventory"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition shadow-sm"
          >
            Back to Inventory
          </Link>
        </div>
      </div>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
