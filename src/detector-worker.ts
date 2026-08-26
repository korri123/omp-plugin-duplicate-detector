/**
 * Worker thread entry point for duplicate detection.
 * Runs in Bun.Worker, managing background baseline indexing and answering RPC requests
 * from the main thread via SourceAwareCloneIndex.
 */

import * as crypto from "node:crypto";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IClone } from "@jscpd/core";
import { cleanupLegacyCacheFiles, DiskCacheManager } from "./disk-cache";
import {
	type BaselineStatus,
	createIgnoreFilter,
	execGit,
	getSupportedCodeFormat,
	getTrackedGitFiles,
	isGeneratedContent,
	isInsideGitWorkTree,
	MAX_FILE_SIZE_BYTES,
	MAX_GIT_PATHS,
	MAX_INDEXED_FILES,
	MAX_TOTAL_SOURCE_BYTES,
} from "./jscpd-engine";
import { canonicalizePath, resolveRepositoryContext } from "./repo-context";
import {
	type SerializedSourceShard,
	SourceAwareCloneIndex,
} from "./source-aware-index";
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
let currentRootDir = "";
let currentOptions: WorkspaceOptions | undefined;
let activeAbortController: AbortController | null = null;
let isBaselineIndexing = false;
let isBaselineComplete = false;
const watchedRevisions = new Map<
	string,
	{ revision: number; lastKnownCloneCount: number }
>();

const BATCH_SIZE = 32;

function areOptionsEqual(a?: WorkspaceOptions, b?: WorkspaceOptions): boolean {
	if (a === b) return true;
	if (!a && !b) return true;
	if (!a || !b) return false;
	if (a.minTokens !== b.minTokens) return false;
	if (a.minLines !== b.minLines) return false;
	if (a.maxLines !== b.maxLines) return false;
	if (a.maxIndexedFiles !== b.maxIndexedFiles) return false;
	if (a.ignoreTests !== b.ignoreTests) return false;
	const aCustom = (a.customTestPatterns ?? []).slice().sort().join(",");
	const bCustom = (b.customTestPatterns ?? []).slice().sort().join(",");
	if (aCustom !== bCustom) return false;
	const aExclude = (a.excludeTestPatterns ?? []).slice().sort().join(",");
	const bExclude = (b.excludeTestPatterns ?? []).slice().sort().join(",");
	if (aExclude !== bExclude) return false;
	const aIgnores = (a.ignorePatterns ?? []).slice().sort().join(",");
	const bIgnores = (b.ignorePatterns ?? []).slice().sort().join(",");
	if (aIgnores !== bIgnores) return false;
	if (a.cacheDir !== b.cacheDir) return false;
	if (a.maxCacheBytes !== b.maxCacheBytes) return false;
	const aFormats = a.formatsExts ? JSON.stringify(a.formatsExts) : "";
	const bFormats = b.formatsExts ? JSON.stringify(b.formatsExts) : "";
	return aFormats === bFormats;
}
/**
 * Verifies that source files involved in detected clones exist on disk.
 * If an indexed repository source has been deleted or moved, it is evicted from currentIndex,
 * disk cache, and watchedRevisions, and the stale clone is filtered out.
 *
 * activeFilePath: the file currently being queried or updated in memory (exempt from disk check).
 */
