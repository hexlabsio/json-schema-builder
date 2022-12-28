import { JSONSchema7, JSONSchema7Builder } from 'generated/json-schema.org/draft-07/JSONSchema7';
import { JSONSchema7_Type } from 'generated/json-schema.org/draft-07/JSONSchema7_Type';

export class Schemas<K extends string | null = null> {

  private constructor(private location: string, private schemas: Record<K extends null ? string : K, JSONSchema7_Type> = {} as any) {
  }

  add<Name extends string>(name: Name, schema: JSONSchema7_Type | ((builder: S<K extends null ? Name : K | Name>) => JSONSchema7_Type)): Schemas<K extends null ? Name : K | Name> {
    if(typeof schema === 'function') {
      this.schemas[name as any] = schema(new S(this.location, name));
    } else {
      this.schemas[name as any] = schema;
    }
    return this as any;
  }

  ref(name: K extends null ? string : K): string {
    return `${this.location}/${name}`;
  }


  static create(location = '#/definitions'): Schemas {
    return new Schemas(location);
  }
}

export class S<K extends string = string> {

  constructor(private location: string, private name?: string) {
  }

  ref(name: K extends null ? string : K): JSONSchema7_Type {
    return { $ref: `${this.location}/${name}` };
  }

  string(props: JSONSchema7): JSONSchema7_Type {
    return { type: 'string', ...props };
  }

  object(props: { title?: string; required?: Record<string, JSONSchema7_Type>, optional?: Record<string, JSONSchema7_Type>, additionalProperties?: JSONSchema7_Type, overrides?: JSONSchema7 }): JSONSchema7_Type {
    return S.object({...props, title: props.title ?? this.name });
  }

  schema(schema: JSONSchema7_Type | ((builder: JSONSchema7Builder<{}>) => JSONSchema7Builder)): JSONSchema7_Type {
    if(typeof schema === 'function') {
      return schema(JSONSchema7Builder.create()).build();
    }
    return schema;
  }

  static object(props: { title?: string; required?: Record<string, JSONSchema7_Type>, optional?: Record<string, JSONSchema7_Type>, additionalProperties?: JSONSchema7_Type, overrides?: JSONSchema7 }): JSONSchema7_Type {
    return {
      type: 'object',
      ...(props.title ? { title: props.title } : {} ),
      ...(props.required ? { required: Object.keys(props.required) } : {}),
      properties: { ...props.required, ...props.optional },
      ...(props.additionalProperties != undefined ? { additionalProperties: props.additionalProperties } : {}),
      ...props.overrides
    };
  }
}
