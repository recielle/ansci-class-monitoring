import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AttendanceEvent, AttendanceRecord, AttendanceSummary, AttendanceTapInput, AuthMeResponse, DailyQrToken, DailyQrTokenInput, ErrorResponse, GetAttendanceSummaryParams, HealthStatus, ListAttendanceRecordsParams, ListRecentAttendanceParams, LocationPing, LocationPingInput, Student, StudentHomeLocationInput, StudentHomeLocationResponse, StudentLatestLocation, StudentLocationStatus, VerifyDailyQrTokenInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAuthMeUrl: () => string;
/**
 * Returns the signed-in user's role and the students that role can access
 * @summary Get the current user and visible students
 */
export declare const getAuthMe: (options?: Parameters<typeof customFetch>[1]) => Promise<AuthMeResponse>;
export declare const getGetAuthMeQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetAuthMeQueryOptions: <TData = Awaited<ReturnType<typeof getAuthMe>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAuthMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAuthMe>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAuthMeQueryResult = NonNullable<Awaited<ReturnType<typeof getAuthMe>>>;
export type GetAuthMeQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get the current user and visible students
 */
export declare function useGetAuthMe<TData = Awaited<ReturnType<typeof getAuthMe>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAuthMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListStudentsUrl: () => string;
/**
 * Returns all students for staff, or only linked students for parents and students
 * @summary List students
 */
export declare const listStudents: (options?: Parameters<typeof customFetch>[1]) => Promise<Student[]>;
export declare const getListStudentsQueryKey: () => readonly ["/api/students"];
export declare const getListStudentsQueryOptions: <TData = Awaited<ReturnType<typeof listStudents>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStudents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listStudents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListStudentsQueryResult = NonNullable<Awaited<ReturnType<typeof listStudents>>>;
export type ListStudentsQueryError = ErrorType<unknown>;
/**
 * @summary List students
 */
export declare function useListStudents<TData = Awaited<ReturnType<typeof listStudents>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStudents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAttendanceSummaryUrl: (params?: GetAttendanceSummaryParams) => string;
/**
 * Returns attendance totals and grouped grade counts for the requested school date
 * @summary Get today's attendance summary
 */
