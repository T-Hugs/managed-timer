import {
	SuperCountdown,
	SuperTimer,
	SuperTimerOptions,
	SuperCountdownOptions,
} from "../../../dist/out-tsc/lib/super-timer";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

function useTimer(timerOptions: SuperTimerOptions = {}, dependencies: any[] = []) {
	const timer = useMemo(() => new SuperTimer(timerOptions), dependencies);
	useEffect(() => {
		return () => {
			timer.dispose();
		};
	}, dependencies);
	return timer;
}

function useCountdown(
	timeRemainingMs: number,
	updateInterval: number,
	onComplete?: (timer: SuperCountdown) => void,
	timerOptions: SuperCountdownOptions = {},
	additionalDependencies: any[] = [],
) {
	const [isComplete, setIsComplete] = useState(false);
	const [timeRemaining, setTimeRemaining] = useState(timeRemainingMs);
	const completeAndUpdateState = useCallback(
		(countdown: SuperCountdown) => {
			setIsComplete(true);
			onComplete?.(countdown);
		},
		[onComplete],
	);
	if (!timerOptions.callbacks) {
		timerOptions.callbacks = [];
	}
	timerOptions.callbacks.push({
		callback: countdown => {
			setIsComplete(countdown.isDone());
		},
		type: "checkpoint",
		timeMs: Infinity,
		name: "hook-complete-state-update",
		executeOnUpdate: true,
	});
	timerOptions.callbacks.push({
		callback: countdown => {
			setTimeRemaining(countdown.getTimeRemaining());
		},
		type: "tick",

		// If update interval is <20ms, use the animation frame short circuit
		// by setting timeMs to 0.
		timeMs: updateInterval < 20 ? 0 : updateInterval,
		requireAnimationFrame: true,
		executeOnUpdate: true,
		name: "hook-time-remaining-update",
	});

	const oldCountdown = useRef<SuperCountdown>();
	const countdown = useMemo(() => {
		if (oldCountdown.current) {
			oldCountdown.current.dispose();
			oldCountdown.current = undefined;
		}
		const newCountdown = new SuperCountdown(timeRemainingMs, completeAndUpdateState, timerOptions);
		oldCountdown.current = newCountdown;
		setTimeRemaining(newCountdown.getTimeRemaining());
		setIsComplete(false);
		return newCountdown;
	}, [timeRemainingMs, completeAndUpdateState, ...additionalDependencies]);
	return { countdown, isComplete, timeRemaining };
}

