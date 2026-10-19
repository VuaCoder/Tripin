import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';

/** initdb embeds installation paths in SQL. A Windows ANSI path containing
 * Vietnamese characters cannot be inserted into a UTF-8 catalog safely.
 * Copy the bundled distribution to the disposable ASCII test directory rather
 * than weakening the database encoding or changing machine-wide locale. */
export class WindowsTestPostgres {
  private readonly nativeDir: string;
  private process?: ReturnType<typeof spawn>;
  private readonly exitHandler = () => { this.process?.kill(); };
  constructor(private readonly root: string, private readonly dataDir: string, private readonly port: number) {
    if (/[^\x20-\x7e]/.test(root)) throw new Error('Windows PostgreSQL tests require an ASCII TEMP/TMP directory (for example C:/Temp/tripri-tests).');
    const embeddedRequire = createRequire(createRequire(import.meta.url).resolve('embedded-postgres'));
    const entry = embeddedRequire.resolve('@embedded-postgres/windows-x64');
    const source = path.resolve(path.dirname(entry), '../native');
    this.nativeDir = path.join(root, 'postgres-runtime');
    mkdirSync(this.nativeDir, { recursive: true });
    const copy = (from: string, to: string): void => {
      mkdirSync(to, { recursive: true });
      for (const entry of readdirSync(from, { withFileTypes: true })) {
        const sourcePath = path.join(from, entry.name);
        const targetPath = path.join(to, entry.name);
        if (entry.isDirectory()) copy(sourcePath, targetPath);
        else copyFileSync(sourcePath, targetPath);
      }
    };
    copy(source, this.nativeDir);
  }
  private run(binary: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(this.nativeDir, 'bin', binary), args, { cwd: this.root, windowsHide: true });
      let output = '';
      child.stderr.on('data', chunk => { output += chunk.toString(); });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${binary} failed (${code}): ${output}`)));
    });
  }
  async initialise(): Promise<void> {
    await this.run('initdb.exe', ['-D', this.dataDir, '--username=postgres', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  }
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(this.nativeDir, 'bin/postgres.exe'), ['-D', this.dataDir, '-p', String(this.port), '-h', '127.0.0.1'], { cwd: this.root, windowsHide: true });
      this.process = child;
      process.once('exit', this.exitHandler);
      let output = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Postgres startup timed out: ${output}`)); }, 30000);
      child.stderr.on('data', chunk => {
        output += chunk.toString();
        if (output.includes('database system is ready to accept connections')) { clearTimeout(timer); resolve(); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Postgres exited (${code}): ${output}`)); });
    });
  }
  async stop(): Promise<void> {
    if (this.process && this.process.exitCode === null) await this.run('pg_ctl.exe', ['-D', this.dataDir, '-m', 'fast', '-w', 'stop']);
    process.removeListener('exit', this.exitHandler);
  }
}
