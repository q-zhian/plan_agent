import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream as createNodeReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createHermesPrompt,
  parsePlanResponse,
  PlanRequestValidationError,
  validatePlanRequest,
} from './server/plan-contract.mjs';

const MAX_BODY_SIZE = 32 * 1024;
const MAX_OUTPUT_SIZE = 128 * 1024;
const KILL_GRACE_MS = 1000;

class HermesTimeoutError extends Error {}
class HermesAbortedError extends Error {}
class BodyTooLargeError extends Error {}

function planRequestError(error) {
  if (error instanceof BodyTooLargeError) return '输入内容过大，请删减后重试。';
  if (!(error instanceof PlanRequestValidationError)) return '请填写目标后重试。';

  switch (error.code) {
    case 'EMPTY_GOAL': return '请先填写今天想推进什么。';
    case 'EMPTY_ANSWER': return '请补充你的可用时间或目标成果。';
    case 'LONG_GOAL': return '目标过长，请控制在 4000 字符以内。';
    case 'LONG_ANSWER': return '补充内容过长，请控制在 4000 字符以内。';
    default: return '请填写目标后重试。';
  }
}

function getTimeout() {
  const value = Number.parseInt(process.env.HERMES_TIMEOUT_MS ?? '90000', 10);
  return Number.isSafeInteger(value) && value > 0 ? value : 90000;
}

function runHermesProcess(prompt, {
  spawnProcess = spawn,
  timeoutMs = getTimeout(),
  signal,
} = {}) {
  return new Promise((resolve, reject) => {
    const environment = { ...process.env };
    for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
      delete environment[key];
    }

    let child;
    let settled = false;
    let closed = false;
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timeout;
    let killTimer;
    let terminationRequested = false;
    let stdoutHandler;
    let stderrHandler;
    let errorHandler;
    let closeHandler;
    let abortHandler;
    const clearKillTimer = () => {
      clearTimeout(killTimer);
      killTimer = undefined;
    };
    const removeListeners = () => {
      child?.stdout?.off('data', stdoutHandler);
      child?.stderr?.off('data', stderrHandler);
      child?.off('error', errorHandler);
      signal?.removeEventListener('abort', abortHandler);
      if (!terminationRequested || closed) child?.off('close', closeHandler);
    };
    const finish = (callback, value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        removeListeners();
        callback(value);
      }
    };
    const terminate = () => {
      if (!child || closed || terminationRequested) return;
      terminationRequested = true;
      try {
        child.kill('SIGTERM');
      } catch {}
      if (closed) return;
      killTimer = setTimeout(() => {
        killTimer = undefined;
        if (!closed) {
          try {
            child.kill('SIGKILL');
          } catch {}
        }
        child?.off('close', closeHandler);
      }, KILL_GRACE_MS);
      killTimer.unref?.();
    };
    const fail = (error) => {
      terminate();
      finish(reject, error);
    };
    const append = (target, chunk) => {
      if (settled) return;
      const bytes = Buffer.byteLength(chunk);
      const currentBytes = target === 'stdout' ? stdoutBytes : stderrBytes;
      if (currentBytes + bytes > MAX_OUTPUT_SIZE) {
        fail(new Error('Hermes output exceeded the limit'));
        return;
      }
      const value = chunk.toString();
      if (target === 'stdout') {
        stdoutBytes += bytes;
        stdout += value;
      } else {
        stderrBytes += bytes;
        stderr += value;
      }
    };

    try {
      child = spawnProcess('hermes', ['-z', prompt], { env: environment, shell: false });
      stdoutHandler = (chunk) => append('stdout', chunk);
      stderrHandler = (chunk) => append('stderr', chunk);
      errorHandler = (error) => fail(error);
      closeHandler = (code) => {
        closed = true;
        clearKillTimer();
        if (code === 0) finish(resolve, stdout);
        else finish(reject, new Error(`Hermes exited with code ${String(code)}`));
      };
      abortHandler = () => fail(new HermesAbortedError());
      child.stdout.on('data', stdoutHandler);
      child.stderr.on('data', stderrHandler);
      child.on('error', errorHandler);
      child.on('close', closeHandler);
      signal?.addEventListener('abort', abortHandler, { once: true });
      if (signal?.aborted) {
        abortHandler();
        return;
      }
      timeout = setTimeout(() => fail(new HermesTimeoutError()), timeoutMs);
    } catch (error) {
      finish(reject, error);
    }
  });
}

