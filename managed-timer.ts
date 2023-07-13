// Creates a type T with every prop in P being required.
type RequiredProp<T, P extends keyof T> = T & { [K in P]-?: T[P] };

let timerId = 1;

const noop: (...input: any) => any = () => {};

/**
 * A callback that can be registered to run on various timer events.
 *
 * @param timer The ManagedTimer instance that triggered the callback
 */
export type TimerCallback = (timer: ManagedTimer) => void;

export interface ManagedTimerCallback {
	/**
	 * The type of callback to execute. Checkpoint callbacks run at
	 * a specific amount of elapsed time, while tick callbacks run
	 * at a specified interval.
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
	type: "checkpoint" | "tick" | "tick-reset";

	/**
	 * When or how often to run the callback. For "checkpoint"
	 * callbacks, this is the elapsed time at which to run the
	 * callback. For "tick" callbacks, this is the interval at
	 * which to run the callback.
	 */
	valueMs: number;

	/**
	 * Callback to execute on each tick
	 */
	callback: TimerCallback;

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
	 * Optional name for this callback. Required if you want to
	 * later remove the callback. This name must be unique.
	 */
	name?: string;
}

type InternalCallback = RequiredProp<ManagedTimerCallback, "name" | "requireAnimationFrame"> & {
	lastExecutionTime?: Date;
	tickTimeRemaining?: number;
};

export interface ManagedTimerOptions {
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
	callbacks: ManagedTimerCallback[];

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
export type TimerEventType = "create" | "pause" | "unpause" | "start" | "checkpoint" | "tick" | "setTime" | "addTime";

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

const defaultOptions: Omit<ManagedTimerOptions, "name"> = {
	callbacks: [],
	timerSpeedMultiplier: 1.0,
};

export class ManagedTimer {
	private id: number;
	private config: ManagedTimerOptions;
	private callbacks: InternalCallback[] = [];
	private history: TimerHistory = { events: [] };
	private unpausedAt: Date | undefined;
	private pausedAt: Date = new Date();
	private elapsedMs: number = 0;
	private timeouts: Map<string, number> = new Map();
	private intervals: Map<string, number> = new Map();
	private callbackIdSeeds: Record<string, number> = {};
	private callbackNames: Record<string, Set<string>> = {};

	constructor(options: Partial<ManagedTimerOptions>) {
		this.id = timerId++;
		const defaultedOptions: ManagedTimerOptions = { ...defaultOptions, name: `timer-${this.id}`, ...options };
		this.registerCallbacks(defaultedOptions.callbacks);
		this.config = defaultedOptions;
	}

	private startCallbacks(callbacks: InternalCallback[]) {
		if (!this.unpausedAt) {
			return;
		}

		const elapsedMs = this.getElapsedMs();

		for (const callback of callbacks) {
			switch (callback.type) {
				case "checkpoint":
					this.handleCheckpointCallback(callback, elapsedMs);
					break;

				case "tick-reset":
					this.handleTickResetCallback(callback, elapsedMs);
					break;

				case "tick":
					this.handleTickCallback(callback, elapsedMs);
					break;
			}
		}
	}

	private createEventAndInvokeCallback(callback: InternalCallback, elapsedMs: number, eventType: TimerEventType) {
		this.history.events.push({
			date: new Date(),
			event: eventType,
			elapsedMs,
			data: callback.name,
		});
		callback.lastExecutionTime = new Date();
		callback.callback(this);
	}

	private handleCheckpointCallback(callback: InternalCallback, elapsedMs: number, eventType: TimerEventType = "checkpoint") {
		const msUntilCheckpoint = callback.valueMs - elapsedMs;
		if (msUntilCheckpoint <= 0) return;

		const timeout = setTimeout(() => {
			this.createEventAndInvokeCallback(callback, elapsedMs, eventType);
		}, msUntilCheckpoint);
		this.timeouts.set(callback.name, timeout);
	}