const tickCallbackName = "tick-callback";
function StopwatchDemo() {
	const [elapsedMs, setElapsedMs] = useState(0);
	const [isTick, setIsTick] = useState(true);
	const [tickType, setTickType] = useState<"standard" | "reset">("standard");
	const [timerSpeed, setTimerSpeed] = useState<number>(1);
	const timer = useTimer({
		callbacks: [
			{
				callback: timer => {
					setElapsedMs(timer.getElapsedMs());
				},
				type: "tick",
				executeOnUpdate: true,
				requireAnimationFrame: true,
				timeMs: 0,
				name: "raf-tick",
			},
		],
	});

	const onStartClick = useCallback(() => {
		timer.unpause();
	}, [timer]);

	const onStopClick = useCallback(() => {
		timer.pause();
	}, [timer]);

	const onAddTimeClick = useCallback(() => {
		timer.addTime(5000);
	}, [timer]);

	const onSubtractTimeClick = useCallback(() => {
		timer.addTime(-5000);
	}, [timer]);

	const onResetClick = useCallback(() => {
		timer.pause();
		timer.setTime(0);
	}, [timer]);

	const onTickTypeChange = useCallback((event: React.ChangeEvent) => {
		setTickType((event.target as HTMLInputElement).value as "standard" | "reset");
	}, []);

	const onTimerSpeedChange = useCallback((event: React.ChangeEvent) => {
		const newSpeed = Number((event.target as HTMLInputElement).value);
		setTimerSpeed(newSpeed);
		timer.setSpeedMultiplier(newSpeed);
	}, []);

	useEffect(() => {
		timer.removeCallbacks([tickCallbackName]);
		timer.registerCallbacks([
			{
				callback: timer => {
					setIsTick(t => !t);
				},
				type: tickType === "reset" ? "tick-reset" : "tick",
				timeMs: 1000,
				name: tickCallbackName,
			},
		]);
	}, [tickType, timer]);

	return (
		<div className="space-y-2">
			<h3>Stopwatch</h3>
			<div>{(elapsedMs / 1000).toFixed(2)}</div>

			<div className="space-x-2">
				<button onClick={onStartClick}>Start</button>
				<button onClick={onStopClick}>Stop</button>
				<button onClick={onAddTimeClick}>+5sec</button>
				<button onClick={onSubtractTimeClick}>-5sec</button>
				<button onClick={onResetClick}>Reset</button>
			</div>
			<div className="flex space-x-1">
				<strong className="pr-4" title="See documentation below">
					Timer speed:
				</strong>
				<input
					id="tenthSpeed"
					type="radio"
					name="timer-speed"
					value="0.1"
					onChange={onTimerSpeedChange}
					checked={timerSpeed == 0.1}
				/>
				<label htmlFor="tenthSpeed" className="pr-4">
					0.1x
				</label>
				<input
					id="halfSpeed"
					type="radio"
					name="timer-speed"
					value="0.5"
					onChange={onTimerSpeedChange}
					checked={timerSpeed === 0.5}
				/>
				<label htmlFor="halfSpeed" className="pr-4">
					0.5x
				</label>
				<input
					id="normalSpeed"
					type="radio"
					name="timer-speed"
					value="1.0"
					onChange={onTimerSpeedChange}
					checked={timerSpeed === 1.0}
				/>
				<label htmlFor="normalSpeed" className="pr-4">
					1.0x (real time)
				</label>
				<input
					id="doubleSpeed"
					type="radio"
					name="timer-speed"
					value="2.0"
					onChange={onTimerSpeedChange}
					checked={timerSpeed === 2.0}
				/>
				<label htmlFor="doubleSpeed" className="pr-4">
					2.0x
				</label>
				<input
					id="tenXSpeed"
					type="radio"
					name="timer-speed"
					value="10.0"
					onChange={onTimerSpeedChange}
					checked={timerSpeed === 10.0}
				/>
				<label htmlFor="tenXSpeed" className="pr-4">
					10x
				</label>
			</div>
			<div className="flex justify-between">
				<div
					className={`rounded bg-flame-100 w-12 text-black text-center font-bold uppercase ${
						isTick ? "visible" : "invisible"
					}`}
				>
					Tick
				</div>
				<div className="flex space-x-1">
					<strong className="pr-4" title="See documentation below">
						Tick type:
					</strong>
					<input
						id="standardTick"
						type="radio"
						name="tick-type"
						value="standard"
						onChange={onTickTypeChange}
						checked={tickType === "standard"}
					/>
					<label htmlFor="standardTick" className="pr-4">
						Standard
					</label>
					<input
						id="resetTick"
						type="radio"
						name="tick-type"
						value="reset"
						onChange={onTickTypeChange}
						checked={tickType === "reset"}
					/>
					<label htmlFor="resetTick">Reset</label>
				</div>
				<div
					className={`rounded bg-flame-100 w-12 text-black text-center font-bold uppercase ${
						isTick ? "invisible" : "visible"
					}`}
				>
					Tock
				</div>
			</div>
		</div>
	);
}

function CountdownDemo() {
	const [countdownTime, setCountdownTime] = useState(10000);

	const { countdown, isComplete, timeRemaining } = useCountdown(
		countdownTime,
		0, // every animation frame
	);

	const onStartClick = useCallback(() => {
		countdown.start();
	}, [countdown]);

	const onStopClick = useCallback(() => {
		countdown.pause();
	}, [countdown]);

	const onAddTimeClick = useCallback(() => {
		countdown.addTime(5000);
	}, [countdown]);

	const onSubtractTimeClick = useCallback(() => {
		countdown.addTime(-5000);
	}, [countdown]);

	const onResetClick = useCallback(() => {
		countdown.pause();
		countdown.setTimeRemaining(countdownTime);
	}, [countdown]);

	const onTimeChange = useCallback((event: React.ChangeEvent) => {
		const newCountdownTime = Number((event.target as HTMLInputElement).value || "0") * 1000;
		setCountdownTime(newCountdownTime);
	}, []);

	return (
		<div className="space-y-2">
			<h3>Countdown</h3>
			<div>{!isComplete ? (timeRemaining / 1000).toFixed(2) : "Complete!"}</div>
			<div>
				Time (seconds):{" "}
				<input onChange={onTimeChange} type="text" value={countdownTime / 1000} className="w-14" />
			</div>
			<div className="space-x-2">
				<button onClick={onStartClick}>Start</button>
				<button onClick={onStopClick}>Stop</button>
				<button onClick={onAddTimeClick}>+5sec</button>
				<button onClick={onSubtractTimeClick}>-5sec</button>
				<button onClick={onResetClick}>Reset</button>
			</div>
		</div>
	);
}

