import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useLocation } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAuthMeQueryKey,
  getGetStudentLocationStatusQueryKey,
  getListLatestStudentLocationsQueryKey,
  useCreateDailyQrToken,
  useCreateStudentLocationPing,
  useGetAuthMe,
  useGetStudentLocationStatus,
} from '@workspace/api-client-react';
import type { DailyQrToken } from '@workspace/api-client-react';
import { AlertCircle, ArrowRight, Check, Clock3, MapPin, RefreshCw, ShieldCheck, StopCircle } from 'lucide-react';

const formatSchoolDate = (date: string) => {
  const parsed = new Date(`${date}T12:00:00+08:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, {
        timeZone: 'Asia/Manila',
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(parsed);
};

const formatCountdown = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(remainder).padStart(2, '0')}s`;
};

function locationApiError(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  }
  return error instanceof Error ? error.message : '';
}

function StudentQrPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<DailyQrToken | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [sharingRequested, setSharingRequested] = useState(false);
  const [sharingStopped, setSharingStopped] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [lastLocationSent, setLastLocationSent] = useState<Date | null>(null);
  const requestedStudentId = useRef<number | null>(null);
  const locationTimer = useRef<number | null>(null);
  const locationRequestInFlight = useRef(false);
  const locationSharingEnabled = useRef(false);

  const profileQuery = useGetAuthMe({
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey: getGetAuthMeQueryKey(),
      retry: false,
    },
  });
  const createToken = useCreateDailyQrToken();
  const locationStatusQuery = useGetStudentLocationStatus({
    query: {
      enabled: isLoaded && !!isSignedIn && profileQuery.data?.role === 'student',
      queryKey: getGetStudentLocationStatusQueryKey(),
      refetchInterval: 45000,
      retry: false,
    },
  });
  const sendLocationPing = useCreateStudentLocationPing();

  const profile = profileQuery.data;
  const student = profile?.role === 'student' ? profile.visibleStudents[0] : undefined;
  const locationStatus = locationStatusQuery.data;
  const expirationMs = token ? new Date(token.expiresAt).getTime() : 0;
  const remainingSeconds = token
    ? Math.max(0, Math.ceil((expirationMs - clock) / 1000))
    : 0;
  const isExpired = !!token && remainingSeconds === 0;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/sign-in', { replace: true });
    }
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (profile && profile.role !== 'student') {
      setLocation('/', { replace: true });
    }
  }, [profile, setLocation]);

  useEffect(() => {
    if (student && requestedStudentId.current !== student.id) {
      requestedStudentId.current = student.id;
      createToken.mutate(
        { data: { studentId: student.id } },
        { onSuccess: setToken },
      );
    }
  }, [student, createToken.mutate]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [token]);

  const stopLocationSharing = () => {
    locationSharingEnabled.current = false;
    if (locationTimer.current !== null) {
      window.clearInterval(locationTimer.current);
      locationTimer.current = null;
    }
    setSharingStopped(true);
  };

  useEffect(() => {
    if (locationStatus && !locationStatus.active) {
      if (sharingRequested) stopLocationSharing();
    }
  }, [locationStatus?.active, sharingRequested]);

  useEffect(() => () => {
    locationSharingEnabled.current = false;
    if (locationTimer.current !== null) window.clearInterval(locationTimer.current);
    locationTimer.current = null;
  }, []);

  const sendOneLocationPing = () => {
    if (
      !locationSharingEnabled.current ||
      locationRequestInFlight.current ||
      !locationStatus?.active
    ) {
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location sharing.');
      return;
    }
    locationRequestInFlight.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!locationSharingEnabled.current) {
          locationRequestInFlight.current = false;
          return;
        }
        sendLocationPing.mutate(
          {
            data: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          },
          {
            onSuccess: (ping) => {
              setLastLocationSent(new Date(ping.pingedAt));
              setLocationError('');
              void queryClient.invalidateQueries({
                queryKey: getListLatestStudentLocationsQueryKey(),
              });
            },
            onError: (error) => {
              setLocationError(locationApiError(error) || 'We could not send your location. Try again shortly.');
              void locationStatusQuery.refetch();
            },
            onSettled: () => {
              locationRequestInFlight.current = false;
            },
          },
        );
      },
      (error) => {
        locationRequestInFlight.current = false;
        if (error.code === error.PERMISSION_DENIED) {
          locationSharingEnabled.current = false;
          if (locationTimer.current !== null) {
            window.clearInterval(locationTimer.current);
            locationTimer.current = null;
          }
          setSharingRequested(false);
        }
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was not allowed. You can enable it in your browser settings and try again.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'GPS is temporarily unavailable. We’ll try again in 45 seconds while sharing stays active.'
              : 'Your location took too long to arrive. We’ll try again in 45 seconds while sharing stays active.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  const startLocationSharing = () => {
    if (!locationStatus?.active || sharingRequested) return;
    if (!navigator.geolocation) {
      setLocationError('This browser does not support location sharing.');
      return;
    }
    locationSharingEnabled.current = true;
    setSharingRequested(true);
    setSharingStopped(false);
    setLocationError('');
    sendOneLocationPing();
    locationTimer.current = window.setInterval(sendOneLocationPing, 45000);
  };

  const requestFreshToken = () => {
    if (!student || createToken.isPending) return;
    createToken.mutate(
      { data: { studentId: student.id } },
      { onSuccess: setToken },
    );
  };

  const loadingProfile = !isLoaded || (!!isSignedIn && profileQuery.isLoading);
  const initialTokenLoading = !!student && !token && createToken.isPending;
  const apiError = createToken.error || profileQuery.error;
  const errorMessage = apiError instanceof Error
    ? apiError.message
    : 'We could not load your attendance QR code. Please try again.';

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-background px-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm" data-testid="status-auth-loading">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          Checking your school account…
        </div>
      </main>
    );
  }

  if (loadingProfile || (profile && profile.role !== 'student')) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm" data-testid="status-profile-loading">
          <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-7 w-48 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
        </div>
      </main>
    );
  }

  if (!profileQuery.data && profileQuery.isError) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
        <section className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-7 shadow-sm sm:p-9" data-testid="panel-profile-error">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle aria-hidden="true" size={22} />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Student access</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">We couldn’t verify your account.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground" data-testid="text-profile-error">
            Your school profile is temporarily unavailable. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => profileQuery.refetch()}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="button-retry-profile"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
        <section className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-7 shadow-sm sm:p-9" data-testid="panel-no-student">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ShieldCheck aria-hidden="true" size={22} />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Student access</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">No student profile is linked yet.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground" data-testid="text-no-student">
            Ask your school office to connect your account. Once it’s linked, your daily check-in code will appear here.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="ops-grid min-h-[100dvh] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="reveal-up mb-8 flex items-center justify-between gap-4 sm:mb-12">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <span className="font-display text-lg font-bold">R</span>
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-tight">RFID Attendance</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Student check-in</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2 text-xs font-medium text-muted-foreground sm:flex" data-testid="status-secure-session">
            <span className="signal-pulse h-2 w-2 rounded-full bg-primary" />
            Your personal school pass
          </div>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <section className="reveal-up reveal-up-delay-1 pt-1">
            <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-primary" data-testid="text-school-date">
              <span className="h-px w-6 bg-primary/50" />
              {token ? formatSchoolDate(token.date) : 'Today at school'}
            </p>
            <h1 className="max-w-xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl">
              You’re ready<br className="hidden sm:block" /> to check in.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
              Show this code at the school reader when you arrive. It belongs to you and refreshes for each school day.
            </p>

            <section className="mt-7 max-w-xl rounded-2xl border border-[#d8e4dd] bg-[#f4f8f4] p-5" aria-labelledby="location-sharing-title" data-testid="panel-location-sharing">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e0eee7] text-[#1d806d]">
                  <MapPin size={19} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="location-sharing-title" className="font-display text-base font-bold">Location sharing</h2>
                    {locationStatus?.active && !sharingStopped && (
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${sharingRequested ? 'bg-[#dff3ed] text-[#176b5a]' : 'bg-[#fff1d3] text-[#8a651c]'}`} data-testid="status-location-sharing">
                        {sharingRequested ? 'Sharing active' : 'Checkout active'}
                      </span>
                    )}
                    {sharingStopped && <span className="rounded-full bg-[#eceef1] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#667181]" data-testid="status-location-stopped">Sharing stopped</span>}
                  </div>
                  {locationStatusQuery.isLoading ? (
                    <div className="mt-3 space-y-2" aria-label="Checking checkout status">
                      <div className="h-3 w-4/5 animate-pulse rounded bg-[#e2e9e3]" />
                      <div className="h-3 w-3/5 animate-pulse rounded bg-[#e2e9e3]" />
                    </div>
                  ) : locationStatusQuery.isError ? (
                    <div role="alert" className="mt-2 text-sm leading-6 text-[#8e3932]" data-testid="status-location-api-error">
                      {locationApiError(locationStatusQuery.error) || 'We could not check your checkout status.'}
                      <button type="button" onClick={() => void locationStatusQuery.refetch()} className="ml-2 font-bold underline">Try again</button>
                    </div>
                  ) : locationStatus?.active ? (
                    <>
                      <p className="mt-2 text-sm leading-6 text-[#586779]">
                        You are checked out. If you choose to share, this page sends one GPS ping now and every 45 seconds while it stays open. Sharing stops when you check in, your checkout expires, or you leave this page.
                      </p>
                      {!sharingRequested && !sharingStopped && (
                        <button type="button" onClick={startLocationSharing} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1d806d] px-4 text-sm font-bold text-white transition hover:bg-[#176653] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d806d] focus-visible:ring-offset-2" data-testid="button-start-location-sharing">
                          <MapPin size={16} aria-hidden="true" /> Start sharing my location
                        </button>
                      )}
                      {sharingRequested && !sharingStopped && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#246e5d]" role="status">
                            <span className="signal-pulse h-2 w-2 rounded-full bg-[#239b85]" />
                            Sharing while this page is open
                          </span>
                          <button type="button" onClick={stopLocationSharing} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#cbd6cf] bg-[#fbfaf7] px-3 text-xs font-bold text-[#536073] hover:bg-[#eef3ee]" data-testid="button-stop-location-sharing">
                            <StopCircle size={14} aria-hidden="true" /> Stop sharing
                          </button>
                        </div>
                      )}
                      {lastLocationSent && <p className="mt-3 font-mono text-[11px] text-[#667181]" data-testid="text-location-last-sent">Last location sent {new Intl.DateTimeFormat(undefined, { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(lastLocationSent)} Manila time</p>}
                      {sendLocationPing.isPending && <p className="mt-2 text-xs text-[#667181]" role="status">Getting a GPS fix and sending it…</p>}
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-[#667181]" data-testid="status-location-not-sharing">
                      {locationStatus?.state === 'checked_in'
                        ? 'You are checked in. Location sharing is off.'
                        : locationStatus?.state === 'checkout_expired'
                          ? 'Your checkout has expired. Location sharing is off.'
                          : 'Location sharing is available only after you check out.'}
                    </p>
                  )}
                  {locationError && <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#e6c9aa] bg-[#fff9ef] p-3 text-xs leading-5 text-[#825c25]" role="alert" data-testid="status-location-error"><AlertCircle size={15} className="mt-0.5 shrink-0" />{locationError}</p>}
                  {sharingStopped && locationStatus?.active && (
                    <p className="mt-3 text-xs leading-5 text-[#667181]">Sharing is stopped for this page session. Your location will not be sent again.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-accent-foreground" aria-hidden="true">
                {student.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold" data-testid="text-student-name">{student.fullName}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-student-account">Your student account</p>
              </div>
              <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground" data-testid="status-private-code">
                <ShieldCheck aria-hidden="true" size={14} />
                Private to you
              </div>
            </div>
          </section>

          <section className="reveal-up reveal-up-delay-2 overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_24px_70px_-38px_hsl(221_31%_16%/0.32)]" aria-label="Your daily attendance QR code">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="font-display text-sm font-bold">Daily check-in pass</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Valid for today’s school date</p>
              </div>
              {token && !isExpired && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-primary" data-testid="status-code-active">
                  <Check aria-hidden="true" size={12} />
                  Active
                </span>
              )}
            </div>

            <div className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7">
              {initialTokenLoading ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-muted/60" data-testid="status-token-loading" aria-live="polite">
                  <div className="mb-5 grid h-[220px] w-[220px] grid-cols-6 gap-2 rounded-xl p-3 opacity-40" aria-hidden="true">
                    {Array.from({ length: 36 }, (_, index) => (
                      <span key={index} className="animate-pulse rounded-sm bg-muted-foreground/30" />
                    ))}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Preparing your secure code…</p>
                </div>
              ) : token && !isExpired ? (
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl bg-[#fffdf8] p-4 shadow-[inset_0_0_0_1px_hsl(35_18%_83%)] sm:p-5" data-testid="qr-code-frame">
                    <QRCodeSVG
                      value={token.token}
                      size={232}
                      level="M"
                      marginSize={2}
                      title={`Daily attendance QR code for ${token.studentName}`}
                      data-testid="img-student-qr"
                    />
                  </div>
                  <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl bg-muted/70 px-4 py-3">
                    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock3 aria-hidden="true" size={15} />
                      Code expires in
                    </span>
                    <span className="font-mono text-sm font-medium tabular-nums text-foreground" aria-live="polite" data-testid="text-countdown">
                      {formatCountdown(remainingSeconds)}
                    </span>
                  </div>
                  <p className="mt-3 text-center text-xs leading-5 text-muted-foreground" data-testid="text-code-expiration">
                    Expires at {new Intl.DateTimeFormat(undefined, { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(new Date(token.expiresAt))} Manila time
                  </p>
                  {createToken.isError && (
                    <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-destructive" role="alert" data-testid="status-refresh-error">
                      <AlertCircle aria-hidden="true" size={14} />
                      {errorMessage}
                    </p>
                  )}
                </div>
              ) : isExpired ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-muted/60 px-6 text-center" data-testid="status-token-expired" aria-live="polite">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/30 text-foreground">
                    <Clock3 aria-hidden="true" size={21} />
                  </div>
                  <h2 className="font-display text-lg font-semibold">This code has expired</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Get a fresh code before you check in. Your previous code is no longer active.</p>
                </div>
              ) : createToken.isError ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-destructive/5 px-6 text-center" data-testid="status-token-error" role="alert">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle aria-hidden="true" size={21} />
                  </div>
                  <h2 className="font-display text-lg font-semibold">Your code didn’t load</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground" data-testid="text-token-error">{errorMessage}</p>
                </div>
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-muted/60 px-6 text-center" data-testid="status-token-ready">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <ShieldCheck aria-hidden="true" size={21} />
                  </div>
                  <h2 className="font-display text-lg font-semibold">Your pass is almost ready</h2>
                  <p className="mt-2 text-sm text-muted-foreground">We’re preparing a secure code for your account.</p>
                </div>
              )}

              <button
                type="button"
                onClick={requestFreshToken}
                disabled={createToken.isPending}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                data-testid="button-refresh-qr"
                aria-label={createToken.isPending ? 'Preparing a fresh attendance code' : 'Get a fresh attendance code'}
              >
                <RefreshCw aria-hidden="true" size={16} className={createToken.isPending ? 'animate-spin' : ''} />
                {createToken.isPending ? 'Preparing your code…' : 'Get a fresh code'}
                {!createToken.isPending && <ArrowRight aria-hidden="true" size={16} />}
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground" data-testid="text-refresh-hint">
                A refreshed code replaces your current one.
              </p>
            </div>
          </section>
        </div>

        <footer className="reveal-up reveal-up-delay-3 mt-10 flex items-start gap-3 border-t border-border/80 pt-5 text-xs leading-5 text-muted-foreground sm:mt-14">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" aria-hidden="true" size={16} />
          <p>Keep your code on your screen and show it only to the school attendance reader. For help, speak with your school office.</p>
        </footer>
      </div>
    </main>
  );
}

export default StudentQrPage;
