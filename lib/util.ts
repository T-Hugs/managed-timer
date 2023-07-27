/**
 * This function converts a number of seconds to a string
 * representation of the number of hours, minutes, and seconds.
 * The string is formatted as "hh:mm:ss" and is prefixed with
 * a minus sign if the number of seconds is negative.
 * If allowNegative is true, then a negative number of seconds
 * is allowed and will be converted to a negative string.
 * If allowNegative is false, then a negative number of seconds
 * is treated as zero and will be converted to "00:00:00".
 * @param seconds 
 * @param allowNegative 
 */
export function secondsToStr(seconds: number, allowNegative: boolean = false) {
	const isNegative = seconds < 0;
	const clampedSeconds = Math.abs(allowNegative ? seconds : Math.max(0, seconds));
	const h = Math.floor(clampedSeconds / 3600);
	const m = Math.floor((clampedSeconds - 3600 * h) / 60);
	const s = Math.floor(clampedSeconds - h * 3600 - m * 60);
	const slz = s < 10 ? "0" + String(s) : String(s);
	const mlz = /*h > 0 &&*/ m < 10 ? "0" + String(m) : String(m);
	const hwcolon = h > 0 ? String(h) + ":" : "";
	return `${isNegative ? "-" : ""}${hwcolon}${mlz}:${slz}`;
}

/**
 * Returns the number of seconds represented by the given string
 * Examples:
 *   strToSeconds("1s") == 1
 *   strToSeconds("1:02:03") == 3723
 *   strToSeconds("1 hour 2 minutes 3 seconds") == 3723
 * @param str
 */
export function strToSeconds(str: string) {
	const sanitized = str.trim();
	const justSeconds = sanitized.match(/^(\d+)\s*((s|sec|second|seconds)\.?)?$/);
	if (justSeconds && justSeconds.length >= 2) {
		// Just one number - assume seconds
		return Number(justSeconds[1]);
	}

	const colonTime = sanitized.match(/^(?:(\d*):)?(\d*):(\d*)$/);
	if (colonTime && colonTime.length >= 3) {
		// In the format of [hh:]mm:ss, e.g. 8:22, 1:02:53, :56, or 20:
		return 3600 * Number(colonTime[1] || 0) + 60 * Number(colonTime[2]) + Number(colonTime[3]);
	}

	const verbose = sanitized
		.replace(",", "")
		.match(
			/^(?:(\d+)\s*(?:(?:h|hr|hrs|hour|hours)\.?))?\s*(?:(\d+)\s*(?:(?:m|min|mins|minute|minutes)\.?))?\s*(?:(\d+)\s*(?:(?:s|sec|secs|second|seconds)\.?))?$/,
		);
	if (verbose && verbose.length >= 4) {
		// In the format of hh hours mm minutes ss seconds, e.g.
		// 2h3m1s, 3 hours, 1 hour, 2 minutes, 3 seconds, etc.
		return 3600 * Number(verbose[1] || "0") + 60 * Number(verbose[2] || "0") + Number(verbose[3] || "0");
	}

	return null;
}
