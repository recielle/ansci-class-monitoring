import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Command,
  ContactRound,
  Fingerprint,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  UsersRound,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAttendanceSummaryQueryKey,
  getListAttendanceRecordsQueryKey,
  getListRecentAttendanceQueryKey,
  getListStudentsQueryKey,
  useCreateAttendanceTap,
  useGetAttendanceSummary,
  useListAttendanceRecords,
  useListRecentAttendance,
  useListStudents,
  type AttendanceSummary,
  type AttendanceEvent,
  type AttendanceRecord,
  type AttendanceTapInput,
} from '@workspace/api-client-react';
import { Link } from 'wouter';

const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const schoolDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(today);

const summaryParams = { date: todayIso };
const recentParams = { limit: 8 };

const statusMeta = {
  present: { label: 'Present', className: 'bg-[#dff3ed] text-[#16705f]', dot: 'bg-[#23a68b]' },
  late: { label: 'Late', className: 'bg-[#fff0c9] text-[#9c6810]', dot: 'bg-[#d69622]' },
  absent: { label: 'Absent', className: 'bg-[#fbe2de] text-[#a63d34]', dot: 'bg-[#d05b4e]' },
  'checked-out': { label: 'Checked out', className: 'bg-[#e5e8ee] text-[#556173]', dot: 'bg-[#7f8a9c]' },
} as const;

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(parsed);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  return <>{day} / {time} local</>;
}

function LoadingBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#e8e4dc] ${className}`} />;
}

function QueryError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#e6b9b2] bg-[#fff5f3] px-5 text-center">
      <CircleAlert className="h-5 w-5 text-[#b94c42]" />
      <p className="text-sm font-semibold text-[#813d36]">Could not load {label}</p>
      <button
        type="button"
        data-testid={`button-retry-${label.replace(/\s/g, '-')}`}
        onClick={onRetry}
        className="rounded-lg border border-[#d99b93] px-3 py-1.5 text-xs font-bold text-[#983e35] transition hover:bg-[#fbe2de]"
      >
        Try again
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: AttendanceRecord['status'] }) {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-[#e6e1d7] bg-[#fcfaf6] p-4">
          <LoadingBar className="mb-5 h-3 w-20" />
          <LoadingBar className="h-8 w-16" />
          <LoadingBar className="mt-3 h-2 w-24" />
        </div>
      ))}
    </div>
  );
}

