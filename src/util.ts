export function logWarning(msg: string) {
  console.error(`%c${msg}`, "color: red");
}

export function logSuccess(msg: string) {
  console.error(`%c${msg}`, "color: green");
}

export function logEmphasis(msg: string) {
  console.error(`%c${msg}`, "color: blue");
}
