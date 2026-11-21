import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { useAuth } from '@clerk/react';
import { useLocation } from 'wouter';
import {
  getGetAuthMeQueryKey,
  useGetAuthMe,
  useVerifyDailyQrTokenAsStaff,
} from '@workspace/api-client-react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  StopCircle,
  Users,
} from 'lucide-react';

type AttendanceAction = 'in' | 'out';
type CameraState = 'idle' | 'requesting' | 'scanning' | 'error';

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
    ) {
      return data.error;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'We could not verify this pass. Check the code and try again.';
}

export default function StaffScanPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const authQuery = useGetAuthMe({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      queryKey: getGetAuthMeQueryKey(),
      retry: false,
    },
  });
  const verifyMutation = useVerifyDailyQrTokenAsStaff();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lockedRef = useRef(false);
  const [action, setAction] = useState<AttendanceAction>('in');
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraMessage, setCameraMessage] = useState('');

  const isStaff = authQuery.data?.role === 'staff';

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/sign-in', { replace: true });
    } else if (isLoaded && isSignedIn && authQuery.data && !isStaff) {
      setLocation('/', { replace: true });
    }
  }, [isLoaded, isSignedIn, authQuery.data, isStaff, setLocation]);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    },
    [],
  );

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraState('idle');
  };

  const beginScan = async () => {
    if (!videoRef.current || cameraState === 'requesting' || verifyMutation.isPending) return;
    setCameraMessage('');
    setCameraState('requesting');
    verifyMutation.reset();
    lockedRef.current = false;

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (!result || lockedRef.current) return;
          const token = result.getText().trim();
          if (!token) return;

          lockedRef.current = true;
          controlsRef.current?.stop();
          controlsRef.current = null;
          setCameraState('idle');
          verifyMutation.mutate({ data: { token, action } });
        },
      );
      controlsRef.current = controls;
      setCameraState('scanning');
    } catch (error) {
      setCameraState('error');
      setCameraMessage(
        error instanceof Error &&
          (/permission|denied|notallowed/i.test(error.name) ||
            /permission|denied/i.test(error.message))
          ? 'Camera access was blocked. Allow camera access in your browser settings, then try again.'
          : 'We could not start the camera. Check that this device has a camera and try again.',
      );
    }
  };

  const handleRetry = () => {
    verifyMutation.reset();
    void beginScan();
  };

  if (
    !isLoaded ||
    (isSignedIn && (authQuery.isLoading || (!authQuery.data && !authQuery.isError)))
  ) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] px-5">
        <div className="w-full max-w-sm animate-pulse rounded-3xl border border-[#ded9cf] bg-[#fbfaf7] p-7">
          <div className="mb-5 h-3 w-24 rounded bg-[#e6e1d7]" />
          <div className="mb-3 h-8 w-3/4 rounded bg-[#e6e1d7]" />
          <div className="h-4 w-full rounded bg-[#e6e1d7]" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) return null;

  if (authQuery.isError) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] px-5 py-10">
        <section className="w-full max-w-md rounded-3xl border border-[#ded9cf] bg-[#fbfaf7] p-7 text-center shadow-[0_18px_60px_rgba(32,42,60,0.08)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1ed] text-[#ad463d]">
            <AlertCircle aria-hidden="true" size={25} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#202a3c]">Account check unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[#6f7888]">
            We couldn’t confirm your staff access. Try again before scanning a pass.
          </p>
          <button
            type="button"
            data-testid="button-retry-account"
            onClick={() => void authQuery.refetch()}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d806d] px-5 text-sm font-semibold text-white transition hover:bg-[#176653] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d806d] focus-visible:ring-offset-2"
          >
            <RotateCcw size={16} aria-hidden="true" /> Retry account check
          </button>
        </section>
      </main>
    );
  }

  if (!isStaff) return null;

  const result = verifyMutation.data;

  return (
    <main className="ops-grid min-h-[100dvh] bg-[#f3f0e9] px-4 py-6 text-[#202a3c] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#202a3c] text-[#8bd3c6]">
              <ScanLine size={21} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-[0.12em] text-[#202a3c]">RFID ATTENDANCE</p>
              <p className="text-xs font-medium text-[#6f7888]">School attendance</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#ded9cf] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-[#526071] sm:flex">
            <ShieldCheck size={15} className="text-[#1d806d]" aria-hidden="true" />
            Staff scanner
          </div>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)] lg:gap-12">
          <section className="reveal-up pt-2 sm:pt-8">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.19em] text-[#1d806d]">
              <span className="h-px w-7 bg-[#1d806d]" />
              Entrance station
            </p>
            <h1 className="max-w-xl font-display text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-[#202a3c] sm:text-6xl">
              A clear check-in,
              <br />
              <span className="text-[#1d806d]">right on time.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#626f80] sm:text-lg">
              Scan a student’s current QR pass at the entrance. We’ll verify it and record the attendance event securely.
            </p>

            <div className="mt-8 flex max-w-lg items-center gap-3 rounded-2xl border border-[#ded9cf] bg-[#fbfaf7] p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf5f2] text-[#1d806d]">
                <LockKeyhole size={19} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#202a3c]">Pass stays on the student’s device</p>
                <p className="mt-1 text-xs leading-5 text-[#6f7888]">
                  Camera decoding happens here. Only the scanned pass and your selected action are sent for verification.
                </p>
              </div>
            </div>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#ded9cf] bg-[#fbfaf7] px-4 py-4">
                <Users size={18} className="mb-3 text-[#1d806d]" aria-hidden="true" />
                <p className="font-display text-lg font-semibold">One scan</p>
                <p className="mt-1 text-xs leading-5 text-[#6f7888]">A student pass is verified once per scan.</p>
              </div>
              <div className="rounded-2xl border border-[#ded9cf] bg-[#fbfaf7] px-4 py-4">
                <Clock3 size={18} className="mb-3 text-[#b77b22]" aria-hidden="true" />
                <p className="font-display text-lg font-semibold">Short-lived</p>
                <p className="mt-1 text-xs leading-5 text-[#6f7888]">Expired passes are not accepted.</p>
              </div>
            </div>
          </section>

          <section className="reveal-up reveal-up-delay-1 overflow-hidden rounded-[1.75rem] border border-[#dcd7cc] bg-[#fbfaf7] shadow-[0_24px_80px_rgba(32,42,60,0.10)]">
            <div className="flex items-start justify-between border-b border-[#ebe7df] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6f7888]">Live scanner</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Student pass</h2>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-[#edf5f2] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#176653]">
                <span className={`h-2 w-2 rounded-full ${cameraState === 'scanning' ? 'signal-pulse bg-[#1d806d]' : 'bg-[#b8c5bf]'}`} />
                {cameraState === 'scanning' ? 'Scanning' : 'Ready'}
              </span>
            </div>

            <div className="p-5 sm:p-7">
              <fieldset className="mb-5">
                <legend className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#6f7888]">
                  Record as
                </legend>
                <div className="grid grid-cols-2 rounded-xl border border-[#ded9cf] bg-[#f3f0e9] p-1">
                  <button
                    type="button"
                    data-testid="button-action-in"
                    aria-pressed={action === 'in'}
                    onClick={() => setAction('in')}
                    disabled={cameraState === 'scanning' || verifyMutation.isPending}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d806d] disabled:cursor-not-allowed disabled:opacity-60 ${action === 'in' ? 'bg-[#1d806d] text-white shadow-sm' : 'text-[#526071] hover:bg-[#fbfaf7]'}`}
                  >
                    <ArrowDownLeft size={17} aria-hidden="true" /> Check in
                  </button>
                  <button
                    type="button"
                    data-testid="button-action-out"
                    aria-pressed={action === 'out'}
                    onClick={() => setAction('out')}
                    disabled={cameraState === 'scanning' || verifyMutation.isPending}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d806d] disabled:cursor-not-allowed disabled:opacity-60 ${action === 'out' ? 'bg-[#202a3c] text-white shadow-sm' : 'text-[#526071] hover:bg-[#fbfaf7]'}`}
                  >
                    <ArrowUpRight size={17} aria-hidden="true" /> Check out
                  </button>
                </div>
              </fieldset>

              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#17202c]">
                <video
                  ref={videoRef}
                  data-testid="video-camera-preview"
                  className={`h-full w-full object-cover ${cameraState === 'scanning' ? 'opacity-100' : 'opacity-0'}`}
                  muted
                  playsInline
                  aria-label="Camera preview for scanning a student QR pass"
                />
                {cameraState !== 'scanning' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] text-[#8bd3c6]">
                      {verifyMutation.isPending ? (
                        <LoaderCircle className="animate-spin" size={27} aria-hidden="true" />
                      ) : result ? (
                        <CheckCircle2 size={29} aria-hidden="true" />
                      ) : cameraState === 'requesting' ? (
                        <Camera size={27} aria-hidden="true" />
                      ) : (
                        <ScanLine size={29} aria-hidden="true" />
                      )}
                    </div>
                    <p className="font-display text-lg font-semibold text-[#fbfaf7]">
                      {verifyMutation.isPending
                        ? 'Verifying pass'
                        : result
                          ? 'Pass verified'
                          : cameraState === 'requesting'
                            ? 'Requesting camera'
                            : cameraState === 'error'
                              ? 'Camera unavailable'
                              : 'Camera is standing by'}
                    </p>
                    <p className="mt-2 max-w-xs text-sm leading-5 text-[#c0c8cf]">
                      {verifyMutation.isPending
                        ? 'Checking today’s pass and recording attendance.'
                        : result
                          ? 'The attendance event has been recorded.'
                          : cameraMessage || 'Position the student’s QR pass inside the frame.'}
                    </p>
                  </div>
                )}
                {cameraState === 'scanning' && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <div className="relative aspect-square w-[64%] max-w-[250px]">
                      <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-[#8bd3c6]" />
                      <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-[#8bd3c6]" />
                      <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-[#8bd3c6]" />
                      <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-[3px] border-r-[3px] border-[#8bd3c6]" />
                      <span className="absolute left-3 right-3 top-1/2 h-px bg-[#8bd3c6]/80 shadow-[0_0_14px_rgba(139,211,198,0.55)]" />
                    </div>
                  </div>
                )}
              </div>

              {cameraState === 'error' && (
                <div
                  role="alert"
                  data-testid="status-camera-error"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-[#e3b8b1] bg-[#fff7f5] p-3 text-sm leading-5 text-[#8e3932]"
                >
                  <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{cameraMessage}</span>
                </div>
              )}

              {verifyMutation.isError && (
                <div
                  role="alert"
                  data-testid="status-api-error"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-[#e3b8b1] bg-[#fff7f5] p-3 text-sm leading-5 text-[#8e3932]"
                >
                  <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{getErrorMessage(verifyMutation.error)}</span>
                </div>
              )}

              {result && (
                <div
                  role="status"
                  data-testid="status-verification-success"
                  className="mt-4 rounded-2xl border border-[#b7d8ca] bg-[#edf5f2] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d806d] text-white">
                      <Check size={18} strokeWidth={3} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#176653]">
                        {result.action === 'in' ? 'Checked in' : 'Checked out'}
                      </p>
                      <p data-testid="text-student-name" className="mt-1 break-words font-display text-xl font-semibold text-[#202a3c]">
                        {result.studentName}
                      </p>
                      <p data-testid="text-event-time" className="mt-1 text-xs text-[#526071]">
                        Recorded {formatTimestamp(result.occurredAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {cameraState === 'scanning' ? (
                  <button
                    type="button"
                    data-testid="button-stop-camera"
                    onClick={stopCamera}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#ded9cf] bg-[#fbfaf7] px-4 text-sm font-semibold text-[#39465a] transition hover:bg-[#f3f0e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d806d] focus-visible:ring-offset-2"
                  >
                    <StopCircle size={18} aria-hidden="true" /> Stop camera
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={result ? 'button-scan-next' : 'button-start-scan'}
                    onClick={handleRetry}
                    disabled={cameraState === 'requesting' || verifyMutation.isPending}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d806d] px-4 text-sm font-bold text-white shadow-[0_5px_14px_rgba(29,128,109,0.18)] transition hover:bg-[#176653] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d806d] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cameraState === 'requesting' || verifyMutation.isPending ? (
                      <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                    ) : result ? (
                      <RotateCcw size={18} aria-hidden="true" />
                    ) : (
                      <Camera size={18} aria-hidden="true" />
                    )}
                    {cameraState === 'requesting'
                      ? 'Starting camera…'
                      : verifyMutation.isPending
                        ? 'Verifying…'
                        : result
                          ? 'Scan next pass'
                          : cameraState === 'error'
                            ? 'Try camera again'
                            : 'Start camera'}
                  </button>
                )}
              </div>

              <p data-testid="text-camera-permission-hint" className="mt-4 text-center text-xs leading-5 text-[#788392]">
                Camera access is requested only when you start scanning. Use a secure browser connection for camera access.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
