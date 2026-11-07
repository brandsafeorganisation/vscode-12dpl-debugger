// The request file the companion macro writes before opening the vscode://
// link (see companions/compile_debug_macro_panel.4dm):
//
//   <path of the macro to debug>
//   CPATH=<12d's include search path>
//   SET_UPS_4D=...  USER_4D=...  LIB_4D=...  USER_LIB_4D=...   (one per line)

export interface DebugRequest {
  program: string;
  /** 12d environment variables sent by the macro. */
  env: Record<string, string>;
  /** Folders 12d searches for includes, in order. */
  cpath: string[];
}

/** The variables that make up 12d's include search, in the order 12d uses them. */
export const CPATH_PARTS = ['USER_LIB_4D', 'USER_4D', 'LIB_4D', 'SET_UPS_4D'];

/**
 * Split a 12d path list. 12d separates entries with ':' even on Windows
 * ("c:\12d\user_lib:c:\12d\user"), so a ':' that starts a drive ("c:\") is
 * not a separator. ';' is accepted too.
 */
export function splitPathList(list: string): string[] {
  return list
    .split(/;|:(?![\\/])/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

export function parseRequest(text: string): DebugRequest {
  const [first = '', ...rest] = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const env: Record<string, string> = {};
  for (const line of rest) {
    const m = /^\s*([A-Za-z_]\w*)\s*=(.*)$/.exec(line);
    if (m && m[2].trim() !== '') env[m[1].toUpperCase()] = m[2].trim();
  }
  // CPATH as 12d reports it; if 12d doesn't expose it, build it the same way.
  const cpath = env.CPATH !== undefined
    ? splitPathList(env.CPATH)
    : CPATH_PARTS.flatMap((k) => (env[k] ? [env[k]] : []));
  return { program: first.trim(), env, cpath };
}
