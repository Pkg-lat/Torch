import { HeadContent, Scripts, createRootRoute, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query'
import { WorkspaceProvider } from '../contexts/WorkspaceContext'
import { SidebarProvider } from '../contexts/SidebarContext'
import { useEffect } from 'react'
import NProgress from 'nprogress'

import appCss from '../styles.css?url'

// Configure NProgress
NProgress.configure({ showSpinner: false, trickleSpeed: 200 })

// Global error handler for auth failures
function handleAuthError(error: any) {
  const status = error?.status || 0
  if (status === 401 || status === 403) {
    console.error('Authentication failed, redirecting to login...')
    window.location.href = '/auth'
  }
}

// Track active requests for NProgress
let activeRequests = 0

// Intercept fetch to show progress (client-side only)
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    activeRequests++
    if (activeRequests === 1) {
      NProgress.start()
    }
    
    try {
      const response = await originalFetch(...args)
      return response
    } finally {
      activeRequests--
      if (activeRequests === 0) {
        NProgress.done()
      }
    }
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleAuthError,
  }),
  mutationCache: new MutationCache({
    onError: handleAuthError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        const status = error?.status || 0
        if (status === 401 || status === 403) {
          return false
        }
        return failureCount < 3
      },
    },
  },
})

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
        title: 'Torch',
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
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SidebarProvider>
            <WorkspaceProvider>
              <RouteProgressIndicator />
              {children}
            </WorkspaceProvider>
          </SidebarProvider>
        </QueryClientProvider>
        {/*<TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />*/}
        <Scripts />
      </body>
    </html>
  )
}

function RouteProgressIndicator() {
  const router = useRouter()
  
  useEffect(() => {
    const unsubscribe = router.subscribe('onBeforeLoad', () => {
      NProgress.start()
    })
    
    return unsubscribe
  }, [router])

  useEffect(() => {
    const unsubscribe = router.subscribe('onLoad', () => {
      NProgress.done()
    })
    
    return unsubscribe
  }, [router])

  return null
}