function TimerDemo() {
	return (
		<div className="space-y-4">
			<StopwatchDemo />
			<CountdownDemo />
		</div>
	);
}

export function App() {
	const [_, forceUpdate] = useReducer(x => x + 1, 0);

	return (
		<div>
			<header className="py-6 bg-gunmetal-900">
				<h1 className="font-bold max-w-2xl m-auto">Super Timer</h1>
			</header>
			<main className="max-w-3xl p-8 m-auto bg-gunmetal-800">
				<p>
					This library exports an object, <code>SuperTimer</code>, which implements a timer that can be paused
					and unpaused and supports various types of callbacks.
				</p>
				<h2 className="mt-3">Demos</h2>
				<TimerDemo />
				<div>
					<div className="mt-4">
						<h2 className="mb-3">Documentation</h2>
						<p className="text-xl">
							See the <a href="/super-throttle/api">Generated API Docs</a>.
						</p>
						<div className="my-3">
							<h3 className="mb-3">
								<code>new SuperTimer(options: SuperTimerOptions)</code>
							</h3>
							<p>Creates a SuperTimer instance that starts out in a "paused" state.</p>
							<h4>SuperTimerOptions</h4>
							<h5>
								<code>callbacks</code>
							</h5>
							<p>
								An array of <a href="#SuperTimerCallback">SuperTimerCallback</a> objects. These
								callbacks are your custom functions that run at various points while the timer is
								unpaused.
							</p>
							<h5>
								<code>name</code>
							</h5>
							<p>Give a name to this timer. Currently unused.</p>
							<h5>
								<code>timerSpeedMultiplier</code>
							</h5>
							<p>
								Adjust the speed of the timer. May be useful for testing purposes. For example, setting
								this to 2 will make the timer run twice as fast as realtime, and 0.5 will make it run
								half as fast. Default: 1.0.
							</p>
							<h5>
								<code>shims</code>
							</h5>
							<p>
								An object that allows customization of the standard library functions used by
								SuperTimer. See the list below for shimName: defaultValue,
							</p>
							<ul className="list-disc list-outside ml-5">
								<li>
									setTimeout: <code>globalThis.setTimeout</code>
								</li>
								<li>
									clearTimeout: <code>globalThis.clearTimeout</code>
								</li>
								<li>
									setInterval: <code>globalThis.setInterval</code>
								</li>
								<li>
									clearInterval: <code>globalThis.clearInterval</code>
								</li>
								<li>
									requestAnimationFrame: <code>globalThis.requestAnimationFrame</code>
								</li>
								<li>
									cancelAnimationFrame: <code>globalThis.cancelAnimationFrame</code>
								</li>
								<li>
									performance: <code>globalThis.performance</code>
								</li>
								<li>
									Date: <code>globalThis.Date</code>
								</li>
							</ul>
							<h4>SuperTimerCallback</h4>
							<p>
								SuperTimer supports several types of callbacks. Callbacks are only executed while the
								timer is in an unpaused state (or during a transition between paused and unpaused).
							</p>
							<ul className="list-disc list-outside ml-5">
								<li>
									<span className="text-olivine-100">"Checkpoint"</span> callbacks execute once at a
									given time.
								</li>
								<li>
									<span className="text-olivine-100">"Tick"</span> callbacks execute continuously on a
									provided interval.
								</li>
								<li>
									<span className="text-olivine-100">"Tick-reset"</span> callbacks are very similar to
									"tick" callbacks. However, if the timer is paused, then unpaused, a tick-reset
									callback will wait the full interval period before the next execution, while "tick"
									callbacks will execute as soon as the full interval time has passed (in an unpaused
									state) since the previous execution.
								</li>
							</ul>
							<h5>
								<code>type</code>
							</h5>
							<p>The type of callback: "tick", "tick-reset", or "checkpoint". See above for details.</p>
							<h5>
								<code>timeMs</code>
							</h5>
							<p>
								When, or how often to run the callback. For "checkpoint" callbacks, this this callback
								will execute one time when the timer reaches the given elapsed time. For "tick"
								callbacks, this is the interval upon which to execute the callback.
							</p>
							<h5>
								<code>callback</code>
							</h5>
							<p>
								The callback function. It receives a single argument, which is an instance of the timer
								that called it.
							</p>
							<h5>
								<code>requireAnimationFrame</code>
							</h5>
							<p>
								If true, the callback will only be executed in a callback to{" "}
								<code>requestAnimationFrame</code>. To schedule an interval callback to run on every
								frame, set <code>timeMs</code> to <code>0</code>, <code>type</code> to{" "}
								<code>"tick"</code>, and <code>requireAnimationFrame</code> to <code>true</code>.
								Default: false.
							</p>
							<h5>
								<code>executeOnUpdate</code>
							</h5>
							<p>
								If true, this callback will run every time the timer is paused, unpaused, or has its
								time modified by a call to <code>addTime</code> or <code>setTime</code>. Default: false.
							</p>
							<h5>
								<code>name</code>
							</h5>
							<p>Name this callback. Useful in case it needs to be removed in the future.</p>
							<h5>
								<code>logExecutions</code>
							</h5>
							<p>
								If true, save an entry to the history every time this callback is executed. Default:
								false.
							</p>
							<h4>SuperTimer methods</h4>
							<h5>
								<code>pause()</code>
							</h5>
							<p>Pause the timer.</p>
							<h5>
								<code>unpause()</code>
							</h5>
							<p>Unpause the timer.</p>
							<h5>
								<code>addTime(ms: number, suppressCallbacks: boolean = false</code>
							</h5>
							<p>
								Add the given number of milliseconds to the timer's elapsed time. If this causes a
								checkpoint callback to be crossed in the forward direction, execute it, unless
								suppressCallbacks is true.
							</p>
							<h5>
								<code>setTime(ms: number, suppressCallbacks: boolean = false)</code>
							</h5>
							<p>
								Set the timer's elapsed time to the given value. If this causes a checkpoint callback to
								be crossed in the forward direction, execute it, unless suppressCallbacks is true.
							</p>
							<h5>
								<code>registerCallbacks(callbacks: SuperTimerCallback[])</code>
							</h5>
							<p>Register the given callbacks. Works the same as specifying them in the constructor</p>
							<h5>
								<code>removeCallbacks(callbackNames: string[])</code>
							</h5>
							<p>
								Remove the callbacks with the given names. Any timeouts/intervals/requestAnimationFrames
								for these callbacks will be canceled.
							</p>

							<h5>
								<code>getElapsedMs()</code>
							</h5>
							<p>Get the timer's elapsed time in milliseconds.</p>
							<h5>
								<code>getState()</code>
							</h5>
							<p>Gets an object showing the current state of the timer and a history of events.</p>
							<h5>
								<code>dispose()</code>
							</h5>
							<p>
								Dispose of the timer. This will ensure all timeouts/intervals/requestAnimationFrames are
								canceled. Further interactions with the timer object will result in an Error being
								thrown.
							</p>
							<h3 className="mb-3">
								<code>
									new SuperCountdown(timeMs: number, onComplete?: (timer: SuperCountdown) =&gt; void,
									timerOptions: SuperTimerOptions)
								</code>
							</h3>
							<p>
								This object is very similar to SuperTimer, and is mostly intended as a convenience for
								implementing countdowns. Here are the differences:
							</p>
							<h4>Methods: getTimeRemaining(), setTimeRemaining(ms: number)</h4>
							<p>Self-explanatory</p>
							<h4>Method: isDone()</h4>
							<p>
								SuperCountdown keeps track of when the countdown has completed. Use{" "}
								<code>isDone()</code> to access this state.{" "}
							</p>
						</div>
					</div>
				</div>
			</main>
			<footer className="py-6 bg-gunmetal-900 text-center">
				<p>
					View on <a href="https://github.com/T-Hugs/super-throttle">GitHub</a> |{" "}
					<a href="https://npmjs.com/package/super-throttle">npm</a>
				</p>
				<p>Created by Trevor Gau</p>
			</footer>
		</div>
	);
}

export default App;
