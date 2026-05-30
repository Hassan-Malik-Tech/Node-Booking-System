// A Promise remains pending until it is either resolved or rejected.
// The Promise starts pending. setTimeout waits for the given milliseconds,
// then calls resolve(), which settles the Promise successfully and lets await continue.
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
