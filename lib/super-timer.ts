// Creates a type T with every prop in P being required.
export type RequiredProp<T, P extends keyof T> = T & { [K in P]-?: T[P] };

// Makes a single prop on T partial
export type PartialProp<T, k extends keyof T> = T[k] extends object
	? Partial<Omit<T, k>> & { [P in k]: Partial<T[k]> }
	: never;

// shim requestAnimationFrame and cancelAnimationFrame
let timerId = 1;
if (typeof globalThis.requestAnimationFrame === "undefined" || typeof globalThis.cancelAnimationFrame === "undefined") {
	// @ts-ignore
	globalThis.requestAnimationFrame = function (callback) {
		return setTimeout(() => callback(Date.now()), 16);
	};

	globalThis.cancelAnimationFrame = function (id) {
		clearTimeout(id);
	};
}

/**
 * A callback that can be registered to run on various timer events.
 *
 * @param timer The SuperTimer instance that triggered the callback
 */
export type TimerCallback<TTimerType> = (timer: TTimerType) => void;

export interface SuperTimerCallbackBase<TTimerType> {
	/**
	 * The type of callback to execute. Checkpoint callbacks run at
	 * a specific amount of elapsed time, while tick callbacks run
	 * repeatedly at a specified interval.
	 *
	 * "checkpoint" and "checkpoint-once" callbacks behave the same,
	 * but a "checkpoint-once" callback will be removed after it is
	 * executed. A "checkpoint" callback may run multiple times if
	 * the time is adjusted such that the checkpoint is passed again.
	 *
	 * "tick" and "tick-reset" are very similar. The difference is
	 * how they are handled when the timer is paused and then
	 * unpaused. After an unpause, callbacks using "tick-reset" will
	 * wait the full `valueMs` interval before the next execution of
	 * the callback. But "tick" on the other hand will always execute
	 * the callback after the `valueMs` interval of elapsed unpaused
	 * time passes.
	 *
	 * For example, if valueMs is 1000, and the timer is paused 400ms
	 * after the callback executes, when the timer is unpaused, the
	 * next execution of the callback will be after 600ms for "tick"
	 * and after 1000ms for "tick-reset".
	 */
	type: "checkpoint" | "checkpoint-once" | "tick" | "tick-reset";

	/**
	 * When or how often to run the callback. For "checkpoint"
	 * callbacks, this is the elapsed time at which to run the
	 * callback. For "tick" callbacks, this is the interval at
	 * which to run the callback.
	 */
	timeMs: number;

	/**
	 * Callback to execute on each tick
	 */
	callback: TimerCallback<TTimerType>;

	/**
	 * If true, the callback will be executed using the next
	 * animation frame available after the specified time.
	 *
	 * To schedule this callback on every animation frame,
	 * set valueMs to 0 and type to "tick".
	 *
	 * @default false
	 */
	requireAnimationFrame?: boolean;

	/**
	 * If true, the callback will be forcefully executed when
	 * any of these oevents occur:
	 * - Time is adjusted manually, via setTime or addTime
	 * - The timer is paused
	 * - The timer is unpaused
	 * - The timer's speed multiplier is changed
	 *
	 * @default false
	 */
	executeOnUpdate?: boolean;

	/**
	 * Optional name for this callback. Required if you want to
	 * later remove the callback. This name must be unique.
	 */
	name?: string;

	/**
	 * If true, each time the callback is executed, log to the
	 * timer history object.
	 *
	 * @default false
	 */
	logExecutions?: boolean;

	/**
	 * When a timer is paused and unpaused, the internal mechanisms that
	 * keep track of elapsed time can be off by a few milliseconds. This
	 * becomes obvious when "tick" callbacks are executed at a round
	 * interval, such as every second. Over time with several pauses and
	 * unpauses, these ticks will drift past the 1000-millisecond intervals
	 * of elapsed time.
	 *
	 * Because of this, there is a mechanism to compensate for this drift.
	 * When a timer is resumed, the interval will be forced to lock into
	 * the original schedule of ticks.
	 *
	 * The potential downside is that after a timer is unpaused, the first
	 * execution of a tick callback may run slightly (a few milliseconds)
	 * earlier than expected.
	 *
	 * To disable this compensation mechanism, set this value to true.
	 * This setting is only applicable to "tick" callbacks.
	 *
	 * @default false
	 */
	disableTickDriftCompensation?: boolean;
}

