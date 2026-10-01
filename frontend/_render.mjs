import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(" ")); origError(...a); };

const { createRoot } = await import("react-dom/client");
const React = (await import("react")).default;
const App = (await import("./src/App.jsx")).default;

const root = createRoot(document.getElementById("root"));
try {
  root.render(React.createElement(App));
  await new Promise((r) => setTimeout(r, 900));
  const html = document.getElementById("root").innerHTML;
  const hasUsername = html.includes('type="text"');
  const crash = errors.filter((e) => e.includes("Cannot read properties of undefined"));
  console.log("RESULT rendered_bytes=" + html.length);
  console.log("RESULT login_input_present=" + hasUsername);
  console.log("RESULT undefined_crash=" + (crash.length ? crash[0].slice(0, 140) : "NONE"));
} catch (e) {
  console.log("RESULT RENDER_THREW: " + e.message);
}
