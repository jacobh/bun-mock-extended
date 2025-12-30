import { CalledWithMock } from './Mock';
import { Matcher, MatchersOrLiterals } from './Matchers';
import { jest } from 'bun:test';

type FunctionLike = (...args: any) => any;

interface CalledWithStackItem<T extends FunctionLike> {
    args: MatchersOrLiterals<[...Parameters<T>]>;
    calledWithFn: jest.Mock<T>;
}

interface JestAsymmetricMatcher {
    asymmetricMatch(...args: any[]): boolean;
}

function isJestAsymmetricMatcher(obj: any): obj is JestAsymmetricMatcher {
    return !!obj && typeof obj === 'object' && 'asymmetricMatch' in obj && typeof obj.asymmetricMatch === 'function';
}

function isBunBuiltInMatcher(obj: any): boolean {
    // Bun's built-in matchers (expect.anything(), expect.any(), etc.) have
    // Symbol.toStringTag like "ExpectAnything", "ExpectAny", etc.
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(obj);
    const tag = proto?.[Symbol.toStringTag] || '';
    return typeof tag === 'string' && tag.startsWith('Expect');
}

function validateCalledWithArgs(args: any[]): void {
    const bunMatchers = args.filter(isBunBuiltInMatcher);
    if (bunMatchers.length > 0) {
        throw new Error(
            `calledWith() does not support Bun's built-in matchers like expect.anything() or expect.any(). ` +
            `Use the library's matchers instead: any(), anyNumber(), anyString(), etc.`
        );
    }
}

const checkCalledWith = <T extends FunctionLike>(
    calledWithStack: CalledWithStackItem<T>[],
    actualArgs: [...Parameters<T>],
    fallbackMockImplementation?: T
): ReturnType<T> => {
    const calledWithInstance = calledWithStack.find((instance) =>
        instance.args.every((matcher, i) => {
            if (matcher instanceof Matcher) {
                return matcher.asymmetricMatch(actualArgs[i]);
            }

            if (isJestAsymmetricMatcher(matcher)) {
                return matcher.asymmetricMatch(actualArgs[i]);
            }

            return actualArgs[i] === matcher;
        })
    );

    return calledWithInstance
        ? calledWithInstance.calledWithFn(...actualArgs)
        : fallbackMockImplementation && fallbackMockImplementation(...actualArgs);
};

export const calledWithFn = <T extends FunctionLike>({
    fallbackMockImplementation,
}: { fallbackMockImplementation?: T | undefined } = {}): CalledWithMock<T> => {
    const fn = jest.fn(fallbackMockImplementation);
    let calledWithStack: CalledWithStackItem<T>[] = [];

    (fn as CalledWithMock<T>).calledWith = (...args) => {
        // Validate that no Bun built-in matchers are used (they don't work with calledWith)
        validateCalledWithArgs(args);

        // We create new function to delegate any interactions (mockReturnValue etc.) to for this set of args.
        // If that set of args is matched, we just call that jest.fn() for the result.
        const calledWithFn = jest.fn(fallbackMockImplementation);
        const mockImplementation = fn.getMockImplementation();
        if (!mockImplementation || mockImplementation === fallbackMockImplementation) {
            // Our original function gets a mock implementation which handles the matching
            // @ts-expect-error '(...args: any) => ReturnType<T>' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint 'FunctionLike'.
            fn.mockImplementation((...args) => checkCalledWith(calledWithStack, args, fallbackMockImplementation));
            calledWithStack = [];
        }
        calledWithStack.unshift({ args, calledWithFn });

        return calledWithFn;
    };

    return fn as CalledWithMock<T>;
};

export default calledWithFn;
