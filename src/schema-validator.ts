import { JSONSchema7 } from '../generated/json-schema.org/draft-07/JSONSchema7';
import { Schema } from '../generated/json-schema.org/draft-07/Schema';
import { Type } from '../generated/json-schema.org/draft-07/Type';

export interface Invalid {
  value?: unknown;
  schema: Schema;
  reason: string;
  schemaLocation: string;
  valuePath: string;
}

export type ValidationResult<T> = { isValid: true; result: T } | { isValid: false; result: Invalid[] }

type ObjectPart = {object: Record<string, unknown>, invalidations: Invalid[]}
type ArrayPart = {array: Array<unknown>, invalidations: Invalid[]}

export class SchemaValidator {
  private constructor(private schema: Schema) {
  }

  private valid<T = unknown>(result?: T): ValidationResult<T> {
    return { isValid: true, result: result as T };
  }

  private invalid<T = unknown>(...invalids: Invalid[]): ValidationResult<T> {
    return { isValid: false, result: invalids };
  }

  private validateAgainstAnyOf<T>(path: string, value: T, parts: Schema[] = []): ValidationResult<T> {

    return this.invalid();
  }

  private validateType<T>(value: T, type: Type): string | undefined {
    const valueType = typeof value;
    const isArray = Array.isArray(value);
    const isNull = value === null;
    const reason = `Value should have been a ${type} but was of type ${isNull ? 'null' : isArray ? 'array' : valueType}`;
    if(type === 'null') {
      if(isNull) return undefined
      return reason;
    }
    if(type === 'array') {
       if(isArray) return undefined
       return reason;
    }
    if(valueType !== type || isArray || isNull) {
      return reason;
    }
    return undefined;
  }

  private validateArraySchema<T>(schemaLocation: string, valuePath: string, schema: JSONSchema7, value: T[], current: ArrayPart): ArrayPart {
    if(schema.items !== undefined) {
      if(Array.isArray(schema.items)) {
        if(value.length >= schema.items.length) {
          return schema.items.reduce((prev, next, index) => {
            const validation = SchemaValidator.validate(next, value[index], `${schemaLocation}/items/${index}`, `${valuePath}/${index}`);
            return { array: [...prev.array, validation.isValid ? validation.result : undefined], invalidations: validation.isValid ? prev.invalidations : [...prev.invalidations, ...validation.result] };
          }, current)
        }
        return { array: [], invalidations: [...current.invalidations, { schema, value, schemaLocation, valuePath, reason: `Should have tuple length ${schema.items.length} but was ${value.length}`}]};
      }
      return value.reduce((prev, next, index) => {
        const validation = SchemaValidator.validate(schema.items as Schema, next, `${schemaLocation}/items`, `${valuePath}/${index}`);
        return { array: [...prev.array, validation.isValid ? validation.result : undefined], invalidations: validation.isValid ? prev.invalidations : [...prev.invalidations, ...validation.result] };
      }, current);
    }
    return { array: value, invalidations: current.invalidations };
  }

