# bun-mock-extended
> Type safe mocking extensions for Bun's test runner

*Forked from [jest-mock-extended](https://github.com/marchaos/jest-mock-extended)*

## Features
- Provides complete Typescript type safety for interfaces, argument types and return types
- Ability to mock any interface or object
- calledWith() extension to provide argument specific expectations, which works for objects and functions.
- Extensive Matcher API for use with `calledWith()`
- Supports mocking deep objects / class instances.

## Installation
```bash
bun add bun-mock-extended --dev
```

## Example

```ts
import { mock } from 'bun-mock-extended';
import { describe, test, expect } from 'bun:test';

interface PartyProvider {
   getPartyType: () => string;
   getSongs: (type: string) => string[]
   start: (type: string) => void;
}

describe('Party Tests', () => {
   test('Mock out an interface', () => {
       const mockProvider = mock<PartyProvider>();
       mockProvider.start('disco party');

       expect(mockProvider.start).toHaveBeenCalledWith('disco party');
   });

   test('mock out a return type', () => {
       const mockProvider = mock<PartyProvider>();
       mockProvider.getPartyType.mockReturnValue('west coast party');

       expect(mockProvider.getPartyType()).toBe('west coast party');
   });

   test('throwing an error if we forget to specify the return value', () => {
       const mockProvider = mock<PartyProvider>(
           {},
           {
               fallbackMockImplementation: () => {
                   throw new Error('not mocked');
               },
           }
       );

       expect(() => mockProvider.getPartyType()).toThrowError('not mocked');
   });
});
```

## Assigning Mocks with a Type

If you wish to assign a mock to a variable that requires a type in your test, then you should use the MockProxy<> type
given that this will provide the apis for calledWith() and other built-in types for providing test functionality.

```ts
import { MockProxy, mock } from 'bun-mock-extended';

describe('test', () => {
    let myMock: MockProxy<MyInterface>;

    beforeEach(() => {
        myMock = mock<MyInterface>();
    })

    test('example', () => {
         myMock.calledWith(1).mockReturnValue(2);
         // ...
    })
});
```

## calledWith() Extension

`bun-mock-extended` allows for invocation matching expectations. Types of arguments, even when using matchers are type checked.

```ts
const provider = mock<PartyProvider>();
provider.getSongs.calledWith('disco party').mockReturnValue(['Dance the night away', 'Stayin Alive']);
expect(provider.getSongs('disco party')).toEqual(['Dance the night away', 'Stayin Alive']);

// Matchers
provider.getSongs.calledWith(any()).mockReturnValue(['Saw her standing there']);
provider.getSongs.calledWith(anyString()).mockReturnValue(['Saw her standing there']);
```

You can also use `mockFn()` to create a mock function with the calledWith extension:

```ts
type MyFn = (x: number, y: number) => Promise<string>;
const fn = mockFn<MyFn>();
fn.calledWith(1, 2).mockReturnValue('str');
```

## Clearing / Resetting Mocks

`bun-mock-extended` exposes a mockClear and mockReset for resetting or clearing mocks.

```ts
import { mock, mockClear, mockReset } from 'bun-mock-extended';

describe('test', () => {
   const mockService = mock<UserService>();

   beforeEach(() => {
      mockReset(mockService); // or mockClear(mockService)
   });
   // ...
})
```

## Deep mocks

If your class has objects returned from methods that you would also like to mock, you can use `mockDeep` in
replacement for mock.

```ts
import { mockDeep, DeepMockProxy } from 'bun-mock-extended';

const mockObj: DeepMockProxy<Test1> = mockDeep<Test1>();
mockObj.deepProp.getNumber.calledWith(1).mockReturnValue(4);
expect(mockObj.deepProp.getNumber(1)).toBe(4);
```

If you also need support for properties on functions, you can pass in an option to enable this:

```ts
import { mockDeep } from 'bun-mock-extended';

const mockObj = mockDeep<Test1>({ funcPropSupport: true });
mockObj.deepProp.calledWith(1).mockReturnValue(3)
mockObj.deepProp.getNumber.calledWith(1).mockReturnValue(4);

expect(mockObj.deepProp(1)).toBe(3);
expect(mockObj.deepProp.getNumber(1)).toBe(4);
```

You can provide a fallback mock implementation used if you do not define a return value using `calledWith`:

```ts
import { mockDeep } from 'bun-mock-extended';

const mockObj = mockDeep<Test1>({
    fallbackMockImplementation: () => {
        throw new Error('please add expected return value using calledWith');
    },
});
expect(() => mockObj.getNumber()).toThrowError('not mocked');
```

## Available Matchers

| Matcher               | Description                                                           |
|-----------------------|-----------------------------------------------------------------------|
|any()                  | Matches any arg of any type.                                          |
|anyBoolean()           | Matches any boolean (true or false)                                   |
|anyString()            | Matches any string including empty string                             |
|anyNumber()            | Matches any number that is not NaN                                    |
|anyFunction()          | Matches any function                                                  |
|anyObject()            | Matches any object (typeof m === 'object') and is not null            |
|anyArray()             | Matches any array                                                     |
|anyMap()               | Matches any Map                                                       |
|anySet()               | Matches any Set                                                       |
|isA(class)             | e.g isA(DiscoPartyProvider)                                           |
|arrayIncludes('value') | Checks if value is in the argument array                              |
|objectContainsKey('key')|  Checks if the key exists in the object                              |
|objectContainsValue('value')| Checks if the value exists in an object                          |
|setHas('value')        | Checks if the value exists in a Set                                   |
|mapHas('key')          | Checks if the key exists in a Map                                     |
|notNull()              | value !== null                                                        |
|notUndefined()         | value !== undefined                                                   |
|notEmpty()             | value !== undefined && value !== null && value !== ''                 |
|captor()               | Used to capture an arg - alternative to mock.calls[0][0]              |
|matches(fn)            | Custom matcher function                                               |

## Writing a Custom Matcher

Custom matchers can be written using a `MatcherCreator`:

```ts
import { MatcherCreator, Matcher } from 'bun-mock-extended';

// expectedValue is optional
export const myMatcher: MatcherCreator<MyType> = (expectedValue) => new Matcher((actualValue) => {
    return (expectedValue === actualValue && actualValue.isSpecial);
});
```

By default, the expected value and actual value are the same type. In the case where you need to type the expected value
differently than the actual value, you can use the optional 2nd generic parameter:

```ts
import { MatcherCreator, Matcher } from 'bun-mock-extended';

export const myMatcher: MatcherCreator<string[], string> = (expectedValue) => new Matcher((actualValue) => {
    return (actualValue.includes(expectedValue));
});
```

## Known Limitations

Due to differences between Bun's test runner and Jest, some patterns throw helpful errors or don't work:

### Bun's matchers with `calledWith()` - THROWS ERROR

Using Bun's built-in matchers (`expect.anything()`, `expect.any()`) with `calledWith()` will throw an error:

```ts
// THROWS ERROR - Bun's matchers don't work with calledWith()
mock.method.calledWith(expect.anything()).mockReturnValue(42);

// Use library matchers instead
mock.method.calledWith(any()).mockReturnValue(42); // Works!
```

### Library matchers with `toHaveBeenCalledWith` - SILENT FAILURE

The library's matchers don't work with Bun's assertions (we can't intercept this):

```ts
// Does NOT work - Bun doesn't recognize library matchers
expect(mock.method).toHaveBeenCalledWith(anyNumber());

// Use Bun's built-in matchers for assertions
expect(mock.method).toHaveBeenCalledWith(expect.any(Number)); // Works!
```

### mockClear/mockReset on deep mocks - THROWS ERROR

Calling `mockClear()` or `mockReset()` on deep mocks will throw an error:

```ts
const mockObj = mockDeep<MyType>();
mockClear(mockObj); // THROWS ERROR

// Create a fresh mock instead
mockObj = mockDeep<MyType>(); // Works!
```

### Deep mock assertions - THROWS ERROR (from Bun)

Bun's `toHaveBeenCalledTimes()` doesn't recognize deep mock proxies:

```ts
expect(mockObj.nested.method).toHaveBeenCalledTimes(1); // Bun throws error

// Use .mock.calls instead
expect(mockObj.nested.method.mock.calls.length).toBe(1); // Works!
```

## License

MIT
