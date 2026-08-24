/**
 * Worker RPC Protocol definitions for Main <-> Worker communication.
 * Provides strictly-typed discriminated union messages, type guards, and helper constructors.
 */

import type { IClone } from "@jscpd/core";
import type { BaselineStatus } from "./jscpd-engine";

// ============================================================================
// Payload Interfaces
// ============================================================================

export interface WorkspaceOptions {
	minTokens?: number;
	minLines?: number;
	maxLines?: number;
	ignorePatterns?: string[];
	ignoreTests?: boolean;
	customTestPatterns?: string[];
	excludeTestPatterns?: string[];
	formatsExts?: Record<string, string[]>;
	crossFormats?: boolean;
	cacheDir?: string;
	maxCacheBytes?: number;
	maxIndexedFiles?: number;
}

export interface OpenWorkspacePayload {
	rootDir: string;
	options?: WorkspaceOptions;
}

export interface CheckSnippetPayload {
	filePath: string;
	content: string;
	format?: string;
}

export interface CheckAndUpdatePayload {
	filePath: string;
	content: string;
	revision?: number;
	format?: string;
}

export interface UpdateFilePayload {
	filePath: string;
	content: string;
	format?: string;
}

export interface RemoveFilePayload {
	filePath: string;
}

export interface ReconcileFileEntry {
	filePath: string;
	content?: string;
	mtime?: number;
}

export interface ReconcilePayload {
	files: ReconcileFileEntry[];
}

export interface ScanPayload {
	targetPath?: string;
	options?: WorkspaceOptions;
}

// ============================================================================
// Main to Worker Request Messages
// ============================================================================

interface OpenWorkspaceRequest {
	id: string;
	type: "openWorkspace";
	payload: OpenWorkspacePayload;
}

interface CheckSnippetRequest {
	id: string;
	type: "checkSnippet";
	payload: CheckSnippetPayload;
}

interface CheckAndUpdateRequest {
	id: string;
	type: "checkAndUpdate";
	payload: CheckAndUpdatePayload;
}

interface UpdateFileRequest {
	id: string;
	type: "updateFile";
	payload: UpdateFilePayload;
}

interface RemoveFileRequest {
	id: string;
	type: "removeFile";
	payload: RemoveFilePayload;
}

interface ReconcileRequest {
	id: string;
	type: "reconcile";
	payload: ReconcilePayload;
}

interface ScanRequest {
	id: string;
	type: "scan";
	payload?: ScanPayload;
}

interface CloseRequest {
	id: string;
	type: "close";
	payload?: Record<string, never>;
}

export type WorkerRequestMessage =
	| OpenWorkspaceRequest
	| CheckSnippetRequest
	| CheckAndUpdateRequest
	| UpdateFileRequest
	| RemoveFileRequest
	| ReconcileRequest
	| ScanRequest
	| CloseRequest;

// ============================================================================
// Worker to Main Response Messages
// ============================================================================

export interface WorkerSuccessResponse<T = unknown> {
	id: string;
	success: true;
	data: T;
}

export interface WorkerErrorResponse {
	id: string;
	success: false;
	error: string;
	stack?: string;
}

type WorkerResponse<T = unknown> =
	| WorkerSuccessResponse<T>
	| WorkerErrorResponse;

export type WorkerResponseMessage = WorkerResponse<unknown>;

// ============================================================================
// Worker to Main Event Notifications
// ============================================================================

type WorkerProgressPhase = "scanning" | "indexing" | "reconciling";

export interface WorkerProgressPayload {
	phase: WorkerProgressPhase;
	indexedCount: number;
	totalFiles?: number;
	currentFile?: string;
	percentage?: number;
}

export interface WorkerProgressEvent {
	type: "progress";
	payload: WorkerProgressPayload;
}

export interface WorkerCompletePayload {
	indexedCount: number;
	cachedCount?: number;
	totalSourceBytes: number;
	cloneCount: number;
	durationMs: number;
	status?: BaselineStatus;
	error?: string;
}

export interface WorkerCompleteEvent {
	type: "complete";
	payload: WorkerCompletePayload;
}

export interface WorkerLateFindingPayload {
	clone: IClone;
}

export interface WorkerLateFindingEvent {
	type: "lateFinding";
	payload: WorkerLateFindingPayload;
}

export type WorkerStatusCode =
	| "idle"
	| "indexing"
	| "ready"
	| "error"
	| "closed";

export interface WorkerStatusPayload {
	status: WorkerStatusCode;
	message?: string;
}

export interface WorkerStatusEvent {
	type: "status";
	payload: WorkerStatusPayload;
}

export type WorkerEventMessage =
	| WorkerProgressEvent
	| WorkerCompleteEvent
	| WorkerLateFindingEvent
	| WorkerStatusEvent;

// ============================================================================

// ============================================================================
// Type Guards
// ============================================================================

const REQUEST_TYPES: Record<string, true> = {
	openWorkspace: true,
	checkSnippet: true,
	checkAndUpdate: true,
	updateFile: true,
	removeFile: true,
	reconcile: true,
	scan: true,
	close: true,
};

const EVENT_TYPES: Record<string, true> = {
	progress: true,
	complete: true,
	lateFinding: true,
	status: true,
};

export function isWorkerRequest(msg: unknown): msg is WorkerRequestMessage {
	if (!msg || typeof msg !== "object") return false;
	const m = msg as Record<string, unknown>;
	return (
		typeof m.id === "string" &&
		typeof m.type === "string" &&
		Boolean(REQUEST_TYPES[m.type])
	);
}

export function isWorkerResponse(msg: unknown): msg is WorkerResponseMessage {
	if (!msg || typeof msg !== "object") return false;
	const m = msg as Record<string, unknown>;
	return typeof m.id === "string" && typeof m.success === "boolean";
}

export function isWorkerEvent(msg: unknown): msg is WorkerEventMessage {
	if (!msg || typeof msg !== "object") return false;
	const m = msg as Record<string, unknown>;
	return (
		!("id" in m) && typeof m.type === "string" && Boolean(EVENT_TYPES[m.type])
	);
}

// ============================================================================
// Helper Constructors
// ============================================================================

export function createSuccessResponse<T>(
	id: string,
	data: T,
): WorkerSuccessResponse<T> {
	return {
		id,
		success: true,
		data,
	};
}

export function createErrorResponse(
	id: string,
	error: string | Error,
): WorkerErrorResponse {
	return {
		id,
		success: false,
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	};
}

export function createProgressEvent(
	payload: WorkerProgressPayload,
): WorkerProgressEvent {
	return {
		type: "progress",
		payload,
	};
}

export function createCompleteEvent(
	payload: WorkerCompletePayload,
): WorkerCompleteEvent {
	return {
		type: "complete",
		payload,
	};
}

export function createLateFindingEvent(clone: IClone): WorkerLateFindingEvent {
	return {
		type: "lateFinding",
		payload: { clone },
	};
}

export function createStatusEvent(
	status: WorkerStatusCode,
	message?: string,
): WorkerStatusEvent {
	return {
		type: "status",
		payload: { status, message },
	};
}
