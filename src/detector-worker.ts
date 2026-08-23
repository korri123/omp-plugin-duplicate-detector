/**
 * Worker thread entry point for duplicate detection.
 * Runs in Bun.Worker, managing background baseline indexing and answering RPC requests
 * from the main thread via SourceAwareCloneIndex.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IClone } from "@jscpd/core";
import { DiskCacheManager } from "./disk-cache";
import {
	type BaselineStatus,
	createIgnoreFilter,
	execGit,
	getTrackedGitFiles,
	isGeneratedContent,
	isInsideGitWorkTree,
	MAX_FILE_SIZE_BYTES,
	MAX_INDEXED_FILES,
	MAX_TOTAL_SOURCE_BYTES,
} from "./jscpd-engine";
import { SourceAwareCloneIndex } from "./source-aware-index";
import {
	createCompleteEvent,
	createErrorResponse,
	createLateFindingEvent,
	createProgressEvent,
	createStatusEvent,
	createSuccessResponse,
	isWorkerRequest,
	type WorkerRequestMessage,
	type WorkspaceOptions,
} from "./worker-protocol";

// Type declaration for Worker global scope
declare const self: {
	onmessage: ((event: MessageEvent<unknown>) => void) | null;
	postMessage: (message: unknown) => void;
	close?: () => void;
};

// ============================================================================
// Worker State
// ============================================================================

let currentIndex: SourceAwareCloneIndex = new SourceAwareCloneIndex();
let currentDiskCache: DiskCacheManager | null = null;
let currentRootDir: string = "";
let currentOptions: WorkspaceOptions | undefined;
let activeAbortController: AbortController | null = null;
let isBaselineIndexing = false;
let isBaselineComplete = false;
const watchedRevisions = new Map<
	string,
	{ revision: number; lastKnownCloneCount: number }
>();
function areOptionsEqual(a?: WorkspaceOptions, b?: WorkspaceOptions): boolean {
	if (a === b) return true;
	if (!a && !b) return true;
	if (!a || !b) return false;
	if (a.minTokens !== b.minTokens) return false;
	if (a.minLines !== b.minLines) return false;
	if (a.maxLines !== b.maxLines) return false;
	const aIgnores = (a.ignorePatterns ?? []).slice().sort().join(",");
	const bIgnores = (b.ignorePatterns ?? []).slice().sort().join(",");
	if (aIgnores !== bIgnores) return false;
	if (a.cacheDir !== b.cacheDir) return false;
	if (a.maxCacheBytes !== b.maxCacheBytes) return false;
	const aFormats = a.formatsExts ? JSON.stringify(a.formatsExts) : "";
	const bFormats = b.formatsExts ? JSON.stringify(b.formatsExts) : "";
	return aFormats === bFormats;
}
// ============================================================================
// Baseline Indexing Worker Task
// ============================================================================

function yieldTask(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, 0);
	return promise;
}

async function runBaselineIndexing(
	rootDir: string,
	options: WorkspaceOptions | undefined,
	signal: AbortSignal,
): Promise<{ indexedCount: number; status: BaselineStatus }> {
	const startTime = Date.now();
	let indexedCount = 0;
	let totalSourceBytes = 0;

	try {
		const isGit = await isInsideGitWorkTree(rootDir, signal);
		if (signal.aborted) return { indexedCount: 0, status: "cancelled" };

		if (!isGit) {
			isBaselineIndexing = false;
			isBaselineComplete = true;
			self.postMessage(
				createStatusEvent("idle", "Workspace is not inside a Git repository"),
			);
			self.postMessage(
				createCompleteEvent({
					indexedCount: 0,
					totalSourceBytes: 0,
					cloneCount: 0,
					durationMs: Date.now() - startTime,
					status: "skipped_not_git",
				}),
			);
			return { indexedCount: 0, status: "skipped_not_git" };
		}

		self.postMessage(
			createStatusEvent("indexing", "Enumerating tracked Git files..."),
		);

		const trackedFiles = await getTrackedGitFiles(rootDir, {
			userIgnorePatterns: options?.ignorePatterns,
			signal,
		});

		if (signal.aborted) return { indexedCount: 0, status: "cancelled" };

		const totalFiles = trackedFiles.length;
		self.postMessage(
			createProgressEvent({
				phase: "indexing",
				indexedCount: 0,
				totalFiles,
				percentage: 0,
			}),
		);

		let baselineStatus:
			| "complete"
			| "capped_file_count"
			| "capped_source_bytes" = "complete";

		for (let i = 0; i < trackedFiles.length; i++) {
			if (signal.aborted) return { indexedCount, status: "cancelled" };

			if (indexedCount >= MAX_INDEXED_FILES) {
				baselineStatus = "capped_file_count";
				self.postMessage(
					createStatusEvent("ready", "Indexed file limit reached"),
				);
				break;
			}
			if (totalSourceBytes >= MAX_TOTAL_SOURCE_BYTES) {
				baselineStatus = "capped_source_bytes";
				self.postMessage(
					createStatusEvent("ready", "Source byte limit reached"),
				);
				break;
			}
			const filePath = trackedFiles[i]!;

			try {
				const stat = await fs.stat(filePath);
				if (stat.size > MAX_FILE_SIZE_BYTES || stat.size <= 0) {
					continue;
				}

				const content = await fs.readFile(filePath, "utf8");
				if (signal.aborted) return { indexedCount, status: "cancelled" };

				if (isGeneratedContent(content)) {
					continue;
				}

				const resolved = path.resolve(filePath);
				if (
					!currentIndex.hasSource(filePath) &&
					!currentIndex.hasSource(resolved)
				) {
					const contentHash = crypto
						.createHash("sha256")
						.update(content)
						.digest("hex");
					const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

					let newClones: IClone[] = [];
					const cachedShard = currentDiskCache
						? await currentDiskCache.getShard(relPath, contentHash)
						: null;

					if (cachedShard) {
						cachedShard.sourceId = filePath;
						newClones = currentIndex.hydrateSourceShard(cachedShard);
					} else {
						newClones = currentIndex.addSource(filePath, content);
						if (currentDiskCache) {
							const shard = currentIndex.exportSourceShard(
								filePath,
								contentHash,
							);
							if (shard) {
								currentDiskCache.saveShard(shard, relPath).catch(() => {});
							}
						}
					}

					indexedCount++;
					totalSourceBytes += stat.size;
					for (const clone of newClones) {
						const srcA = clone.duplicationA.sourceId;
						const srcB = clone.duplicationB.sourceId;
						const resA = path.resolve(srcA);
						const resB = path.resolve(srcB);

						const isWatchedA =
							watchedRevisions.has(srcA) || watchedRevisions.has(resA);
						const isWatchedB =
							watchedRevisions.has(srcB) || watchedRevisions.has(resB);

						if (isWatchedA || isWatchedB) {
							if (isWatchedA) {
								const entry =
									watchedRevisions.get(srcA) ?? watchedRevisions.get(resA);
								if (entry) entry.lastKnownCloneCount++;
							}
							if (isWatchedB) {
								const entry =
									watchedRevisions.get(srcB) ?? watchedRevisions.get(resB);
								if (entry) entry.lastKnownCloneCount++;
							}
							self.postMessage(createLateFindingEvent(clone));
						}
					}
				} else {
					indexedCount++;
					totalSourceBytes += stat.size;
				}
			} catch {
				// Non-fatal: ignore unreadable/deleted files during baseline scan
			}

			if (i % 2 === 0 || i === trackedFiles.length - 1) {
				const percentage =
					totalFiles > 0 ? Math.round(((i + 1) / totalFiles) * 100) : 100;
				self.postMessage(
					createProgressEvent({
						phase: "indexing",
						indexedCount,
						totalFiles,
						currentFile: filePath,
						percentage,
					}),
				);
			}

			// Yield macrotask every 1-2 files to process pending RPCs
			await yieldTask();
		}

		if (!signal.aborted) {
			isBaselineIndexing = false;
			isBaselineComplete = true;
			currentDiskCache?.prune().catch(() => {});
			self.postMessage(
				createCompleteEvent({
					indexedCount,
					totalSourceBytes,
					cloneCount: currentIndex.clones.length,
					durationMs: Date.now() - startTime,
					status: baselineStatus,
				}),
			);
			self.postMessage(
				createStatusEvent("ready", "Baseline indexing complete"),
			);
			return { indexedCount, status: baselineStatus };
		}
		return { indexedCount, status: "cancelled" };
	} catch (err) {
		if (signal.aborted) return { indexedCount, status: "cancelled" };
		isBaselineIndexing = false;
		isBaselineComplete = false;
		const error = err instanceof Error ? err.message : String(err);
		self.postMessage(createStatusEvent("error", error));
		self.postMessage(
			createCompleteEvent({
				indexedCount,
				totalSourceBytes,
				cloneCount: currentIndex.clones.length,
				durationMs: Date.now() - startTime,
				status: "failed",
				error,
			}),
		);
		return { indexedCount, status: "failed" };
	}
}

async function runIncrementalGitReconciliation(
	rootDir: string,
	options: WorkspaceOptions | undefined,
	signal: AbortSignal,
): Promise<{ indexedCount: number; status: BaselineStatus }> {
	try {
		const isGit = await isInsideGitWorkTree(rootDir, signal);
		if (!isGit || signal.aborted) {
			return {
				indexedCount: currentIndex.stats().sourceCount,
				status: !isGit ? "skipped_not_git" : "complete",
			};
		}
		const ignoreFilter = createIgnoreFilter(options?.ignorePatterns);

		const { stdout } = await execGit(
			["status", "--porcelain", "-z", "--", "."],
			rootDir,
			{ signal },
		);

		if (signal.aborted)
			return {
				indexedCount: currentIndex.stats().sourceCount,
				status: "cancelled",
			};

		const entries = stdout.split("\0");
		let i = 0;
		while (i < entries.length) {
			if (signal.aborted)
				return {
					indexedCount: currentIndex.stats().sourceCount,
					status: "cancelled",
				};
			const entry = entries[i];
			i++;
			if (!entry || entry.length < 4) continue;

			const statusCode = entry.slice(0, 2);
			const relPath = entry.slice(3).trim();
			if (!relPath) continue;

			if (statusCode.includes("R") && i < entries.length) {
				const oldRelPath = entries[i]?.trim();
				i++;
				if (oldRelPath) {
					const oldFullPath = path.resolve(rootDir, oldRelPath);
					currentIndex.removeSource(oldFullPath);
					currentIndex.removeSource(oldRelPath);
				}
			}

			const fullPath = path.resolve(rootDir, relPath);

			if (ignoreFilter(relPath)) {
				currentIndex.removeSource(fullPath);
				currentIndex.removeSource(relPath);
				continue;
			}

			if (statusCode.includes("D")) {
				currentIndex.removeSource(fullPath);
				currentIndex.removeSource(relPath);
			} else {
				try {
					const stat = await fs.stat(fullPath);
					if (stat.size > MAX_FILE_SIZE_BYTES || stat.size <= 0) {
						currentIndex.removeSource(fullPath);
						continue;
					}
					const content = await fs.readFile(fullPath, "utf8");
					if (signal.aborted)
						return {
							indexedCount: currentIndex.stats().sourceCount,
							status: "cancelled",
						};

					if (isGeneratedContent(content)) {
						currentIndex.removeSource(fullPath);
						continue;
					}

					const newClones = currentIndex.updateSource(fullPath, content);
					for (const clone of newClones) {
						const srcA = clone.duplicationA.sourceId;
						const srcB = clone.duplicationB.sourceId;
						const resA = path.resolve(srcA);
						const resB = path.resolve(srcB);

						const isWatchedA =
							watchedRevisions.has(srcA) || watchedRevisions.has(resA);
						const isWatchedB =
							watchedRevisions.has(srcB) || watchedRevisions.has(resB);

						if (isWatchedA || isWatchedB) {
							if (isWatchedA) {
								const entry =
									watchedRevisions.get(srcA) ?? watchedRevisions.get(resA);
								if (entry) entry.lastKnownCloneCount++;
							}
							if (isWatchedB) {
								const entry =
									watchedRevisions.get(srcB) ?? watchedRevisions.get(resB);
								if (entry) entry.lastKnownCloneCount++;
							}
							self.postMessage(createLateFindingEvent(clone));
						}
					}
				} catch {
					currentIndex.removeSource(fullPath);
				}
			}

			await yieldTask();
		}

		if (!signal.aborted) {
			self.postMessage(
				createCompleteEvent({
					indexedCount: currentIndex.stats().sourceCount,
					totalSourceBytes: 0,
					cloneCount: currentIndex.clones.length,
					durationMs: 0,
					status: "complete",
				}),
			);
		}
		return {
			indexedCount: currentIndex.stats().sourceCount,
			status: "complete",
		};
	} catch {
		// Non-fatal error during incremental reconciliation
		return {
			indexedCount: currentIndex.stats().sourceCount,
			status: "complete",
		};
	}
}

// ============================================================================
// Message Dispatcher
// ============================================================================

async function handleWorkerRequest(msg: WorkerRequestMessage): Promise<void> {
	switch (msg.type) {
		case "openWorkspace": {
			const { rootDir, options } = msg.payload;

			// If rootDir === currentRootDir and options match and baseline is already complete or indexing,
			// avoid total reset; trigger an incremental git status check instead.
			if (
				currentRootDir === rootDir &&
				areOptionsEqual(currentOptions, options) &&
				(isBaselineComplete || isBaselineIndexing)
			) {
				if (isBaselineComplete) {
					if (activeAbortController) {
						activeAbortController.abort();
					}
					activeAbortController = new AbortController();
					const recResult = await runIncrementalGitReconciliation(
						rootDir,
						options,
						activeAbortController.signal,
					);
					self.postMessage(
						createSuccessResponse(msg.id, {
							started: true,
							rootDir,
							reused: true,
							indexedCount: recResult.indexedCount,
							status: recResult.status,
						}),
					);
				} else {
					self.postMessage(
						createSuccessResponse(msg.id, {
							started: true,
							rootDir,
							reused: true,
							indexedCount: currentIndex.stats().sourceCount,
							status: "complete" as BaselineStatus,
						}),
					);
				}
				break;
			}

			// Abort any ongoing indexing from previous workspace
			if (activeAbortController) {
				activeAbortController.abort();
			}
			activeAbortController = new AbortController();

			currentRootDir = rootDir;
			currentOptions = options;
			currentIndex = new SourceAwareCloneIndex(options);
			currentDiskCache = new DiskCacheManager({
				rootDir,
				cacheDir: options?.cacheDir,
				config: options,
				maxBytes: options?.maxCacheBytes,
			});
			watchedRevisions.clear();
			isBaselineIndexing = true;
			isBaselineComplete = false;

			self.postMessage(
				createSuccessResponse(msg.id, {
					started: true,
					rootDir,
					reused: false,
				}),
			);

			// Run background indexing task (posts complete event when finished)
			runBaselineIndexing(rootDir, options, activeAbortController.signal).catch(
				() => {},
			);
			break;
		}

		case "checkSnippet": {
			const { filePath, content, format } = msg.payload;
			const clones = currentIndex.checkSnippet(filePath, content, format);
			self.postMessage(createSuccessResponse(msg.id, clones));
			break;
		}

		case "checkAndUpdate": {
			const { filePath, content, format, revision = 1 } = msg.payload;
			const clones = currentIndex.updateSource(filePath, content, format);
			const resolvedPath = path.resolve(filePath);

			const fileClones = clones.filter(
				(c) =>
					c.duplicationA.sourceId === filePath ||
					c.duplicationB.sourceId === filePath ||
					path.resolve(c.duplicationA.sourceId) === resolvedPath ||
					path.resolve(c.duplicationB.sourceId) === resolvedPath,
			);

			const watchEntry = {
				revision,
				lastKnownCloneCount: fileClones.length,
			};
			watchedRevisions.set(filePath, watchEntry);
			watchedRevisions.set(resolvedPath, watchEntry);

			self.postMessage(
				createSuccessResponse(msg.id, {
					clones,
					isComplete: isBaselineComplete,
				}),
			);
			break;
		}

		case "updateFile": {
			const { filePath, content, format } = msg.payload;
			const clones = currentIndex.updateSource(filePath, content, format);
			self.postMessage(createSuccessResponse(msg.id, { clones }));
			break;
		}

		case "removeFile": {
			const { filePath } = msg.payload;
			currentIndex.removeSource(filePath);
			self.postMessage(createSuccessResponse(msg.id, { removed: true }));
			break;
		}

		case "reconcile": {
			const { files } = msg.payload;
			let reconciledCount = 0;

			for (const fileEntry of files) {
				try {
					if (fileEntry.content !== undefined) {
						currentIndex.updateSource(fileEntry.filePath, fileEntry.content);
						reconciledCount++;
					} else {
						const stat = await fs.stat(fileEntry.filePath);
						if (stat.size <= MAX_FILE_SIZE_BYTES && stat.size > 0) {
							const content = await fs.readFile(fileEntry.filePath, "utf8");
							if (!isGeneratedContent(content)) {
								currentIndex.updateSource(fileEntry.filePath, content);
								reconciledCount++;
							}
						}
					}
				} catch {
					// If file cannot be read or no longer exists, remove from index
					currentIndex.removeSource(fileEntry.filePath);
				}
			}

			self.postMessage(createSuccessResponse(msg.id, { reconciledCount }));
			break;
		}

		case "scan": {
			const targetPath = msg.payload?.targetPath;
			const scanOptions = msg.payload?.options;
			let clones: IClone[] = [];

			if (scanOptions || (targetPath && targetPath !== currentRootDir)) {
				try {
					const pathToScan = targetPath || currentRootDir;
					const isGit = await isInsideGitWorkTree(pathToScan);
					const filesToScan: string[] = [];
					const optionsToUse = scanOptions || currentOptions;
					const indexToUse = new SourceAwareCloneIndex({
						minTokens: optionsToUse?.minTokens,
						minLines: optionsToUse?.minLines,
						maxLines: optionsToUse?.maxLines,
						formatsExts: optionsToUse?.formatsExts,
					});

					if (isGit) {
						const gitFiles = await getTrackedGitFiles(pathToScan, {
							userIgnorePatterns: optionsToUse?.ignorePatterns,
						});
						filesToScan.push(...gitFiles);
					}

					for (const file of filesToScan) {
						try {
							const stat = await fs.stat(file);
							if (stat.size <= MAX_FILE_SIZE_BYTES && stat.size > 0) {
								const content = await fs.readFile(file, "utf8");
								if (!isGeneratedContent(content)) {
									indexToUse.addSource(file, content);
								}
							}
						} catch {
							// Ignore individual file read errors
						}
					}

					clones = indexToUse.getClones();
				} catch {
					clones = currentIndex.getClones();
				}
			} else {
				clones = currentIndex.getClones();
			}

			self.postMessage(createSuccessResponse(msg.id, clones));
			break;
		}

		case "close": {
			if (activeAbortController) {
				activeAbortController.abort();
				activeAbortController = null;
			}
			currentIndex.reset();
			currentDiskCache = null;
			watchedRevisions.clear();
			isBaselineIndexing = false;
			isBaselineComplete = false;

			self.postMessage(createSuccessResponse(msg.id, { closed: true }));
			self.postMessage(createStatusEvent("closed"));
			break;
		}

		default: {
			const unknownMsg = msg as Record<string, unknown>;
			const reqId =
				typeof unknownMsg.id === "string" ? unknownMsg.id : "unknown";
			const reqType =
				typeof unknownMsg.type === "string" ? unknownMsg.type : "unknown";
			self.postMessage(
				createErrorResponse(reqId, `Unsupported request type: ${reqType}`),
			);
			break;
		}
	}
}

// ============================================================================
// Worker Listener
// ============================================================================

self.onmessage = async (event: MessageEvent<unknown>) => {
	const rawData = event.data;

	if (!isWorkerRequest(rawData)) {
		return;
	}

	try {
		await handleWorkerRequest(rawData);
	} catch (err) {
		self.postMessage(
			createErrorResponse(
				rawData.id,
				err instanceof Error ? err : new Error(String(err)),
			),
		);
	}
};
