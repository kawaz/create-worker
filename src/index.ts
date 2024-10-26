/**
 * Creates a Worker from a function object
 * @param {Function} workerMain Function to be executed in the Worker. This function will be stringified at runtime, so it must not reference external variables
 * @param {WorkerOptions} options Worker options
 * @returns {Promise<Worker>} Worker object
 * @throws {AggregateError} When Worker creation fails
 * @throws {TypeError} When workerMain is not a function
 * @example
 * const worker = await createWorker(() => {
 *   // Worker code here
 *   self.postMessage('Hello from worker')
 * })
 * worker.onmessage = (e) => console.log(e.data)
 */
export const createWorker = async (workerMain: () => void, options?: WorkerOptions) => {
  if (typeof workerMain !== 'function') {
    throw new TypeError('Worker main must be a function')
  }

  //
  // At the point of calling `new Worker()`, we can't yet catch initialization errors due to CSP, etc.
  // Therefore, we add a check in the main code running in the Worker to confirm that it has been properly initialized and is functioning.
  // This makes it easier to catch initialization errors that are otherwise difficult to capture.
  //

  /**
   * @preserve This function will be stringified at runtime, so it must not reference external variables
   */
  const workerCheck = (main: () => void) => {
    self.postMessage('workerOk')
    self.onmessage = (e: MessageEvent<string>) => {
      if (e.data === 'startMain') {
        self.onmessage = null
        main()
      }
    }
  }
  const workerCode = `(${workerCheck.toString()})(${workerMain.toString()})`
  const errors: unknown[] = []
  for (const code2url of [scriptToDataUrl, scriptToObjectUrl]) {
    try {
      const url = code2url(workerCode)
      const cleanupUrl = () => {
        // ObjectURLの場合、メモリリークを防ぐためにURLを解放
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      }
      const worker = new Worker(url, options)
      return await new Promise<Worker>((resolve, reject) => {
        worker.onerror = (e: ErrorEvent) => {
          cleanupUrl()
          reject(e.error)
        }
        worker.onmessage = (e: MessageEvent<string>) => {
          cleanupUrl()
          if (e.data === 'workerOk') {
            worker.onmessage = null
            worker.onerror = null
            worker.postMessage('startMain')
            resolve(worker)
          }
        }
      })
    } catch (e) {
      errors.push(e)
    }
  }
  throw new AggregateError(
    errors,
    'Failed to create worker: Both data URL and object URL approaches failed',
  )
}

const scriptToDataUrl = (code: string) =>
  `data:text/javascript;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(code)))}`

const scriptToObjectUrl = (code: string) =>
  URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