export type SuperTimerCallback = SuperTimerCallbackBase<SuperTimer>;

export type SuperCountdownCallback = SuperTimerCallbackBase<SuperCountdown>;

export type InternalCallback<TTimerType> = RequiredProp<
	SuperTimerCallbackBase<TTimerType>,
	"name" | "requireAnimationFrame"
> & {
	lastExecutionMs: number;
	registeredAt: number;
};

export interface TimerShims {
	setTimeout: typeof setTimeout;
	clearTimeout: typeof clearTimeout;
	setInterval: typeof setInterval;
	clearInterval: typeof clearInterval;
	requestAnimationFrame: typeof requestAnimationFrame;
	cancelAnimationFrame: typeof cancelAnimationFrame;
	performance: typeof performance;
	Date: typeof Date;
}

export interface SuperTimerOptionsInternal<TTimerType> {
	/**
	 * The name of the timer, used for logging/printing.
	 * If not provided, a default name will be used.
	 *
	 * @default `timer-${id}`
	 */
	name: string;

	/**
	 * A list of callbacks to execute at when the timer is running.
	 * Callbacks can either be set to execute once at a particular
	 * amount of elapsed time, or at a specified interval.
	 *
	 * @default []
	 */
	callbacks: SuperTimerCallbackBase<TTimerType>[];

	/**
	 * Adjust the "speed" of the timer. A value of 1 is "real
	 * time", a value of 2.0 means the timer will run twice
	 * as fast as real time, and a value of 0.5 means the
	 * timer will run at half the speed of real time.
	 *
	 * Mostly useful for testing and demonstration purposes.
	 *
	 * @default 1.0
	 */
	timerSpeedMultiplier: number;

	/**
	 * Override the implementations of some standard lib dependencies.
	 * May be useful for testing.
	 */
	shims: TimerShims;
}

/**
 * Types of events that can occur on a timer.
 *
 * "create" - The timer was created
 * "pause" - The timer was paused
 * "unpause" - The timer was unpaused
 * "start" - The timer was started
 * "checkpoint" - A checkpoint callback was executed
 * "tick" - A tick callback was executed
 * "setTime" - The timer's elapsed time was set
 * "addTime" - The timer's elapsed time was adjusted
 */
export type TimerEventType =
	| "create"
	| "pause"
	| "unpause"
	| "start"
	| "checkpoint"
	| "tick"
	| "setTime"
	| "addTime"
	| "reset"
	| "setSpeed";

export interface TimerEvent {
	/**
	 * The date/time at which the event occurred.
	 */
	date: Date;

	/**
	 * The number of milliseconds that have elapsed since the
	 * timer was started. This value will be adjusted for pauses
	 * and any time modifications made with setTime or addTime.
	 */
	elapsedMs: number;

	/**
	 * The type of event that occurred.
	 *
	 */
	event: TimerEventType;

	/**
	 * Additional data reported for this event. For example
	 * checkpoint and tick will report the name of the callback,
	 * setTime and addTime will report the associated value.
	 */
	data?: string | number | Record<string, string | number>;
}

export interface TimerHistory {
	/**
	 * A list of events that have occurred since the timer
	 * was created.
	 */
	events: TimerEvent[];
}

export interface TimerState {
	/**
	 * A unique identifier for this timer.
	 */
	timerId: number;

	/**
	 * The number of milliseconds that have elapsed since the
	 * timer was started. This value will be adjusted for pauses
	 * and any time modifications made with setTime or addTime.
	 */
	elapsedMs: number;

	/**
	 * Indicates whether or not the timer is pasued.
	 */
	isPaused: boolean;

