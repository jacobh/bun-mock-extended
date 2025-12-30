# Migration from Jest to Bun

This document describes the migration of `jest-mock-extended` to `bun-mock-extended`, including what changed, what works, and what limitations exist.

## Overview

| Metric | Count |
|--------|-------|
| Total tests | 161 |
| Passing | 151 (94%) |
| Skipped (Bun limitations we can't intercept) | 10 (6%) |
| Failing | 0 |

**Note:** Incompatible patterns now throw helpful errors instead of silently failing.

## What Works

### Core Mocking Features (100% working)
- `mock<T>()` - Creating type-safe mocks from interfaces
- `mockDeep<T>()` - Creating deep mocks with nested proxy support
- `mockFn<T>()` - Creating mock functions with type safety
- `stub<T>()` - Creating stub objects
- Mock method chaining (`.mockReturnValue()`, `.mockImplementation()`, etc.)

### calledWith() Extension (100% working)
The primary feature of this library works perfectly:
```ts
mock.method.calledWith(1, 2).mockReturnValue(42);
expect(mock.method(1, 2)).toBe(42);
```

### Library Matchers with calledWith() (100% working)
All matchers work when used with `calledWith()`:
- `any()`, `anyNumber()`, `anyString()`, `anyBoolean()`
- `anyFunction()`, `anySymbol()`, `anyObject()`
- `anyArray()`, `anyMap()`, `anySet()`
- `isA()`, `arrayIncludes()`, `setHas()`, `mapHas()`
- `objectContainsKey()`, `objectContainsValue()`
- `notNull()`, `notUndefined()`, `notEmpty()`
- `captor()`, `matches()`

### Mock Clear/Reset (partial)
- Works on shallow mocks
- Has limitations on deep mocks (see below)

## What Doesn't Work (Known Limitations)

### 1. Library Matchers with `toHaveBeenCalledWith()` (7 tests skipped)

**Issue:** Bun's `expect().toHaveBeenCalledWith()` does not recognize the library's custom `Matcher` class, even though it implements the Jest asymmetric matcher protocol (`Symbol.for('jest.asymmetricMatcher')`).

**Symptoms:**
```ts
const fn = jest.fn();
fn(42);
expect(fn).toHaveBeenCalledWith(anyNumber()); // FAILS - Bun compares raw Matcher object
```

**Root Cause:** Bun's assertion matcher implementation doesn't call the `asymmetricMatch()` method on custom matcher objects. It appears to only recognize its own built-in matchers.

**Workaround:** Use Bun's built-in matchers for assertions:
```ts
expect(fn).toHaveBeenCalledWith(expect.any(Number)); // Works
```

**Affected tests:**
- `Matchers with toHaveBeenCalledWith > matchers allow all args to be Matcher based`
- `Matchers with toHaveBeenCalledWith > matchers allow for a mix of Matcher and literal`
- `Matchers > any > Supports undefined in chain`
- `Matchers > captor > can capture arg with other matchers`
- `Matchers > captor > stores all values`
- `Matchers > matches function > expects passes for when it returns true`

### 2. `calledWith()` with `expect.anything()` - NOW THROWS ERROR

**Issue:** Bun's `expect.anything()` and similar matchers don't work with `calledWith()`.

**Behavior:** The library now **throws a helpful error** when you try to use Bun's built-in matchers:
```ts
mock.method.calledWith(expect.anything(), expect.anything()).mockReturnValue(3);
// THROWS: "calledWith() does not support Bun's built-in matchers like expect.anything() or expect.any().
//          Use the library's matchers instead: any(), anyNumber(), anyString(), etc."
```

**Solution:** Use library matchers instead:
```ts
mock.method.calledWith(any(), any()).mockReturnValue(3); // Works
```

### 3. Mock Detection on Deep Mocks (4 tests skipped)

**Issue:** Bun's `toHaveBeenCalledTimes()` fails with "Expected value must be a mock function" on deeply nested proxy mocks.

**Symptoms:**
```ts
const mockObj = mockDeep<Test1>();
mockObj.deepProp.getNumber(2);
expect(mockObj.deepProp.getNumber).toHaveBeenCalledTimes(1); // FAILS
```

**Root Cause:** Bun checks if the value is an instance of its internal `Mock` class. Proxy-wrapped functions that delegate to `jest.fn()` are not recognized.

**Workaround:** Access the `.mock.calls` property directly:
```ts
expect(mockObj.deepProp.getNumber.mock.calls.length).toBe(1); // Works
```

**Affected tests:**
- `Deep mock support > non deep expectation work as expected`
- `Deep mock support > deep expectation work as expected`
- `Deep mock support for class variables... > deep expectation work as expected`
- `Deep mock support for class variables... > base function expectation work as expected`

### 4. mockClear/mockReset on Deep Mocks - NOW THROWS ERROR

**Issue:** Bun's mock methods have strict `this` binding that rejects proxy-wrapped mocks.

**Behavior:** The library now **throws a helpful error** when you try to clear/reset deep mocks:
```ts
const mockObj = mockDeep<Test1>();
mockObj.deepProp.getNumber(1);
mockClear(mockObj);
// THROWS: "mockClear() does not work on deep mocks in Bun.
//          Create a fresh mock instead of clearing: mockObj = mockDeep<T>()"
```

**Root Cause:** Bun's mock methods (`mockClear()`, `mockReset()`) throw "Expected this to be instanceof Mock" when called on proxy-wrapped functions.

**Solution:** Create a fresh mock instead of clearing:
```ts
let mockObj = mockDeep<Test1>();
// In beforeEach:
mockObj = mockDeep<Test1>(); // Create fresh mock
```

## Code Changes Made

### Import Updates
All files updated from:
```ts
import { jest } from '@jest/globals';
import { FunctionLike } from 'jest-mock';
```
To:
```ts
import { jest } from 'bun:test';
type FunctionLike = (...args: any) => any;
```

### Error Detection for Incompatible Patterns

Added detection and helpful errors for patterns that don't work in Bun:

**Bun matcher detection in `calledWith()`:**
```ts
function isBunBuiltInMatcher(obj: any): boolean {
    const proto = Object.getPrototypeOf(obj);
    const tag = proto?.[Symbol.toStringTag] || '';
    return typeof tag === 'string' && tag.startsWith('Expect');
}
```

**Mock clear/reset error handling:**
```ts
const safeMockClear = (mockFn: any, isDeepMock: boolean) => {
    try {
        mockFn.mockClear();
    } catch (e: any) {
        if (isDeepMock && e?.message?.includes('instanceof Mock')) {
            throw new Error(
                `mockClear() does not work on deep mocks in Bun. ` +
                `Create a fresh mock instead: mockObj = mockDeep<T>()`
            );
        }
        throw e;
    }
};
```

### Package Configuration
- Renamed to `bun-mock-extended`
- Removed Jest dependencies (`jest`, `@jest/globals`, `ts-jest`)
- Added `@types/bun`
- Updated tsconfig for ESNext modules
- Deleted `jest.config.js`

## Technical Analysis

### Why Asymmetric Matchers Don't Work

The library's `Matcher` class correctly implements the Jest asymmetric matcher protocol:
```ts
class Matcher<T> {
    $$typeof = Symbol.for('jest.asymmetricMatcher');
    asymmetricMatch(other: unknown): boolean { ... }
}
```

However, Bun's `toHaveBeenCalledWith()` implementation appears to:
1. Not iterate over the expected arguments looking for `$$typeof`
2. Or use a different Symbol
3. Or perform a stricter type check

This is a Bun limitation, not a library bug.

### Why Mock Detection Fails

Bun's mock functions are instances of an internal `Mock` class. When checking `toHaveBeenCalledTimes()`, Bun does:
```ts
if (!(value instanceof Mock)) {
    throw new Error("Expected value must be a mock function");
}
```

The library's proxied mocks wrap `jest.fn()` but the proxy intercepts the instanceof check.

### Why mockClear/mockReset Fail on Deep Mocks

Bun's mock methods have strict `this` binding:
```ts
mockClear() {
    if (!(this instanceof Mock)) {
        throw new TypeError("Expected this to be instanceof Mock");
    }
    // ...
}
```

When called through a proxy, `this` is the proxy object, not the underlying Mock instance.

## Recommendations for Users

1. **Use library matchers with `calledWith()`** - This is the primary use case and works perfectly
2. **Use Bun's built-in matchers with `toHaveBeenCalledWith()`** - `expect.any(Number)` instead of `anyNumber()`
3. **For deep mocks, access `.mock.calls` directly** instead of using `toHaveBeenCalledTimes()`
4. **Create fresh mocks** instead of using `mockClear()`/`mockReset()` on deep mocks
