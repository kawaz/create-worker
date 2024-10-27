import { describe, expect, it } from 'bun:test'
import { createWorker } from './index'

describe('createWorker', () => {
  describe('when resolved', () => {
    it('can exchange messages', async () => {
      const worker = await createWorker(() => {
        self.onmessage = (e: MessageEvent<number>) => {
          self.postMessage(e.data * 2)
        }
      })
      expect(worker).toBeInstanceOf(Worker)
      const waitPromise = new Promise((resolve, reject) => {
        setTimeout(reject, 50)
        worker.onmessage = (e: MessageEvent<number>) => {
          expect(e.data).toBe(20)
          resolve('done')
        }
        worker.postMessage(10)
      })
      await expect(waitPromise).resolves.toBe('done')
    })
    it('If main function throws error, worker is created and worker.onerror is called', async () => {
      const worker = await createWorker(() => {
        throw new Error('error in workerMain')
      })
      const waitPromise = new Promise((resolve, reject) => {
        setTimeout(reject, 50)
        worker.onerror = () => {
          // Cannot verify details of unhandled error
          resolve('done')
        }
      })
      await expect(waitPromise).resolves.toBe('done')
    })
  })
  describe('when rejected', () => {
    it('throws an error when workerMain is not a function', async () => {
      try {
        // @ts-expect-error
        await createWorker('()=>self.postMessage("test")')
        expect().fail('This should not be reached')
      } catch (e) {
        expect(e).toBeInstanceOf(TypeError)
        expect((e as Error).message).toBe('Worker main must be a function')
      }
      // @ts-expect-error
      expect(createWorker(null)).rejects.toThrow('Worker main must be a function')
    })
  })
})