export declare const getAttendanceSummary: (params?: GetAttendanceSummaryParams, options?: Parameters<typeof customFetch>[1]) => Promise<AttendanceSummary>;
export declare const getGetAttendanceSummaryQueryKey: (params?: GetAttendanceSummaryParams) => readonly ["/api/attendance/summary", ...GetAttendanceSummaryParams[]];
export declare const getGetAttendanceSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getAttendanceSummary>>, TError = ErrorType<unknown>>(params?: GetAttendanceSummaryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAttendanceSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAttendanceSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAttendanceSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getAttendanceSummary>>>;
export type GetAttendanceSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get today's attendance summary
 */
export declare function useGetAttendanceSummary<TData = Awaited<ReturnType<typeof getAttendanceSummary>>, TError = ErrorType<unknown>>(params?: GetAttendanceSummaryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAttendanceSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListAttendanceRecordsUrl: (params?: ListAttendanceRecordsParams) => string;
/**
 * Returns the current attendance state for each student on the requested school date
 * @summary List attendance records
 */
export declare const listAttendanceRecords: (params?: ListAttendanceRecordsParams, options?: Parameters<typeof customFetch>[1]) => Promise<AttendanceRecord[]>;
export declare const getListAttendanceRecordsQueryKey: (params?: ListAttendanceRecordsParams) => readonly ["/api/attendance/records", ...ListAttendanceRecordsParams[]];
export declare const getListAttendanceRecordsQueryOptions: <TData = Awaited<ReturnType<typeof listAttendanceRecords>>, TError = ErrorType<unknown>>(params?: ListAttendanceRecordsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAttendanceRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAttendanceRecords>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAttendanceRecordsQueryResult = NonNullable<Awaited<ReturnType<typeof listAttendanceRecords>>>;
export type ListAttendanceRecordsQueryError = ErrorType<unknown>;
/**
 * @summary List attendance records
 */
export declare function useListAttendanceRecords<TData = Awaited<ReturnType<typeof listAttendanceRecords>>, TError = ErrorType<unknown>>(params?: ListAttendanceRecordsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAttendanceRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListRecentAttendanceUrl: (params?: ListRecentAttendanceParams) => string;
/**
 * Returns the latest tap events from attendance devices
 * @summary List recent RFID activity
 */
export declare const listRecentAttendance: (params?: ListRecentAttendanceParams, options?: Parameters<typeof customFetch>[1]) => Promise<AttendanceEvent[]>;
export declare const getListRecentAttendanceQueryKey: (params?: ListRecentAttendanceParams) => readonly ["/api/attendance/recent", ...ListRecentAttendanceParams[]];
export declare const getListRecentAttendanceQueryOptions: <TData = Awaited<ReturnType<typeof listRecentAttendance>>, TError = ErrorType<unknown>>(params?: ListRecentAttendanceParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRecentAttendance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listRecentAttendance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListRecentAttendanceQueryResult = NonNullable<Awaited<ReturnType<typeof listRecentAttendance>>>;
export type ListRecentAttendanceQueryError = ErrorType<unknown>;
/**
 * @summary List recent RFID activity
 */
export declare function useListRecentAttendance<TData = Awaited<ReturnType<typeof listRecentAttendance>>, TError = ErrorType<unknown>>(params?: ListRecentAttendanceParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRecentAttendance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateAttendanceTapUrl: () => string;
/**
 * Records a tap-in or tap-out event from an RFID reader; staff access only
 * @summary Receive an RFID tap
 */
export declare const createAttendanceTap: (attendanceTapInput: AttendanceTapInput, options?: Parameters<typeof customFetch>[1]) => Promise<AttendanceEvent>;
export declare const getCreateAttendanceTapMutationKey: () => readonly ["createAttendanceTap"];
export declare const getCreateAttendanceTapMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAttendanceTap>>, TError, CreateAttendanceTapMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAttendanceTap>>, TError, CreateAttendanceTapMutationVariables, TContext>;
export type CreateAttendanceTapMutationResult = NonNullable<Awaited<ReturnType<typeof createAttendanceTap>>>;
export type CreateAttendanceTapMutationBody = BodyType<AttendanceTapInput>;
export type CreateAttendanceTapMutationError = ErrorType<ErrorResponse>;
export type CreateAttendanceTapMutationVariables = {
    data: BodyType<AttendanceTapInput>;
};
/**
* @summary Receive an RFID tap
*/
export declare const useCreateAttendanceTap: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAttendanceTap>>, TError, CreateAttendanceTapMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAttendanceTap>>, TError, CreateAttendanceTapMutationVariables, TContext>;
export declare const getGetStudentLocationStatusUrl: () => string;
/**
 * Requires a student account. Sharing is active after checkout until check-in the next day, and only while the student page remains open.
 * @summary Get the current student's location-sharing status
 */
export declare const getStudentLocationStatus: (options?: Parameters<typeof customFetch>[1]) => Promise<StudentLocationStatus>;
export declare const getGetStudentLocationStatusQueryKey: () => readonly ["/api/attendance/location/status"];
export declare const getGetStudentLocationStatusQueryOptions: <TData = Awaited<ReturnType<typeof getStudentLocationStatus>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStudentLocationStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStudentLocationStatus>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStudentLocationStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getStudentLocationStatus>>>;
export type GetStudentLocationStatusQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get the current student's location-sharing status
 */
export declare function useGetStudentLocationStatus<TData = Awaited<ReturnType<typeof getStudentLocationStatus>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStudentLocationStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateStudentLocationPingUrl: () => string;
/**
 * Requires a student account with an active checkout. The server derives the student and timestamp from the session and server clock.
 * @summary Save the signed-in student's GPS location
 */
export declare const createStudentLocationPing: (locationPingInput: LocationPingInput, options?: Parameters<typeof customFetch>[1]) => Promise<LocationPing>;
export declare const getCreateStudentLocationPingMutationKey: () => readonly ["createStudentLocationPing"];
export declare const getCreateStudentLocationPingMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStudentLocationPing>>, TError, CreateStudentLocationPingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createStudentLocationPing>>, TError, CreateStudentLocationPingMutationVariables, TContext>;
export type CreateStudentLocationPingMutationResult = NonNullable<Awaited<ReturnType<typeof createStudentLocationPing>>>;
export type CreateStudentLocationPingMutationBody = BodyType<LocationPingInput>;
export type CreateStudentLocationPingMutationError = ErrorType<ErrorResponse>;
export type CreateStudentLocationPingMutationVariables = {
    data: BodyType<LocationPingInput>;
};
/**
* @summary Save the signed-in student's GPS location
*/
export declare const useCreateStudentLocationPing: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStudentLocationPing>>, TError, CreateStudentLocationPingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createStudentLocationPing>>, TError, CreateStudentLocationPingMutationVariables, TContext>;
export declare const getListLatestStudentLocationsUrl: () => string;
/**
 * Parents receive only linked children; staff receive all students. The response includes each student's latest ping, not the ping history.
 * @summary List visible students' latest locations
 */
export declare const listLatestStudentLocations: (options?: Parameters<typeof customFetch>[1]) => Promise<StudentLatestLocation[]>;
export declare const getListLatestStudentLocationsQueryKey: () => readonly ["/api/attendance/location/latest"];
export declare const getListLatestStudentLocationsQueryOptions: <TData = Awaited<ReturnType<typeof listLatestStudentLocations>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLatestStudentLocations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLatestStudentLocations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLatestStudentLocationsQueryResult = NonNullable<Awaited<ReturnType<typeof listLatestStudentLocations>>>;
export type ListLatestStudentLocationsQueryError = ErrorType<ErrorResponse>;
/**
 * @summary List visible students' latest locations
 */
export declare function useListLatestStudentLocations<TData = Awaited<ReturnType<typeof listLatestStudentLocations>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLatestStudentLocations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateStudentHomeLocationUrl: (studentId: number) => string;
/**
 * Parent accounts can set home coordinates only for children linked through student_parents.
 * @summary Set a linked child's home coordinates
 */
export declare const updateStudentHomeLocation: (studentId: number, studentHomeLocationInput: StudentHomeLocationInput, options?: Parameters<typeof customFetch>[1]) => Promise<StudentHomeLocationResponse>;
export declare const getUpdateStudentHomeLocationMutationKey: () => readonly ["updateStudentHomeLocation"];
export declare const getUpdateStudentHomeLocationMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateStudentHomeLocation>>, TError, UpdateStudentHomeLocationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateStudentHomeLocation>>, TError, UpdateStudentHomeLocationMutationVariables, TContext>;
export type UpdateStudentHomeLocationMutationResult = NonNullable<Awaited<ReturnType<typeof updateStudentHomeLocation>>>;
export type UpdateStudentHomeLocationMutationBody = BodyType<StudentHomeLocationInput>;
export type UpdateStudentHomeLocationMutationError = ErrorType<ErrorResponse>;
export type UpdateStudentHomeLocationMutationVariables = {
    studentId: number;
    data: BodyType<StudentHomeLocationInput>;
};
/**
* @summary Set a linked child's home coordinates
*/
export declare const useUpdateStudentHomeLocation: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateStudentHomeLocation>>, TError, UpdateStudentHomeLocationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateStudentHomeLocation>>, TError, UpdateStudentHomeLocationMutationVariables, TContext>;
export declare const getCreateDailyQrTokenUrl: () => string;
/**
 * Creates a signed token that expires at the end of the current school date
 * @summary Create a daily QR token for a visible student
 */
export declare const createDailyQrToken: (dailyQrTokenInput: DailyQrTokenInput, options?: Parameters<typeof customFetch>[1]) => Promise<DailyQrToken>;
export declare const getCreateDailyQrTokenMutationKey: () => readonly ["createDailyQrToken"];
export declare const getCreateDailyQrTokenMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDailyQrToken>>, TError, CreateDailyQrTokenMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createDailyQrToken>>, TError, CreateDailyQrTokenMutationVariables, TContext>;
export type CreateDailyQrTokenMutationResult = NonNullable<Awaited<ReturnType<typeof createDailyQrToken>>>;
export type CreateDailyQrTokenMutationBody = BodyType<DailyQrTokenInput>;
export type CreateDailyQrTokenMutationError = ErrorType<ErrorResponse>;
export type CreateDailyQrTokenMutationVariables = {
    data: BodyType<DailyQrTokenInput>;
};
/**
* @summary Create a daily QR token for a visible student
*/
export declare const useCreateDailyQrToken: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDailyQrToken>>, TError, CreateDailyQrTokenMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createDailyQrToken>>, TError, CreateDailyQrTokenMutationVariables, TContext>;
export declare const getVerifyDailyQrTokenUrl: () => string;
/**
 * Scanner endpoint protected by the DEVICE_API_KEY header
 * @summary Verify a daily QR token and record an attendance event
 */
export declare const verifyDailyQrToken: (verifyDailyQrTokenInput: VerifyDailyQrTokenInput, options?: Parameters<typeof customFetch>[1]) => Promise<AttendanceEvent>;
export declare const getVerifyDailyQrTokenMutationKey: () => readonly ["verifyDailyQrToken"];
export declare const getVerifyDailyQrTokenMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyDailyQrToken>>, TError, VerifyDailyQrTokenMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof verifyDailyQrToken>>, TError, VerifyDailyQrTokenMutationVariables, TContext>;
export type VerifyDailyQrTokenMutationResult = NonNullable<Awaited<ReturnType<typeof verifyDailyQrToken>>>;
export type VerifyDailyQrTokenMutationBody = BodyType<VerifyDailyQrTokenInput>;
export type VerifyDailyQrTokenMutationError = ErrorType<ErrorResponse>;
export type VerifyDailyQrTokenMutationVariables = {
    data: BodyType<VerifyDailyQrTokenInput>;
};
/**
* @summary Verify a daily QR token and record an attendance event
*/
export declare const useVerifyDailyQrToken: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyDailyQrToken>>, TError, VerifyDailyQrTokenMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof verifyDailyQrToken>>, TError, VerifyDailyQrTokenMutationVariables, TContext>;
export declare const getVerifyDailyQrTokenAsStaffUrl: () => string;
/**
 * Requires a signed-in school staff account; records the same attendance event as the device scanner endpoint
 * @summary Verify a daily QR token from the staff scanner
 */
export declare const verifyDailyQrTokenAsStaff: (verifyDailyQrTokenInput: VerifyDailyQrTokenInput, options?: Parameters<typeof customFetch>[1]) => Promise<AttendanceEvent>;
export declare const getVerifyDailyQrTokenAsStaffMutationKey: () => readonly ["verifyDailyQrTokenAsStaff"];
export declare const getVerifyDailyQrTokenAsStaffMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyDailyQrTokenAsStaff>>, TError, VerifyDailyQrTokenAsStaffMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof verifyDailyQrTokenAsStaff>>, TError, VerifyDailyQrTokenAsStaffMutationVariables, TContext>;
export type VerifyDailyQrTokenAsStaffMutationResult = NonNullable<Awaited<ReturnType<typeof verifyDailyQrTokenAsStaff>>>;
export type VerifyDailyQrTokenAsStaffMutationBody = BodyType<VerifyDailyQrTokenInput>;
export type VerifyDailyQrTokenAsStaffMutationError = ErrorType<ErrorResponse>;
export type VerifyDailyQrTokenAsStaffMutationVariables = {
    data: BodyType<VerifyDailyQrTokenInput>;
};
/**
* @summary Verify a daily QR token from the staff scanner
*/
export declare const useVerifyDailyQrTokenAsStaff: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyDailyQrTokenAsStaff>>, TError, VerifyDailyQrTokenAsStaffMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof verifyDailyQrTokenAsStaff>>, TError, VerifyDailyQrTokenAsStaffMutationVariables, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map