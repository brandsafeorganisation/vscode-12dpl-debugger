import * as path from 'path';

/**
 * The CPATH cc4d.exe needs when it is run outside 12d (12d sets it for its
 * own compiles). Worked out from where cc4d.exe is, the way a standard
 * install lays out its folders; 12d separates entries with ':'.
 *
 *   C:\Program Files\12d\12dmodel\15.00\nt.x64\cc4d.exe
 *   -> c:\12d\15.00\user_lib:c:\12d\15.00\user:
 *      C:\Program Files\12d\12dmodel\15.00\library:C:\Program Files\12d\12dmodel\15.00\set_ups
 */
export function defaultCompilerCpath(compiler: string): string {
  const win = path.win32;
  const install = win.dirname(win.dirname(compiler)); // ...\12dmodel\15.00
  const version = win.basename(install);              // 15.00
  return [
    `c:\\12d\\${version}\\user_lib`,
    `c:\\12d\\${version}\\user`,
    win.join(install, 'library'),
    win.join(install, 'set_ups'),
  ].join(':');
}

/** 12dpl.compilerCpath if set, else CPATH from the environment, else the default above. */
export function compilerCpath(compiler: string, setting: string | undefined, env: NodeJS.ProcessEnv): string {
  return setting?.trim() || env.CPATH?.trim() || defaultCompilerCpath(compiler);
}