	private handleTickResetCallback(callback: InternalCallback, elapsedMs: number) {
		const interval = setInterval(() => {
			this.createEventAndInvokeCallback(callback, elapsedMs, "tick");
		}, callback.valueMs);
		this.intervals.set(callback.name, interval);
	}

	private handleTickCallback(callback: InternalCallback, elapsedMs: number) {
        if (callback.tickTimeRemaining && callback.tickTimeRemaining > 0) {
            // If we have paused, the first execution will be a one-off, handled as a "checkpoint"
            // callback. After that, it becomes a regular tick callback.
            this.handleCheckpointCallback({...callback, callback: (timer: ManagedTimer) => {
                this.handleTickResetCallback(callback, elapsedMs);
                callback.callback(timer);
            }}, elapsedMs, "tick");
        } else {
            this.handleTickResetCallback(callback, elapsedMs);
        }
    }

	/**
	 * Register new callbacks to execute on this timer.
	 * @param callbacks
	 */
	public registerCallbacks(callbacks: ManagedTimerCallback[]) {
		const callbacksToStart: InternalCallback[] = [];
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
			const internalCallback: InternalCallback = {
				name: callbackName,
				callback: callback.callback,
				valueMs: callback.valueMs,
				type: callback.type,
				requireAnimationFrame: callback.requireAnimationFrame ?? false,
			};
			this.callbacks.push(internalCallback);
			callbacksToStart.push(internalCallback);

			this.callbackIdSeeds[callback.type]++;
			callbackNamesForType.add(callbackName);
		}
		this.startCallbacks(callbacksToStart);
	}

	/**
	 * Unpause the timer. Any registered callbacks are resumed.
	 * @returns
	 */
	public unpause(): void {
		// No-op if already unpaused
		if (this.unpausedAt) {
			return;
		}

		// Save the last time unpaused.
		this.unpausedAt = new Date();

		// Add the unpause event to the history
		const elapsedMs = this.getElapsedMs();
		this.history.events.push({
			date: new Date(),
			event: "unpause",
			elapsedMs: elapsedMs,
		});

		// Resume all checkpoint callbacks
		this.startCallbacks(this.callbacks);
	}

	/**
	 * Pause the timer. Any registered callbacks are paused.
	 * @returns
	 */
	public pause(): void {
		// No-op if already paused
		if (!this.unpausedAt) {
			return;
		}

		// Save the last time paused.
		this.pausedAt = new Date();

		// Add this segment to the total elapsed time
		const now = new Date();
		const elapsedSinceLastPause = now.getTime() - this.unpausedAt.getTime();
		this.elapsedMs += elapsedSinceLastPause;
		this.unpausedAt = undefined;

		// Add a pause event to the history
		this.history.events.push({
			date: now,
			event: "pause",
			elapsedMs: this.elapsedMs,
		});

		// Clear all callback timeouts and intervals
		for (const timeout of this.timeouts.values()) {
			clearTimeout(timeout);
		}
		for (const interval of this.intervals.values()) {
			clearInterval(interval);
		}
		this.timeouts.clear();
	}

	/**
	 * Gets the number of milliseconds elapsed for the duration
	 * that the timer has been unpaused.
	 * @returns
	 */
	public getElapsedMs(): number {
		// If the timer is paused, we just return the total
		// elapsed time
		if (!this.unpausedAt) {
			return this.elapsedMs;
		}

		// Otherwise, we need to add the time since the last
		// pause to the total elapsed time
		const now = new Date();
		const elapsedSinceLastPause = now.getTime() - this.unpausedAt.getTime();
		return this.elapsedMs + elapsedSinceLastPause;
	}

	public getState(): TimerState {
		// Try to clone history so it can't be modified
		const history = globalThis.structuredClone?.(this.history) ?? this.history;
		return {
			timerId: this.id,
			elapsedMs: this.getElapsedMs(),
			isPaused: !this.unpausedAt,
			history,
		};
	}
}
