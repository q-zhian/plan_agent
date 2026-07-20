import { afterEach, describe, expect, test } from 'vitest';
import { request } from 'node:http';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';

const validPlan = {
  plan: {
    title: 'Launch plan',
    totalDuration: '4 hours',
    startTime: '09:00',
    endTime: '13:00',
    tasks: [
      { title: 'Research', startTime: '09:00', endTime: '10:00', description: 'Find sources', estimatedDuration: '1 hour' },
      { title: 'Outline', startTime: '10:00', endTime: '11:00', description: 'Structure work', estimatedDuration: '1 hour' },
      { title: 'Draft', startTime: '11:00', endTime: '12:00', description: 'Write content', estimatedDuration: '1 hour' },
      { title: 'Review', startTime: '12:00', endTime: '13:00', description: 'Check quality', estimatedDuration: '1 hour' },
    ],
  },
};

const servers = [];
const temporaryDirectories = [];

async function startServer(options) {
  const server = createApp(options);
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function httpRequest(baseUrl, pathname, { method = 'GET', headers, body } = {}) {
  const url = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const clientRequest = request(url, { method, headers }, (response) => {
      let content = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { content += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: content }));
    });
    clientRequest.on('error', reject);
    clientRequest.end(body);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  })));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('plan server', () => {
  test('returns an ok health response', async () => {
    const baseUrl = await startServer();

    const response = await httpRequest(baseUrl, '/health');

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });

  test('rejects malformed JSON plan requests', async () => {
    const baseUrl = await startServer();

    const response = await httpRequest(baseUrl, '/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: '请填写目标后重试。' });
  });

  test('rejects an oversized plan body before the client finishes sending it', async () => {
    let runHermesCalled = false;
    const baseUrl = await startServer({ runHermes: async () => { runHermesCalled = true; return JSON.stringify(validPlan); } });
    const clientRequest = request(new URL('/api/plan', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const responsePromise = new Promise((resolve, reject) => {
      clientRequest.on('response', (response) => {
        let content = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { content += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body: content }));
      });
      clientRequest.on('error', reject);
    });

    try {
      clientRequest.write('x'.repeat(16 * 1024 + 1));
      const response = await Promise.race([
        responsePromise,
        delay(250).then(() => { throw new Error('server did not reject the oversized body promptly'); }),
      ]);

      expect(response.status).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: '请填写目标后重试。' });
      expect(runHermesCalled).toBe(false);
    } finally {
      clientRequest.destroy();
    }
  });

  test('returns a parsed plan from injected Hermes output', async () => {
    const runHermes = async () => JSON.stringify(validPlan);
    const baseUrl = await startServer({ runHermes });

    const response = await httpRequest(baseUrl, '/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal: 'Launch a product' }),
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(validPlan);
  });

  test('rejects malformed injected Hermes output', async () => {
    const baseUrl = await startServer({ runHermes: async () => 'not JSON' });

    const response = await httpRequest(baseUrl, '/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal: 'Launch a product' }),
    });

    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: 'Hermes 返回的计划格式无效，请重试。' });
  });

  test('rejects a non-zero Hermes process exit even when stdout is valid', async () => {
    let spawnCalled = false;
    const spawnProcess = () => {
      spawnCalled = true;
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.killed = false;
      child.kill = () => { child.killed = true; };
      queueMicrotask(() => {
        child.stdout.emit('data', JSON.stringify(validPlan));
        child.emit('close', 1);
      });
      return child;
    };
    const baseUrl = await startServer({ spawnProcess });

    const response = await httpRequest(baseUrl, '/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal: 'Launch a product' }),
    });

    expect(spawnCalled).toBe(true);
    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: '生成计划失败，请稍后重试。' });
  });

  test('terminates a Hermes process whose output exceeds the cap', async () => {
    let child;
    const spawnProcess = () => {
      child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.killed = false;
      child.killCalls = [];
      child.kill = (signal) => { child.killed = true; child.killCalls.push(signal); };
      queueMicrotask(() => child.stdout.emit('data', Buffer.alloc(128 * 1024 + 1)));
      return child;
    };
    const baseUrl = await startServer({ spawnProcess });

    try {
      const response = await httpRequest(baseUrl, '/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal: 'Launch a product' }),
      });

      expect(response.status).toBe(502);
      expect(child.killCalls).toContain('SIGTERM');
      await delay(1100);
      expect(child.killCalls).toContain('SIGKILL');
    } finally {
      child?.emit('close', null);
    }
  });

  test('cancels Hermes when the plan client aborts', async () => {
    let child;
    let spawned;
    const spawnedPromise = new Promise((resolve) => { spawned = resolve; });
    const spawnProcess = () => {
      child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.killed = false;
      child.killCalls = [];
      child.kill = (signal) => { child.killed = true; child.killCalls.push(signal); };
      spawned();
      return child;
    };
    const baseUrl = await startServer({ spawnProcess });
    const clientRequest = request(new URL('/api/plan', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    clientRequest.on('error', () => {});

    try {
      clientRequest.end(JSON.stringify({ goal: 'Launch a product' }));
      await spawnedPromise;
      clientRequest.destroy();
      await delay(25);

      expect(child.killCalls).toContain('SIGTERM');
    } finally {
      child?.emit('close', null);
    }
  });

  test('does not serve a dist file symlink that resolves outside dist', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'plan-server-'));
    temporaryDirectories.push(directory);
    const distDirectory = path.join(directory, 'dist');
    const outsideDirectory = path.join(directory, 'outside');
    await mkdir(distDirectory);
    await mkdir(outsideDirectory);
    await writeFile(path.join(outsideDirectory, 'secret.txt'), 'secret');
    await symlink(outsideDirectory, path.join(distDirectory, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const baseUrl = await startServer({ distDirectory });

    const response = await httpRequest(baseUrl, '/escape/secret.txt');

    expect(response.status).toBe(404);
  });

  test('returns a controlled response when an existing static file stream fails', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'plan-server-'));
    temporaryDirectories.push(directory);
    const distDirectory = path.join(directory, 'dist');
    await mkdir(distDirectory);
    await writeFile(path.join(distDirectory, 'app.js'), 'console.log("ok")');
    let streamCreated = false;
    const createFileReadStream = () => {
      streamCreated = true;
      const stream = new EventEmitter();
      stream.pipe = () => { throw new Error('pipe should not run after a stream error'); };
      queueMicrotask(() => stream.emit('error', new Error('file became unreadable')));
      return stream;
    };
    const baseUrl = await startServer({ distDirectory, createFileReadStream });

    const response = await httpRequest(baseUrl, '/app.js');

    expect(streamCreated).toBe(true);
    expect(response.status).toBe(404);
  });
});