	/**
	 * A full history of events that have occurred
	 * on this timer.
	 */
	history: TimerHistory;
}

export type SuperTimerOptionsBase<TTimerType> = Partial<PartialProp<SuperTimerOptionsInternal<TTimerType>, "shims">>;

export type SuperTimerOptions = SuperTimerOptionsBase<SuperTimer>;
export type SuperCountdownOptions = SuperTimerOptionsBase<SuperCountdown>;

const defaultOptions: Omit<SuperTimerOptionsInternal<any>, "name"> = {
	callbacks: [],
	timerSpeedMultiplier: 1.0,
	shims: {
		setTimeout: setTimeout.bind(globalThis),
		clearTimeout: clearTimeout.bind(globalThis),
		setInterval: setInterval.bind(globalThis),
		clearInterval: clearInterval.bind(globalThis),
		requestAnimationFrame: requestAnimationFrame.bind(globalThis),
		cancelAnimationFrame: cancelAnimationFrame.bind(globalThis),
		performance,
		Date,
	},
};

abstract class SuperTimerBase<TTimerType> {
	protected id: number;
	protected callbacks: InternalCallback<TTimerType>[] = [];
	protected history: TimerHistory = { events: [] };
	protected unpausedAt: DOMHighResTimeStamp | undefined;
	protected pausedAt: DOMHighResTimeStamp;
	protected elapsedMs: number = 0;
	protected timeouts: Map<string, number | NodeJS.Timeout> = new Map();
	protected intervals: Map<string, number | NodeJS.Timeout> = new Map();
	protected rafs: Map<string, number> = new Map();
	protected callbackIdSeeds: Record<string, number> = {};
	protected callbackNames: Record<string, Set<string>> = {};
	protected lib: TimerShims;
	protected disposed: boolean = false;
	protected speed: number;
	protected name: string;

	constructor(options: SuperTimerOptionsBase<TTimerType> = {}) {
		this.id = timerId++;
		const defaultedShims = { ...defaultOptions.shims, ...options.shims };
		const defaultedOptions: SuperTimerOptionsInternal<TTimerType> = {
			...defaultOptions,
			name: `timer-${this.id}`,
			...options,
			shims: defaultedShims,
		};
		this.registerCallbacks(defaultedOptions.callbacks);
		this.lib = defaultOptions.shims;
		this.pausedAt = this.lib.performance.now();
		this.speed = defaultedOptions.timerSpeedMultiplier || 1.0;
		this.name = defaultedOptions.name;
	}

	protected startCallbacks(callbacks: InternalCallback<TTimerType>[]) {
		if (!this.unpausedAt) {
			return;
		}

		for (const callback of callbacks) {
			switch (callback.type) {
				case "checkpoint":
				case "checkpoint-once":
					this.handleCheckpointCallback(callback);
					break;

				case "tick-reset":
					this.handleTickResetCallback(callback);
					break;

				case "tick":
					this.handleTickCallback(callback);
					break;
			}
		}
	}

	protected abstract executeCallback(callback: InternalCallback<TTimerType>): void;

	protected createEventAndInvokeCallback(
		callback: InternalCallback<TTimerType>,
		eventType: TimerEventType | undefined,
		sourceCallback?: InternalCallback<TTimerType>,
	) {
		const elapsedMs = this.getElapsedMs();
		if (eventType) {
			this.history.events.push({
				date: new this.lib.Date(),
				event: eventType,
				elapsedMs,
				data: callback.name,
			});
		}
		if (callback.requireAnimationFrame) {
			const rafId = this.lib.requestAnimationFrame(() => {
				(sourceCallback ?? callback).lastExecutionMs = elapsedMs;
				this.executeCallback(callback);
			});
			this.rafs.set(callback.name, rafId);
		} else {
			(sourceCallback ?? callback).lastExecutionMs = elapsedMs;
			this.executeCallback(callback);
		}
	}

