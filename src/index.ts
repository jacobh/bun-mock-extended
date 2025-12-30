export {
    JestMockExtended,
    mockDeep,
    mockClear,
    mockReset,
    mockFn,
    stub,
    type GlobalConfig,
    type MockProxy,
    type DeepMockProxy,
    type CalledWithMock,
} from './Mock';
import { default as mockDefault } from './Mock'
export const mock = mockDefault
import { default as calledWithFnDefault } from './CalledWithFn';
export const calledWithFn = calledWithFnDefault
export * from './Matchers';
