export type FormulaCellReader = (address: string) => unknown;

type Token =
  | { type: "number"; value: number }
  | { type: "cell"; value: string }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: string }
  | { type: "left" | "right" | "separator" | "colon" | "percent" };

type RangeValue = { start: string; end: string };
type FormulaValue = number | string | boolean | RangeValue;

const CELL = /^\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/i;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    if (/^\s+/.test(rest)) { index += rest.match(/^\s+/)![0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
    if (number) { tokens.push({ type: "number", value: Number(number[0]) }); index += number[0].length; continue; }
    const word = /^\$?[A-Z]{1,3}\$?[1-9][0-9]*/i.exec(rest);
    if (word) { tokens.push({ type: "cell", value: word[0].replace(/\$/g, "").toUpperCase() }); index += word[0].length; continue; }
    const identifier = /^[A-Z_][A-Z0-9_]*/i.exec(rest);
    if (identifier) { tokens.push({ type: "identifier", value: identifier[0].toUpperCase() }); index += identifier[0].length; continue; }
    const comparison = /^(<=|>=|<>|=|<|>)/.exec(rest);
    if (comparison) { tokens.push({ type: "operator", value: comparison[0] }); index += comparison[0].length; continue; }
    const char = source[index++];
    if (char === "+" || char === "-" || char === "*" || char === "/" || char === "^") tokens.push({ type: "operator", value: char });
    else if (char === "(") tokens.push({ type: "left" });
    else if (char === ")") tokens.push({ type: "right" });
    else if (char === "," || char === ";") tokens.push({ type: "separator" });
    else if (char === ":") tokens.push({ type: "colon" });
    else if (char === "%") tokens.push({ type: "percent" });
    else throw new Error(`Аломати формула дастгирӣ намешавад: ${char}`);
  }
  return tokens;
}

function columnNumber(letters: string) {
  return [...letters].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function expandRange(start: string, end: string) {
  const a = CELL.exec(start), b = CELL.exec(end);
  if (!a || !b) throw new Error("Диапазони ҳуҷайра нодуруст аст.");
  const startCol = columnNumber(a[1].toUpperCase()), endCol = columnNumber(b[1].toUpperCase());
  const startRow = Number(a[2]), endRow = Number(b[2]);
  if (Math.abs(endCol - startCol) > 100 || Math.abs(endRow - startRow) > 1000) throw new Error("Диапазон аз ҳад калон аст.");
  const addresses: string[] = [];
  for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
    for (let col = Math.min(startCol, endCol); col <= Math.max(startCol, endCol); col++) {
      let n = col, letters = "";
      while (n > 0) { const rem = (n - 1) % 26; letters = String.fromCharCode(65 + rem) + letters; n = Math.floor((n - 1) / 26); }
      addresses.push(`${letters}${row}`);
    }
  }
  return addresses;
}

function numeric(value: FormulaValue | unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  if (value === null || value === undefined || value === "") return 0;
  throw new Error("Формула ба ҳуҷайраи ғайрирақамӣ ишора мекунад.");
}

