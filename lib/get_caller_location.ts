export interface CallerLocation {
  filePath: string;
  line: number; // 0-based index
  column: number; // 0-based index
}

const internalFileNames = new Set([
  "caller_location.ts",
  "caller_location.js",
  "get_caller_location.ts",
  "get_caller_location.js",
  "lib.ts",
  "lib.js",
]);

function parseStackFrame(line: string): CallerLocation | undefined {
  let frame = line.trim();

  if (frame.startsWith("at ")) {
    frame = frame.slice(3).trim();
  }

  const parenthesizedLocation = frame.match(/\((.+)\)$/);
  if (parenthesizedLocation) {
    frame = parenthesizedLocation[1]!;
  } else {
    const functionSeparator = frame.lastIndexOf("@");
    if (functionSeparator !== -1) {
      frame = frame.slice(functionSeparator + 1);
    }
  }

  frame = frame.replace(/^(?:async\s+)+/, "");

  const coordinates = frame.match(/^(.*):(\d+):(\d+)$/);
  if (!coordinates) {
    return undefined;
  }

  return {
    filePath: coordinates[1]!,
    line: Number(coordinates[2]) - 1,
    column: Number(coordinates[3]) - 1,
  };
}

function isInternalFrame(filePath: string): boolean {
  const pathParts = filePath.replaceAll("\\", "/").toLowerCase().split("/");
  const fileName = pathParts.at(-1);

  return (
    (fileName !== undefined && internalFileNames.has(fileName)) ||
    pathParts.some((part) => ["internal", "node_modules", "native"].includes(part))
  );
}

/**
 * Analyzes the stack trace to find the file and coordinates
 * where this function was called.
 */
export function get_caller_location(skip_until?: Function): CallerLocation {
  // `skip_until` drops every frame above (and including) that function, so
  // library wrappers like `threads.spawn` never count as the "caller".
  const holder: { stack?: string } = {};
  Error.captureStackTrace(holder, skip_until ?? get_caller_location);
  const stack = holder.stack;
  if (!stack) {
    throw new Error("This runtime did not provide a stack trace");
  }

  for (const line of stack.split("\n")) {
    const location = parseStackFrame(line);
    if (location && !isInternalFrame(location.filePath)) {
      return location;
    }
  }

  throw new Error("Could not find an external caller location in the stack trace");
}