  private validateArray<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const invalidType = this.validateType(value, 'array');
    const schema = this.schema as JSONSchema7;
    const invalidations: Invalid[] = invalidType ? [{ schemaLocation, valuePath, value, schema: this.schema, reason: invalidType }] : [];
    if(schema.const !== undefined && value !== schema.const) {
      invalidations.push({ schemaLocation, valuePath, value, schema: this.schema, reason: `Value should have been exactly ${JSON.stringify(schema.const)}` });
    }
    if(schema.enum && !schema.enum.includes(value)) {
      invalidations.push({ schemaLocation, valuePath, value, schema: this.schema, reason: `Value should have been one of [${schema.enum.map(it => JSON.stringify(it)).join(', ')}]` });
    }
    const array = value as any[];
    const result = this.validateArraySchema(schemaLocation, valuePath, schema, array, { array: [], invalidations });
    return result.invalidations.length ? this.invalid(...result.invalidations) : this.valid(result.array as T);
  }

  private getPropertiesPart<T>(schemaLocation: string, valuePath: string, schema: JSONSchema7, value: T, current: ObjectPart): ObjectPart {
    return Object.keys(schema.properties ?? {})
      .reduce((prev, property) => {
        const propertyValue = value[property];
        const propertyValidation = SchemaValidator.validate(schema.properties![property], propertyValue, `${schemaLocation}/properties/${property}`, `${valuePath}/${property}`);
        if(!propertyValidation.isValid && !propertyValue) return prev;
        return { object: {...prev.object, [property]: propertyValidation.isValid ? propertyValidation.result : undefined}, invalidations: propertyValidation.isValid ? prev.invalidations : [...prev.invalidations, ...propertyValidation.result] }
      }, current);
  }

  private getAdditionalPropertiesPart<T>(schemaLocation: string, valuePath: string, schema: JSONSchema7, value: T, extraProperties: string[], current: ObjectPart): ObjectPart {
    if(extraProperties.length === 0) return current;
    const additionalProperties = schema.additionalProperties;
    const extraParts = extraProperties.reduce((prev, next) => ({...prev, [next]: value[next]}), {});
    if(additionalProperties === true || additionalProperties === undefined) return { ...current, object: {...current.object, ...extraParts} }
    if(additionalProperties === false) return { ...current, invalidations: [...current.invalidations, { schema: false, schemaLocation: `${schemaLocation}/additionalProperties`, value, valuePath, reason: `Should have no additional properties, found [${extraProperties}]` }] }
    return Object.keys(extraParts)
      .reduce((prev, property) => {
        const propertyValue = value[property];
        const propertyValidation = SchemaValidator.validate(additionalProperties, propertyValue, `${schemaLocation}/additionalProperties`, `${valuePath}/${property}`);
        if(!propertyValidation.isValid && !propertyValue) return prev;
        return { object: {...prev.object, [property]: propertyValidation.isValid ? propertyValidation.result : undefined}, invalidations: propertyValidation.isValid ? prev.invalidations : [...prev.invalidations, ...propertyValidation.result] }
      }, current);
  }

  private getPatternPropertiesPart<T>(schemaLocation: string, valuePath: string, schema: JSONSchema7, value: T, current: ObjectPart): ObjectPart {
    const valueKeys = Object.keys(value!);
    return Object.keys(schema.patternProperties ?? {})
      .reduce((prev, patternProperty) =>
        valueKeys.filter(it => !!it.match(patternProperty)).reduce((prev2, property) => {
          const propertyValue = value[property];
          const validation =  SchemaValidator.validate(schema.patternProperties![patternProperty], propertyValue, `${schemaLocation}/patternProperties/${patternProperty}`, `${valuePath}/${property}`);
          return { object: {...prev.object, [property]: validation.isValid ? validation.result : undefined}, invalidations: validation.isValid ? prev.invalidations : [...prev.invalidations, ...validation.result] }
        }, prev), current);
  }

  private validateObjectSchema<T>(schemaLocation: string, valuePath: string, schema: JSONSchema7, value: T, current: ObjectPart): ObjectPart {
    if(typeof value === 'object' && value && !Array.isArray(value)) {
      const required = schema.required ?? [];
      const keys = Object.keys(value!);
      const validKeys = keys.filter(it => value[it] !== undefined);
      const missing = required.filter(key => !validKeys.includes(key));
      const invalidations = [...current.invalidations];
      if (missing.length) {
        invalidations.push({
          schemaLocation,
          valuePath,
          value,
          schema: this.schema,
          reason: `Value should have all required properties but is missing [${missing.join(', ')}]`
        });
      }
      const validations = this.getPropertiesPart(schemaLocation, valuePath, schema, value, current);
      const withPatternPropertiesValidation = this.getPatternPropertiesPart(schemaLocation, valuePath, schema, value, validations);
      const keysMatchingPatterns = Object.keys(withPatternPropertiesValidation.object);
      const extraProperties = validKeys.filter(it => !keysMatchingPatterns.includes(it));
      const withAdditionalPropertiesValidation = this.getAdditionalPropertiesPart(schemaLocation, valuePath, schema, value, extraProperties, withPatternPropertiesValidation);
      invalidations.push(...withAdditionalPropertiesValidation.invalidations);
      if (schema.propertyNames !== undefined) {
        const nameSchema = new SchemaValidator(schema.propertyNames);
        invalidations.push(...keys.flatMap(key => {
          const validation = nameSchema.validateString(`${schemaLocation}/propertyNames`, `${valuePath}/${key}`, key);
          if (!validation.isValid) return validation.result;
          return [];
        }))
      }
      if (schema.minProperties && keys.length < schema.minProperties) {
        invalidations.push({
          schema,
          value,
          schemaLocation,
          valuePath,
          reason: `Object should have a minimum of ${schema.minProperties} properties`
        });
      }
      if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
        invalidations.push({
          schema,
          value,
          schemaLocation,
          valuePath,
          reason: `Object should have a maximum of ${schema.maxProperties} properties`
        });
      }
      return {object: withAdditionalPropertiesValidation.object, invalidations};
    }
    return current;
  }

  private validateObject<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const invalidType = this.validateType(value, 'object');
    const schema = this.schema as JSONSchema7;
    const invalidations: Invalid[] = invalidType ? [{ schemaLocation, valuePath, value, schema: this.schema, reason: invalidType }] : [];
    if(schema.const !== undefined && value !== schema.const) {
      invalidations.push({ schemaLocation, valuePath, value, schema: this.schema, reason: `Value should have been exactly ${JSON.stringify(schema.const)}` });
    }
    if(schema.enum && !schema.enum.includes(value)) {
      invalidations.push({ schemaLocation, valuePath, value, schema: this.schema, reason: `Value should have been one of [${schema.enum.map(it => JSON.stringify(it)).join(', ')}]` });
    }
    const result = this.validateObjectSchema(schemaLocation, valuePath, schema, value, { object: {}, invalidations });
    return result.invalidations.length ? this.invalid(...result.invalidations) : this.valid(result.object as T);
  }

  private validateString<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const invalidType = this.validateType(value, 'string');
    const schema = this.schema as JSONSchema7;
    const invalidations: string[] = invalidType ? [invalidType] : [];
    if(schema.const !== undefined && value !== schema.const) {
      invalidations.push(`Value should have been exactly '${schema.const}'`);
    }
    if(schema.enum && !schema.enum.includes(value)) {
      invalidations.push(`Value should have been one of [${schema.enum.map(it => `'${it}'`).join(', ')}]`);
    }
    if(typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        invalidations.push(`Value should have a minimum length of ${schema.minLength} character(s)`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        invalidations.push(`Value should have a maximum length of ${schema.maxLength} character(s)`);
      }
      if (schema.pattern !== undefined) {
        if (!value.match(new RegExp(schema.pattern))) {
          invalidations.push(`Value should match the following pattern /${schema.pattern}/`);
        }
      }
    }
    return invalidations.length ? this.invalid(...invalidations.map(reason => ({value, schemaLocation, valuePath, schema, reason}))) : this.valid(value);
  }

  private validateInteger<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const validation = this.validateNumber(schemaLocation, valuePath, value);
    if(typeof value === 'number'){
      if(Math.floor(value) !== value) {
        const otherInvalidations = validation.isValid ? [] : validation.result;
        return this.invalid({ reason: 'Value should have been an integer', schema: this.schema, schemaLocation, valuePath, value}, ...otherInvalidations);
      }
    }
    return validation;
  }

  private validateNumber<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const invalidType = this.validateType(value, 'number');
    const schema = this.schema as JSONSchema7;
    const invalidations: string[] = invalidType ? [invalidType] : [];
    if(schema.const !== undefined && value !== schema.const) {
      invalidations.push(`Value should have been exactly ${schema.const}`);
    }
    if(schema.enum && !schema.enum.includes(value)) {
      invalidations.push(`Value should have been one of [${schema.enum.join(', ')}]`);
    }
    if(typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        invalidations.push(`Value should have a minimum value of ${schema.minimum}`);
      }
      if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
        invalidations.push(`Value should have an exclusive minimum value of ${schema.exclusiveMinimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        invalidations.push(`Value should have a maximum value of ${schema.maximum}`);
      }
      if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
        invalidations.push(`Value should have an exclusive maximum value of ${schema.exclusiveMaximum}`);
      }
      if(schema.multipleOf !== undefined && schema.multipleOf !== 0) {
        if(value % schema.multipleOf !== 0) {
          invalidations.push(`Value should be a multiple of ${schema.multipleOf}`);
        }
      }
    }
    return invalidations.length ? this.invalid(...invalidations.map(reason => ({value, schema, schemaLocation, valuePath, reason}))) : this.valid(value);
  }

  private validateNull<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const invalidType = this.validateType(value, 'null');
    const schema = this.schema as JSONSchema7;
    const invalidations: string[] = invalidType ? [invalidType] : [];
    return invalidations.length ? this.invalid(...invalidations.map(reason => ({value, schema, schemaLocation, valuePath, reason}))) : this.valid(value);
  }

  private validateBoolean<T>(schemaLocation: string, valuePath: string, value: T): ValidationResult<T> {
    const invalidType = this.validateType(value, 'boolean');
    const schema = this.schema as JSONSchema7;
    const invalidations: string[] = invalidType ? [invalidType] : [];
    return invalidations.length ? this.invalid(...invalidations.map(reason => ({value, schema, schemaLocation, valuePath, reason}))) : this.valid(value);
  }


  private validateAgainstSchema<T = unknown>(schemaLocation: string, valuePath: string, value?: T): ValidationResult<T> {
    if(typeof this.schema === 'boolean') {
      if(this.schema) return this.valid(value);
      return this.invalid({ schemaLocation, valuePath, schema: this.schema, reason: 'Nothing validates against a false schema', value })
    }
    if(value === undefined) {
      if(this.schema.default !== undefined)
        return this.valid(this.schema.default as T);
      return this.invalid({ schemaLocation, valuePath, schema: this.schema, reason: 'Value should not be undefined, schema does not have a default value'});
    }
    if(this.schema.type) {
      if(Array.isArray(this.schema.type)) {
        return this.validateAgainstAnyOf(schemaLocation, value, this.schema.type.map(type => ({ ...this.schema as any, type })));
      }
      switch(this.schema.type) {
        case 'string': return this.validateString(schemaLocation, valuePath, value);
        case 'null': return this.validateNull(schemaLocation, valuePath, value);
        case 'number': return this.validateNumber(schemaLocation, valuePath, value);
        case 'integer': return this.validateInteger(schemaLocation, valuePath, value);
        case 'boolean': return this.validateBoolean(schemaLocation, valuePath, value);
        case 'object': return this.validateObject(schemaLocation, valuePath, value);
        case 'array': return this.validateArray(schemaLocation, valuePath, value);
      }
    }
    return this.valid(value);
  }


  static validate<T>(schema: Schema, value?: T, schemaLocation = '#', valuePath = '#'): ValidationResult<T> {
    return new SchemaValidator(schema).validateAgainstSchema(schemaLocation, valuePath, value);
  }
}