function filterAndEvictStaleClones(
	clones: IClone[],
	activeFilePath?: string,
): IClone[] {
	if (!currentRootDir || !fsSync.existsSync(currentRootDir)) {
		return clones;
	}

	const validClones: IClone[] = [];
	const evictedSources = new Set<string>();
	const activeRes = activeFilePath ? path.resolve(activeFilePath) : null;
	const activeCan = activeFilePath ? canonicalizePath(activeFilePath) : null;

	const isActive = (src: string): boolean => {
		if (!activeFilePath) return false;
		if (src === activeFilePath) return true;
		if (activeRes && path.resolve(src) === activeRes) return true;
		if (activeCan && canonicalizePath(src) === activeCan) return true;
		return false;
	};

	const isStaleSource = (src: string): boolean => {
		if (isActive(src)) return false;
		if (evictedSources.has(src)) return true;

		const can = canonicalizePath(
			path.isAbsolute(src) ? src : path.resolve(currentRootDir, src),
		);
		const rel = path.relative(currentRootDir, can);
		const isInside = !rel.startsWith("..") && !path.isAbsolute(rel);
		if (isInside && !fsSync.existsSync(can)) {
			evictedSources.add(src);
			currentIndex.removeSource(src);
			watchedRevisions.delete(src);
			watchedRevisions.delete(can);
			watchedRevisions.delete(path.resolve(src));
			if (currentDiskCache) {
				currentDiskCache.deleteByRelPath(rel).catch(() => {});
			}
			return true;
		}
		return false;
	};

	for (const clone of clones) {
		const srcA = clone.duplicationA.sourceId;
		const srcB = clone.duplicationB.sourceId;

		if (isStaleSource(srcA) || isStaleSource(srcB)) {
			continue;
		}

		validClones.push(clone);
	}

	return validClones;
}
function notifyLateFindings(clones: IClone[]): void {
	for (const clone of clones) {
		const srcA = clone.duplicationA.sourceId;
		const srcB = clone.duplicationB.sourceId;
		const resA = path.resolve(srcA);
		const resB = path.resolve(srcB);
		const canA = canonicalizePath(srcA);
		const canB = canonicalizePath(srcB);
		const isWatchedA =
			watchedRevisions.has(srcA) ||
			watchedRevisions.has(resA) ||
			watchedRevisions.has(canA);
		const isWatchedB =
			watchedRevisions.has(srcB) ||
			watchedRevisions.has(resB) ||
			watchedRevisions.has(canB);

		if (isWatchedA || isWatchedB) {
			if (isWatchedA) {
				const entry =
					watchedRevisions.get(srcA) ??
					watchedRevisions.get(resA) ??
					watchedRevisions.get(canA);
				if (entry) entry.lastKnownCloneCount++;
			}
			if (isWatchedB) {
				const entry =
					watchedRevisions.get(srcB) ??
					watchedRevisions.get(resB) ??
					watchedRevisions.get(canB);
				if (entry) entry.lastKnownCloneCount++;
			}
			self.postMessage(createLateFindingEvent(clone));
		}
	}
}

function cacheSourceShard(filePath: string, content: string): void {
	if (!currentDiskCache) return;
	const contentHash = crypto.createHash("sha256").update(content).digest("hex");
	const relPath = path.relative(currentRootDir, filePath).replace(/\\/g, "/");
	const shard = currentIndex.exportSourceShard(filePath, contentHash);
	if (shard) {
		currentDiskCache.saveShard(shard, relPath).catch(() => {});
	}
}

// ============================================================================
// Baseline Indexing Worker Task
// ============================================================================

function yieldTask(): Promise<void> {
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, 0);
	return promise;
}

interface BatchItem {
	filePath: string;
	content: string | null;
	contentHash: string | null;
	relPath: string | null;
	size: number;
	cachedShard: SerializedSourceShard | null;
	isNewlyTokenized: boolean;
	alreadyIndexed: boolean;
}