export function evaluateFinanceFormula(formula: string, readCell: FormulaCellReader): number {
  const source = formula.trim().startsWith("=") ? formula.trim().slice(1) : formula.trim();
  if (!source || source.length > 500) throw new Error("Формула холӣ ё аз ҳад дароз аст.");
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (type: Token["type"]) => {
    const token = take();
    if (!token || token.type !== type) throw new Error("Сохтори формула нодуруст аст.");
    return token;
  };
  const readReference = (address: string) => numeric(readCell(address));
  const compare = (left: FormulaValue, operator: string, right: FormulaValue): number => {
    const a = numeric(left), b = numeric(right);
    const result = operator === "=" ? a === b : operator === "<>" ? a !== b : operator === "<" ? a < b : operator === ">" ? a > b : operator === "<=" ? a <= b : a >= b;
    return result ? 1 : 0;
  };
  const parseComparison = (): FormulaValue => {
    const left = parseAdditive();
    const token = peek();
    if (token?.type === "operator" && ["=", "<>", "<", ">", "<=", ">="].includes(token.value)) {
      take();
      return compare(left, token.value, parseAdditive());
    }
    return left;
  };
  const parseAdditive = (): FormulaValue => {
    let value = parseMultiplicative();
    while (peek()?.type === "operator" && ["+", "-"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      const right = parseMultiplicative();
      value = op === "+" ? numeric(value) + numeric(right) : numeric(value) - numeric(right);
    }
    return value;
  };
  const parseMultiplicative = (): FormulaValue => {
    let value = parsePower();
    while (peek()?.type === "operator" && ["*", "/"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      const right = numeric(parsePower());
      if (op === "/" && right === 0) throw new Error("Ба сифр тақсим кардан мумкин нест.");
      value = op === "*" ? numeric(value) * right : numeric(value) / right;
    }
    return value;
  };
  const parsePower = (): FormulaValue => {
    const left = parseUnary();
    if (peek()?.type === "operator" && (peek() as Extract<Token,{type:"operator"}>).value === "^") {
      take();
      return Math.pow(numeric(left), numeric(parsePower()));
    }
    return left;
  };
  const parseUnary = (): FormulaValue => {
    if (peek()?.type === "operator" && ["+", "-"].includes((peek() as Extract<Token,{type:"operator"}>).value)) {
      const op = (take() as Extract<Token,{type:"operator"}>).value;
      const value = numeric(parseUnary());
      return op === "-" ? -value : value;
    }
    let value = parsePrimary();
    while (peek()?.type === "percent") { take(); value = numeric(value) / 100; }
    return value;
  };
  const parsePrimary = (): FormulaValue => {
    const token = take();
    if (!token) throw new Error("Қисми формула намерасад.");
    if (token.type === "number") return token.value;
    if (token.type === "cell") {
      if (peek()?.type === "colon") {
        take();
        const end = expect("cell") as Extract<Token,{type:"cell"}>;
        return { start: token.value, end: end.value };
      }
      return readReference(token.value);
    }
    if (token.type === "left") {
      const value = parseComparison();
      expect("right");
      return value;
    }
    if (token.type === "identifier") {
      const name = token.value;
      expect("left");
      const args: FormulaValue[] = [];
      if (peek()?.type !== "right") {
        args.push(parseComparison());
        while (peek()?.type === "separator") { take(); args.push(parseComparison()); }
      }
      expect("right");
      const values = args.flatMap((arg) => {
        if (typeof arg === "object" && arg !== null && "start" in arg) {
          const range = arg as RangeValue;
          return expandRange(range.start, range.end).map(readReference);
        }
        return [numeric(arg)];
      });
      if (name === "SUM") return values.reduce((sum, value) => sum + value, 0);
      if (name === "MIN") { if (!values.length) throw new Error("MIN ҳадди ақал як аргумент мехоҳад."); return Math.min(...values); }
      if (name === "MAX") { if (!values.length) throw new Error("MAX ҳадди ақал як аргумент мехоҳад."); return Math.max(...values); }
      if (name === "AVERAGE") { if (!values.length) throw new Error("AVERAGE ҳадди ақал як аргумент мехоҳад."); return values.reduce((sum, value) => sum + value, 0) / values.length; }
      if (name === "ROUND") {
        if (values.length < 1 || values.length > 2) throw new Error("ROUND адад ва шумораи рақамҳои даҳиро мехоҳад.");
        const factor = 10 ** (values[1] ?? 0);
        return Math.round((values[0] + Number.EPSILON) * factor) / factor;
      }
      if (name === "ABS" && values.length === 1) return Math.abs(values[0]);
      if (name === "IF" && args.length === 3) return numeric(args[0]) !== 0 ? numeric(args[1]) : numeric(args[2]);
      throw new Error(`Функсияи ${name} дастгирӣ намешавад.`);
    }
    throw new Error("Қисми формула нодуруст аст.");
  };
  const result = parseComparison();
  if (position !== tokens.length) {
    throw new Error("Дар охири формула аломатҳои зиёдатӣ ҳастанд.");
  }
  const value = numeric(result);
  if (!Number.isFinite(value)) throw new Error("Натиҷаи формула рақами дуруст нест.");
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
