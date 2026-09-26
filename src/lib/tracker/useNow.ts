import { useEffect, useState } from "react";

/**
 * Current time, refreshed every minute. Null during SSR and the first client
 * render so time-dependent text never causes a hydration mismatch.
 */
export function useNow(): Date | null {
	const [now, setNow] = useState<Date | null>(null);
	useEffect(() => {
		setNow(new Date());
		const id = setInterval(() => setNow(new Date()), 60_000);
		return () => clearInterval(id);
	}, []);
	return now;
}
