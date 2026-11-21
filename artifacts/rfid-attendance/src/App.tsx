import { lazy, Suspense, type ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import StudentQrPage from '@/pages/student-qr';
import LocationsPage from '@/pages/locations';
const StaffScanPage = lazy(() => import('@/pages/staff-scan'));
import {
  getGetAuthMeQueryKey,
  useGetAuthMe,
} from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function HomeGate() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const currentUserQuery = useGetAuthMe({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      queryKey: getGetAuthMeQueryKey(),
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation(`${basePath}/sign-in`, { replace: true });
      return;
    }
    if (isLoaded && isSignedIn && currentUserQuery.data?.role === 'student') {
      setLocation('/student/qr', { replace: true });
    }
  }, [isLoaded, isSignedIn, currentUserQuery.data?.role, setLocation]);

  if (!isLoaded || (isSignedIn && currentUserQuery.isLoading)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] text-sm text-[#6f7888]">
        Loading your account…
      </div>
    );
  }

    if (isSignedIn && currentUserQuery.isError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] px-4 text-sm text-[#6f7888]">
        <div className="text-center">
          <p>Your account could not be loaded. Refresh the page to try again.</p>
          <p className="mt-2 text-xs text-[#7d8490]">
            Signed in as {clerk.user?.primaryEmailAddress?.emailAddress ?? 'unknown'}
          </p>
          <button
            type="button"
            onClick={() => { void clerk.signOut().then(() => window.location.assign('/sign-in')); }}
            className="mt-4 rounded-xl bg-[#1d806d] px-4 py-2.5 text-sm font-bold text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    );
    }
  
  if (isSignedIn && currentUserQuery.data?.role === 'student') return null;
  return isSignedIn ? <Dashboard /> : null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== userId
      ) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function StaffScanRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] text-sm text-[#6f7888]">
          Loading staff scanner…
        </div>
      }
    >
      <StaffScanPage />
    </Suspense>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeGate} />
        <Route path="/student/qr" component={StudentQrPage} />
        <Route path="/locations" component={LocationsPage} />
        <Route path="/staff/scan" component={StaffScanRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        appearance={{
          theme: shadcn,
          cssLayerName: 'clerk',
          options: {
            logoPlacement: 'inside',
            logoLinkUrl: basePath || '/',
            logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
          },
          variables: {
            colorPrimary: '#1d806d',
            colorForeground: '#202a3c',
            colorMutedForeground: '#6f7888',
            colorDanger: '#ad463d',
            colorBackground: '#fbfaf7',
            colorInput: '#f8f6f1',
            colorInputForeground: '#202a3c',
            colorNeutral: '#ded9cf',
            fontFamily: 'Manrope, sans-serif',
            borderRadius: '0.75rem',
          },
          elements: {
            rootBox: 'w-full flex justify-center',
            cardBox: 'bg-[#fbfaf7] rounded-2xl w-[440px] max-w-full overflow-hidden',
            card: '!shadow-none !border-0 !bg-transparent !rounded-none',
            footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
            headerTitle: 'text-[#202a3c]',
            headerSubtitle: 'text-[#6f7888]',
            socialButtonsBlockButtonText: 'text-[#202a3c]',
            formFieldLabel: 'text-[#39465a]',
            footerActionLink: 'text-[#1d806d]',
            footerActionText: 'text-[#6f7888]',
            dividerText: 'text-[#6f7888]',
            identityPreviewEditButton: 'text-[#1d806d]',
            formFieldSuccessText: 'text-[#1d806d]',
            alertText: 'text-[#ad463d]',
            logoBox: 'justify-center',
            logoImage: 'max-h-10',
            socialButtonsBlockButton: 'border-[#ded9cf] bg-[#f8f6f1]',
            formButtonPrimary: 'bg-[#1d806d] hover:bg-[#176653]',
            formFieldInput: 'border-[#ded9cf] bg-[#f8f6f1] text-[#202a3c]',
            footerAction: 'border-t border-[#ebe7df]',
            dividerLine: 'bg-[#ded9cf]',
            alert: 'border-[#e3b8b1] bg-[#fff7f5]',
            otpCodeFieldInput: 'border-[#ded9cf] bg-[#f8f6f1]',
            formFieldRow: 'gap-2',
            main: 'bg-transparent',
          },
        }}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        localization={{
          signIn: {
            start: {
              title: 'Welcome back',
              subtitle: 'Sign in to access your school attendance account',
            },
          },
          signUp: {
            start: {
              title: 'Create your school account',
              subtitle: 'Verify your email to continue',
            },
          },
        }}
        routerPush={(to) => setLocation(stripBase(to))}
        routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkRoutes />
    </WouterRouter>
  );
}

export default App;
