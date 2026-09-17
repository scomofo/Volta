import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Plus, r as Minus } from "../_libs/lucide-react.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Bf0gZGfJ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WAVEFORMS = [
	{
		id: "sine",
		label: "Sine"
	},
	{
		id: "triangle",
		label: "Tri"
	},
	{
		id: "sawtooth",
		label: "Saw"
	},
	{
		id: "square",
		label: "Square"
	}
];
var NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B"
];
function midiToFreq(midi) {
	return 440 * 2 ** ((midi - 69) / 12);
}
function midiToName(midi) {
	const pc = (midi % 12 + 12) % 12;
	const oct = Math.floor(midi / 12) - 1;
	return `${NOTE_NAMES[pc]}${oct}`;
}
function isWhiteMidi(midi) {
	const pc = (midi % 12 + 12) % 12;
	return pc === 0 || pc === 2 || pc === 4 || pc === 5 || pc === 7 || pc === 9 || pc === 11;
}
function displayedMidi(octave, offset) {
	return 48 + octave * 12 + offset;
}
/** Physical `event.code` → semitone offset from the displayed bottom C. */
var CODE_TO_OFFSET = {
	KeyZ: 0,
	KeyS: 1,
	KeyX: 2,
	KeyD: 3,
	KeyC: 4,
	KeyV: 5,
	KeyG: 6,
	KeyB: 7,
	KeyH: 8,
	KeyN: 9,
	KeyJ: 10,
	KeyM: 11,
	Comma: 12,
	KeyL: 13,
	Period: 14,
	Semicolon: 15,
	Slash: 16,
	KeyQ: 12,
	Digit2: 13,
	KeyW: 14,
	Digit3: 15,
	KeyE: 16,
	KeyR: 17,
	Digit5: 18,
	KeyT: 19,
	Digit6: 20,
	KeyY: 21,
	Digit7: 22,
	KeyU: 23,
	KeyI: 24,
	Digit9: 25,
	KeyO: 26,
	Digit0: 27,
	KeyP: 28
};
/** Preferred computer-key glyph for each on-screen offset. */
var OFFSET_LABEL = {
	0: "Z",
	1: "S",
	2: "X",
	3: "D",
	4: "C",
	5: "V",
	6: "G",
	7: "B",
	8: "H",
	9: "N",
	10: "J",
	11: "M",
	12: "Q",
	13: "2",
	14: "W",
	15: "3",
	16: "E",
	17: "R",
	18: "5",
	19: "T",
	20: "6",
	21: "Y",
	22: "7",
	23: "U",
	24: "I"
};
function buildKeyboard(octave) {
	const keys = [];
	for (let offset = 0; offset <= 24; offset++) {
		const midi = displayedMidi(octave, offset);
		keys.push({
			midi,
			offset,
			white: isWhiteMidi(midi),
			label: OFFSET_LABEL[offset] ?? ""
		});
	}
	return keys;
}
function expMap(t, min, max) {
	const x = Math.min(1, Math.max(0, t));
	return min * (max / min) ** x;
}
function formatHz(hz) {
	if (hz >= 1e3) return `${(hz / 1e3).toFixed(hz >= 1e4 ? 1 : 2)}k`;
	return `${Math.round(hz)}Hz`;
}
function formatMs(seconds) {
	const ms = seconds * 1e3;
	if (ms < 10) return `${ms.toFixed(1)}ms`;
	if (ms < 1e3) return `${Math.round(ms)}ms`;
	return `${seconds.toFixed(2)}s`;
}
function formatPct(t) {
	return `${Math.round(t * 100)}%`;
}
var WAVE_GAIN = {
	sine: 1,
	triangle: .9,
	sawtooth: .52,
	square: .38
};
var MAX_VOICES = 8;
function cutoffHz(t) {
	return expMap(t, 80, 12e3);
}
function attackSec(t) {
	return expMap(t, .002, 2);
}
function decaySec(t) {
	return expMap(t, .02, 2);
}
function releaseSec(t) {
	return expMap(t, .02, 3);
}
function resonanceQ(t) {
	return .5 + t * 17.5;
}
function createAudioContext() {
	const w = window;
	const Ctor = w.AudioContext ?? w.webkitAudioContext;
	if (!Ctor) throw new Error("Web Audio is not available");
	return new Ctor({ latencyHint: "interactive" });
}
var SynthEngine = class {
	ctx = null;
	master = null;
	compressor = null;
	analyser = null;
	params = {
		waveform: "sawtooth",
		cutoff: .72,
		resonance: .18,
		attack: .1,
		decay: .28,
		sustain: .68,
		release: .32,
		volume: .72
	};
	voices = /* @__PURE__ */ new Map();
	holds = /* @__PURE__ */ new Map();
	timeDomain = null;
	get armed() {
		return this.ctx !== null && this.ctx.state !== "closed";
	}
	/** Must run inside a user-gesture call stack. */
	arm() {
		if (typeof window === "undefined") return false;
		if (!this.ctx) {
			this.ctx = createAudioContext();
			this.buildGraph();
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
		return true;
	}
	resume() {
		if (this.ctx?.state === "suspended") this.ctx.resume();
	}
	panic() {
		const now = this.ctx?.currentTime ?? 0;
		for (const midi of [...this.voices.keys()]) this.releaseVoice(midi, now, .03);
		this.holds.clear();
	}
	setParams(partial) {
		this.params = {
			...this.params,
			...partial
		};
		this.applyLiveParams();
	}
	noteOn(midi) {
		this.arm();
		if (!this.ctx) return;
		const holds = (this.holds.get(midi) ?? 0) + 1;
		this.holds.set(midi, holds);
		if (holds > 1) {
			const existing = this.voices.get(midi);
			if (existing && !existing.releasing) return;
		}
		this.startVoice(midi);
	}
	noteOff(midi) {
		const holds = (this.holds.get(midi) ?? 0) - 1;
		if (holds > 0) {
			this.holds.set(midi, holds);
			return;
		}
		this.holds.delete(midi);
		const ctx = this.ctx;
		if (!ctx) return;
		this.releaseVoice(midi, ctx.currentTime, releaseSec(this.params.release));
	}
	getByteTimeDomain() {
		if (!this.analyser || !this.timeDomain) return null;
		this.analyser.getByteTimeDomainData(this.timeDomain);
		return this.timeDomain;
	}
	rms() {
		const data = this.getByteTimeDomain();
		if (!data) return 0;
		let sum = 0;
		for (let i = 0; i < data.length; i++) {
			const v = (data[i] - 128) / 128;
			sum += v * v;
		}
		return Math.sqrt(sum / data.length);
	}
	buildGraph() {
		const ctx = this.ctx;
		this.master = ctx.createGain();
		this.compressor = ctx.createDynamicsCompressor();
		this.compressor.threshold.value = -18;
		this.compressor.knee.value = 12;
		this.compressor.ratio.value = 3.2;
		this.compressor.attack.value = .004;
		this.compressor.release.value = .12;
		this.analyser = ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = .35;
		this.timeDomain = new Uint8Array(this.analyser.fftSize);
		this.master.connect(this.compressor);
		this.compressor.connect(this.analyser);
		this.analyser.connect(ctx.destination);
		this.applyMaster();
	}
	applyMaster() {
		if (!this.master || !this.ctx) return;
		const g = this.params.volume ** 2 * .42;
		this.master.gain.setTargetAtTime(g, this.ctx.currentTime, .03);
	}
	applyLiveParams() {
		this.applyMaster();
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		for (const voice of this.voices.values()) {
			voice.osc.type = this.params.waveform;
			const tracked = cutoffHz(this.params.cutoff) * 2 ** ((voice.midi - 60) / 12 * .35);
			voice.filter.frequency.setTargetAtTime(Math.min(tracked, 18e3), now, .02);
			voice.filter.Q.setTargetAtTime(resonanceQ(this.params.resonance), now, .02);
		}
	}
	stealOldest() {
		if (this.voices.size < MAX_VOICES) return;
		let oldest = null;
		for (const v of this.voices.values()) if (!oldest || v.startedAt < oldest.startedAt) oldest = v;
		if (oldest) this.disposeVoice(oldest, true);
	}
	startVoice(midi) {
		const ctx = this.ctx;
		const master = this.master;
		if (!ctx || !master) return;
		const existing = this.voices.get(midi);
		if (existing) this.disposeVoice(existing, true);
		this.stealOldest();
		const osc = ctx.createOscillator();
		osc.type = this.params.waveform;
		osc.frequency.value = midiToFreq(midi);
		const filter = ctx.createBiquadFilter();
		filter.type = "lowpass";
		const tracked = cutoffHz(this.params.cutoff) * 2 ** ((midi - 60) / 12 * .35);
		filter.frequency.value = Math.min(tracked, 18e3);
		filter.Q.value = resonanceQ(this.params.resonance);
		const env = ctx.createGain();
		env.gain.value = 0;
		osc.connect(filter);
		filter.connect(env);
		env.connect(master);
		const now = ctx.currentTime;
		const a = attackSec(this.params.attack);
		const d = decaySec(this.params.decay);
		const s = this.params.sustain;
		const peak = WAVE_GAIN[this.params.waveform];
		env.gain.cancelScheduledValues(now);
		env.gain.setValueAtTime(0, now);
		env.gain.linearRampToValueAtTime(peak, now + a);
		env.gain.linearRampToValueAtTime(peak * s, now + a + d);
		osc.start(now);
		const voice = {
			midi,
			osc,
			filter,
			env,
			startedAt: now,
			releasing: false
		};
		this.voices.set(midi, voice);
		osc.onended = () => {
			if (this.voices.get(midi) === voice) this.voices.delete(midi);
			this.disposeVoice(voice, false);
		};
	}
	releaseVoice(midi, now, release) {
		const voice = this.voices.get(midi);
		if (!voice || !this.ctx) return;
		voice.releasing = true;
		const g = voice.env.gain;
		const current = Math.max(g.value, 1e-4);
		g.cancelScheduledValues(now);
		g.setValueAtTime(current, now);
		g.exponentialRampToValueAtTime(1e-4, now + Math.max(.01, release));
		try {
			voice.osc.stop(now + Math.max(.01, release) + .03);
		} catch {}
	}
	disposeVoice(voice, stop) {
		try {
			if (stop) voice.osc.stop();
		} catch {}
		try {
			voice.osc.disconnect();
			voice.filter.disconnect();
			voice.env.disconnect();
		} catch {}
		if (this.voices.get(voice.midi) === voice) this.voices.delete(voice.midi);
	}
};
var singleton = null;
function getEngine() {
	if (!singleton) singleton = new SynthEngine();
	return singleton;
}
function syncEngine(partial) {
	getEngine().setParams(partial);
}
function pushHeld(held, midi) {
	return held.includes(midi) ? held : [...held, midi];
}
function dropHeld(held, midi) {
	return held.filter((n) => n !== midi);
}
var useSynthStore = create((set, get) => ({
	armed: false,
	octave: 0,
	held: [],
	waveform: "sawtooth",
	cutoff: .72,
	resonance: .18,
	attack: .1,
	decay: .28,
	sustain: .68,
	release: .32,
	volume: .72,
	arm: () => {
		if (getEngine().arm()) set({ armed: true });
	},
	noteOn: (midi) => {
		const engine = getEngine();
		engine.arm();
		engine.noteOn(midi);
		set((s) => ({
			armed: true,
			held: pushHeld(s.held, midi)
		}));
	},
	noteOff: (midi) => {
		getEngine().noteOff(midi);
		set((s) => ({ held: dropHeld(s.held, midi) }));
	},
	setWaveform: (waveform) => {
		syncEngine({ waveform });
		set({ waveform });
	},
	setCutoff: (cutoff) => {
		syncEngine({ cutoff });
		set({ cutoff });
	},
	setResonance: (resonance) => {
		syncEngine({ resonance });
		set({ resonance });
	},
	setAttack: (attack) => {
		syncEngine({ attack });
		set({ attack });
	},
	setDecay: (decay) => {
		syncEngine({ decay });
		set({ decay });
	},
	setSustain: (sustain) => {
		syncEngine({ sustain });
		set({ sustain });
	},
	setRelease: (release) => {
		syncEngine({ release });
		set({ release });
	},
	setVolume: (volume) => {
		syncEngine({ volume });
		set({ volume });
	},
	shiftOctave: (delta) => {
		set((s) => ({ octave: Math.min(3, Math.max(-2, s.octave + delta)) }));
	},
	panic: () => {
		getEngine().panic();
		set({ held: [] });
	}
}));
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function ArmGate() {
	const armed = useSynthStore((s) => s.armed);
	const arm = useSynthStore((s) => s.arm);
	if (armed) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "button",
		tabIndex: 0,
		"aria-label": "Arm audio engine",
		className: "absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-6",
		onPointerDown: (event) => {
			event.preventDefault();
			event.stopPropagation();
			arm();
		},
		onKeyDown: (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				arm();
			}
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex max-w-sm flex-col items-center gap-5 rounded-xl bg-surface px-8 py-8 text-center shadow-panel",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex size-12 items-center justify-center rounded-full bg-surface-2 text-accent",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
						viewBox: "0 0 24 24",
						className: "size-6",
						"aria-hidden": true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: "12",
							cy: "12",
							r: "7",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
							d: "M12 8v8",
							stroke: "currentColor",
							strokeWidth: "1.6",
							strokeLinecap: "round"
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-2xl font-medium tracking-tight text-fg",
						children: "Arm engine"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-pretty text-sm leading-relaxed text-muted",
						children: "Browsers keep audio silent until a gesture. Tap to start the oscillator."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-md bg-fg px-4 py-2.5 text-sm font-medium text-bg",
					children: "Tap to play"
				})
			]
		})
	});
}
var downMidi = /* @__PURE__ */ new Map();
function ComputerKeys() {
	const octave = useSynthStore((s) => s.octave);
	const noteOn = useSynthStore((s) => s.noteOn);
	const noteOff = useSynthStore((s) => s.noteOff);
	const shiftOctave = useSynthStore((s) => s.shiftOctave);
	const panic = useSynthStore((s) => s.panic);
	(0, import_react.useEffect)(() => {
		const onDown = (event) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const target = event.target;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
			if (event.code === "BracketLeft" || event.code === "Minus") {
				event.preventDefault();
				if (!event.repeat) shiftOctave(-1);
				return;
			}
			if (event.code === "BracketRight" || event.code === "Equal") {
				event.preventDefault();
				if (!event.repeat) shiftOctave(1);
				return;
			}
			if (event.code === "Escape") {
				event.preventDefault();
				panic();
				downMidi.clear();
				return;
			}
			const offset = CODE_TO_OFFSET[event.code];
			if (offset == null) return;
			event.preventDefault();
			if (event.repeat || downMidi.has(event.code)) return;
			const midi = displayedMidi(octave, offset);
			downMidi.set(event.code, midi);
			noteOn(midi);
		};
		const onUp = (event) => {
			const midi = downMidi.get(event.code);
			if (midi == null) return;
			event.preventDefault();
			downMidi.delete(event.code);
			noteOff(midi);
		};
		const flush = () => {
			downMidi.clear();
			panic();
		};
		const onVis = () => {
			if (document.hidden) {
				flush();
				return;
			}
			getEngine().resume();
		};
		window.addEventListener("keydown", onDown);
		window.addEventListener("keyup", onUp);
		window.addEventListener("blur", flush);
		document.addEventListener("visibilitychange", onVis);
		return () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
			window.removeEventListener("blur", flush);
			document.removeEventListener("visibilitychange", onVis);
		};
	}, [
		noteOff,
		noteOn,
		octave,
		panic,
		shiftOctave
	]);
	return null;
}
function Keyboard() {
	const octave = useSynthStore((s) => s.octave);
	const held = useSynthStore((s) => s.held);
	const noteOn = useSynthStore((s) => s.noteOn);
	const noteOff = useSynthStore((s) => s.noteOff);
	const arm = useSynthStore((s) => s.arm);
	const keys = (0, import_react.useMemo)(() => buildKeyboard(octave), [octave]);
	const whites = keys.filter((k) => k.white);
	const blacks = keys.filter((k) => !k.white);
	const bedRef = (0, import_react.useRef)(null);
	const pointers = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const midiFromPoint = (0, import_react.useCallback)((clientX, clientY) => {
		const bed = bedRef.current;
		if (!bed) return null;
		const hits = document.elementsFromPoint(clientX, clientY);
		for (const el of hits) {
			if (!(el instanceof HTMLElement)) continue;
			if (!bed.contains(el)) continue;
			const midi = el.dataset.midi;
			if (midi) return Number(midi);
		}
		return null;
	}, []);
	const onPointerDown = (0, import_react.useCallback)((event) => {
		if (event.button !== 0 && event.pointerType === "mouse") return;
		event.preventDefault();
		arm();
		event.currentTarget.setPointerCapture(event.pointerId);
		const midi = midiFromPoint(event.clientX, event.clientY);
		if (midi == null) return;
		pointers.current.set(event.pointerId, midi);
		noteOn(midi);
	}, [
		arm,
		midiFromPoint,
		noteOn
	]);
	const onPointerMove = (0, import_react.useCallback)((event) => {
		if (!pointers.current.has(event.pointerId)) return;
		const midi = midiFromPoint(event.clientX, event.clientY);
		const prev = pointers.current.get(event.pointerId);
		if (midi === prev) return;
		if (prev != null && prev >= 0) noteOff(prev);
		if (midi != null) {
			pointers.current.set(event.pointerId, midi);
			noteOn(midi);
		} else pointers.current.set(event.pointerId, -1);
	}, [
		midiFromPoint,
		noteOff,
		noteOn
	]);
	const endPointer = (0, import_react.useCallback)((event) => {
		const prev = pointers.current.get(event.pointerId);
		pointers.current.delete(event.pointerId);
		if (prev != null && prev >= 0) noteOff(prev);
	}, [noteOff]);
	(0, import_react.useEffect)(() => {
		const onLost = () => {
			for (const midi of pointers.current.values()) if (midi >= 0) noteOff(midi);
			pointers.current.clear();
		};
		window.addEventListener("blur", onLost);
		return () => window.removeEventListener("blur", onLost);
	}, [noteOff]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: bedRef,
		className: "keybed relative isolate flex h-36 touch-none select-none sm:h-44",
		onPointerDown,
		onPointerMove,
		onPointerUp: endPointer,
		onPointerCancel: endPointer,
		onContextMenu: (e) => e.preventDefault(),
		role: "group",
		"aria-label": "Piano keyboard",
		children: [whites.map((key) => {
			const on = held.includes(key.midi);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"data-midi": key.midi,
				tabIndex: -1,
				"aria-label": midiToName(key.midi),
				"aria-pressed": on,
				className: cn("key-white relative z-0 min-w-0 flex-1", on && "is-on"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center gap-0.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden text-[0.65rem] font-medium text-subtle sm:block",
						children: key.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[0.6rem] font-medium tabular-nums text-subtle/80",
						children: midiToName(key.midi)
					})]
				})
			}, key.midi);
		}), blacks.map((key) => {
			const left = whites.filter((w) => w.offset < key.offset).length / whites.length * 100;
			const width = 1 / whites.length * 100 * .62;
			const on = held.includes(key.midi);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"data-midi": key.midi,
				tabIndex: -1,
				"aria-label": midiToName(key.midi),
				"aria-pressed": on,
				style: {
					left: `calc(${left}% - ${width / 2}%)`,
					width: `${width}%`
				},
				className: cn("key-black absolute top-0 z-10 h-[58%]", on && "is-on"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "pointer-events-none absolute inset-x-0 bottom-2 hidden text-center text-[0.6rem] font-medium text-current sm:block",
					children: key.label
				})
			}, key.midi);
		})]
	});
}
var MIN_ANGLE = -135;
function Knob({ label, value, display, onChange, defaultValue = .5, disabled = false }) {
	const id = (0, import_react.useId)();
	const drag = (0, import_react.useRef)(null);
	const t = Math.min(1, Math.max(0, value));
	const angle = MIN_ANGLE + t * 270;
	const onPointerDown = (0, import_react.useCallback)((event) => {
		if (disabled) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = {
			y: event.clientY,
			value: t
		};
	}, [disabled, t]);
	const onPointerMove = (0, import_react.useCallback)((event) => {
		if (!drag.current) return;
		const range = 140;
		const fine = event.shiftKey ? .35 : 1;
		const next = drag.current.value + (drag.current.y - event.clientY) / range * fine;
		onChange(Math.min(1, Math.max(0, next)));
	}, [onChange]);
	const endDrag = (0, import_react.useCallback)(() => {
		drag.current = null;
	}, []);
	const onKeyDown = (0, import_react.useCallback)((event) => {
		const step = event.shiftKey ? .01 : .04;
		if (event.key === "ArrowUp" || event.key === "ArrowRight") {
			event.preventDefault();
			onChange(Math.min(1, t + step));
		} else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
			event.preventDefault();
			onChange(Math.max(0, t - step));
		} else if (event.key === "Home") {
			event.preventDefault();
			onChange(0);
		} else if (event.key === "End") {
			event.preventDefault();
			onChange(1);
		}
	}, [onChange, t]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex w-16 flex-col items-center gap-1.5 sm:w-[4.5rem]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				id,
				type: "button",
				disabled,
				"aria-label": `${label} ${display}`,
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				"aria-valuenow": Math.round(t * 100),
				"aria-valuetext": display,
				role: "slider",
				onPointerDown,
				onPointerMove,
				onPointerUp: endDrag,
				onPointerCancel: endDrag,
				onDoubleClick: () => onChange(defaultValue),
				onKeyDown,
				className: cn("knob relative size-14 touch-none rounded-full sm:size-16", "bg-surface-2 text-fg", "transition-[box-shadow,transform] duration-(--motion-quick) ease-(--ease-out)", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70", "active:scale-[0.98]", disabled && "pointer-events-none opacity-50"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					className: "pointer-events-none absolute inset-[18%] rounded-full bg-surface"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					className: "pointer-events-none absolute inset-0 origin-center",
					style: { transform: `rotate(${angle}deg)` },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute left-1/2 top-[7%] h-[26%] w-[2px] -translate-x-1/2 rounded-full bg-accent" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				htmlFor: id,
				className: "font-sans text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-sans text-xs tabular-nums text-fg",
				children: display
			})
		]
	});
}
var SEGMENTS = 16;
function LevelMeter({ armed }) {
	const fillRef = (0, import_react.useRef)(null);
	const peakRef = (0, import_react.useRef)(null);
	const peakHold = (0, import_react.useRef)(0);
	(0, import_react.useEffect)(() => {
		let frame = 0;
		let alive = true;
		const tick = () => {
			if (!alive) return;
			const rms = armed ? getEngine().rms() : 0;
			const level = Math.min(1, rms * 3.2);
			peakHold.current = Math.max(level, peakHold.current * .96);
			if (peakHold.current < .02) peakHold.current = 0;
			if (fillRef.current) fillRef.current.style.height = `${level * 100}%`;
			if (peakRef.current) {
				peakRef.current.style.bottom = `${peakHold.current * 100}%`;
				peakRef.current.style.opacity = peakHold.current > .02 ? "1" : "0";
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => {
			alive = false;
			cancelAnimationFrame(frame);
		};
	}, [armed]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-[7.5rem] flex-col items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted",
			children: "Lvl"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex h-full w-6 flex-col-reverse overflow-hidden rounded-sm bg-surface-2",
			"aria-label": "Output level",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 flex flex-col-reverse",
					children: Array.from({ length: SEGMENTS }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("flex-1 border-t border-bg/80", i > 13 ? "bg-fg/10" : "bg-transparent") }, i))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: fillRef,
					className: "absolute bottom-0 left-0 right-0 bg-accent/80",
					style: { height: "0%" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: peakRef,
					className: "absolute left-0 right-0 h-0.5 bg-fg opacity-0",
					style: { bottom: "0%" }
				})
			]
		})]
	});
}
function readToken(name, fallback) {
	if (typeof window === "undefined") return fallback;
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function Scope({ armed }) {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx2d = canvas.getContext("2d");
		if (!ctx2d) return;
		let frame = 0;
		let alive = true;
		const draw = () => {
			if (!alive) return;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
				canvas.width = Math.floor(width * dpr);
				canvas.height = Math.floor(height * dpr);
			}
			ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
			const bg = readToken("--color-bg", "#0a0b0c");
			const grid = readToken("--color-border", "#2a2c31");
			const accent = readToken("--color-accent", "#7dcea0");
			const muted = readToken("--color-subtle", "#5c616a");
			ctx2d.fillStyle = bg;
			ctx2d.fillRect(0, 0, width, height);
			ctx2d.strokeStyle = grid;
			ctx2d.lineWidth = 1;
			ctx2d.beginPath();
			for (let i = 1; i < 4; i++) {
				const y = height / 4 * i;
				ctx2d.moveTo(0, y);
				ctx2d.lineTo(width, y);
			}
			ctx2d.moveTo(width / 2, 0);
			ctx2d.lineTo(width / 2, height);
			ctx2d.stroke();
			ctx2d.beginPath();
			const engine = getEngine();
			const data = armed ? engine.getByteTimeDomain() : null;
			if (!data) {
				ctx2d.strokeStyle = muted;
				ctx2d.moveTo(0, height / 2);
				ctx2d.lineTo(width, height / 2);
			} else {
				ctx2d.strokeStyle = accent;
				ctx2d.lineWidth = 1.6;
				ctx2d.shadowColor = accent;
				ctx2d.shadowBlur = 8;
				const n = data.length;
				for (let i = 0; i < n; i++) {
					const x = i / (n - 1) * width;
					const y = data[i] / 255 * height;
					if (i === 0) ctx2d.moveTo(x, y);
					else ctx2d.lineTo(x, y);
				}
			}
			ctx2d.stroke();
			ctx2d.shadowBlur = 0;
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);
		return () => {
			alive = false;
			cancelAnimationFrame(frame);
		};
	}, [armed]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "scope-well relative min-h-[7.5rem] overflow-hidden rounded-md bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
			ref: canvasRef,
			className: "block h-32 w-full sm:h-36",
			"aria-label": "Oscilloscope"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "pointer-events-none absolute left-3 top-2 font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-subtle",
			children: "Scope"
		})]
	});
}
function WaveIcon({ id }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 22 24",
		className: "size-5",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: id === "sine" ? "M2 12c3-8 5 8 8 0s5 8 8 0" : id === "triangle" ? "M2 16 L8 8 L14 16 L20 8" : id === "sawtooth" ? "M3 16 L3 8 L17 16 L17 8" : "M4 16 V8 H11 V16 H18 V8",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
function WaveformSelect({ value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "radiogroup",
		"aria-label": "Waveform",
		className: "flex rounded-lg bg-surface-2 p-1",
		children: WAVEFORMS.map((wave) => {
			const selected = wave.id === value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "radio",
				"aria-checked": selected,
				"aria-label": wave.label,
				onClick: () => onChange(wave.id),
				className: cn("flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md px-2.5", "text-muted transition-[color,background-color,transform] duration-(--motion-quick) ease-(--ease-out)", "hover:text-fg active:scale-[0.96]", selected && "bg-surface text-accent"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveIcon, { id: wave.id }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "sr-only",
					children: wave.label
				})]
			}, wave.id);
		})
	});
}
function VoltaApp() {
	const armed = useSynthStore((s) => s.armed);
	const waveform = useSynthStore((s) => s.waveform);
	const octave = useSynthStore((s) => s.octave);
	const held = useSynthStore((s) => s.held);
	const cutoff = useSynthStore((s) => s.cutoff);
	const resonance = useSynthStore((s) => s.resonance);
	const attack = useSynthStore((s) => s.attack);
	const decay = useSynthStore((s) => s.decay);
	const sustain = useSynthStore((s) => s.sustain);
	const release = useSynthStore((s) => s.release);
	const volume = useSynthStore((s) => s.volume);
	const setWaveform = useSynthStore((s) => s.setWaveform);
	const setCutoff = useSynthStore((s) => s.setCutoff);
	const setResonance = useSynthStore((s) => s.setResonance);
	const setAttack = useSynthStore((s) => s.setAttack);
	const setDecay = useSynthStore((s) => s.setDecay);
	const setSustain = useSynthStore((s) => s.setSustain);
	const setRelease = useSynthStore((s) => s.setRelease);
	const setVolume = useSynthStore((s) => s.setVolume);
	const shiftOctave = useSynthStore((s) => s.shiftOctave);
	const lowest = midiToName(48 + octave * 12);
	const current = held.length ? midiToName(held[held.length - 1]) : "—";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		"data-armed": armed ? "true" : "false",
		"data-waveform": waveform,
		"data-octave": octave,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComputerKeys, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-sans text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted",
						children: "Subtractive instrument"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl",
						children: "VOLTA"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-muted",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5", armed ? "text-accent" : "text-muted"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", armed ? "bg-accent" : "bg-subtle") }), armed ? "Live" : "Standby"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden tabular-nums sm:inline",
						children: "8 voice"
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative flex flex-1 flex-col gap-4 rounded-xl bg-surface p-3 shadow-panel sm:gap-5 sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-4 lg:flex-row lg:items-stretch",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0 flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scope, { armed })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-stretch gap-3 sm:gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelMeter, { armed }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-w-0 flex-1 flex-col justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted",
										children: "Wave"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformSelect, {
										value: waveform,
										onChange: setWaveform
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-sans text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted",
										children: "Octave"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": "Octave down",
												onClick: () => shiftOctave(-1),
												className: "flex size-11 items-center justify-center rounded-md bg-surface-2 text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {
													className: "size-4",
													strokeWidth: 2
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex min-w-16 flex-1 flex-col items-center",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-display text-xl font-medium tabular-nums text-fg",
													children: octave > 0 ? `+${octave}` : octave
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[0.65rem] uppercase tracking-[0.14em] text-muted",
													children: lowest
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": "Octave up",
												onClick: () => shiftOctave(1),
												className: "flex size-11 items-center justify-center rounded-md bg-surface-2 text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
													className: "size-4",
													strokeWidth: 2
												})
											})
										]
									})]
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-4 justify-items-center gap-y-4 sm:grid-cols-8",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Cutoff",
								value: cutoff,
								display: formatHz(cutoffHz(cutoff)),
								onChange: setCutoff,
								defaultValue: .72
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Res",
								value: resonance,
								display: formatPct(resonance),
								onChange: setResonance,
								defaultValue: .18
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Attack",
								value: attack,
								display: formatMs(attackSec(attack)),
								onChange: setAttack,
								defaultValue: .1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Decay",
								value: decay,
								display: formatMs(decaySec(decay)),
								onChange: setDecay,
								defaultValue: .28
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Sustain",
								value: sustain,
								display: formatPct(sustain),
								onChange: setSustain,
								defaultValue: .68
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Release",
								value: release,
								display: formatMs(releaseSec(release)),
								onChange: setRelease,
								defaultValue: .32
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
								label: "Volume",
								value: volume,
								display: formatPct(volume),
								onChange: setVolume,
								defaultValue: .72
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex w-16 flex-col items-center justify-center gap-1 sm:w-[4.5rem]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-sans text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted",
									children: "Note"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-display text-lg font-medium tabular-nums text-fg",
									children: current
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-hidden rounded-lg bg-bg p-1.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-1 text-pretty text-xs leading-relaxed text-muted",
						children: "Computer keys Z–M and Q–I play two octaves. [ and ] shift octave. Esc silences. Drag knobs vertically — double-tap to reset."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArmGate, {})
				]
			})]
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoltaApp, {});
}
//#endregion
export { Home as component };
