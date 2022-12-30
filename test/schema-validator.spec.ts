import { AssertionError } from 'assert';
import { S, Schema } from '../src';
import { SchemaValidator } from '../src/schema-validator';

function expectInvalidReason<T = unknown>(schema: Schema, value: T, reason: string, schemaLocation?: string, valuePath?: string) {
  expectInvalidReasons(schema, value, {reason, schemaLocation, valuePath});
}

function expectInvalidReasons<T = unknown>(schema: Schema, value: T, ...invalids: {reason?: string, schema?: Schema, schemaLocation?: string, valuePath?: string}[]) {
  const validation = SchemaValidator.validate(schema, value);
  if(validation.isValid) {
    throw new AssertionError({ message: 'Expected invalid but got valid', expected: invalids });
  }
  invalids.forEach(({reason, schema, schemaLocation, valuePath}, index) => {
    if(schema) {
      expect(validation.result[index].schema).toEqual(schema);
    }
    if(reason)
      expect(validation.result[index].reason).toEqual(reason);
    if(schemaLocation) {
      expect(validation.result[index].schemaLocation).toEqual(schemaLocation);
    }
    if(valuePath) {
      expect(validation.result[index].valuePath).toEqual(valuePath);
    }
  })
}

function expectValid<T = unknown>(schema: Schema, value: T, expectedValue?: T) {
  const validation = SchemaValidator.validate(schema, value);
  if(!validation.isValid) {
    expect(validation.result).toEqual([]);
  }
  if(expectedValue !== undefined) {
    expect(validation.result).toEqual(expectedValue);
  }
}

