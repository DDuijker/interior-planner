/**
 * JSON parser that remembers where every value starts, so validation
 * errors can point at a line and column. Accepts standard JSON only.
 */

export interface Position {
  line: number;
  col: number;
}

export class JsonSyntaxError extends Error {
  override name = "JsonSyntaxError";
  constructor(
    message: string,
    public readonly position: Position,
  ) {
    super(`${message} (line ${position.line}, column ${position.col})`);
  }
}

export interface Parsed {
  value: unknown;
  /** Path ("rooms.0.rects.1") to the position where that value starts. */
  positions: Map<string, Position>;
}

export function parseWithPositions(text: string): Parsed {
  let i = 0;
  let line = 1;
  let col = 1;
  const positions = new Map<string, Position>();

  const pos = (): Position => ({ line, col });
  const fail = (msg: string): never => {
    throw new JsonSyntaxError(msg, pos());
  };
  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (text[i] === "\n") {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };
  const ws = () => {
    while (i < text.length && /\s/.test(text[i]!)) advance();
  };
  const expect = (ch: string) => {
    if (text[i] !== ch)
      fail(`Expected "${ch}" but found ${text[i] === undefined ? "end of text" : `"${text[i]}"`}`);
    advance();
  };

  function parseString(): string {
    expect('"');
    let out = "";
    while (true) {
      const ch = text[i];
      if (ch === undefined) fail("Unterminated string");
      if (ch === '"') break;
      if (ch === "\n") fail("Line break inside a string");
      if (ch === "\\") {
        const next = text[i + 1];
        const map: Record<string, string> = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        if (next === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("Bad unicode escape");
          out += String.fromCharCode(parseInt(hex, 16));
          advance(6);
          continue;
        }
        if (next === undefined || !(next in map)) fail("Bad escape");
        out += map[next!];
        advance(2);
        continue;
      }
      out += ch;
      advance();
    }
    advance();
    return out;
  }

  function parseNumber(): number {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) fail(`Unexpected "${text[i]}"`);
    advance(m![0].length);
    return Number(m![0]);
  }

  function parseValue(path: string): unknown {
    ws();
    positions.set(path, pos());
    const ch = text[i];
    if (ch === "{") {
      advance();
      const obj: Record<string, unknown> = {};
      ws();
      if (text[i] === "}") {
        advance();
        return obj;
      }
      while (true) {
        ws();
        const key = parseString();
        ws();
        expect(":");
        obj[key] = parseValue(path ? `${path}.${key}` : key);
        ws();
        if (text[i] === ",") {
          advance();
          continue;
        }
        if (text[i] === "}") {
          advance();
          return obj;
        }
        fail(`Expected "," or "}"`);
      }
    }
    if (ch === "[") {
      advance();
      const arr: unknown[] = [];
      ws();
      if (text[i] === "]") {
        advance();
        return arr;
      }
      while (true) {
        arr.push(parseValue(path ? `${path}.${arr.length}` : String(arr.length)));
        ws();
        if (text[i] === ",") {
          advance();
          continue;
        }
        if (text[i] === "]") {
          advance();
          return arr;
        }
        fail(`Expected "," or "]"`);
      }
    }
    if (ch === '"') return parseString();
    if (text.startsWith("true", i)) {
      advance(4);
      return true;
    }
    if (text.startsWith("false", i)) {
      advance(5);
      return false;
    }
    if (text.startsWith("null", i)) {
      advance(4);
      return null;
    }
    if (ch === undefined) fail("Unexpected end of text");
    return parseNumber();
  }

  const value = parseValue("");
  ws();
  if (i < text.length) fail("Unexpected text after the end");
  return { value, positions };
}

/** Position of the deepest known ancestor of `path`. */
export function positionOf(positions: Map<string, Position>, path: (string | number)[]): Position {
  for (let n = path.length; n >= 0; n--) {
    const p = positions.get(path.slice(0, n).join("."));
    if (p) return p;
  }
  return { line: 1, col: 1 };
}
