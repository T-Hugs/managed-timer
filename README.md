# Super Throttle

Demo and documentation at: https://t-hugs.github.io/super-throttle/demo

## Usage

This package exports a single function: [`throttle`](https://t-hugs.github.io/super-throttle/api/functions/throttle.html).

### Install super-throttle

```bash
npm install --save super-throttle
```

or

```bash
yarn add super-throttle
```

### Throttle a function!

```js
let i = 1;
function originalFunction() {
	console.log(i++);
}
const throttledFunction = throttle(originalFunction, { cooldownMs: 500 });
throttledFunction(); // calls originalFunction immediately, starts the cooldown period
throttledFunction(); // cooldown in progress... queue a call for when it is complete
throttledFunction(); // call is already queued! Ignore.
throttledFunction(); // call is already queued! Ignore.
throttledFunction.clearCooldown(); // Force the cooldown to end, causing the queued call to execute.
throttledFunction(); // cooldown in progress... queue a call for when it is complete
```

Output:

```
1
2
<500ms passes>
3
```

### Settings

Find the documentation for all settings at https://t-hugs.github.io/super-throttle/demo.

## Source

Super Throttle source code is at https://github.com/T-Hugs/super-throttle.
