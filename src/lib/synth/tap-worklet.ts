/**
 * Tap worklet: a pure audio sink that copies the master output (post
 * analyser, i.e. exactly what the player hears) and posts each block to
 * the main thread for recording. It has no outputs and never touches the
 * audible graph.
 *
 * Loaded via Blob URL like the ladder/swarm worklets.
 */
export const TAP_WORKLET = `
class VoltaTapProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const chans = [];
      for (let c = 0; c < input.length; c++) {
        chans.push(input[c].slice(0));
      }
      this.port.postMessage({ channels: chans });
    }
    return true;
  }
}
registerProcessor("volta-tap", VoltaTapProcessor);
`;