function sendJson(response, status, body, { close = false } = {}) {
  const content = JSON.stringify(body);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(content),
  };
  if (close) {
    headers.connection = 'close';
    response.shouldKeepAlive = false;
  }
  response.writeHead(status, headers);
  response.end(content);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    let settled = false;
    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('aborted', onAborted);
    };
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_SIZE) {
        request.pause();
        rejectOnce(new BodyTooLargeError());
        return;
      }
      body += chunk;
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    };
    const onAborted = () => rejectOnce(new Error('Request was aborted'));
    request.setEncoding('utf8');
    request.on('data', onData);
    request.on('end', onEnd);
    request.once('aborted', onAborted);
    request.once('error', rejectOnce);
  });
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.avif': return 'image/avif';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

function isWithinDirectory(filePath, directory) {
  return filePath === directory || filePath.startsWith(`${directory}${path.sep}`);
}

async function serveFile(response, filePath, method, realDistDirectory, createFileReadStream) {
  let info;
  let realFilePath;
  try {
    info = await stat(filePath);
    realFilePath = await realpath(filePath);
  } catch {
    return false;
  }
  if (!info.isFile() || !isWithinDirectory(realFilePath, realDistDirectory)) return false;

  const headers = {
    'content-type': contentType(realFilePath),
    'content-length': info.size,
  };
  if (method === 'HEAD') {
    response.writeHead(200, headers);
    response.end();
  } else {
    const fileStream = createFileReadStream(realFilePath);
    fileStream.once('error', () => {
      if (response.headersSent) response.destroy();
      else response.writeHead(404).end();
    });
    fileStream.once('open', () => {
      if (response.destroyed) {
        fileStream.destroy();
        return;
      }
      response.writeHead(200, headers);
      fileStream.pipe(response);
    });
  }
  return true;
}

export function createApp({
  distDirectory = path.resolve('dist'),
  runHermes,
  spawnProcess = spawn,
  createFileReadStream = createNodeReadStream,
} = {}) {
  const resolvedDistDirectory = path.resolve(distDirectory);
  const executeHermes = runHermes ?? ((prompt, options) => runHermesProcess(prompt, { spawnProcess, ...options }));

  return createServer(async (request, response) => {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (method === 'POST' && url.pathname === '/api/plan') {
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
        sendJson(response, 400, { error: '请填写目标后重试。' });
        return;
      }

      let planRequest;
      try {
        planRequest = validatePlanRequest(await readJsonBody(request));
      } catch (error) {
        if (!response.destroyed) {
          sendJson(response, 400, { error: planRequestError(error) }, {
            close: error instanceof BodyTooLargeError,
          });
        }
        return;
      }

      const abortController = new AbortController();
      const abortExecution = () => abortController.abort();
      const abortOnResponseClose = () => {
        if (!response.writableEnded) abortExecution();
      };
      request.once('aborted', abortExecution);
      response.once('close', abortOnResponseClose);
      let output;
      try {
        output = await executeHermes(createHermesPrompt(planRequest), {
          signal: abortController.signal,
        });
      } catch (error) {
        request.off('aborted', abortExecution);
        response.off('close', abortOnResponseClose);
        if (abortController.signal.aborted || response.destroyed) return;
        if (error instanceof HermesTimeoutError || error?.code === 'HERMES_TIMEOUT') {
          sendJson(response, 504, { error: 'Hermes 响应超时，请稍后重试。' });
        } else {
          sendJson(response, 502, { error: '生成计划失败，请稍后重试。' });
        }
        return;
      }
      request.off('aborted', abortExecution);
      response.off('close', abortOnResponseClose);
      if (abortController.signal.aborted || response.destroyed) return;

      try {
        sendJson(response, 200, parsePlanResponse(output));
      } catch {
        sendJson(response, 502, { error: 'Hermes 返回的计划格式无效，请重试。' });
      }
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(404).end();
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(404).end();
      return;
    }
    const requestedFile = path.resolve(resolvedDistDirectory, `.${requestPath}`);
    if (!isWithinDirectory(requestedFile, resolvedDistDirectory)) {
      response.writeHead(404).end();
      return;
    }
    let realDistDirectory;
    try {
      realDistDirectory = await realpath(resolvedDistDirectory);
    } catch {
      response.writeHead(404).end();
      return;
    }
    if (await serveFile(response, requestedFile, method, realDistDirectory, createFileReadStream)) return;

    const indexFile = path.join(resolvedDistDirectory, 'index.html');
    if (!await serveFile(response, indexFile, method, realDistDirectory, createFileReadStream)) response.writeHead(404).end();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT ?? '8787', 10) || 8787;
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`Listening on http://127.0.0.1:${port}`);
  });
}
