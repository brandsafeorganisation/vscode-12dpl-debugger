// Debug adapter entry point. VS Code starts this as a separate process and
// talks to it over stdin/stdout using the Debug Adapter Protocol.
// Run with --server=<port> to listen on TCP instead (for debugging the adapter
// itself; point a launch config at it with "debugServer": <port>).
import * as net from 'net';
import { TwelveDDebugSession } from './session';

const serverArg = process.argv.find((a) => a.startsWith('--server='));
if (serverArg) {
  const port = Number(serverArg.split('=')[1]);
  net.createServer((socket) => {
    const session = new TwelveDDebugSession();
    session.setRunAsServer(true);
    session.start(socket, socket);
  }).listen(port, () => console.error(`12dPL debug adapter listening on port ${port}`));
} else {
  const session = new TwelveDDebugSession();
  process.on('SIGTERM', () => {
    // Tell a paused macro to stop, then exit.
    session.shutdown();
    setTimeout(() => process.exit(0), 300);
  });
  session.start(process.stdin, process.stdout);
}