	protected handleRafCallback(callback: InternalCallback<TTimerType>) {
		const elapsedMs = this.getElapsedMs();
		if (this.unpausedAt) {
			callback.lastExecutionMs = elapsedMs;
			this.history.events.push({
				date: new this.lib.Date(),
				event: "tick",
				elapsedMs,
				data: callback.name,
			});
			this.executeCallback(callback);
			const rafId = this.lib.requestAnimationFrame(() => {
				this.handleRafCallback(callback);
			});
			this.rafs.set(callback.name, rafId);
		}
	}

	protected handleCheckpointCallback(
		callback: InternalCallback<TTimerType>,
		eventType: TimerEventType = "checkpoint",
		sourceCallback?: InternalCallback<TTimerType>,
	) {
		const elapsedMs = this.getElapsedMs();
		const msUntilCheckpoint = (callback.timeMs - elapsedMs) / this.speed;
		if (msUntilCheckpoint <= 0) return;

		const timeout = this.lib.setTimeout(() => {
			if (callback.type === "checkpoint-once") {
				this.removeCallbacks([callback.name]);
			}
			this.createEventAndInvokeCallback(callback, eventType, sourceCallback);
		}, msUntilCheckpoint);
		this.timeouts.set(callback.name, timeout);
	}

	protected handleTickResetCallback(callback: InternalCallback<TTimerType>) {
		if (callback.timeMs === 0 && callback.requireAnimationFrame) {
			// Special case where the "interval" is the animation frames. We want to avoid
			// any overhead involved with setTimeout or setInterval, so we just do a basic
			// raf loop.
			const rafId = this.lib.requestAnimationFrame(() => {
				this.handleRafCallback(callback);
			});
			this.rafs.set(callback.name, rafId);
		} else {
			const interval = this.lib.setInterval(() => {
				this.createEventAndInvokeCallback(callback, "tick");
			}, callback.timeMs / this.speed);
			this.intervals.set(callback.name, interval);
		}
	}

	protected handleTickCallback(callback: InternalCallback<TTimerType>) {
		const elapsedMs = this.getElapsedMs();
		let nextExecutionTime = callback.lastExecutionMs + callback.timeMs;
		if (callback.disableTickDriftCompensation !== true) {
			const fullIntervals = Math.floor((elapsedMs - callback.registeredAt) / callback.timeMs);
			const idealNextExecutionTime = callback.registeredAt + (fullIntervals + 1) * callback.timeMs;
			if (nextExecutionTime - idealNextExecutionTime > 0) {
				nextExecutionTime = idealNextExecutionTime;
			}
		}

		if (nextExecutionTime > elapsedMs && nextExecutionTime < elapsedMs + callback.timeMs) {
			// If we have paused, the first execution will be a one-off, handled as a "checkpoint"
			// callback. After that, it becomes a regular tick callback.
			this.handleCheckpointCallback(
				{
					...callback,
					callback: (timer: TTimerType) => {
						this.handleTickResetCallback(callback);
						callback.callback(timer);
					},
					timeMs: nextExecutionTime,
				},
				"tick",
				callback,
			);
		} else {
			this.handleTickResetCallback(callback);
		}
	}

	protected clearTimeouts(excludeIntervals = false) {
		for (const timeout of this.timeouts.values()) {
			this.lib.clearTimeout(timeout);
		}
		this.timeouts.clear();

		if (!excludeIntervals) {
			for (const interval of this.intervals.values()) {
				this.lib.clearInterval(interval);
				this.intervals.clear();
			}
			for (const raf of this.rafs.values()) {
				this.lib.cancelAnimationFrame(raf);
			}
			this.rafs.clear();
		}
	}

	protected executeUpdateCallbacks() {
		for (const callback of this.callbacks) {
			if (callback.executeOnUpdate) {
				this.createEventAndInvokeCallback(callback, callback.type === "checkpoint" ? "checkpoint" : "tick");
			}
		}
	}

	protected checkDisposed() {
		if (this.disposed) {
			throw new Error(`Timer "${this.name}" has been disposed and cannot be used.`);
		}
	}