function GradeBars({ byGrade }: { byGrade: AttendanceSummary['byGrade'] }) {
  const maxTotal = Math.max(...byGrade.map((grade) => grade.total), 1);
  return (
    <div className="space-y-4">
      {byGrade.map((grade) => {
        const presentWidth = (grade.present / maxTotal) * 100;
        const absentWidth = (grade.absent / maxTotal) * 100;
        return (
          <div key={grade.grade} data-testid={`grade-row-${grade.grade}`}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-bold text-[#283247]">{grade.grade}</span>
              <span className="font-mono text-[11px] text-[#778093]">{grade.present} / {grade.total} in</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[#ebe7de]">
              <div className="rounded-l-full bg-[#229b85] transition-all duration-700" style={{ width: `${presentWidth}%` }} />
              <div className="bg-[#d25b4d] transition-all duration-700" style={{ width: `${absentWidth}%` }} />
            </div>
            <div className="mt-1 flex gap-3 text-[10px] font-medium text-[#8991a0]">
              <span>{grade.present} present</span>
              <span>{grade.absent} absent</span>
            </div>
          </div>
        );
      })}
      {!byGrade.length && (
        <div className="rounded-xl border border-dashed border-[#d8d3c9] px-4 py-8 text-center text-xs text-[#778093]">
          Grade movement will appear once the first reader event lands.
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceRecord['status']>('all');
  const [tapForm, setTapForm] = useState<{ cardUid: string; deviceId: string; action: AttendanceTapInput['action'] }>({
    cardUid: '',
    deviceId: 'GATE-01',
    action: 'in',
  });
  const [tapNotice, setTapNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const summaryQuery = useGetAttendanceSummary(summaryParams, {
    query: {
      queryKey: getGetAttendanceSummaryQueryKey(summaryParams),
      refetchInterval: 15000,
    },
  });
  const studentsQuery = useListStudents({
    query: {
      queryKey: getListStudentsQueryKey(),
      refetchInterval: 60000,
    },
  });
  const recordsQuery = useListAttendanceRecords(summaryParams, {
    query: {
      queryKey: getListAttendanceRecordsQueryKey(summaryParams),
      refetchInterval: 15000,
    },
  });
  const recentQuery = useListRecentAttendance(recentParams, {
    query: {
      queryKey: getListRecentAttendanceQueryKey(recentParams),
      refetchInterval: 10000,
    },
  });
  const createTap = useCreateAttendanceTap();

  const filteredRecords = useMemo(() => {
    const records = recordsQuery.data ?? [];
    const normalizedSearch = recordSearch.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesSearch = !normalizedSearch
        || record.studentName.toLowerCase().includes(normalizedSearch)
        || record.cardUid.toLowerCase().includes(normalizedSearch)
        || record.section.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [recordSearch, recordsQuery.data, statusFilter]);

  const refreshAll = async () => {
    await Promise.all([summaryQuery.refetch(), studentsQuery.refetch(), recordsQuery.refetch(), recentQuery.refetch()]);
  };

  const submitTap = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tapForm.cardUid.trim() || !tapForm.deviceId.trim()) {
      setTapNotice({ type: 'error', message: 'Card UID and reader ID are required.' });
      return;
    }
    setTapNotice(null);
    createTap.mutate(
      { data: { cardUid: tapForm.cardUid.trim(), deviceId: tapForm.deviceId.trim(), action: tapForm.action } },
      {
        onSuccess: (createdEvent: AttendanceEvent) => {
          setTapNotice({
            type: 'success',
            message: `${createdEvent.studentName} recorded ${createdEvent.action === 'in' ? 'on campus' : 'off campus'} at ${formatTime(createdEvent.occurredAt)}.`,
          });
          setTapForm((current) => ({ ...current, cardUid: '' }));
          queryClient.invalidateQueries({ queryKey: getGetAttendanceSummaryQueryKey(summaryParams) });
          queryClient.invalidateQueries({ queryKey: getListAttendanceRecordsQueryKey(summaryParams) });
          queryClient.invalidateQueries({ queryKey: getListRecentAttendanceQueryKey(recentParams) });
        },
        onError: () => {
          setTapNotice({ type: 'error', message: 'That tap could not be recorded. Check the card UID and reader ID.' });
        },
      },
    );
  };

  const summary = summaryQuery.data;
  const recentEvents = recentQuery.data ?? [];
  const isFirstLoad = summaryQuery.isLoading && !summary;
  const globalError = summaryQuery.isError && !summary;

  return (
    <div className="min-h-[100dvh] bg-[#f3f0e9] text-[#202a3c]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-[#202b40] px-5 py-6 text-[#e8eadf] transition-transform duration-300 md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6bd0bc] text-[#172337]">
              <Fingerprint className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-[15px] font-bold tracking-tight">Signalroom</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#91a09e]">Campus control</p>
            </div>
          </div>
          <button type="button" data-testid="button-close-mobile-nav" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-1 text-[#9da9ae] hover:bg-[#2b3850] md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-12">
          <p className="mb-3 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-[#71818a]">Workspace</p>
          <Link href="/" className="flex items-center gap-3 rounded-xl bg-[#2b3a4e] px-3 py-3 text-[#f0f0e8]" data-testid="link-dashboard-home">
            <LayoutDashboard className="h-4 w-4 text-[#6bd0bc]" />
            <span className="text-sm font-bold">Today’s overview</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#6bd0bc] signal-pulse" />
          </Link>
          <Link href="/locations" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-[#b8c3c5] transition hover:bg-[#2b3a4e] hover:text-[#f0f0e8]" data-testid="link-dashboard-locations">
            <MapPin className="h-4 w-4 text-[#6bd0bc]" />
            <span className="text-sm font-semibold">Latest locations</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#71818a]" />
          </Link>
        </div>

        <div className="mt-auto">
          <div className="rounded-2xl border border-[#354359] bg-[#263349] p-4">
            <div className="flex items-center gap-2 text-[#8ee2d0]">
              <Signal className="h-4 w-4" />
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em]">Reader network</span>
            </div>
            <p className="mt-3 text-sm font-bold text-[#f0f0e8]">Live and listening</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#9aa7aa]">New events sync into this room every few seconds.</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#3c4c60]">
              <div className="h-full w-[86%] rounded-full bg-[#6bd0bc]" />
            </div>
          </div>
          <p className="mt-5 px-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#71818a]">RFID / ATTENDANCE / 01</p>
        </div>
      </aside>

      {mobileNavOpen && <button type="button" aria-label="Close navigation" data-testid="button-overlay-close" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-20 bg-[#172337]/40 md:hidden" />}

      <main className="min-h-[100dvh] md:pl-[248px]">
        <header className="sticky top-0 z-10 border-b border-[#e4dfd5] bg-[#f3f0e9]/90 px-5 py-4 backdrop-blur-md md:px-10">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="button" data-testid="button-open-mobile-nav" onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-[#ddd8ce] bg-[#fbfaf7] p-2 text-[#39465a] md:hidden">
                <Command className="h-4 w-4" />
              </button>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.19em] text-[#7c8490]"> <LiveClock/> </p>
                <h1 className="font-display text-xl font-bold tracking-[-0.03em] text-[#202a3c] md:text-2xl">Campus pulse</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden items-center gap-2 rounded-full border border-[#d9e8e1] bg-[#edf8f3] px-3 py-2 text-xs font-bold text-[#16705f] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#23a68b] signal-pulse" />
                Readers online
              </div>
              <button type="button" data-testid="button-refresh-dashboard" onClick={refreshAll} disabled={summaryQuery.isFetching || recentQuery.isFetching} className="group inline-flex items-center gap-2 rounded-xl border border-[#ddd8ce] bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-[#4d596b] transition hover:border-[#a9bdb5] hover:text-[#16705f] disabled:cursor-wait disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${summaryQuery.isFetching || recentQuery.isFetching ? 'animate-spin' : 'transition-transform group-hover:rotate-45'}`} />
                <span className="hidden sm:inline">Sync now</span>
              </button>
            </div>
          </div>
        </header>

        <div className="ops-grid mx-auto max-w-[1500px] space-y-6 px-5 py-7 md:space-y-8 md:px-10 md:py-10">
          {globalError ? (
            <section className="rounded-[24px] border border-[#e6b9b2] bg-[#fff5f3] p-8">
              <div className="mx-auto flex max-w-lg flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fbe2de] text-[#b94c42]"><CircleAlert className="h-7 w-7" /></div>
                <h2 className="mt-5 font-display text-2xl font-bold text-[#813d36]">The room is waiting for a signal</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#95534c]">We could not reach today’s attendance summary. The reader network may still be active.</p>
                <button type="button" data-testid="button-retry-dashboard" onClick={refreshAll} className="mt-5 rounded-xl bg-[#b94c42] px-4 py-2.5 text-sm font-bold text-[#fffaf5] transition hover:bg-[#983e35]">Reconnect to dashboard</button>
              </div>
            </section>
          ) : (
            <>
              <section className="reveal-up flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#228b76]">Daily command center</span>
                    <span className="h-px w-9 bg-[#5bbca7]" />
                  </div>
                  <h2 className="max-w-2xl font-display text-3xl font-bold leading-[1.02] tracking-[-0.055em] text-[#202a3c] md:text-5xl">Know who’s here.<br /><span className="text-[#229b85]">Trust the signal.</span></h2>
                  <p className="mt-4 text-sm text-[#6f7888]">{schoolDate} <span className="mx-2 text-[#c5bfb4]">/</span> Arrival window in progress</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#ded9cf] bg-[#fbfaf7] px-4 py-3 shadow-[0_8px_20px_hsl(221_31%_16%_/_0.04)]">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#dff3ed] text-[#18735f]">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#fbfaf7] bg-[#23a68b]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#39465a]">Last synced</p>
                    <p data-testid="text-last-sync" className="font-mono text-[11px] text-[#7b8492]">{summary ? formatDateTime(summary.lastSyncAt) : 'Waiting for data'}</p>
                  </div>
                </div>
              </section>

              {isFirstLoad ? <SummarySkeleton /> : (
                <section className="reveal-up reveal-up-delay-1 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="panel-lift rounded-2xl border border-[#cce7de] bg-[#eaf7f2] p-4 md:p-5">
                    <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#397f70]">On campus</p><ArrowDownLeft className="h-4 w-4 text-[#239b84]" /></div>
                    <p data-testid="metric-present" className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-[#176b5a] md:text-4xl">{summary?.present ?? '—'}</p>
                    <p className="mt-1 text-[11px] font-medium text-[#568b7f]">of {summary?.totalStudents ?? '—'} enrolled</p>
                  </div>
                  <div className="panel-lift rounded-2xl border border-[#efdfb8] bg-[#fff8e7] p-4 md:p-5">
                    <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#9b741e]">Running late</p><Clock3 className="h-4 w-4 text-[#c39021]" /></div>
                    <p data-testid="metric-late" className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-[#a06d13] md:text-4xl">{summary?.late ?? '—'}</p>
                    <p className="mt-1 text-[11px] font-medium text-[#ae8b4a]">arrival watchlist</p>
                  </div>
                  <div className="panel-lift rounded-2xl border border-[#ecd0cc] bg-[#fff2f0] p-4 md:p-5">
                    <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#a65950]">Unaccounted</p><CircleAlert className="h-4 w-4 text-[#c1574d]" /></div>
                    <p data-testid="metric-absent" className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-[#ad463d] md:text-4xl">{summary?.absent ?? '—'}</p>
                    <p className="mt-1 text-[11px] font-medium text-[#b9746d]">needs a reason</p>
                  </div>
                  <div className="panel-lift rounded-2xl border border-[#dcdfea] bg-[#f1f3f8] p-4 md:p-5">
                    <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#69758b]">Checked out</p><ArrowUpRight className="h-4 w-4 text-[#718099]" /></div>
                    <p data-testid="metric-checked-out" className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-[#56637a] md:text-4xl">{summary?.checkedOut ?? '—'}</p>
                    <p className="mt-1 text-[11px] font-medium text-[#8490a3]">off campus now</p>
                  </div>
                </section>
              )}

              <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
                <div className="reveal-up reveal-up-delay-2 rounded-[22px] border border-[#e1dcd2] bg-[#fbfaf7] p-5 shadow-[0_8px_20px_hsl(221_31%_16%_/_0.035)] md:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#239b84]" /><h3 className="font-display text-lg font-bold tracking-[-0.03em]">Today by grade</h3></div>
                      <p className="mt-1 text-xs text-[#7d8490]">Present and absent students, grouped by grade.</p>
                    </div>
                    {summary && <div className="rounded-xl bg-[#edf8f3] px-3 py-2 text-right"><p data-testid="text-attendance-rate" className="font-display text-xl font-bold text-[#18735f]">{summary.attendanceRate}%</p><p className="font-mono text-[9px] uppercase tracking-wider text-[#579385]">attendance rate</p></div>}
                  </div>
                  <div className="mt-7">
                    {summaryQuery.isLoading ? <div className="space-y-5"><LoadingBar className="h-3 w-full" /><LoadingBar className="h-3 w-4/5" /><LoadingBar className="h-3 w-11/12" /></div> : summaryQuery.isError ? <QueryError label="grade breakdown" onRetry={() => summaryQuery.refetch()} /> : <GradeBars byGrade={summary?.byGrade ?? []} />}
                  </div>
                </div>

                <div className="reveal-up reveal-up-delay-3 rounded-[22px] border border-[#e1dcd2] bg-[#202b40] p-5 text-[#f0f0e8] shadow-[0_12px_26px_hsl(221_31%_16%_/_0.1)] md:p-6">
                  <div className="flex items-start justify-between">
                    <div><div className="flex items-center gap-2"><ContactRound className="h-4 w-4 text-[#6bd0bc]" /><h3 className="font-display text-lg font-bold tracking-[-0.03em]">Roster pulse</h3></div><p className="mt-1 text-xs text-[#99a4a7]">The population your readers are watching.</p></div>
                    <UsersRound className="h-5 w-5 text-[#607084]" />
                  </div>
                  <div className="mt-8 flex items-end gap-3"><p data-testid="text-roster-count" className="font-display text-5xl font-bold tracking-[-0.07em] text-[#f0f0e8]">{studentsQuery.isLoading ? '—' : (studentsQuery.data?.length ?? summary?.totalStudents ?? '—')}</p><span className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#8f9b9e]">students enrolled</span></div>
                  <div className="mt-7 border-t border-[#344257] pt-4">
                    <div className="flex items-center justify-between text-xs"><span className="text-[#aab4b4]">Arrival progress</span><span className="font-mono text-[#6bd0bc]">{summary?.attendanceRate ?? '—'}%</span></div>
                    <div className="mt-2 h-2 rounded-full bg-[#36465c]"><div className="h-full rounded-full bg-[#6bd0bc] transition-all duration-700" style={{ width: `${Math.min(Number(summary?.attendanceRate ?? 0), 100)}%` }} /></div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-[#95a2a7]"><BadgeCheck className="h-3.5 w-3.5 text-[#6bd0bc]" /> Enrollment roster synced</div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
                <div className="reveal-up reveal-up-delay-3 rounded-[22px] border border-[#e1dcd2] bg-[#fbfaf7] shadow-[0_8px_20px_hsl(221_31%_16%_/_0.035)]">
                  <div className="flex flex-col gap-4 border-b border-[#ebe7df] p-5 md:flex-row md:items-center md:justify-between md:p-6">
                    <div><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#239b84]" /><h3 className="font-display text-lg font-bold tracking-[-0.03em]">Current student status</h3></div><p className="mt-1 text-xs text-[#7d8490]">A live view of every card’s latest state.</p></div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8991a0]" /><input data-testid="input-search-students" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Search name or card" className="h-9 w-full rounded-lg border border-[#ded9cf] bg-[#f8f6f1] pl-9 pr-3 text-xs font-medium text-[#2c374b] outline-none transition placeholder:text-[#a2a7ad] focus:border-[#70b9a7] focus:ring-2 focus:ring-[#bde7dc] sm:w-[170px]" /></div>
                      <select data-testid="select-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-9 rounded-lg border border-[#ded9cf] bg-[#f8f6f1] px-3 text-xs font-bold text-[#536073] outline-none focus:border-[#70b9a7]">
                        <option value="all">All statuses</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="checked-out">Checked out</option>
                      </select>
                    </div>
                  </div>
                  {recordsQuery.isLoading ? (
                    <div className="space-y-4 p-6">{Array.from({ length: 5 }).map((_, index) => <LoadingBar key={index} className="h-10 w-full" />)}</div>
                  ) : recordsQuery.isError ? <div className="p-5"><QueryError label="student status" onRetry={() => recordsQuery.refetch()} /></div> : filteredRecords.length ? (
                    <div className="scrollbar-quiet overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-[#f6f3ed] font-mono text-[9px] uppercase tracking-[0.15em] text-[#9299a4]"><tr><th className="px-5 py-3 font-medium md:px-6">Student</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">First tap</th><th className="px-4 py-3 font-medium">Last reader</th></tr></thead>
                        <tbody className="divide-y divide-[#eeeae3]">
                          {filteredRecords.slice(0, 12).map((record) => <tr key={record.studentId} data-testid={`row-student-${record.studentId}`} className="group transition hover:bg-[#f7f5ef]">
                            <td className="px-5 py-3.5 md:px-6"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e1f0ec] font-mono text-[10px] font-bold text-[#227e6d]">{initials(record.studentName)}</div><div><p data-testid={`text-student-name-${record.studentId}`} className="text-xs font-bold text-[#303b4d]">{record.studentName}</p><p className="mt-0.5 font-mono text-[10px] text-[#969da7]">{record.grade} / {record.section}</p></div></div></td>
                            <td className="px-4 py-3.5"><StatusPill status={record.status} /></td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-[#737d8d]">{formatTime(record.firstTapAt)}</td>
                            <td className="px-4 py-3.5"><span className="font-mono text-[10px] text-[#737d8d]">{record.deviceId ?? '—'}</span><span className="ml-2 text-[11px] text-[#9da3ab]">{formatTime(record.lastTapAt)}</span></td>
                          </tr>)}
                        </tbody>
                      </table>
                      {filteredRecords.length > 12 && <p className="border-t border-[#eeeae3] px-6 py-3 text-center font-mono text-[10px] text-[#9299a4]">Showing 12 of {filteredRecords.length} matching students</p>}
                    </div>
                  ) : <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf8f3] text-[#239b84]"><Search className="h-5 w-5" /></div><p className="mt-4 text-sm font-bold text-[#4b5668]">No students match this view</p><p className="mt-1 text-xs text-[#8a929e]">Try another name, card UID, or status filter.</p></div>}
                </div>

                <div className="reveal-up reveal-up-delay-4 rounded-[22px] border border-[#e1dcd2] bg-[#fbfaf7] shadow-[0_8px_20px_hsl(221_31%_16%_/_0.035)]">
                  <div className="flex items-start justify-between border-b border-[#ebe7df] p-5 md:p-6"><div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#239b84]" /><h3 className="font-display text-lg font-bold tracking-[-0.03em]">Recent RFID activity</h3></div><p className="mt-1 text-xs text-[#7d8490]">Latest reader events across campus.</p></div><span className="rounded-full bg-[#edf8f3] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#23846f]">Live</span></div>
                  {recentQuery.isLoading ? <div className="space-y-5 p-6">{Array.from({ length: 5 }).map((_, index) => <LoadingBar key={index} className="h-9 w-full" />)}</div> : recentQuery.isError ? <div className="p-5"><QueryError label="RFID activity" onRetry={() => recentQuery.refetch()} /></div> : recentEvents.length ? <div className="divide-y divide-[#eeeae3]">{recentEvents.map((event) => <div key={event.id} data-testid={`event-row-${event.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#f7f5ef] md:px-6"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${event.action === 'in' ? 'bg-[#e1f0ec] text-[#21836f]' : 'bg-[#eef0f5] text-[#68758a]'}`}>{event.action === 'in' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p data-testid={`text-event-student-${event.id}`} className="truncate text-xs font-bold text-[#303b4d]">{event.studentName}</p><p className="mt-0.5 font-mono text-[10px] text-[#969da7]">{event.deviceId} <span className="mx-1 text-[#c4c8cc]">/</span> {event.action === 'in' ? 'tap in' : 'tap out'}</p></div><time className="shrink-0 font-mono text-[10px] text-[#8a929e]">{formatTime(event.occurredAt)}</time></div>)}</div> : <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff8e7] text-[#b6811b]"><Activity className="h-5 w-5" /></div><p className="mt-4 text-sm font-bold text-[#4b5668]">No reader events yet</p><p className="mt-1 text-xs text-[#8a929e]">The activity feed will fill as cards are tapped.</p></div>}
                </div>
              </section>

              <section className="reveal-up reveal-up-delay-4 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
                <div className="rounded-[22px] border border-[#c9e8df] bg-[#eaf7f2] p-5 shadow-[0_8px_20px_hsl(174_52%_38%_/_0.05)] md:p-6">
                  <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-[#1d806d]" /><h3 className="font-display text-lg font-bold tracking-[-0.03em] text-[#1c554c]">Exercise a reader tap</h3></div><p className="mt-1 text-xs text-[#568b7f]">Send a real event to the live attendance API.</p></div><span className="rounded-full bg-[#d4eee6] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#267965]">Test input</span></div>
                  <form onSubmit={submitTap} className="mt-6 space-y-3">
                    <label className="block"><span className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#4e8a7b]">Card UID</span><input data-testid="input-tap-card-uid" value={tapForm.cardUid} onChange={(event) => setTapForm((current) => ({ ...current, cardUid: event.target.value }))} placeholder="e.g. 04-A8-19-7C" className="h-10 w-full rounded-xl border border-[#b8ddd3] bg-[#f5fcf9] px-3 font-mono text-xs text-[#20473f] outline-none transition placeholder:text-[#94bcb2] focus:border-[#2e9c85] focus:ring-2 focus:ring-[#bde7dc]" /></label>
                    <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#4e8a7b]">Reader ID</span><input data-testid="input-tap-device-id" value={tapForm.deviceId} onChange={(event) => setTapForm((current) => ({ ...current, deviceId: event.target.value }))} className="h-10 w-full rounded-xl border border-[#b8ddd3] bg-[#f5fcf9] px-3 font-mono text-xs text-[#20473f] outline-none transition focus:border-[#2e9c85] focus:ring-2 focus:ring-[#bde7dc]" /></label><label className="block"><span className="mb-1.5 block font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#4e8a7b]">Action</span><select data-testid="select-tap-action" value={tapForm.action} onChange={(event) => setTapForm((current) => ({ ...current, action: event.target.value as AttendanceTapInput['action'] }))} className="h-10 w-full rounded-xl border border-[#b8ddd3] bg-[#f5fcf9] px-3 text-xs font-bold text-[#20473f] outline-none focus:border-[#2e9c85]"><option value="in">Tap in</option><option value="out">Tap out</option></select></label></div>
                    <button data-testid="button-submit-tap" type="submit" disabled={createTap.isPending} className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1d806d] text-xs font-bold text-[#f4fffb] transition hover:bg-[#176653] disabled:cursor-wait disabled:opacity-60">{createTap.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {createTap.isPending ? 'Recording event…' : 'Record reader event'}</button>
                  </form>
                  {tapNotice && <div data-testid={`status-tap-${tapNotice.type}`} className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${tapNotice.type === 'success' ? 'border-[#b9ded2] bg-[#f5fcf9] text-[#1e725f]' : 'border-[#e3b8b1] bg-[#fff7f5] text-[#a34a40]'}`}>{tapNotice.type === 'success' ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span>{tapNotice.message}</span></div>}
                </div>
                <div className="rounded-[22px] border border-[#e1dcd2] bg-[#fbfaf7] p-5 shadow-[0_8px_20px_hsl(221_31%_16%_/_0.035)] md:p-6">
                  <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#b6811b]" /><h3 className="font-display text-lg font-bold tracking-[-0.03em]">Operator notes</h3></div><p className="mt-1 text-xs text-[#7d8490]">A quick read on how to use this room.</p></div><ChevronRight className="h-4 w-4 text-[#b5b9bf]" /></div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <div className="rounded-xl bg-[#f5f1e9] p-4"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#9c7b37]">01 / Watch</p><p className="mt-2 text-xs font-bold leading-relaxed text-[#4b5668]">Use the pulse above for the immediate campus count.</p></div>
                    <div className="rounded-xl bg-[#f5f1e9] p-4"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#9c7b37]">02 / Verify</p><p className="mt-2 text-xs font-bold leading-relaxed text-[#4b5668]">Recent activity confirms what each reader recorded.</p></div>
                    <div className="rounded-xl bg-[#f5f1e9] p-4"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#9c7b37]">03 / Act</p><p className="mt-2 text-xs font-bold leading-relaxed text-[#4b5668]">Search a student when a name needs attention.</p></div>
                  </div>
                </div>
              </section>
            </>
          )}
          <footer className="flex flex-col justify-between gap-2 border-t border-[#ded9cf] pt-5 text-[10px] text-[#9299a4] sm:flex-row"><span className="font-mono uppercase tracking-[0.14em]">Signalroom / Attendance desk</span><span>Auto-refreshing live data every 10–60 seconds</span></footer>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;