describe('Schema Validator', () => {

  describe('Null', () => {
    it('should exist', () => {
      const schema = S.null();
      expectInvalidReason(schema, undefined, 'Value should not be undefined, schema does not have a default value');
      expectValid(schema, null);
      expectValid(S.null({default: null}), undefined, null);
    });
    it('should have type null', () => {
      const schema = S.null();
      expectInvalidReason(schema, 1234, 'Value should have been a null but was of type number');
      expectInvalidReason(schema, ['a'], 'Value should have been a null but was of type array');
      expectValid(schema, null);
    });
  });

  describe('Boolean', () => {
    it('should exist', () => {
      const schema = S.boolean();
      expectInvalidReason(schema, undefined, 'Value should not be undefined, schema does not have a default value');
      expectValid(schema, true);
      expectValid(schema, false);
      expectValid(S.boolean({default: true}), undefined, true);
    });
    it('should have type boolean', () => {
      const schema = S.boolean();
      expectInvalidReason(schema, 1234, 'Value should have been a boolean but was of type number');
      expectInvalidReason(schema, ['a'], 'Value should have been a boolean but was of type array');
      expectValid(schema, true);
    });
  });

  describe('String', () => {
    it('should exist', () => {
      const schema = S.string();
      expectInvalidReason(schema, undefined, 'Value should not be undefined, schema does not have a default value');
      expectValid(schema, '');
      expectValid(S.string({default: '123'}), undefined, '123');
    });
    it('should have type string', () => {
      const schema = S.string();
      expectInvalidReason(schema, 1234, 'Value should have been a string but was of type number');
      expectInvalidReason(schema, ['a'], 'Value should have been a string but was of type array');
      expectValid(schema, 'abc');
    });
    it('should have const value', () => {
      const schema = S.string({ const: 'abc' })
      expectInvalidReason(schema, 'xyz', 'Value should have been exactly \'abc\'');
      expectValid(schema, 'abc');
    });
    it('should have enum value', () => {
      const schema = S.string({ enum: ['abc', 'def'] })
      expectInvalidReason(schema, 'xyz', 'Value should have been one of [\'abc\', \'def\']');
      expectValid(schema, 'def');
    });
    it('should have minLength', () => {
      const schema = S.string({ minLength: 2 })
      expectInvalidReason(schema, 'x', 'Value should have a minimum length of 2 character(s)');
      expectValid(schema, 'xy');
    });
    it('should have maxLength', () => {
      const schema = S.string({ maxLength: 2 })
      expectInvalidReason(schema, 'xyz', 'Value should have a maximum length of 2 character(s)');
      expectValid(schema, 'xy');
    });
    it('should match pattern', () => {
      const schema = S.string({ pattern: '^_[a-z][0-9]:X$' })
      expectInvalidReason(schema, 'xyz', 'Value should match the following pattern /^_[a-z][0-9]:X$/');
      expectValid(schema, '_a8:X');
    });
  });

  describe('Number', () => {
    it('should exist', () => {
      const schema = S.number();
      expectInvalidReason(schema, undefined, 'Value should not be undefined, schema does not have a default value');
      expectValid(schema, 1);
      expectValid(S.number({default: 123}), undefined, 123);
    });
    it('should have type number', () => {
      const schema = S.number();
      expectInvalidReason(schema, '1234', 'Value should have been a number but was of type string');
      expectInvalidReason(schema, ['a'], 'Value should have been a number but was of type array');
      expectValid(schema, -123);
    });
    it('should be integer', () => {
      const schema = S.integer();
      expectInvalidReason(schema, 89.2, 'Value should have been an integer');
      expectValid(schema, -123);
      expectValid(schema, 0);
      expectValid(schema, 100);
    });
    it('should have const value', () => {
      const schema = S.number({ const: 77 })
      expectInvalidReason(schema, 65, 'Value should have been exactly 77');
      expectValid(schema, 77);
    });
    it('should have enum value', () => {
      const schema = S.number({ enum: [1, 2, 3] })
      expectInvalidReason(schema, 0, 'Value should have been one of [1, 2, 3]');
      expectValid(schema, 3);
    });
    it('should have minimum', () => {
      const schema = S.number({ minimum: 2 })
      expectInvalidReason(schema, 1, 'Value should have a minimum value of 2');
      expectValid(schema, 2);
      expectValid(schema, 8);
    });
    it('should have exclusive minimum', () => {
      const schema = S.number({ exclusiveMinimum: 2 })
      expectInvalidReason(schema, 1, 'Value should have an exclusive minimum value of 2');
      expectInvalidReason(schema, 2, 'Value should have an exclusive minimum value of 2');
      expectValid(schema, 8);
    });
    it('should have maximum', () => {
      const schema = S.number({ maximum: 5 })
      expectInvalidReason(schema, 8, 'Value should have a maximum value of 5');
      expectValid(schema, 5);
      expectValid(schema, 3);
    });
    it('should have exclusive maximum', () => {
      const schema = S.number({ exclusiveMaximum: 5 })
      expectInvalidReason(schema, 8, 'Value should have an exclusive maximum value of 5');
      expectInvalidReason(schema, 5, 'Value should have an exclusive maximum value of 5');
      expectValid(schema, 3);
    });
  });

  describe('Object', () => {
    it('should exist', () => {
      const schema = S.object();
      expectInvalidReason(schema, undefined, 'Value should not be undefined, schema does not have a default value');
      expectValid(schema, {});
      expectValid(S.object({default: {a: 'abc'}}), undefined, { a: 'abc' });
    });
    it('should have type object', () => {
      const schema = S.object({ additionalProperties: true });
      expectInvalidReason(schema, '1234', 'Value should have been a object but was of type string');
      expectInvalidReason(schema, ['a'], 'Value should have been a object but was of type array');
      expectInvalidReason(schema, null, 'Value should have been a object but was of type null');
      expectValid(schema, {x: 'abc'}, {x: 'abc'});
    });

    it('should have required properties', () => {
      const schema = S.object({ required: { a: S.string(), b: S.number() }});
      expectInvalidReason(schema, {}, 'Value should have all required properties but is missing [a, b]');
      expectValid(schema, {a: 'abc', b: 5});
    });

    it('should not have additional properties', () => {
      const schema = S.object({ required: { a: S.string(), b: S.number() }});
      expectInvalidReasons(schema, {a: 'abc', b : 5, c: true}, {schemaLocation: '#/additionalProperties', valuePath: '#', reason: 'Should have no additional properties, found [c]'});
      expectValid(schema, {a: 'abc', b: 5}, {a: 'abc', b: 5});
    });

    it('should not have additional properties empty', () => {
      const schema = S.object({ additionalProperties: false });
      expectInvalidReasons(schema, {c: true}, {schemaLocation: '#/additionalProperties', valuePath: '#', reason: 'Should have no additional properties, found [c]'});
      expectValid(schema, {}, {});
    });

    it('should have required properties in child', () => {
      const schema = S.object({ required: { a: S.object({required: { b: S.string()}}) }});
      expectInvalidReasons(schema, {a: {}, c: 2},
        {schemaLocation: '#/properties/a', valuePath: '#/a', reason: 'Value should have all required properties but is missing [b]'},
        {schemaLocation: '#/additionalProperties', valuePath: '#', reason: 'Should have no additional properties, found [c]'}
      );
      expectValid(schema, {a: { b: 'abc' }}, {a: { b: 'abc' }});
    });

    it('should map defaults in result', () => {
      const schema = S.object({ required: { a: S.object({optional: { b: S.string({ default: 'xyz'})}}) }});
      expectValid(schema, {a: { }}, { a: { b: 'xyz' }});
    });
  })
})