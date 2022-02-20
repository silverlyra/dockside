import {fetch, Response} from 'fetch-h2'

export {fetch}

/**
 * Fetch is the type of the [`fetch()`][fetch] function.
 *
 * [fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 */
export type Fetch = typeof fetch

export type FetchInit = Parameters<typeof fetch>[1]

export {Request, Response} from 'fetch-h2'

export class ResponseError extends Error {
  public readonly name = 'ResponseError'

  constructor(message: string, public response: Response) {
    super(message)
  }
}
