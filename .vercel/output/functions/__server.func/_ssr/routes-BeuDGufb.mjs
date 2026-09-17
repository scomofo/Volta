import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Plus, r as Minus } from "../_libs/lucide-react.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BeuDGufb.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var OSC_WAVES = [
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
	},
	{
		id: "pulse",
		label: "Pulse"
	}
];
var FOOTAGES = [
	{
		id: "32",
		label: "32′",
		ratio: .25
	},
	{
		id: "16",
		label: "16′",
		ratio: .5
	},
	{
		id: "8",
		label: "8′",
		ratio: 1
	},
	{
		id: "4",
		label: "4′",
		ratio: 2
	},
	{
		id: "2",
		label: "2′",
		ratio: 4
	},
	{
		id: "LO",
		label: "LO",
		ratio: 0
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
function formatTune(t) {
	const st = (t - .5) * 14;
	if (Math.abs(st) < .05) return "0.0";
	return `${st > 0 ? "+" : ""}${st.toFixed(1)}`;
}
function footageRatio(footage) {
	const found = FOOTAGES.find((f) => f.id === footage);
	return found && found.ratio > 0 ? found.ratio : 1;
}
var LADDER_WORKLET = `
class MoogLadderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "cutoff", defaultValue: 1200, minValue: 20, maxValue: 18000, automationRate: "a-rate" },
      { name: "resonance", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" }
    ];
  }
  constructor() {
    super();
    this.y1 = 0; this.y2 = 0; this.y3 = 0; this.y4 = 0;
    this.t1 = 0; this.t2 = 0; this.t3 = 0; this.t4 = 0;
    this.dc = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const inp = input && input[0] ? input[0] : null;
    const out = output[0];
    const n = out.length;
    const cut = parameters.cutoff;
    const resArr = parameters.resonance;
    const res = (resArr.length === 1 ? resArr[0] : resArr[0]) || 0.3;
    const k = res * 4.2;
    const sr = sampleRate;
    for (let i = 0; i < n; i++) {
      const hz = cut.length === 1 ? cut[0] : cut[i];
      let f = (2 * hz) / sr;
      if (f > 0.86) f = 0.86;
      if (f < 0.0002) f = 0.0002;
      const fc = f * 1.16;
      const f2 = fc * fc;
      const xIn = inp ? inp[i] : 0;
      let x = xIn - this.y4 * k * (1 - 0.15 * f2);
      x = Math.tanh(x);
      this.y1 += fc * (x - this.t1); this.t1 = Math.tanh(this.y1);
      this.y2 += fc * (this.t1 - this.t2); this.t2 = Math.tanh(this.y2);
      this.y3 += fc * (this.t2 - this.t3); this.t3 = Math.tanh(this.y3);
      this.y4 += fc * (this.t3 - this.t4); this.t4 = Math.tanh(this.y4);
      this.dc = this.dc * 0.995 + this.y4 * 0.005;
      out[i] = this.y4 - this.dc;
    }
    for (let c = 1; c < output.length; c++) output[c].set(out);
    return true;
  }
}
registerProcessor("moog-ladder", MoogLadderProcessor);
`;
var DEFAULT_PARAMS = {
	osc1Wave: "sawtooth",
	osc1Footage: "8",
	osc2Wave: "sawtooth",
	osc2Footage: "8",
	osc2Tune: .52,
	osc3Wave: "sawtooth",
	osc3Footage: "16",
	osc3Tune: .48,
	osc3Follow: true,
	mix1: .74,
	mix2: .62,
	mix3: .42,
	mixNoise: 0,
	cutoff: .58,
	emphasis: .32,
	contour: .55,
	filterAttack: .08,
	filterDecay: .42,
	filterSustain: .28,
	filterTrack: .66,
	ampAttack: .06,
	ampDecay: .48,
	ampSustain: .82,
	glide: 0,
	pitchMod: 0,
	filterMod: 0,
	volume: .72,
	tune: .5,
	a440: false
};
function cutoffHz(t) {
	return expMap(t, 40, 14e3);
}
function attackSec(t) {
	return expMap(t, .001, 3);
}
function decaySec(t) {
	return expMap(t, .04, 12);
}
function glideSec(t) {
	if (t < .02) return 0;
	return expMap(t, .012, 1.4);
}
function createAudioContext() {
	const w = window;
	const Ctor = w.AudioContext ?? w.webkitAudioContext;
	if (!Ctor) throw new Error("Web Audio is not available");
	return new Ctor({ latencyHint: "interactive" });
}
function makeShaper(ctx) {
	const n = 1024;
	const curve = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const x = i / 1023 * 2 - 1;
		curve[i] = Math.tanh(x * 1.55);
	}
	const shaper = ctx.createWaveShaper();
	shaper.curve = curve;
	shaper.oversample = "2x";
	return shaper;
}
function makePulseWave(ctx, duty) {
	const n = 64;
	const real = new Float32Array(n);
	const imag = new Float32Array(n);
	for (let k = 1; k < n; k++) imag[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty);
	return ctx.createPeriodicWave(real, imag);
}
function makeNoiseBuffer(ctx) {
	const length = Math.floor(ctx.sampleRate * 2);
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
	return buffer;
}
function tuneSemis(t) {
	return (t - .5) * 14;
}
var SynthEngine = class {
	ctx = null;
	analyser = null;
	params = { ...DEFAULT_PARAMS };
	oscs = [];
	oscGains = [];
	noise = null;
	noiseGain = null;
	mixer = null;
	vca = null;
	master = null;
	compressor = null;
	ladderWorklet = null;
	biquads = [];
	shaper = null;
	cutoffTargets = [];
	filterEnv = null;
	contourAmt = null;
	ampEnv = null;
	pitchModGain = null;
	filterModGain = null;
	a440Osc = null;
	a440Gain = null;
	pulseWave = null;
	dc = null;
	timeDomain = null;
	stack = [];
	envOpen = false;
	lastMidi = 60;
	workletReady = false;
	get armed() {
		return this.ctx !== null && this.ctx.state !== "closed";
	}
	/** Must run inside a user-gesture call stack. */
	arm() {
		if (typeof window === "undefined") return false;
		if (!this.ctx) {
			this.ctx = createAudioContext();
			this.buildGraph();
			this.upgradeLadder();
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
		return true;
	}
	resume() {
		if (this.ctx?.state === "suspended") this.ctx.resume();
	}
	panic() {
		this.stack = [];
		this.envOpen = false;
		this.releaseEnvelopes(.03);
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
		this.stack = this.stack.filter((m) => m !== midi);
		const legato = this.stack.length > 0 && this.envOpen;
		this.stack.push(midi);
		this.setPitch(midi, legato);
		if (!legato) this.triggerEnvelopes();
		this.envOpen = true;
	}
	noteOff(midi) {
		this.stack = this.stack.filter((m) => m !== midi);
		if (this.stack.length) {
			this.setPitch(this.stack[this.stack.length - 1], true);
			return;
		}
		this.releaseEnvelopes();
		this.envOpen = false;
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
		this.pulseWave = makePulseWave(ctx, .18);
		this.mixer = ctx.createGain();
		this.mixer.gain.value = 1;
		this.shaper = makeShaper(ctx);
		this.biquads = [
			0,
			1,
			2,
			3
		].map(() => {
			const f = ctx.createBiquadFilter();
			f.type = "lowpass";
			f.frequency.value = cutoffHz(this.params.cutoff);
			f.Q.value = .5;
			return f;
		});
		this.biquads[0].connect(this.biquads[1]);
		this.biquads[1].connect(this.biquads[2]);
		this.biquads[2].connect(this.biquads[3]);
		this.cutoffTargets = this.biquads.map((b) => b.frequency);
		this.vca = ctx.createGain();
		this.vca.gain.value = 1;
		this.ampEnv = ctx.createGain();
		this.ampEnv.gain.value = 0;
		this.master = ctx.createGain();
		this.compressor = ctx.createDynamicsCompressor();
		this.compressor.threshold.value = -16;
		this.compressor.knee.value = 10;
		this.compressor.ratio.value = 2.8;
		this.compressor.attack.value = .004;
		this.compressor.release.value = .18;
		this.analyser = ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = .32;
		this.timeDomain = new Uint8Array(this.analyser.fftSize);
		this.mixer.connect(this.shaper);
		this.shaper.connect(this.biquads[0]);
		this.biquads[3].connect(this.ampEnv);
		this.ampEnv.connect(this.vca);
		this.vca.connect(this.master);
		this.master.connect(this.compressor);
		this.compressor.connect(this.analyser);
		this.analyser.connect(ctx.destination);
		this.oscs = [];
		this.oscGains = [];
		for (let i = 0; i < 3; i++) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sawtooth";
			osc.frequency.value = midiToFreq(60);
			osc.connect(gain);
			gain.connect(this.mixer);
			osc.start();
			this.oscs.push(osc);
			this.oscGains.push(gain);
		}
		this.noise = ctx.createBufferSource();
		this.noise.buffer = makeNoiseBuffer(ctx);
		this.noise.loop = true;
		this.noiseGain = ctx.createGain();
		this.noiseGain.gain.value = 0;
		this.noise.connect(this.noiseGain);
		this.noiseGain.connect(this.mixer);
		this.noise.start();
		this.dc = ctx.createConstantSource();
		this.dc.offset.value = 1;
		this.filterEnv = ctx.createGain();
		this.filterEnv.gain.value = 0;
		this.contourAmt = ctx.createGain();
		this.contourAmt.gain.value = 0;
		this.dc.connect(this.filterEnv);
		this.filterEnv.connect(this.contourAmt);
		this.dc.start();
		this.connectToCutoff(this.contourAmt);
		this.pitchModGain = ctx.createGain();
		this.pitchModGain.gain.value = 0;
		this.filterModGain = ctx.createGain();
		this.filterModGain.gain.value = 0;
		this.oscs[2].connect(this.pitchModGain);
		this.oscs[2].connect(this.filterModGain);
		this.pitchModGain.connect(this.oscs[0].frequency);
		this.pitchModGain.connect(this.oscs[1].frequency);
		this.connectToCutoff(this.filterModGain);
		this.a440Gain = ctx.createGain();
		this.a440Gain.gain.value = 0;
		this.a440Osc = ctx.createOscillator();
		this.a440Osc.type = "sine";
		this.a440Osc.frequency.value = 440;
		this.a440Osc.connect(this.a440Gain);
		this.a440Gain.connect(this.master);
		this.a440Osc.start();
		this.applyLiveParams();
		this.setCutoff(cutoffHz(this.params.cutoff), ctx.currentTime, .01);
	}
	async upgradeLadder() {
		const ctx = this.ctx;
		if (!ctx || this.workletReady) return;
		try {
			const url = URL.createObjectURL(new Blob([LADDER_WORKLET], { type: "application/javascript" }));
			await ctx.audioWorklet.addModule(url);
			URL.revokeObjectURL(url);
			if (this.ctx !== ctx || !this.shaper || !this.ampEnv || !this.biquads[0]) return;
			const node = new AudioWorkletNode(ctx, "moog-ladder", {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				outputChannelCount: [1]
			});
			const cutoff = node.parameters.get("cutoff");
			const res = node.parameters.get("resonance");
			if (cutoff) cutoff.value = cutoffHz(this.params.cutoff);
			if (res) res.value = this.params.emphasis;
			this.shaper.disconnect();
			this.biquads[3]?.disconnect();
			this.shaper.connect(node);
			node.connect(this.ampEnv);
			this.disconnectCutoff(this.contourAmt);
			this.disconnectCutoff(this.filterModGain);
			this.biquads = [];
			this.ladderWorklet = node;
			this.cutoffTargets = cutoff ? [cutoff] : [];
			this.connectToCutoff(this.contourAmt);
			this.connectToCutoff(this.filterModGain);
			this.workletReady = true;
			this.applyLiveParams();
		} catch {
			this.workletReady = false;
		}
	}
	connectToCutoff(source) {
		if (!source) return;
		for (const param of this.cutoffTargets) try {
			source.connect(param);
		} catch {}
	}
	disconnectCutoff(source) {
		if (!source) return;
		try {
			source.disconnect();
		} catch {}
	}
	applyLiveParams() {
		if (!this.ctx) return;
		const p = this.params;
		const now = this.ctx.currentTime;
		this.applyWave(this.oscs[0], p.osc1Wave);
		this.applyWave(this.oscs[1], p.osc2Wave);
		this.applyWave(this.oscs[2], p.osc3Wave);
		this.setMix(this.oscGains[0], p.mix1 ** 2 * .42);
		this.setMix(this.oscGains[1], p.mix2 ** 2 * .42);
		this.setMix(this.oscGains[2], p.mix3 ** 2 * .38);
		this.setMix(this.noiseGain, p.mixNoise ** 2 * .28);
		if (this.master) this.master.gain.setTargetAtTime(p.volume ** 2 * .5, now, .03);
		if (this.a440Gain) this.a440Gain.gain.setTargetAtTime(p.a440 ? .12 : 0, now, .02);
		if (this.contourAmt) this.contourAmt.gain.setTargetAtTime(p.contour * 7200, now, .02);
		if (this.pitchModGain) this.pitchModGain.gain.setTargetAtTime(p.pitchMod * 48, now, .02);
		if (this.filterModGain) this.filterModGain.gain.setTargetAtTime(p.filterMod * 1800, now, .02);
		if (this.ladderWorklet) this.ladderWorklet.parameters.get("resonance")?.setTargetAtTime(p.emphasis, now, .02);
		else {
			const q = .5 + p.emphasis * 14;
			this.biquads[3]?.Q.setTargetAtTime(q, now, .02);
		}
		this.setCutoff(this.trackedCutoff(), now, .03);
		this.setPitch(this.lastMidi, false);
	}
	setMix(node, value) {
		if (!node || !this.ctx) return;
		node.gain.setTargetAtTime(value, this.ctx.currentTime, .02);
	}
	applyWave(osc, wave) {
		if (!osc) return;
		if (wave === "pulse") {
			if (this.pulseWave) osc.setPeriodicWave(this.pulseWave);
			return;
		}
		osc.type = wave;
	}
	oscFreq(index, midi) {
		const p = this.params;
		const master = tuneSemis(p.tune);
		if (index === 0) return midiToFreq(midi) * footageRatio(p.osc1Footage) * 2 ** (master / 12);
		if (index === 1) {
			const det = master + tuneSemis(p.osc2Tune);
			return midiToFreq(midi) * footageRatio(p.osc2Footage) * 2 ** (det / 12);
		}
		const follow = p.osc3Follow ? midi : this.lastMidi;
		if (p.osc3Footage === "LO") {
			const rate = expMap(p.osc3Tune, .12, 22);
			if (!p.osc3Follow) return rate;
			return midiToFreq(follow) * .015625 * 2 ** (tuneSemis(p.osc3Tune) / 12);
		}
		const det = master + tuneSemis(p.osc3Tune);
		return midiToFreq(p.osc3Follow ? midi : 60) * footageRatio(p.osc3Footage) * 2 ** (det / 12);
	}
	setPitch(midi, glide) {
		if (!this.ctx) return;
		this.lastMidi = midi;
		const now = this.ctx.currentTime;
		const time = glideSec(this.params.glide);
		const tau = glide && time > 0 ? Math.max(.008, time * .35) : 0;
		for (let i = 0; i < 3; i++) {
			const osc = this.oscs[i];
			if (!osc) continue;
			const freq = this.oscFreq(i, midi);
			if (tau > 0) osc.frequency.setTargetAtTime(freq, now, tau);
			else osc.frequency.setValueAtTime(freq, now);
		}
		this.setCutoff(this.trackedCutoff(), now, .02);
	}
	trackedCutoff() {
		const base = cutoffHz(this.params.cutoff);
		const track = 2 ** ((this.lastMidi - 60) / 12 * this.params.filterTrack * .7);
		return Math.min(16e3, base * track);
	}
	setCutoff(hz, now, tau) {
		for (const param of this.cutoffTargets) param.setTargetAtTime(Math.max(20, hz), now, tau);
	}
	triggerEnvelopes() {
		if (!this.ctx || !this.ampEnv || !this.filterEnv) return;
		const now = this.ctx.currentTime;
		const p = this.params;
		const aA = attackSec(p.ampAttack);
		const aD = decaySec(p.ampDecay);
		const fA = attackSec(p.filterAttack);
		const fD = decaySec(p.filterDecay);
		const amp = this.ampEnv.gain;
		amp.cancelScheduledValues(now);
		amp.setValueAtTime(1e-4, now);
		amp.linearRampToValueAtTime(1, now + aA);
		amp.linearRampToValueAtTime(Math.max(1e-4, p.ampSustain), now + aA + aD);
		const filt = this.filterEnv.gain;
		filt.cancelScheduledValues(now);
		filt.setValueAtTime(1e-4, now);
		filt.linearRampToValueAtTime(1, now + fA);
		filt.linearRampToValueAtTime(Math.max(1e-4, p.filterSustain), now + fA + fD);
	}
	releaseEnvelopes(force) {
		if (!this.ctx || !this.ampEnv || !this.filterEnv) return;
		const now = this.ctx.currentTime;
		const ampRel = force ?? decaySec(this.params.ampDecay);
		const filtRel = force ?? decaySec(this.params.filterDecay);
		const amp = this.ampEnv.gain;
		const ampNow = Math.max(amp.value, 1e-4);
		amp.cancelScheduledValues(now);
		amp.setValueAtTime(ampNow, now);
		amp.exponentialRampToValueAtTime(1e-4, now + Math.max(.02, ampRel));
		const filt = this.filterEnv.gain;
		const filtNow = Math.max(filt.value, 1e-4);
		filt.cancelScheduledValues(now);
		filt.setValueAtTime(filtNow, now);
		filt.exponentialRampToValueAtTime(1e-4, now + Math.max(.02, filtRel));
	}
};
var singleton = null;
function getEngine() {
	if (!singleton) singleton = new SynthEngine();
	return singleton;
}
function pushHeld(held, midi) {
	return held.includes(midi) ? held : [...held, midi];
}
function dropHeld(held, midi) {
	return held.filter((n) => n !== midi);
}
var useSynthStore = create((set) => ({
	armed: false,
	octave: 0,
	held: [],
	...DEFAULT_PARAMS,
	arm: () => {
		if (!getEngine().arm()) return;
		const s = useSynthStore.getState();
		getEngine().setParams({
			osc1Wave: s.osc1Wave,
			osc1Footage: s.osc1Footage,
			osc2Wave: s.osc2Wave,
			osc2Footage: s.osc2Footage,
			osc2Tune: s.osc2Tune,
			osc3Wave: s.osc3Wave,
			osc3Footage: s.osc3Footage,
			osc3Tune: s.osc3Tune,
			osc3Follow: s.osc3Follow,
			mix1: s.mix1,
			mix2: s.mix2,
			mix3: s.mix3,
			mixNoise: s.mixNoise,
			cutoff: s.cutoff,
			emphasis: s.emphasis,
			contour: s.contour,
			filterAttack: s.filterAttack,
			filterDecay: s.filterDecay,
			filterSustain: s.filterSustain,
			filterTrack: s.filterTrack,
			ampAttack: s.ampAttack,
			ampDecay: s.ampDecay,
			ampSustain: s.ampSustain,
			glide: s.glide,
			pitchMod: s.pitchMod,
			filterMod: s.filterMod,
			volume: s.volume,
			tune: s.tune,
			a440: s.a440
		});
		set({ armed: true });
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
	patch: (partial) => {
		getEngine().setParams(partial);
		set(partial);
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
			className: "flex max-w-sm flex-col items-center gap-5 rounded-xl bg-panel px-8 py-8 text-center text-panel-fg shadow-panel",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex size-12 items-center justify-center rounded-full bg-walnut text-accent",
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
						className: "font-display text-2xl font-medium tracking-tight text-panel-fg",
						children: "Arm oscillators"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-pretty text-sm leading-relaxed text-panel-muted",
						children: "Three VCOs and a ladder filter stay silent until a gesture. Tap to start."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-md bg-walnut px-4 py-2.5 text-sm font-medium text-cream",
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
function FootageSelect({ value, onChange, allowLo = false, label = "Range" }) {
	const options = allowLo ? FOOTAGES : FOOTAGES.filter((f) => f.id !== "LO");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "radiogroup",
		"aria-label": label,
		className: "flex flex-wrap justify-center gap-0.5",
		children: options.map((opt) => {
			const selected = opt.id === value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				role: "radio",
				"aria-checked": selected,
				onClick: () => onChange(opt.id),
				className: cn("min-h-8 min-w-8 rounded-sm px-1.5 font-sans text-micro font-medium tracking-wide", "text-panel-muted transition-[color,background-color] duration-(--motion-quick) ease-(--ease-out)", "hover:text-panel-fg", selected && "bg-walnut text-cream"),
				children: opt.label
			}, opt.id);
		})
	});
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
function Knob({ label, value, display, onChange, defaultValue = .5, disabled = false, tone = "default" }) {
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
		const range = 130;
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
		className: "flex w-14 flex-col items-center gap-1 sm:w-16",
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
				className: cn("knob relative size-12 touch-none rounded-full sm:size-14", tone === "filter" ? "knob-filter" : "bg-walnut text-cream", "transition-[box-shadow,transform] duration-(--motion-quick) ease-(--ease-out)", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70", "active:scale-[0.98]", disabled && "pointer-events-none opacity-50"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					className: cn("pointer-events-none absolute inset-[20%] rounded-full", tone === "filter" ? "bg-accent/30" : "bg-panel/15")
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					className: "pointer-events-none absolute inset-0 origin-center",
					style: { transform: `rotate(${angle}deg)` },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("absolute left-1/2 top-[8%] h-[24%] w-0.5 -translate-x-1/2 rounded-full", tone === "filter" ? "bg-cream" : "bg-accent") })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				htmlFor: id,
				className: "text-center font-sans text-micro font-medium uppercase tracking-[0.12em] text-panel-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-sans text-xs tabular-nums text-panel-fg",
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
			className: "font-sans text-micro font-medium uppercase tracking-[0.16em] text-muted",
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
function Rocker({ label, pressed, onPressedChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		role: "switch",
		"aria-checked": pressed,
		"aria-label": label,
		onClick: () => onPressedChange(!pressed),
		className: cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5", "text-micro font-medium uppercase tracking-[0.14em]", "transition-[background-color,color,transform] duration-(--motion-quick) ease-(--ease-out)", "active:scale-[0.98]", pressed ? "bg-walnut text-cream" : "bg-walnut/10 text-panel-muted"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "tabular-nums",
			children: pressed ? "On" : "Off"
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
			const bg = readToken("--color-walnut", "#241c16");
			const grid = readToken("--color-border", "#3a2f26");
			const accent = readToken("--color-accent", "#c45c32");
			const muted = readToken("--color-subtle", "#7a6c5e");
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
		className: "size-4",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: id === "triangle" ? "M2 16 L8 8 L14 16 L20 8" : id === "sawtooth" ? "M3 16 L3 8 L17 16 L17 8" : id === "square" ? "M4 16 V8 H11 V16 H18 V8" : "M4 16 V8 H7 V16 H20",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
function WaveformSelect({ value, onChange, label = "Waveform" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "radiogroup",
		"aria-label": label,
		className: "flex rounded-md bg-walnut/10 p-0.5",
		children: OSC_WAVES.map((wave) => {
			const selected = wave.id === value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "radio",
				"aria-checked": selected,
				"aria-label": wave.label,
				onClick: () => onChange(wave.id),
				className: cn("flex min-h-9 min-w-9 flex-1 items-center justify-center rounded-sm px-1.5", "text-panel-muted transition-[color,background-color,transform] duration-(--motion-quick) ease-(--ease-out)", "hover:text-panel-fg active:scale-[0.96]", selected && "bg-walnut text-cream"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveIcon, { id: wave.id }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "sr-only",
					children: wave.label
				})]
			}, wave.id);
		})
	});
}
function silk(title) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: "font-sans text-micro font-medium uppercase tracking-[0.2em] text-panel-muted",
		children: title
	});
}
function VoltaApp() {
	const armed = useSynthStore((s) => s.armed);
	const octave = useSynthStore((s) => s.octave);
	const held = useSynthStore((s) => s.held);
	const patch = useSynthStore((s) => s.patch);
	const shiftOctave = useSynthStore((s) => s.shiftOctave);
	const s = useSynthStore();
	const lowest = midiToName(48 + octave * 12);
	const current = held.length ? midiToName(held[held.length - 1]) : "—";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col overflow-x-hidden bg-bg text-fg",
		"data-armed": armed ? "true" : "false",
		"data-waveform": s.osc1Wave,
		"data-octave": octave,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComputerKeys, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-3 px-3 py-4 sm:gap-4 sm:px-5 sm:py-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-sans text-micro font-medium uppercase tracking-[0.22em] text-muted",
						children: "Monophonic ladder"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl",
						children: "VOLTA"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: cn("inline-flex items-center gap-2 rounded-full bg-walnut px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em]", armed ? "text-accent" : "text-muted"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", armed ? "bg-accent" : "bg-subtle") }), armed ? "Live" : "Standby"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden text-xs font-medium uppercase tracking-[0.14em] text-muted sm:inline",
							children: "Last note · 3 VCO"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Octave down",
									onClick: () => shiftOctave(-1),
									className: "flex size-11 items-center justify-center rounded-md bg-walnut text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {
										className: "size-4",
										strokeWidth: 2
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-14 text-center",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block font-display text-lg font-medium tabular-nums text-fg",
										children: octave > 0 ? `+${octave}` : octave
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-micro uppercase tracking-[0.14em] text-muted",
										children: lowest
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Octave up",
									onClick: () => shiftOctave(1),
									className: "flex size-11 items-center justify-center rounded-md bg-walnut text-fg transition-transform duration-(--motion-quick) ease-(--ease-out) hover:text-accent active:scale-[0.96]",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
										className: "size-4",
										strokeWidth: 2
									})
								})
							]
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative flex min-w-0 flex-1 flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "wood-frame min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "overflow-x-auto overscroll-x-contain bg-panel text-panel-fg",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex w-max gap-3 p-3 sm:p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex shrink-0 flex-col gap-3 sm:min-w-40",
										children: [
											silk("Controllers"),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Tune",
													value: s.tune,
													display: formatTune(s.tune),
													onChange: (tune) => patch({ tune }),
													defaultValue: DEFAULT_PARAMS.tune
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Glide",
													value: s.glide,
													display: s.glide < .02 ? "Off" : formatMs(glideSec(s.glide)),
													onChange: (glide) => patch({ glide }),
													defaultValue: DEFAULT_PARAMS.glide
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Pitch mod",
													value: s.pitchMod,
													display: formatPct(s.pitchMod),
													onChange: (pitchMod) => patch({ pitchMod }),
													defaultValue: DEFAULT_PARAMS.pitchMod
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Filt mod",
													value: s.filterMod,
													display: formatPct(s.filterMod),
													onChange: (filterMod) => patch({ filterMod }),
													defaultValue: DEFAULT_PARAMS.filterMod
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocker, {
												label: "Osc 3 control",
												pressed: s.osc3Follow,
												onPressedChange: (osc3Follow) => patch({ osc3Follow })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocker, {
												label: "A-440",
												pressed: s.a440,
												onPressedChange: (a440) => patch({ a440 })
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "silk-rule hidden self-stretch sm:block" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex min-w-72 flex-1 flex-col gap-3 sm:min-w-0",
										children: [silk("Oscillator bank"), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-3 gap-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OscColumn, {
													title: "Osc 1",
													wave: s.osc1Wave,
													footage: s.osc1Footage,
													onWave: (osc1Wave) => patch({ osc1Wave }),
													onFootage: (osc1Footage) => patch({ osc1Footage })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OscColumn, {
													title: "Osc 2",
													wave: s.osc2Wave,
													footage: s.osc2Footage,
													onWave: (osc2Wave) => patch({ osc2Wave }),
													onFootage: (osc2Footage) => patch({ osc2Footage }),
													tune: s.osc2Tune,
													onTune: (osc2Tune) => patch({ osc2Tune })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OscColumn, {
													title: "Osc 3",
													wave: s.osc3Wave,
													footage: s.osc3Footage,
													onWave: (osc3Wave) => patch({ osc3Wave }),
													onFootage: (osc3Footage) => patch({ osc3Footage }),
													tune: s.osc3Tune,
													onTune: (osc3Tune) => patch({ osc3Tune }),
													allowLo: true
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "silk-rule hidden self-stretch sm:block" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex shrink-0 flex-col gap-3",
										children: [
											silk("Mixer"),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Osc 1",
													value: s.mix1,
													display: formatPct(s.mix1),
													onChange: (mix1) => patch({ mix1 }),
													defaultValue: DEFAULT_PARAMS.mix1
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Osc 2",
													value: s.mix2,
													display: formatPct(s.mix2),
													onChange: (mix2) => patch({ mix2 }),
													defaultValue: DEFAULT_PARAMS.mix2
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Osc 3",
													value: s.mix3,
													display: formatPct(s.mix3),
													onChange: (mix3) => patch({ mix3 }),
													defaultValue: DEFAULT_PARAMS.mix3
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Noise",
													value: s.mixNoise,
													display: formatPct(s.mixNoise),
													onChange: (mixNoise) => patch({ mixNoise }),
													defaultValue: DEFAULT_PARAMS.mixNoise
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "silk-rule hidden self-stretch sm:block" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex shrink-0 flex-col gap-3",
										children: [
											silk("Modifiers"),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Cutoff",
														value: s.cutoff,
														display: formatHz(cutoffHz(s.cutoff)),
														onChange: (cutoff) => patch({ cutoff }),
														defaultValue: DEFAULT_PARAMS.cutoff,
														tone: "filter"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Emphasis",
														value: s.emphasis,
														display: formatPct(s.emphasis),
														onChange: (emphasis) => patch({ emphasis }),
														defaultValue: DEFAULT_PARAMS.emphasis,
														tone: "filter"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Contour",
														value: s.contour,
														display: formatPct(s.contour),
														onChange: (contour) => patch({ contour }),
														defaultValue: DEFAULT_PARAMS.contour,
														tone: "filter"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-center text-micro uppercase tracking-[0.16em] text-panel-muted",
												children: "Filter contour"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Attack",
														value: s.filterAttack,
														display: formatMs(attackSec(s.filterAttack)),
														onChange: (filterAttack) => patch({ filterAttack }),
														defaultValue: DEFAULT_PARAMS.filterAttack,
														tone: "filter"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Decay",
														value: s.filterDecay,
														display: formatMs(decaySec(s.filterDecay)),
														onChange: (filterDecay) => patch({ filterDecay }),
														defaultValue: DEFAULT_PARAMS.filterDecay,
														tone: "filter"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Sustain",
														value: s.filterSustain,
														display: formatPct(s.filterSustain),
														onChange: (filterSustain) => patch({ filterSustain }),
														defaultValue: DEFAULT_PARAMS.filterSustain,
														tone: "filter"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
												label: "Kbd track",
												value: s.filterTrack,
												display: formatPct(s.filterTrack),
												onChange: (filterTrack) => patch({ filterTrack }),
												defaultValue: DEFAULT_PARAMS.filterTrack,
												tone: "filter"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "silk-rule hidden self-stretch sm:block" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex shrink-0 flex-col gap-3",
										children: [
											silk("Loudness"),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-center text-micro uppercase tracking-[0.16em] text-panel-muted",
												children: "Decay is release"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-center gap-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Attack",
														value: s.ampAttack,
														display: formatMs(attackSec(s.ampAttack)),
														onChange: (ampAttack) => patch({ ampAttack }),
														defaultValue: DEFAULT_PARAMS.ampAttack
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Decay",
														value: s.ampDecay,
														display: formatMs(decaySec(s.ampDecay)),
														onChange: (ampDecay) => patch({ ampDecay }),
														defaultValue: DEFAULT_PARAMS.ampDecay
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
														label: "Sustain",
														value: s.ampSustain,
														display: formatPct(s.ampSustain),
														onChange: (ampSustain) => patch({ ampSustain }),
														defaultValue: DEFAULT_PARAMS.ampSustain
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-end justify-center gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
													label: "Volume",
													value: s.volume,
													display: formatPct(s.volume),
													onChange: (volume) => patch({ volume }),
													defaultValue: DEFAULT_PARAMS.volume
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex w-14 flex-col items-center gap-1 pb-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-sans text-micro font-medium uppercase tracking-[0.12em] text-panel-muted",
														children: "Note"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-display text-lg font-medium tabular-nums text-panel-fg",
														children: current
													})]
												})]
											})
										]
									})
								]
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 items-stretch gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0 flex-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scope, { armed })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelMeter, { armed })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0 overflow-hidden rounded-lg bg-walnut p-1.5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Keyboard, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-1 text-pretty text-xs leading-relaxed text-muted",
						children: "Three free-running oscillators into a 24 dB ladder. Last-note mono, decay is release. Computer keys Z–M and Q–I. [ and ] shift octave. Esc silences."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArmGate, {})
				]
			})]
		})]
	});
}
function OscColumn({ title, wave, footage, onWave, onFootage, tune, onTune, allowLo = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-sans text-micro font-medium uppercase tracking-[0.16em] text-panel-fg",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FootageSelect, {
				value: footage,
				onChange: onFootage,
				allowLo,
				label: `${title} range`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformSelect, {
				value: wave,
				onChange: onWave,
				label: `${title} waveform`
			}),
			onTune != null && tune != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Knob, {
				label: "Freq",
				value: tune,
				display: formatTune(tune),
				onChange: onTune,
				defaultValue: title === "Osc 2" ? DEFAULT_PARAMS.osc2Tune : DEFAULT_PARAMS.osc3Tune
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-[5.75rem]" })
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoltaApp, {});
}
//#endregion
export { Home as component };
