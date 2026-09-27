export const LADDER_WORKLET = `
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
    const res = resArr[0] ?? 0.3;
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
