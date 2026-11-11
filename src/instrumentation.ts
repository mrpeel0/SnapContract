export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startChannels } = await import("./lib/channels");
    startChannels();
  }
}
