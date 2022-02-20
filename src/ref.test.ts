import {Reference, Registry, Repository} from './ref'

describe('Reference.parse', () => {
  test('in library', () => {
    expect(Reference.parse('ubuntu')).toEqual(
      new Reference(new Repository(new Registry('index.docker.io', false), 'ubuntu'), {
        type: 'tag',
        value: 'latest',
      }),
    )
    expect(Reference.parse('ubuntu:latest')).toEqual(
      new Reference(new Repository(new Registry('index.docker.io', false), 'ubuntu'), {
        type: 'tag',
        value: 'latest',
      }),
    )
    expect(
      Reference.parse(
        'ubuntu@sha256:669e010b58baf5beb2836b253c1fd5768333f0d1dbcb834f7c07a4dc93f474be',
      ),
    ).toEqual(
      new Reference(new Repository(new Registry('index.docker.io', false), 'ubuntu'), {
        type: 'digest',
        value: 'sha256:669e010b58baf5beb2836b253c1fd5768333f0d1dbcb834f7c07a4dc93f474be',
      }),
    )
  })
})

describe('Repository.parse', () => {
  test('implicit docker.io', () => {
    expect(Repository.parse('otel/collector')).toEqual(
      new Repository(new Registry('index.docker.io', false), 'otel/collector'),
    )
  })

  test('in library', () => {
    expect(Repository.parse('ubuntu')).toEqual(
      new Repository(new Registry('index.docker.io', false), 'ubuntu'),
    )
  })

  test('explicit', () => {
    expect(Repository.parse('gcr.io/google/wave')).toEqual(
      new Repository(new Registry('gcr.io', false), 'google/wave'),
    )
  })
})

describe('Repository#url', () => {
  test('in library', () => {
    expect(Repository.parse('ubuntu').url).toBe('https://index.docker.io/v2/library/ubuntu')
  })

  test('implicit docker.io', () => {
    expect(Repository.parse('otel/collector').url).toBe('https://index.docker.io/v2/otel/collector')
  })

  test('explicit', () => {
    expect(Repository.parse('gcr.io/google/wave').url).toBe('https://gcr.io/v2/google/wave')
  })
})

describe('Registry.parse', () => {
  test('explicit', () => {
    expect(Registry.parse('gcr.io')).toEqual({host: 'gcr.io', insecure: false})
  })

  test('explicitly insecure', () => {
    expect(Registry.parse('docker', {insecure: true})).toEqual({host: 'docker', insecure: true})
  })

  test('explicit docker.io', () => {
    expect(Registry.parse('docker.io')).toEqual({host: 'index.docker.io', insecure: false})
  })

  test('implicit docker.io', () => {
    expect(Registry.parse('')).toEqual({host: 'index.docker.io', insecure: false})
  })

  test('override default registry', () => {
    expect(Registry.parse('', {default: 'docker.example.com'})).toEqual({
      host: 'docker.example.com',
      insecure: false,
    })
  })

  test('local/private addresses', () => {
    expect(Registry.parse('127.0.0.1')).toEqual({host: '127.0.0.1', insecure: true})
    expect(Registry.parse('127.0.0.1:8080')).toEqual({host: '127.0.0.1:8080', insecure: true})
    expect(Registry.parse('10.100.0.1')).toEqual({host: '10.100.0.1', insecure: true})
    expect(Registry.parse('172.18.8.1')).toEqual({host: '172.18.8.1', insecure: true})
    expect(Registry.parse('192.168.1.1')).toEqual({host: '192.168.1.1', insecure: true})

    expect(Registry.parse('::1')).toEqual({host: '::1', insecure: true})
    expect(Registry.parse('[::1]:8080')).toEqual({host: '[::1]:8080', insecure: true})
    expect(Registry.parse('fd00:aaaa::1')).toEqual({host: 'fd00:aaaa::1', insecure: true})
    expect(Registry.parse('FD00:AAAA::1')).toEqual({host: 'FD00:AAAA::1', insecure: true})

    expect(Registry.parse('localhost')).toEqual({host: 'localhost', insecure: true})
    expect(Registry.parse('localhost:8080')).toEqual({host: 'localhost:8080', insecure: true})
    expect(Registry.parse('docker.localdomain')).toEqual({
      host: 'docker.localdomain',
      insecure: true,
    })
    expect(Registry.parse('docker.localdomain:8080')).toEqual({
      host: 'docker.localdomain:8080',
      insecure: true,
    })
  })
})

describe('Registry#url', () => {
  test('https', () => {
    expect(new Registry('index.docker.io', false).url).toBe('https://index.docker.io/v2')
  })

  test('http', () => {
    expect(new Registry('localhost:8080', true).url).toBe('http://localhost:8080/v2')
  })
})