	/**
	 * Register new callbacks to execute on this timer.
	 * @param callbacks
	 */
	public registerCallbacks(callbacks: SuperTimerCallbackBase<TTimerType>[]) {
		this.checkDisposed();
		const callbacksToStart: InternalCallback<TTimerType>[] = [];
		for (const callback of callbacks) {
			if (!this.callbackIdSeeds[callback.type]) {
				this.callbackIdSeeds[callback.type] = 1;
				this.callbackNames[callback.type] = new Set();
			}
			const callbackIdSeed = this.callbackIdSeeds[callback.type];
			const callbackNamesForType = this.callbackNames[callback.type];
			const callbackName = callback.name ?? `${callback.type}-${callbackIdSeed}`;
			if (callbackNamesForType.has(callbackName)) {
				throw new Error(
					`${callback.type} callback name must be unique: ${callback.name}. Either provide a unique name or omit the name.`,
				);
			}
			const elapsedMs = this.getElapsedMs();
			const internalCallback: InternalCallback<TTimerType> = {
				name: callbackName,
				callback: callback.callback,
				timeMs: callback.timeMs,
				type: callback.type,
				requireAnimationFrame: callback.requireAnimationFrame ?? false,
				executeOnUpdate: callback.executeOnUpdate ?? false,
				logExecutions: callback.logExecutions ?? false,
				lastExecutionMs: elapsedMs,
				registeredAt: elapsedMs,
				disableTickDriftCompensation: callback.disableTickDriftCompensation ?? false,
			};
			this.callbacks.push(internalCallback);
			callbacksToStart.push(internalCallback);

			this.callbackIdSeeds[callback.type]++;
			callbackNamesForType.add(callbackName);
		}
		this.startCallbacks(callbacksToStart);
	}

	/**
	 * Remove callbacks by the given names and cancel
	 * any pending executions of those callbacks.
	 * @param callbackNames
	 */
	public removeCallbacks(callbackNames: string[]) {
		this.checkDisposed();
		for (const name of callbackNames) {
			const timeout = this.timeouts.get(name);
			const interval = this.intervals.get(name);
			const raf = this.rafs.get(name);
			if (timeout) {
				this.lib.clearTimeout(timeout);
				this.timeouts.delete(name);
			}
			if (interval) {
				this.lib.clearInterval(interval);
				this.intervals.delete(name);
			}
			if (raf) {
				this.lib.cancelAnimationFrame(raf);
				this.rafs.delete(name);
			}
			const index = this.callbacks.findIndex(c => c.name === name);
			if (index >= 0) {
				this.callbacks.splice(index, 1);
			}
			this.callbackNames["checkpoint"]?.delete(name);
			this.callbackNames["checkpoint-once"]?.delete(name);
			this.callbackNames["tick"]?.delete(name);
			this.callbackNames["tick-reset"]?.delete(name);
		}
	}

	/**
	 * Remove all callbacks unless the name of the callback begins with "!".
	 */
	public removeAllCallbacks() {
		this.checkDisposed();
		const callbacksToRemove = this.callbacks.filter(c => !c.name.startsWith("!"));
		this.removeCallbacks(callbacksToRemove.map(c => c.name));
	}

	/**
	 * Unpause the timer. Any registered callbacks are resumed.
	 * @returns
	 */
	public unpause(suppressUpdateCallbacks = false): void {
		this.checkDisposed();

		// No-op if already unpaused
		if (this.unpausedAt) {
			return;
		}

		// Save the last time unpaused.
		this.unpausedAt = this.lib.performance.now();

		// Add the unpause event to the history
		const elapsedMs = this.getElapsedMs();
		this.history.events.push({
			date: new this.lib.Date(),
			event: "unpause",
			elapsedMs: elapsedMs,
		});

		// Resume all checkpoint callbacks
		this.startCallbacks(this.callbacks);

		// Run any callbacks that need to execute on update
		this.executeUpdateCallbacks();
	}

	/**
	 * Alias for unpause
	 */
	public start(): void {
		this.unpause();
	}

