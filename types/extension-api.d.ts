/**
 * Type declarations for `@oh-my-pi/pi-coding-agent` extension runtime.
 */

export interface AutocompleteItem {
	value: string;
	label: string;
	description?: string;
}

export interface ExtensionUIContext {
	notify(message: string, type?: "info" | "warning" | "error"): void;
	confirm(title: string, message: string): Promise<boolean>;
	input(title: string, placeholder?: string): Promise<string | undefined>;
	select(title: string, options: Array<string | { label: string; description?: string }>): Promise<string | undefined>;
	setStatus(key: string, text: string | undefined): void;
	setWorkingMessage(message?: string): void;
	setTitle(title: string): void;
}

export interface ExtensionContext {
	ui: ExtensionUIContext;
	hasUI: boolean;
	cwd: string;
	setInterval(fn: () => void | Promise<void>, ms: number): number;
	setTimeout(fn: () => void | Promise<void>, ms: number): number;
	clearTimer(timer: number): void;
	getContextUsage?(): { tokens?: number; cost?: number } | undefined;
	isIdle(): boolean;
	hasPendingMessages(): boolean;
	abort(): void;
}

export interface ExtensionCommandContext extends ExtensionContext {
	waitForIdle(): Promise<void>;
	newSession(opts?: { title?: string }): Promise<void>;
	switchSession(path: string): Promise<void>;
	branch(entryId: string): Promise<void>;
	reload(): Promise<void>;
	compact(opts?: unknown): Promise<void>;
}

export interface RegisteredCommand {
	name?: string;
	description?: string;
	getArgumentCompletions?: (argumentPrefix: string) => AutocompleteItem[] | null;
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

export interface ToolTextContent {
	type: "text";
	text: string;
}

export interface ToolImageContent {
	type: "image";
	data: string;
	mimeType: string;
}

export type ToolContentItem = ToolTextContent | ToolImageContent;

export interface AgentToolResult<TDetails = unknown> {
	content: ToolContentItem[];
	details?: TDetails;
	isError?: boolean;
}

export interface ToolResultEventResult {
	content?: ToolContentItem[];
	details?: unknown;
	isError?: boolean;
}

export type AgentToolUpdateCallback<TDetails = unknown> = (update: {
	content?: ToolContentItem[];
	details?: TDetails;
}) => void;

export interface ToolDefinition<TParams = unknown, TDetails = unknown> {
	name: string;
	label: string;
	description: string;
	parameters: TParams;
	hidden?: boolean;
	defaultInactive?: boolean;
	loadMode?: "essential" | "discoverable";
	approval?: "read" | "write" | "exec";
	strict?: boolean;
	execute(
		toolCallId: string,
		params: any,
		signal: AbortSignal | undefined,
		onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
		ctx: ExtensionContext,
	): Promise<AgentToolResult<TDetails>>;
}

export interface CustomMessagePayload<T = unknown> {
	customType: string;
	content: string;
	display?: boolean;
	attribution?: "user" | "assistant";
	data?: T;
}

export interface ExtensionLogger {
	debug(message: string, context?: Record<string, unknown>): void;
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
}

export interface ZodType<T = unknown> {
	describe(desc: string): ZodType<T>;
	optional(): ZodType<T | undefined>;
	default(val: T): ZodType<T>;
}

export interface ZodBuilder {
	object(shape: Record<string, ZodType<any>>): ZodType<Record<string, unknown>>;
	string(): ZodType<string>;
	number(): ZodType<number>;
	boolean(): ZodType<boolean>;
	array(item: ZodType<any>): ZodType<unknown[]>;
	enum(values: string[]): ZodType<string>;
}

export interface ExtensionAPI {
	logger: ExtensionLogger;
	zod: ZodBuilder;
	arktype: unknown;
	typebox: unknown;
	pi: unknown;
	setLabel(label: string): void;
	on(event: string, handler: (event: any, ctx: ExtensionContext) => Promise<any> | any): void;
	registerTool<TParams = unknown, TDetails = unknown>(tool: ToolDefinition<TParams, TDetails>): void;
	registerCommand(name: string, options: RegisteredCommand): void;
	registerShortcut(shortcut: string, options: { description?: string; handler: (ctx: ExtensionContext) => Promise<void> | void }): void;
	registerFlag(name: string, options: { description?: string; type: "boolean" | "string"; default?: boolean | string }): void;
	registerMessageRenderer<T = unknown>(
		customType: string,
		renderer: (message: CustomMessagePayload<T>, options: { expanded: boolean }, theme: any) => any,
	): void;
	sendMessage<T = unknown>(message: CustomMessagePayload<T>, options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" }): void;
	sendUserMessage(content: string, options?: { deliverAs?: "steer" | "followUp" }): void;
	appendEntry<T = unknown>(customType: string, data?: T): void;
	exec(command: string, args: string[], options?: unknown): Promise<{ exitCode: number; stdout: string; stderr: string }>;
	getActiveTools(): string[];
	setActiveTools(toolNames: string[]): Promise<void>;
	events: unknown;
}