async function runBaselineIndexing(
	rootDir: string,
	options: WorkspaceOptions | undefined,
	signal: AbortSignal,
): Promise<{ indexedCount: number; status: BaselineStatus }> {
	const startTime = Date.now();
	let indexedCount = 0;
	let cachedCount = 0;
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
					cachedCount: 0,
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

		const maxIndexedFiles = options?.maxIndexedFiles ?? MAX_INDEXED_FILES;
		const trackedFiles = await getTrackedGitFiles(rootDir, {
			userIgnorePatterns: options?.ignorePatterns,
			ignoreTests: options?.ignoreTests,
			customTestPatterns: options?.customTestPatterns,
			excludeTestPatterns: options?.excludeTestPatterns,
			signal,
			maxPaths: Math.max(MAX_GIT_PATHS, maxIndexedFiles),
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

		for (let i = 0; i < trackedFiles.length; i += BATCH_SIZE) {
			if (signal.aborted) return { indexedCount, status: "cancelled" };

			if (indexedCount >= maxIndexedFiles) {
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

			const batch = trackedFiles.slice(i, i + BATCH_SIZE);

			// Process file batch I/O and cache lookups concurrently
			const fileItems = await Promise.all(
				batch.map(async (filePath): Promise<BatchItem | null> => {
					if (signal.aborted) return null;

					// Early skip if file format is unsupported by code duplicate detector
					if (!getSupportedCodeFormat(filePath, options?.formatsExts)) {
						return null;
					}

					try {
						const stat = await fs.stat(filePath);
						if (stat.size > MAX_FILE_SIZE_BYTES || stat.size <= 0) {
							return null;
						}

						const resolved = path.resolve(filePath);
						if (
							currentIndex.hasSource(filePath) ||
							currentIndex.hasSource(resolved)
						) {
							return {
								filePath,
								content: null,
								contentHash: null,
								relPath: null,
								size: stat.size,
								cachedShard: null,
								isNewlyTokenized: false,
								alreadyIndexed: true,
							};
						}

						const content = await fs.readFile(filePath, "utf8");
						if (signal.aborted || isGeneratedContent(content)) {
							return null;
						}

						const contentHash = crypto
							.createHash("sha256")
							.update(content)
							.digest("hex");
						const relPath = path
							.relative(rootDir, filePath)
							.replace(/\\/g, "/");

						const cachedShard = currentDiskCache
							? await currentDiskCache.getShard(relPath, contentHash)
							: null;

						let isNewlyTokenized = false;
						let shard = cachedShard;
						if (!shard) {
							shard = currentIndex.tokenizeSource(
								filePath,
								content,
								contentHash,
							);
							isNewlyTokenized = true;
						}

						return {
							filePath,
							content: shard ? null : content,
							contentHash,
							relPath,
							size: stat.size,
							cachedShard: shard,
							isNewlyTokenized,
							alreadyIndexed: false,
						};
					} catch {
						return null;
					}
				}),
			);

			if (signal.aborted) return { indexedCount, status: "cancelled" };

			// Ingest items into index and notify late findings
			const shardsToSave: Array<{
				shard: SerializedSourceShard;
				relPath: string;
			}> = [];
			for (const item of fileItems) {
				if (!item) continue;

				if (item.alreadyIndexed) {
					indexedCount++;
					totalSourceBytes += item.size;
					continue;
				}

				let newClones: IClone[] = [];

				if (item.cachedShard) {
					item.cachedShard.sourceId = item.filePath;
					newClones = currentIndex.hydrateSourceShard(item.cachedShard);
					if (item.isNewlyTokenized) {
						if (currentDiskCache && item.contentHash && item.relPath) {
							shardsToSave.push({
								shard: item.cachedShard,
								relPath: item.relPath,
							});
						}
					} else {
						cachedCount++;
					}
				} else if (item.content) {
					newClones = currentIndex.addSource(item.filePath, item.content);
					if (currentDiskCache && item.contentHash && item.relPath) {
						const shard = currentIndex.exportSourceShard(
							item.filePath,
							item.contentHash,
						);
						if (shard) {
							shardsToSave.push({ shard, relPath: item.relPath });
						}
					}
				}
				indexedCount++;
				totalSourceBytes += item.size;

				if (newClones.length > 0) {
					notifyLateFindings(newClones);
				}
			}

			if (shardsToSave.length > 0 && currentDiskCache) {
				await currentDiskCache.saveShards(shardsToSave);
			}

			const processedCount = Math.min(i + batch.length, totalFiles);
			const percentage =
				totalFiles > 0 ? Math.round((processedCount / totalFiles) * 100) : 100;
			self.postMessage(
				createProgressEvent({
					phase: "indexing",
					indexedCount,
					totalFiles,
					currentFile: batch[batch.length - 1],
					percentage,
				}),
			);

			// Yield macrotask once per batch to process pending RPC requests
			await yieldTask();
		}

		if (!signal.aborted) {
			isBaselineIndexing = false;
			isBaselineComplete = true;
			currentDiskCache?.prune().catch(() => {});
			self.postMessage(
				createCompleteEvent({
					indexedCount,
					cachedCount,
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
				cachedCount,
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
		const ignoreFilter = createIgnoreFilter(options?.ignorePatterns, {
			ignoreTests: options?.ignoreTests,
			customTestPatterns: options?.customTestPatterns,
			excludeTestPatterns: options?.excludeTestPatterns,
		});
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
					if (!getSupportedCodeFormat(fullPath, options?.formatsExts)) {
						currentIndex.removeSource(fullPath);
						continue;
					}
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
					cacheSourceShard(fullPath, content);
					if (newClones.length > 0) {
						notifyLateFindings(newClones);
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
			const canonicalRootDir = canonicalizePath(rootDir);

			// If canonicalRootDir === currentRootDir and options match and baseline is already complete or indexing,
			// avoid total reset; trigger an incremental git status check instead.
			if (
				(currentRootDir === canonicalRootDir || currentRootDir === rootDir) &&
				areOptionsEqual(currentOptions, options) &&
				(isBaselineComplete || isBaselineIndexing)
			) {
				if (isBaselineComplete) {
					if (activeAbortController) {
						activeAbortController.abort();
					}
					activeAbortController = new AbortController();
					const recResult = await runIncrementalGitReconciliation(
						currentRootDir,
						options,
						activeAbortController.signal,
					);
					self.postMessage(
						createSuccessResponse(msg.id, {
							started: true,
							rootDir: currentRootDir,
							reused: true,
							indexedCount: recResult.indexedCount,
							status: recResult.status,
						}),
					);
				} else {
					self.postMessage(
						createSuccessResponse(msg.id, {
							started: true,
							rootDir: currentRootDir,
							reused: true,
							indexedCount: currentIndex.stats().sourceCount,
							status: "complete" as BaselineStatus,
						}),
					);
				}
				break;
			}

			// Abort any ongoing indexing and close previous workspace cache
			if (activeAbortController) {
				activeAbortController.abort();
			}
			activeAbortController = new AbortController();
			if (currentDiskCache) {
				currentDiskCache.close();
				currentDiskCache = null;
			}

			const repoContext = await resolveRepositoryContext(
				rootDir,
				activeAbortController.signal,
			);
			const effectiveRoot = repoContext.workspaceRoot;
			currentRootDir = effectiveRoot;
			currentOptions = options;
			currentIndex = new SourceAwareCloneIndex(options);
			currentDiskCache = new DiskCacheManager({
				rootDir: effectiveRoot,
				repositoryKey: repoContext.repositoryKey,
				cacheDir: options?.cacheDir,
				config: options,
				maxBytes: options?.maxCacheBytes,
			});
			watchedRevisions.clear();
			isBaselineIndexing = true;
			isBaselineComplete = false;

			// Clean up legacy pre-v4 caches in background
			cleanupLegacyCacheFiles(options?.cacheDir).catch(() => {});

			self.postMessage(
				createSuccessResponse(msg.id, {
					started: true,
					rootDir: effectiveRoot,
					reused: false,
				}),
			);

			// Run background indexing task (posts complete event when finished)
			runBaselineIndexing(
				effectiveRoot,
				options,
				activeAbortController.signal,
			).catch(() => {});
			break;
		}

		case "checkSnippet": {
			const { filePath, content, format } = msg.payload;
			const rawClones = currentIndex.checkSnippet(filePath, content, format);
			const clones = filterAndEvictStaleClones(rawClones, filePath);
			self.postMessage(createSuccessResponse(msg.id, clones));
			break;
		}

		case "checkAndUpdate": {
			const { filePath, content, format, revision = 1 } = msg.payload;
			const rawClones = currentIndex.updateSource(filePath, content, format);
			const canonicalFilePath = canonicalizePath(filePath);
			const resolvedPath = path.resolve(filePath);

			cacheSourceShard(filePath, content);

			const clones = filterAndEvictStaleClones(rawClones, filePath);

			const fileClones = clones.filter(
				(c) =>
					c.duplicationA.sourceId === filePath ||
					c.duplicationB.sourceId === filePath ||
					path.resolve(c.duplicationA.sourceId) === resolvedPath ||
					path.resolve(c.duplicationB.sourceId) === resolvedPath ||
					canonicalizePath(c.duplicationA.sourceId) === canonicalFilePath ||
					canonicalizePath(c.duplicationB.sourceId) === canonicalFilePath,
			);

			const watchEntry = {
				revision,
				lastKnownCloneCount: fileClones.length,
			};
			watchedRevisions.set(filePath, watchEntry);
			watchedRevisions.set(resolvedPath, watchEntry);
			watchedRevisions.set(canonicalFilePath, watchEntry);

			self.postMessage(
				createSuccessResponse(msg.id, {
					clones: fileClones,
					isComplete: isBaselineComplete,
				}),
			);
			break;
		}

		case "updateFile": {
			const { filePath, content, format } = msg.payload;
			const rawClones = currentIndex.updateSource(filePath, content, format);
			cacheSourceShard(filePath, content);
			const clones = filterAndEvictStaleClones(rawClones, filePath);
			self.postMessage(createSuccessResponse(msg.id, { clones }));
			break;
		}

		case "removeFile": {
			const { filePath } = msg.payload;
			currentIndex.removeSource(filePath);
			if (currentDiskCache) {
				const relPath =
					path.isAbsolute(filePath) && currentRootDir
						? path.relative(currentRootDir, filePath)
						: filePath;
				currentDiskCache.deleteByRelPath(relPath).catch(() => {});
			}
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
						cacheSourceShard(fileEntry.filePath, fileEntry.content);
						reconciledCount++;
					} else {
						if (
							!getSupportedCodeFormat(
								fileEntry.filePath,
								currentOptions?.formatsExts,
							)
						) {
							currentIndex.removeSource(fileEntry.filePath);
							if (currentDiskCache) {
								const relPath =
									path.isAbsolute(fileEntry.filePath) && currentRootDir
										? path.relative(currentRootDir, fileEntry.filePath)
										: fileEntry.filePath;
								currentDiskCache.deleteByRelPath(relPath).catch(() => {});
							}
							continue;
						}
						const stat = await fs.stat(fileEntry.filePath);
						if (stat.size <= MAX_FILE_SIZE_BYTES && stat.size > 0) {
							const content = await fs.readFile(fileEntry.filePath, "utf8");
							if (!isGeneratedContent(content)) {
								currentIndex.updateSource(fileEntry.filePath, content);
								cacheSourceShard(fileEntry.filePath, content);
								reconciledCount++;
							}
						}
					}
				} catch {
					// If file cannot be read or no longer exists, remove from index and disk cache
					currentIndex.removeSource(fileEntry.filePath);
					if (currentDiskCache) {
						const relPath =
							path.isAbsolute(fileEntry.filePath) && currentRootDir
								? path.relative(currentRootDir, fileEntry.filePath)
								: fileEntry.filePath;
						currentDiskCache.deleteByRelPath(relPath).catch(() => {});
					}
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
							ignoreTests: optionsToUse?.ignoreTests,
							customTestPatterns: optionsToUse?.customTestPatterns,
							excludeTestPatterns: optionsToUse?.excludeTestPatterns,
						});
						filesToScan.push(...gitFiles);
					}

					for (const file of filesToScan) {
						try {
							if (!getSupportedCodeFormat(file, optionsToUse?.formatsExts))
								continue;
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
				clones = filterAndEvictStaleClones(currentIndex.getClones());
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
			if (currentDiskCache) {
				currentDiskCache.close();
				currentDiskCache = null;
			}
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
