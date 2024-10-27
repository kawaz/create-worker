import * as fs from 'node:fs/promises'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'

const testCases = [
  {
    name: 'No CSP',
    path: '/',
    csp: '',
    expected: {
      success: true,
      message: /test successful/,
      consoleMatch: [],
      consoleNotMatch: [/Content.Security.Policy/],
    },
  },
  {
    name: 'Strict CSP',
    path: '/strict',
    csp: "default-src 'self'",
    expected: {
      success: false,
      message: /Failed to create worker: Both data URL and object URL approaches failed/,
      consoleMatch: [
        /Content.Security.Policy/,
        // chromium/webkit では AggregateError のコンソールログが省略されないため data: と blob: のエラーが両方出るが
        // Firefox では AggregateError のコンソールログが省略されて表示されるため data: と blob: のエラーの両方は出ないのでどちらかが出ることだけの確認とする
        // /data:text/,
        // /blob:\w+/,
        /(data:text|blob:\w+)/,
      ],
      consoleNotMatch: [],
    },
  },
  {
    name: 'Allow Data URL',
    path: '/allowDataUrl',
    csp: "default-src 'self'; script-src 'self'; worker-src 'self' data:",
    expected: {
      success: true,
      message: /test successful/,
      consoleMatch: [],
      consoleNotMatch: [
        // DataUrl を先に試す実装なので ObjectURL は試されずCSP エラーが出ることはない
        /Content.Security.Policy/,
        /data:text/,
        /blob:\w+/,
      ],
    },
  },
  {
    name: 'Allow Blob URL',
    path: '/allowBlobUrl',
    csp: "default-src 'self'; script-src 'self'; worker-src 'self' blob:",
    expected: {
      success: true,
      message: /test successful/,
      consoleMatch: [
        // DataUrl を先に試す実装なので一度はCSPエラーが出る
        /Content.Security.Policy/,
        /data:text/,
      ],
      consoleNotMatch: [/blob:\w+/],
    },
  },
  {
    name: 'Allow Both Data URL and Blob URL',
    path: '/allowDataUrlAndBlobUrl',
    csp: "default-src 'self'; script-src 'self'; worker-src 'self' data: blob:",
    expected: {
      success: true,
      message: /test successful/,
      consoleMatch: [],
      consoleNotMatch: [/Content.Security.Policy/, /data:text/, /blob:\w+/],
    },
  },
]

const runServer = async () => {
  const jsPath = 'lib/index.js'
  const jsContent = await fs.readFile(jsPath, 'utf-8')
  return new Promise<http.Server>((resolve) => {
    const server = http
      .createServer((req, res) => {
        const path = req.url?.split('?')[0]
        if (path === '/index.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' }).end(jsContent)
          return
        }
        const testCase = testCases.find((p) => p.path === path) ?? testCases[0]
        const headers = {
          'Content-Type': 'text/html',
          ...(testCase.csp ? { 'Content-Security-Policy': testCase.csp } : {}),
        }
        res.writeHead(200, headers).end(testCase.name)
        return
      })
      .listen(() => {
        resolve(server)
      })
  })
}

const runTests = async () => {
  let server: http.Server
  let baseUrl: string
  test.beforeAll(async () => {
    server = await runServer()
    const { port } = server.address() as AddressInfo
    baseUrl = `http://localhost:${port}`
  })

  test.afterAll(async () => {
    await server?.close()
  })

  test.describe('CSP Test Cases', () => {
    for (const { path, name, expected } of testCases) {
      test(`createWorker with ${name}`, async ({ page }) => {
        // コンソールメッセージをキャプチャするための配列
        const consoleMessages: string[] = []
        page.on('console', (msg) => {
          consoleMessages.push(msg.text())
        })
        // テスト用ページに移動
        await page.goto(`${baseUrl}${path}`)
        // createWorkerをテスト
        const testResult: { success: boolean; message: string } = await page.evaluate(async () => {
          try {
            const { createWorker } = await import(`${location.origin}/index.js`)
            const worker = await createWorker(() => self.postMessage('test successful'))
            return new Promise((resolve) => {
              worker.onmessage = (e: MessageEvent<string>) => {
                resolve({ success: true, message: e.data })
              }
              setTimeout(() => {
                resolve({ success: false, message: 'Worker timeout' })
              }, 500)
            })
          } catch (error) {
            return { success: false, message: (error as Error).message }
          }
        })
        // パスごとの期待される動作を検証
        expect(testResult.message).toMatch(expected.message)
        for (const match of expected.consoleMatch ?? []) {
          expect(consoleMessages.join('\n')).toMatch(match)
        }
        for (const notMatch of expected.consoleNotMatch ?? []) {
          expect(consoleMessages.join('\n')).not.toMatch(notMatch)
        }
        expect(testResult.success).toBe(expected.success)
      })
    }
  })
}

if (typeof Bun !== 'undefined') {
  // bun test では実行出来ないのでスキップ。
} else {
  runTests()
}