	/**
	 * Pause the timer. Any registered callbacks are paused.
	 * @returns
	 */
	public pause(suppressUpdateCallbacks = false): boolean {
		this.checkDisposed();

		// No-op if already paused
		if (!this.unpausedAt) {
			return false;
		}

		// Save the last time paused.
		this.pausedAt = this.lib.performance.now();

		// Add this segment to the total elapsed time
		const elapsedSinceLastPause = (this.pausedAt - this.unpausedAt) * this.speed;
		this.elapsedMs += elapsedSinceLastPause;
		this.unpausedAt = undefined;

		// Add a pause event to the history
		this.history.events.push({
			date: new this.lib.Date(),
			event: "pause",
			elapsedMs: this.elapsedMs,
		});

		this.clearTimeouts();

		// Run any callbacks that need to execute on update
		if (!suppressUpdateCallbacks) {
			this.executeUpdateCallbacks();
		}

		return true;
	}

	/**
	 * Cancels any outstanding timeouts/intervals. Timer cannot be reused
	 * after disposal.
	 */
	public dispose(): void {
		this.clearTimeouts();
		this.disposed = true;
	}

	private _addTime(ms: number, suppressCallbacks: boolean) {
		this.clearTimeouts(true);
		const wasPaused = this.pause(true);
		const oldElapsed = this.getElapsedMs();
		this.elapsedMs += ms;
		const sortedCallbacks = this.callbacks.filter(c => c.type === "checkpoint").sort((a, b) => a.timeMs - b.timeMs);
		if (!suppressCallbacks) {
			// Sort to ensure that checkpoints are executed in the correct order
			for (const callback of sortedCallbacks) {
				if (callback.timeMs > oldElapsed && callback.timeMs <= oldElapsed + ms) {
					this.createEventAndInvokeCallback(callback, "checkpoint");
				}
			}
		}
		// Manually run any callbacks that include the flag to run when time is adjusted
		this.executeUpdateCallbacks();

		// Check that the timer is not running in case the callback started it already.
		if (!this.unpausedAt && wasPaused) {
			this.unpause(true);
		}
	}

	/**
	 * Add the given value to the elapsed time. Use a negative value
	 * to subtract time. If suppressCallbacks is false, if this update
	 * causes the timer to move forward through any checkpoint callbacks,
	 * they will be executed.
	 *
	 * This method adds "real" time to the timer, meaning, if a speed
	 * multiplier other than 1.0 is set, the effective time added will be
	 * ms / speedMultiplier.
	 * @param ms
	 * @param suppressCallbacks
	 */
	protected addTime(ms: number, suppressCallbacks: boolean = false) {
		this.checkDisposed();
		const elapsedMs = this.getElapsedMs();

		this.history.events.push({
			date: new this.lib.Date(),
			event: "addTime",
			elapsedMs: elapsedMs,
			data: `${ms}ms will be added to elapsedMs.`,
		});

		this._addTime(ms, suppressCallbacks);
	}

	/**
	 * Set the elapsed time to a given value. If suppressCallbacks is
	 * false, if this update causes the timer to move forward through
	 * any checkpoint callbacks, they will be executed.
	 * @param ms
	 * @param suppressCallbacks
	 */
	protected setTime(ms: number, suppressCallbacks: boolean = false) {
		this.checkDisposed();
		const elapsedMs = this.getElapsedMs();

		this.history.events.push({
			date: new this.lib.Date(),
			event: "setTime",
			elapsedMs: elapsedMs,
			data: `elapsedMs will be set to ${ms}.`,
		});

		const timeToAdd = ms - elapsedMs;
		this._addTime(timeToAdd, suppressCallbacks);
	}

	/**
	 * Gets the number of milliseconds elapsed for the duration
	 * that the timer has been in an unpaused state.
	 * @returns
	 */
	public getElapsedMs(): number {
		this.checkDisposed();

		// If the timer is paused, we just return the total
		// elapsed time
		if (!this.unpausedAt) {
			return Math.round(this.elapsedMs);
		}

		// Otherwise, we need to add the time since the last
		// pause to the total elapsed time
		const elapsedSinceLastPause = (this.lib.performance.now() - this.unpausedAt) * this.speed;
		return Math.round(this.elapsedMs + elapsedSinceLastPause);
	}

