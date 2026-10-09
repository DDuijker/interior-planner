/**
 * Error report (E12): a plain-text summary the user can read, copy and
 * share themselves. It is never sent anywhere by the app. Anything that
 * could be private is scrubbed: API keys, URL query strings and fragments,
 * e-mail addresses.
 */

export interface ErrorReportInput {
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  version?: string;
  time: Date;
}

const KEY = /sk-ant-[A-Za-z0-9_-]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function scrub(text: string): string {
  return text
    .replace(KEY, "[key removed]")
    .replace(EMAIL, "[e-mail removed]")
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, "$1");
}

export function buildErrorReport(input: ErrorReportInput): string {
  const lines = [
    "Maison error report",
    `Time: ${input.time.toISOString()}`,
    input.version ? `Version: ${input.version}` : "",
    input.url ? `Page: ${input.url}` : "",
    input.userAgent ? `Browser: ${input.userAgent}` : "",
    "",
    `Error: ${input.message}`,
    input.stack ? `\nStack:\n${input.stack.split("\n").slice(0, 15).join("\n")}` : "",
    input.componentStack
      ? `\nComponents:\n${input.componentStack.trim().split("\n").slice(0, 10).join("\n")}`
      : "",
  ];
  return scrub(lines.filter((l, i) => l !== "" || i === 5).join("\n"));
}
