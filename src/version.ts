// Three-field release rule: this constant, package.json, and server.json move
// together (test/release.test.ts pins it). Lives in its own module so the HTTP
// client can name itself without importing the server entry point.
export const VERSION = "0.4.0";