	public getState(): TimerState {
		this.checkDisposed();

		// Try to clone history so it can't be modified
		const history = globalThis.structuredClone?.(this.history) ?? this.history;
		return {
			timerId: this.id,
			elapsedMs: this.getElapsedMs(),
			isPaused: !this.unpausedAt,
			history,
		};
	}

	/**
	 * Sets the timer speed multiplier. Calling this function takes effect
	 * immediately, rescheduling any future callbacks to honor the new speed.
	 * @param speed
	 */
	public setSpeedMultiplier(speedMultiplier: number) {
		if (speedMultiplier !== this.speed) {
			// If the timer is running, we need to pause, change the speed, and resume.
			// This will cause callbacks to be rescheduled for the new speed.
			let shouldUnpause = false;
			if (this.unpausedAt) {
				this.pause();
				shouldUnpause = true;
			}
			this.speed = speedMultiplier;
			this.history.events.push({
				date: new this.lib.Date(),
				event: "setSpeed",
				elapsedMs: this.elapsedMs,
				data: speedMultiplier,
			});
			if (shouldUnpause) {
				this.unpause();
			}
		}
	}
}

export class SuperTimer extends SuperTimerBase<SuperTimer> {
	protected executeCallback(callback: InternalCallback<SuperTimer>) {
		callback.callback(this);
	}
	public addTime(ms: number, suppressCallbacks: boolean = false) {
		super.addTime(ms, suppressCallbacks);
	}
	public setTime(ms: number, suppressCallbacks: boolean = false) {
		super.setTime(ms, suppressCallbacks);
	}
}

export class SuperCountdown extends SuperTimerBase<SuperCountdown> {
	private completeTime: number;
	private completeCallbacks: Set<{ callback: (timer: SuperCountdown) => void; once: boolean }> = new Set();
	constructor(
		timeMs: number,
		onComplete?: (timer: SuperCountdown) => void,
		timerOptions: SuperCountdownOptions = {},
	) {
		super(timerOptions);
		this.completeTime = timeMs;
		this.registerCallbacks([
			{
				type: "checkpoint",
				timeMs: timeMs,
				callback: (timer: SuperCountdown) => {
					this.pause();
					this.setTimeRemaining(0, true);

					// Complete callbacks are run outside of the callback system of SuperTimer
					// to ensure that they get run even when the timer is paused upon completion.
					const completeCallbacksSnapshot = [...this.completeCallbacks];
					for (const completeCallback of completeCallbacksSnapshot) {
						completeCallback.callback(timer);
						if (completeCallback.once) {
							this.completeCallbacks.delete(completeCallback);
						}
					}
				},
				name: "!countdown-complete-internal",
			},
		]);
		if (onComplete) {
			this.registerCompleteCallback(onComplete);
		}
	}

	protected executeCallback(callback: InternalCallback<SuperCountdown>) {
		callback.callback(this);
	}

	public unpause(): void {
		if (!this.isDone()) {
			super.unpause();
		}
	}

	/**
	 * Register a callback to execute when the timer completes.
	 *
	 * @param callback
	 * @param once If true, the callback will be removed after it is executed.
	 */
	public registerCompleteCallback(callback: (timer: SuperCountdown) => void, once = false) {
		this.checkDisposed();
		this.completeCallbacks.add({ callback, once });
	}

	public addTime(ms: number, suppressCallbacks = false) {
		super.addTime(-ms, suppressCallbacks);
	}

	public setTimeRemaining(ms: number, suppressCallbacks = false) {
		super.setTime(this.completeTime - ms, suppressCallbacks);
	}

	public getTimeRemaining() {
		return this.completeTime - super.getElapsedMs();
	}

	public isDone() {
		return this.getTimeRemaining() <= 0;
	}
}
