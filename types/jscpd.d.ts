declare module "@jscpd/core" {
	import type EventEmitter from "eventemitter3";

	export interface IClonePosition {
		line: number;
		column: number;
		position?: number;
	}

	export interface ITokenLocation {
		line: number;
		column?: number;
		position?: number;
	}

	export interface IToken {
		type?: string;
		value?: string;
		length?: number;
		format?: string;
		range: [number, number];
		loc?: {
			start: ITokenLocation;
			end: ITokenLocation;
		};
		line?: number;
		column?: number;
		position?: number;
	}

	export interface IDuplication {
		format?: string;
		sourceId: string;
		start: IClonePosition;
		end: IClonePosition;
		range?: [number, number];
		fragment?: string;
	}

	export interface IClone {
		format: string;
		duplicationA: IDuplication;
		duplicationB: IDuplication;
		isNew?: boolean;
		foundDate?: number;
	}

	export interface IMapFrame {
		id: string;
		sourceId: string;
		start: IToken;
		end: IToken;
		localStart?: IClonePosition;
		localEnd?: IClonePosition;
	}

	export interface IOptions {
		minLines?: number;
		maxLines?: number;
		minTokens?: number;
		maxSize?: string;
		mode?: unknown;
		formatsExts?: Record<string, string[]>;
		[key: string]: unknown;
	}

	export interface IStore<T = IMapFrame> {
		namespace(ns: string): void;
		get(key: string): Promise<T>;
		set(key: string, value: T): Promise<T>;
		close(): void;
	}

	export class MemoryStore<T = IMapFrame> implements IStore<T> {
		protected _namespace: string;
		values: Record<string, Record<string, T>>;
		namespace(namespace: string): void;
		get(key: string): Promise<T>;
		set(key: string, value: T): Promise<T>;
		close(): void;
	}

	export interface ITokenMap {
		getFormat(): string;
		getId(): string;
		getLinesCount(): number;
		getTokensCount(): number;
		next(): IteratorResult<IMapFrame | boolean>;
	}

	export interface ITokenizer {
		generateMaps(
			id: string,
			text: string,
			format: string,
			options: IOptions,
		): ITokenMap[];
	}

	export class Detector extends EventEmitter {
		constructor(
			tokenizer: ITokenizer,
			store: IStore<IMapFrame>,
			cloneValidators?: unknown[],
			options?: IOptions,
		);
		detect(id: string, text: string, format: string): Promise<IClone[]>;
	}

	export class Statistic {
		getStatistic(): unknown;
	}

	export function getDefaultOptions(): IOptions;
	export function getModeByName(name: string): unknown;
	export function getModeHandler(mode: unknown): unknown;
	export function getOption(name: string, options?: IOptions): unknown;
	export function mild(token: unknown): boolean;
	export function strict(token: unknown): boolean;
	export function weak(token: unknown): boolean;
}

declare module "@jscpd/tokenizer" {
	import type { IOptions, ITokenizer, ITokenMap } from "@jscpd/core";

	export class Tokenizer implements ITokenizer {
		generateMaps(
			id: string,
			text: string,
			format: string,
			options: IOptions,
		): ITokenMap[];
	}

	export function getFormatByFile(
		filePath: string,
		formatsExts?: Record<string, string[]>,
	): string | undefined;
}
