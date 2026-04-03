// parsingUtils.test.ts
import { replaceOperatorWithIn } from './parsingUtils';

describe('replaceOperatorWithIn', () => {
  describe('one var', () => {
    const operators = [':', ':='];
    operators.forEach(operator => {
      describe(`${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('field1:in($variableName)');
        });

        it(`should replace ${operator} operator right space with ":in()" syntax`, () => {
          const input = `field1${operator} $variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('field1:in($variableName)');
        });

        it(`should replace ${operator} operator with left space with ":in()" syntax`, () => {
          const input = `field1 ${operator}$variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('field1:in($variableName)');
        });

        it(`should replace ${operator} operator without spaces with ":in()" syntax`, () => {
          const input = `field1${operator}$variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('field1:in($variableName)');
        });

        it(`should replace ${operator} operator with field name which contains /`, () => {
          const input = `kubernetes.pod_labels.app.kubernetes.io/name${operator}$variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('kubernetes.pod_labels.app.kubernetes.io/name:in($variableName)');
        });

        ['\r', '\n', '\t'].forEach((separator) => {
          it(`should replace ${operator} operator with the separator ${JSON.stringify(separator)}`, () => {
            const input = `_stream:{kubernetes.pod_namespace="$namespace"} kubernetes.pod_labels.app.kubernetes.io/name${operator}$variableName${separator}
| format if (kubernetes.pod_labels.app.kubernetes.io/name:"") "unknown" as kubernetes.pod_labels.app.kubernetes.io/name
| stats by (kubernetes.pod_labels.app.kubernetes.io/name) count()
| count()`;
            const output = replaceOperatorWithIn(input, 'variableName');
            expect(output).toBe(`_stream:{kubernetes.pod_namespace="$namespace"} kubernetes.pod_labels.app.kubernetes.io/name:in($variableName)${separator}
| format if (kubernetes.pod_labels.app.kubernetes.io/name:"") "unknown" as kubernetes.pod_labels.app.kubernetes.io/name
| stats by (kubernetes.pod_labels.app.kubernetes.io/name) count()
| count()`);
          });
        });
      });
    });

    const negativeOperators = [':!', ':!='];
    negativeOperators.forEach(operator => {
      describe(`negative ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('!field1:in($variableName)');
        });

        it(`should replace ${operator} operator right space with ":in()" syntax`, () => {
          const input = `field1${operator} $variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('!field1:in($variableName)');
        });

        it(`should replace ${operator} operator with left space with ":in()" syntax`, () => {
          const input = `field1 ${operator}$variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('!field1:in($variableName)');
        });

        it(`should replace ${operator} operator without spaces with ":in()" syntax`, () => {
          const input = `field1${operator}$variableName`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('!field1:in($variableName)');
        });
      });
    });

    const streamOperators = ['='];
    streamOperators.forEach(operator => {
      describe(`stream ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with "in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 in($variableName)}');
        });

        it(`should replace ${operator} operator right space with "in()" syntax`, () => {
          const input = `{field1${operator} $variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 in($variableName)}');
        });

        it(`should replace ${operator} operator with left space with "in()" syntax`, () => {
          const input = `{field1 ${operator}$variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 in($variableName)}');
        });

        it(`should replace ${operator} operator without spaces with "in()" syntax`, () => {
          const input = `{field1${operator}$variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 in($variableName)}');
        });
      });
    });

    const negativeStreamOperators = ['!='];
    negativeStreamOperators.forEach(operator => {
      describe(`stream ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with "in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 not_in($variableName)}');
        });

        it(`should replace ${operator} operator right space with "in()" syntax`, () => {
          const input = `{field1${operator} $variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 not_in($variableName)}');
        });

        it(`should replace ${operator} operator with left space with "in()" syntax`, () => {
          const input = `{field1 ${operator}$variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 not_in($variableName)}');
        });

        it(`should replace ${operator} operator without spaces with "in()" syntax`, () => {
          const input = `{field1${operator}$variableName}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe('{field1 not_in($variableName)}');
        });
      });
    });
  });

  describe('two vars with first var replacement', () => {
    const variableName = 'variableName1';
    const operators = [':', ':='];
    operators.forEach(operator => {
      describe(`${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1:in($variableName1) field2 ${operator} $variableName2`);
        });

        it(`should replace ${operator} operator right space with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1:in($variableName1) field2 ${operator} $variableName2`);
        });

        it(`should replace ${operator} operator with left space with ":in()" syntax`, () => {
          const input = `field1 ${operator}$variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1:in($variableName1) field2 ${operator} $variableName2`);
        });

        it(`should replace ${operator} operator without spaces with ":in()" syntax`, () => {
          const input = `field1${operator}$variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1:in($variableName1) field2 ${operator} $variableName2`);
        });
      });
    });

    const negativeOperators = [':!', ':!='];
    negativeOperators.forEach(operator => {
      describe(`${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`!field1:in($variableName1) field2 ${operator} $variableName2`);
        });

        it(`should replace ${operator} operator with right space with ":in()" syntax`, () => {
          const input = `field1${operator} $variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`!field1:in($variableName1) field2 ${operator} $variableName2`);
        });

        it(`should replace ${operator} operator with left space with ":in()" syntax`, () => {
          const input = `field1 ${operator}$variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`!field1:in($variableName1) field2 ${operator} $variableName2`);
        });

        it(`should replace ${operator} operator without spaces with ":in()" syntax`, () => {
          const input = `field1${operator}$variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`!field1:in($variableName1) field2 ${operator} $variableName2`);
        });
      });
    });

    const streamOperators = ['='];
    streamOperators.forEach(operator => {
      describe(`stream ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with "in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 in($variableName) field2 ${operator} $variableName2}`);
        });

        it(`should replace ${operator} operator right space with "in()" syntax`, () => {
          const input = `{field1${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 in($variableName) field2 ${operator} $variableName2}`);
        });

        it(`should replace ${operator} operator with left space with "in()" syntax`, () => {
          const input = `{field1 ${operator}$variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 in($variableName) field2 ${operator} $variableName2}`);
        });

        it(`should replace ${operator} operator without spaces with "in()" syntax`, () => {
          const input = `{field1${operator}$variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 in($variableName) field2 ${operator} $variableName2}`);
        });
      });
    });

    const negativeStreamOperators = ['!='];
    negativeStreamOperators.forEach(operator => {
      describe(`stream ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with "in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 not_in($variableName) field2 ${operator} $variableName2}`);
        });

        it(`should replace ${operator} operator right space with "in()" syntax`, () => {
          const input = `{field1${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 not_in($variableName) field2 ${operator} $variableName2}`);
        });

        it(`should replace ${operator} operator with left space with "in()" syntax`, () => {
          const input = `{field1 ${operator}$variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 not_in($variableName) field2 ${operator} $variableName2}`);
        });

        it(`should replace ${operator} operator without spaces with "in()" syntax`, () => {
          const input = `{field1${operator}$variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, 'variableName');
          expect(output).toBe(`{field1 not_in($variableName) field2 ${operator} $variableName2}`);
        });
      });
    });
  });

  describe('two vars with second var replacement', () => {
    const variableName = 'variableName2';
    const operators = [':', ':='];
    operators.forEach(operator => {
      describe(`${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1 ${operator} $variableName1 field2:in($variableName2)`);
        });

        it(`should replace ${operator} operator right space with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1 ${operator} $variableName1 field2:in($variableName2)`);
        });

        it(`should replace ${operator} operator with left space with ":in()" syntax`, () => {
          const input = `field1 ${operator}$variableName1 field2 ${operator}$variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1 ${operator}$variableName1 field2:in($variableName2)`);
        });

        it(`should replace ${operator} operator without spaces with ":in()" syntax`, () => {
          const input = `field1${operator}$variableName1 field2${operator}$variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1${operator}$variableName1 field2:in($variableName2)`);
        });
      });
    });

    const negativeOperators = [':!', ':!='];
    negativeOperators.forEach(operator => {
      describe(`${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2 ${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1 ${operator} $variableName1 !field2:in($variableName2)`);
        });

        it(`should replace ${operator} operator with right space with ":in()" syntax`, () => {
          const input = `field1${operator}$variableName1 field2${operator} $variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1${operator}$variableName1 !field2:in($variableName2)`);
        });

        it(`should replace ${operator} operator with left space with ":in()" syntax`, () => {
          const input = `field1 ${operator}$variableName1 field2 ${operator}$variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1 ${operator}$variableName1 !field2:in($variableName2)`);
        });

        it(`should replace ${operator} operator without spaces with ":in()" syntax`, () => {
          const input = `field1 ${operator} $variableName1 field2${operator}$variableName2`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`field1 ${operator} $variableName1 !field2:in($variableName2)`);
        });
      });
    });

    const streamOperators = ['='];
    streamOperators.forEach(operator => {
      describe(`stream ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with "in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1 ${operator} $variableName field2 in($variableName2)}`);
        });

        it(`should replace ${operator} operator right space with "in()" syntax`, () => {
          const input = `{field1${operator} $variableName field2${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1${operator} $variableName field2 in($variableName2)}`);
        });

        it(`should replace ${operator} operator with left space with "in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName field2 ${operator}$variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1 ${operator} $variableName field2 in($variableName2)}`);
        });

        it(`should replace ${operator} operator without spaces with "in()" syntax`, () => {
          const input = `{field1${operator}$variableName field2${operator}$variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1${operator}$variableName field2 in($variableName2)}`);
        });
      });
    });

    const negativeStreamOperators = ['!='];
    negativeStreamOperators.forEach(operator => {
      describe(`stream ${operator} cases`, () => {
        it(`should replace ${operator} operator with spaces with "not_in()" syntax`, () => {
          const input = `{field1 ${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1 ${operator} $variableName field2 not_in($variableName2)}`);
        });

        it(`should replace ${operator} operator right space with "not_in()" syntax`, () => {
          const input = `{field1${operator} $variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1${operator} $variableName field2 not_in($variableName2)}`);
        });

        it(`should replace ${operator} operator with left space with "not_in()" syntax`, () => {
          const input = `{field1 ${operator}$variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1 ${operator}$variableName field2 not_in($variableName2)}`);
        });

        it(`should replace ${operator} operator without spaces with "not_in()" syntax`, () => {
          const input = `{field1${operator}$variableName field2 ${operator} $variableName2}`;
          const output = replaceOperatorWithIn(input, variableName);
          expect(output).toBe(`{field1${operator}$variableName field2 not_in($variableName2)}`);
        });
      });
    });
  });
});
