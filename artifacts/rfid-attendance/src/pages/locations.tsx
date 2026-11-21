import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  getGetAuthMeQueryKey,
  getListLatestStudentLocationsQueryKey,
  useGetAuthMe,
  useListLatestStudentLocations,
  useUpdateStudentHomeLocation,
  type StudentLatestLocation,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Check,
  Clock3,
  House,
  MapPin,
  MapPinned,
  RefreshCw,
  Save,
  ShieldCheck,
  Timer,
  UsersRound,
  X,
} from "lucide-react";

function apiErrorText(error: unknown) {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    )
      return data.error;
  }
  return error instanceof Error
    ? error.message
    : "This request could not be completed. Please try again.";
}

function formatTimestamp(value: Date | string | null) {
  if (!value) return "No location received";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "No location received";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function coordinates(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return null;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function LoadingLocations() {
  return (
    <div
      className="space-y-4"
      aria-label="Loading latest locations"
      data-testid="status-locations-loading"
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-[#e2ded5] bg-[#fbfaf7] p-5"
        >
          <div className="h-4 w-40 rounded bg-[#e7e3da]" />
          <div className="mt-4 h-3 w-3/4 rounded bg-[#e7e3da]" />
          <div className="mt-2 h-3 w-1/2 rounded bg-[#e7e3da]" />
        </div>
      ))}
    </div>
  );
}

type EtaItem = {
  studentId: number;
  state:
    | "not_tracking"
    | "no_home"
    | "no_pings"
    | "stale"
    | "arrived"
    | "estimating";
  minutes?: number;
  meters?: number;
  speedKmh?: number;
  basis?: "measured" | "default";
};

function etaText(eta?: EtaItem) {
  if (!eta) return "Checking…";
  switch (eta.state) {
    case "arrived":
      return "Arrived home";
    case "estimating":
      return `About ${eta.minutes} min away`;
    case "no_home":
      return "Set home coordinates to see an estimate";
    case "no_pings":
      return "Waiting for the first location";
    case "stale":
      return "Location is out of date";
    default:
      return "Not available while the student is not sharing";
  }
}

type NotificationItem = {
  id: string;
  kind: "checked_in" | "checked_out" | "arrived_home";
  studentId: number;
  studentName: string;
  at: string;
};

function notificationText(item: NotificationItem) {
  if (item.kind === "checked_in")
    return `${item.studentName} checked in at school`;
  if (item.kind === "checked_out")
    return `${item.studentName} checked out of school`;
  return `${item.studentName} arrived home`;
}

