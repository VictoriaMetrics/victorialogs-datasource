export class NeverCaseError extends Error {
  constructor(value: never) {
    super(`Unexpected case in switch statement: ${JSON.stringify(value)}`);
  }
}