const SEEN_KEY = "notifications-seen-at";
function readSeenAt(): number {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveSeenAt(value: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function NotificationsPanel({
  items,
  seenAt,
  onMarkRead,
}: {
  items: NotificationItem[];
  seenAt: number;
  onMarkRead: () => void;
}) {
  const unread = items.filter(
    (item) => new Date(item.at).getTime() > seenAt,
  ).length;
  return (
    <section
      className="mb-5 rounded-[22px] border border-[#e1dcd2] bg-[#fbfaf7] shadow-[0_8px_24px_rgba(32,42,60,0.04)]"
      data-testid="panel-notifications"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#ebe7df] px-5 py-4 sm:px-6">
        <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a929e]">
          <Bell size={14} className="text-[#1d806d]" /> Notifications
          {unread > 0 && (
            <span
              className="rounded-full bg-[#d25b4d] px-2 py-0.5 text-[10px] text-white"
              data-testid="badge-unread"
            >
              {unread} new
            </span>
          )}
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={onMarkRead}
            className="text-xs font-bold text-[#1d806d] hover:underline"
            data-testid="button-mark-read"
          >
            Mark all as read
          </button>
        )}
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#eeeae3]">
          {items.slice(0, 8).map((item) => {
            const isNew = new Date(item.at).getTime() > seenAt;
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6"
                data-testid={`notification-${item.id}`}
              >
                <p
                  className={`text-sm ${isNew ? "font-bold text-[#283247]" : "text-[#5b6676]"}`}
                >
                  {notificationText(item)}
                </p>
                <time className="shrink-0 font-mono text-[10px] text-[#8a929e]">
                  {formatTimestamp(item.at)}
                </time>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm text-[#8a929e] sm:px-6">
          No notifications yet. Check-ins, check-outs and arrivals appear here.
        </p>
      )}
    </section>
  );
}

function StudentLocationCard({
  student,
  isParent,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
  error,
  success,
  eta,
}: {
  student: StudentLatestLocation;
  isParent: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (latitude: number, longitude: number) => void;
  saving: boolean;
  error: string;
  success: boolean;
  eta?: EtaItem;
}) {
  const [latitude, setLatitude] = useState(
    student.homeLocation?.latitude.toString() ?? "",
  );
  const [longitude, setLongitude] = useState(
    student.homeLocation?.longitude.toString() ?? "",
  );
  const hasPing = student.latitude !== null && student.longitude !== null;

  useEffect(() => {
    setLatitude(student.homeLocation?.latitude.toString() ?? "");
    setLongitude(student.homeLocation?.longitude.toString() ?? "");
  }, [student.homeLocation?.latitude, student.homeLocation?.longitude]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    )
      return;
    onSave(lat, lon);
  };

  return (
    <article
      className="overflow-hidden rounded-[22px] border border-[#e1dcd2] bg-[#fbfaf7] shadow-[0_8px_24px_rgba(32,42,60,0.04)]"
      data-testid={`card-location-${student.studentId}`}
    >
      <div className="flex flex-col gap-4 border-b border-[#ebe7df] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e1f0ec] font-mono text-xs font-bold text-[#227e6d]">
            {student.studentName
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <h2
              className="font-display text-base font-bold tracking-tight text-[#283247]"
              data-testid={`text-location-student-${student.studentId}`}
            >
              {student.studentName}
            </h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a929e]">
              {student.grade} <span className="mx-1 text-[#c5c3bd]">/</span>{" "}
              {student.section}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.11em] ${student.trackingActive ? "bg-[#e4f3ed] text-[#176b5a]" : "bg-[#eeeff1] text-[#697586]"}`}
          data-testid={`status-tracking-${student.studentId}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${student.trackingActive ? "signal-pulse bg-[#239b85]" : "bg-[#9ca4ae]"}`}
          />
          {student.trackingActive ? "Tracking active" : "Not sharing"}
        </span>
      </div>

      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b border-[#ebe7df] px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
          <p className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8a929e]">
            <MapPinned size={14} className="text-[#1d806d]" /> Latest location
          </p>
          {hasPing ? (
            <>
              <p
                className="mt-3 font-mono text-sm font-medium tabular-nums text-[#344154]"
                data-testid={`text-location-coordinates-${student.studentId}`}
              >
                {coordinates(student.latitude, student.longitude)}
              </p>
              <p
                className="mt-2 flex items-center gap-1.5 text-xs text-[#7d8490]"
                data-testid={`text-location-timestamp-${student.studentId}`}
              >
                <Clock3 size={13} />
                {formatTimestamp(student.pingedAt)}
              </p>
              <p className="mt-3 text-[10px] text-[#8a929e]">
                Latest GPS coordinates, shared by the student.
              </p>
            </>
          ) : (
            <div
              className="mt-3 rounded-xl border border-dashed border-[#d9d5cc] bg-[#f8f6f1] px-4 py-4"
              data-testid={`empty-location-${student.studentId}`}
            >
              <p className="text-sm font-semibold text-[#536073]">
                No location ping yet
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8a929e]">
                A location appears after the student opts in while checked out.
              </p>
            </div>
          )}
        </div>

        {isParent ? (
          <div className="px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8a929e]">
                <House size={14} className="text-[#b6811b]" /> Home coordinates
              </p>
              {!editing && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-lg border border-[#ded9cf] bg-[#f8f6f1] px-3 py-1.5 text-[11px] font-bold text-[#536073] transition hover:border-[#9dc4b6] hover:text-[#1d806d]"
                  data-testid={`button-edit-home-${student.studentId}`}
                >
                  {student.homeLocation ? "Edit home" : "Add home"}
                </button>
              )}
            </div>
            {editing ? (
              <form
                onSubmit={submit}
                className="mt-3 space-y-3"
                data-testid={`form-home-${student.studentId}`}
              >
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-bold text-[#707b8b]">
                    Latitude
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      required
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                      placeholder="14.5995"
                      className="mt-1 h-10 w-full rounded-lg border border-[#ded9cf] bg-[#fffdf9] px-3 font-mono text-xs text-[#344154] outline-none focus:border-[#70b9a7] focus:ring-2 focus:ring-[#bde7dc]"
                      data-testid={`input-home-latitude-${student.studentId}`}
                    />
                  </label>
                  <label className="text-[10px] font-bold text-[#707b8b]">
                    Longitude
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      required
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                      placeholder="120.9842"
                      className="mt-1 h-10 w-full rounded-lg border border-[#ded9cf] bg-[#fffdf9] px-3 font-mono text-xs text-[#344154] outline-none focus:border-[#70b9a7] focus:ring-2 focus:ring-[#bde7dc]"
                      data-testid={`input-home-longitude-${student.studentId}`}
                    />
                  </label>
                </div>
                <p className="text-[10px] leading-4 text-[#8a929e]">
                  These coordinates are visible to your linked family account
                  and school staff.
                </p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving || !latitude.trim() || !longitude.trim()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1d806d] px-3 text-xs font-bold text-white transition hover:bg-[#176653] disabled:cursor-wait disabled:opacity-60"
                    data-testid={`button-save-home-${student.studentId}`}
                  >
                    {saving ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {saving ? "Saving…" : "Save home"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#ded9cf] px-3 text-xs font-bold text-[#5b6676] hover:bg-[#f4f1eb]"
                    data-testid={`button-cancel-home-${student.studentId}`}
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="flex items-start gap-1.5 text-xs leading-5 text-[#a34a40]"
                    data-testid={`status-home-error-${student.studentId}`}
                  >
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {error}
                  </p>
                )}
              </form>
            ) : (
              <>
                <p
                  className="mt-3 font-mono text-sm font-medium tabular-nums text-[#344154]"
                  data-testid={`text-home-coordinates-${student.studentId}`}
                >
                  {student.homeLocation
                    ? coordinates(
                        student.homeLocation.latitude,
                        student.homeLocation.longitude,
                      )
                    : "Not set"}
                </p>
                {success && (
                  <p
                    role="status"
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#1d806d]"
                    data-testid={`status-home-saved-${student.studentId}`}
                  >
                    <Check size={14} />
                    Home coordinates saved
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col justify-center px-5 py-5 sm:px-6">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8a929e]">
              Location sharing
            </p>
            <p className="mt-2 text-sm font-semibold text-[#344154]">
              {student.trackingActive
                ? "Student page is actively sharing"
                : "No active sharing session"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#8a929e]">
              Locations are refreshed every 45 seconds.
            </p>
          </div>
        )}
      </div>
      {isParent && (
        <div
          className="border-t border-[#ebe7df] px-5 py-4 sm:px-6"
          data-testid={`eta-${student.studentId}`}
        >
          <p className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#8a929e]">
            <Timer size={14} className="text-[#1d806d]" /> Estimated arrival
          </p>
          <p className="mt-2 text-sm font-semibold text-[#344154]">
            {etaText(eta)}
          </p>
          {eta?.state === "estimating" && (
            <p className="mt-1 text-xs text-[#8a929e]">
              About {eta.meters} m from home at roughly {eta.speedKmh} km/h
              {eta.basis === "default" ? " (assumed speed)" : ""}.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function LocationsPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const authQuery = useGetAuthMe({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      queryKey: getGetAuthMeQueryKey(),
      retry: false,
    },
  });
  const locationsQuery = useListLatestStudentLocations({
    query: {
      enabled:
        isLoaded && Boolean(isSignedIn) && authQuery.data?.role !== "student",
      queryKey: getListLatestStudentLocationsQueryKey(),
      refetchInterval: 45000,
      retry: false,
    },
  });
  const updateHome = useUpdateStudentHomeLocation();
  const role = authQuery.data?.role;
  const isParent = role === "parent";
    const notificationsQuery = useQuery({
    queryKey: ['family-notifications'],
    enabled: isLoaded && Boolean(isSignedIn) && isParent,
    refetchInterval: 15000,
    retry: false,
    queryFn: async (): Promise<NotificationItem[]> => {
      const token = await getToken();
      const response = await fetch('/api/attendance/notifications', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Notifications unavailable');
      return response.json();
    },
  });
  const [seenAt, setSeenAt] = useState(readSeenAt);
  const etaQuery = useQuery({
    queryKey: ["student-eta"],
    enabled: isLoaded && Boolean(isSignedIn) && isParent,
    refetchInterval: 45000,
    retry: false,
    queryFn: async (): Promise<EtaItem[]> => {
      const token = await getToken();
      const response = await fetch("/api/attendance/location/eta", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("ETA unavailable");
      return response.json();
    },
  });
  const etaByStudent = useMemo(
    () => new Map((etaQuery.data ?? []).map((item) => [item.studentId, item])),
    [etaQuery.data],
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation("/sign-in", { replace: true });
    else if (authQuery.data?.role === "student")
      setLocation("/student/qr", { replace: true });
  }, [isLoaded, isSignedIn, authQuery.data?.role, setLocation]);

  const visibleLocations = useMemo(() => {
    const entries = locationsQuery.data ?? [];
    if (!isParent || !authQuery.data) return entries;
    const linkedIds = new Set(
      authQuery.data.visibleStudents.map((student) => student.id),
    );
    return entries.filter((entry) => linkedIds.has(entry.studentId));
  }, [locationsQuery.data, isParent, authQuery.data]);

  const handleSaveHome = (
    studentId: number,
    latitude: number,
    longitude: number,
  ) => {
    setSaveError("");
    setSavedId(null);
    updateHome.mutate(
      { studentId, data: { latitude, longitude } },
      {
        onSuccess: () => {
          setEditingId(null);
          setSavedId(studentId);
          void queryClient.invalidateQueries({
            queryKey: getListLatestStudentLocationsQueryKey(),
          });
        },
        onError: (error) => setSaveError(apiErrorText(error)),
      },
    );
  };

  if (!isLoaded || (isSignedIn && authQuery.isLoading)) {
    return (
      <main className="ops-grid flex min-h-[100dvh] items-center justify-center bg-[#f3f0e9] px-5">
        <div className="w-full max-w-sm animate-pulse rounded-3xl border border-[#ded9cf] bg-[#fbfaf7] p-7">
          <div className="h-3 w-24 rounded bg-[#e6e1d7]" />
          <div className="mt-4 h-8 w-3/4 rounded bg-[#e6e1d7]" />
          <div className="mt-3 h-4 w-full rounded bg-[#e6e1d7]" />
        </div>
      </main>
    );
  }
  if (!isSignedIn || role === "student") return null;

  return (
    <main className="ops-grid min-h-[100dvh] bg-[#f3f0e9] px-4 py-6 text-[#202a3c] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[#ded9cf] bg-[#fbfaf7] px-3 py-2 text-xs font-bold text-[#536073] transition hover:border-[#9dc4b6] hover:text-[#1d806d]"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-[#ded9cf] bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-[#526071]">
            <ShieldCheck size={15} className="text-[#1d806d]" />
            {isParent ? "Family locations" : "Staff view"}
          </div>
        </header>

        <section className="reveal-up mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#1d806d]">
              <span className="h-px w-7 bg-[#54a995]" />
              Location oversight
            </p>
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[#202a3c] sm:text-5xl">
              {isParent
                ? "A clear view of your children."
                : "The latest location signal."}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#6f7888]">
              {isParent
                ? "Only children linked to your account appear here. Their latest location is shared only after checkout and only while their student page stays open."
                : "Latest student pings and sharing status. Students opt in after checkout; sharing ends at check-in, checkout expiry, or when the page closes."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void locationsQuery.refetch()}
            disabled={locationsQuery.isFetching}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#ded9cf] bg-[#fbfaf7] px-4 text-xs font-bold text-[#536073] transition hover:border-[#9dc4b6] hover:text-[#1d806d] disabled:cursor-wait disabled:opacity-60"
            data-testid="button-refresh-locations"
          >
            <RefreshCw
              size={14}
              className={locationsQuery.isFetching ? "animate-spin" : ""}
            />
            {locationsQuery.isFetching ? "Refreshing…" : "Refresh now"}
          </button>
        </section>

        <div
          className="mb-5 flex items-center gap-3 rounded-2xl border border-[#e5dfd2] bg-[#f9f6ee] px-4 py-3 text-xs leading-5 text-[#6d7180]"
          data-testid="notice-location-privacy"
        >
          <ShieldCheck size={17} className="shrink-0 text-[#a47720]" />
          <p>
            <strong className="text-[#414a5b]">Privacy boundary:</strong>{" "}
            location is shown only to linked parents and authorized school
            staff. Student sharing is opt-in and stops when the active checkout
            ends.
          </p>
        </div>

        {isParent && (
          <NotificationsPanel
            items={notificationsQuery.data ?? []}
            seenAt={seenAt}
            onMarkRead={() => {
              const now = Date.now();
              saveSeenAt(now);
              setSeenAt(now);
            }}
          />
        )}

        {authQuery.isError ? (
          <section
            className="rounded-[22px] border border-[#e6b9b2] bg-[#fff5f3] p-8 text-center"
            role="alert"
          >
            <AlertCircle className="mx-auto h-7 w-7 text-[#b94c42]" />
            <h2 className="mt-4 font-display text-xl font-bold text-[#813d36]">
              Account access unavailable
            </h2>
            <p className="mt-2 text-sm text-[#95534c]">
              {apiErrorText(authQuery.error)}
            </p>
            <button
              type="button"
              onClick={() => void authQuery.refetch()}
              className="mt-5 rounded-xl bg-[#b94c42] px-4 py-2.5 text-sm font-bold text-white"
              data-testid="button-retry-locations-auth"
            >
              Try again
            </button>
          </section>
        ) : locationsQuery.isLoading && !locationsQuery.data ? (
          <LoadingLocations />
        ) : locationsQuery.isError ? (
          <section
            className="rounded-[22px] border border-[#e6b9b2] bg-[#fff5f3] p-8 text-center"
            role="alert"
            data-testid="status-locations-error"
          >
            <AlertCircle className="mx-auto h-7 w-7 text-[#b94c42]" />
            <h2 className="mt-4 font-display text-xl font-bold text-[#813d36]">
              Latest locations did not load
            </h2>
            <p className="mt-2 text-sm text-[#95534c]">
              {apiErrorText(locationsQuery.error)}
            </p>
            <button
              type="button"
              onClick={() => void locationsQuery.refetch()}
              className="mt-5 rounded-xl bg-[#b94c42] px-4 py-2.5 text-sm font-bold text-white"
              data-testid="button-retry-locations"
            >
              Retry locations
            </button>
          </section>
        ) : visibleLocations.length ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p
                className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#87909d]"
                data-testid="text-visible-count"
              >
                <UsersRound size={14} />
                {visibleLocations.length}{" "}
                {isParent ? "linked children" : "students"}
              </p>
              <p className="flex items-center gap-1.5 text-[10px] text-[#89919d]">
                <Clock3 size={12} />
                Auto-refresh every 45 seconds
              </p>
            </div>
            <div className="space-y-4">
              {visibleLocations.map((student) => (
                <StudentLocationCard
                  key={student.studentId}
                  student={student}
                  isParent={isParent}
                  editing={editingId === student.studentId}
                  onEdit={() => {
                    setEditingId(student.studentId);
                    setSaveError("");
                    setSavedId(null);
                  }}
                  onCancel={() => {
                    setEditingId(null);
                    setSaveError("");
                  }}
                  onSave={(latitude, longitude) =>
                    handleSaveHome(student.studentId, latitude, longitude)
                  }
                  saving={
                    updateHome.isPending && editingId === student.studentId
                  }
                  error={editingId === student.studentId ? saveError : ""}
                  success={savedId === student.studentId}
                  eta={etaByStudent.get(student.studentId)}
                />
              ))}
            </div>
          </>
        ) : (
          <section
            className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#d8d3c9] bg-[#fbfaf7]/75 px-6 text-center"
            data-testid="empty-locations"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf4ef] text-[#1d806d]">
              <MapPin size={24} />
            </div>
            <h2 className="mt-5 font-display text-xl font-bold text-[#39465a]">
              {isParent
                ? "No linked children found"
                : "No student location records yet"}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#7b8492]">
              {isParent
                ? "When your school links a child to your account, their location status and home coordinates will appear here."
                : "Latest student locations will appear here after students opt in to sharing during an active checkout."}
            </p>
            {isParent && (
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#1d806d] hover:underline"
                data-testid="link-empty-dashboard"
              >
                Return to dashboard <ArrowLeft size={14} />
              </Link>
            )}
          </section>
        )}
        <footer className="mt-8 flex items-center justify-between border-t border-[#ded9cf] pt-5 text-[10px] text-[#9299a4]">
          <span className="font-mono uppercase tracking-[0.14em]">
            RFID / Location signal
          </span>
          <span>
            Ping history is retained; this view shows only the latest point.
          </span>
        </footer>
      </div>
    </main>
  );
}
