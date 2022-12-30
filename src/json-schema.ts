import { JSONSchema7, JSONSchema7Builder } from '../generated/json-schema.org/draft-07/JSONSchema7';
import { Schema } from '../generated/json-schema.org/draft-07/Schema';

export class Schemas<K extends string | null = null> {

  private constructor(private location: string, private schemas: Record<K extends null ? string : K, Schema> = {} as any) {
  }

  add<Name extends string>(name: Name, schema: Schema | ((builder: S<K extends null ? Name : K | Name>) => Schema)): Schemas<K extends null ? Name : K | Name> {
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

type CommonProps = Pick<JSONSchema7, 'title' | 'description' | 'const' | 'enum' | 'default' | 'readOnly' | 'writeOnly' | 'examples'>
type StringProps = Pick<JSONSchema7, keyof CommonProps | 'format' | 'minLength' | 'maxLength' | 'pattern'>
type ObjectProps = Pick<JSONSchema7, keyof CommonProps | 'additionalProperties' | 'properties' | 'required' | 'patternProperties' | 'minProperties' | 'maxProperties'>
type ArrayProps = Pick<JSONSchema7, keyof CommonProps | 'additionalItems' | 'items' | 'minItems' | 'maxItems' | 'uniqueItems'>
type NumberProps = Pick<JSONSchema7, keyof CommonProps | 'minimum' | 'maximum' | 'exclusiveMinimum' | 'exclusiveMaximum'>
type IntegerProps = Pick<JSONSchema7, keyof CommonProps | 'minimum' | 'maximum' | 'exclusiveMinimum' | 'exclusiveMaximum'>
type BooleanProps = Pick<JSONSchema7, keyof CommonProps>
type NullProps = Pick<JSONSchema7, keyof CommonProps>
type RefProps = Pick<JSONSchema7, '$ref'>

export class S<K extends string = string> {

  constructor(private location: string, private name?: string) {
  }

  ref(name: K extends null ? string : K): RefProps {
    return S.$ref(`${this.location}/${name}`);
  }

  static $ref($ref: string): RefProps {
    return { $ref };
  }

  string(props?: StringProps): StringProps {
    return S.string(props);
  }

  static string(props?: StringProps): JSONSchema7 {
    return { type: 'string', ...props };
  }

  number(props?: NumberProps): JSONSchema7 {
    return S.number(props);
  }

  static number(props?: NumberProps): JSONSchema7 {
    return { type: 'number', ...props };
  }

  integer(props?: IntegerProps): JSONSchema7 {
    return S.integer(props);
  }

  static integer(props?: IntegerProps): JSONSchema7 {
    return { type: 'integer', ...props };
  }

  boolean(props?: BooleanProps): JSONSchema7 {
    return S.boolean(props);
  }

  static boolean(props?: BooleanProps): JSONSchema7 {
    return { type: 'boolean', ...props };
  }

  null(props?: NullProps): JSONSchema7 {
    return S.null(props);
  }

  static null(props?: NullProps): JSONSchema7 {
    return { type: 'null', ...props };
  }

  arrayOf(reference: K extends null ? string : K, props?: ArrayProps): JSONSchema7 {
    return S.array({ items: this.ref(reference), ...props });
  }

  array(props?: ArrayProps): JSONSchema7 {
    return S.array(props);
  }

  static array(props?: ArrayProps): JSONSchema7 {
    return { type: 'array', ...props };
  }

  object(props?: { title?: string; required?: Record<string, Schema>, optional?: Record<string, Schema> } & Omit<ObjectProps, 'required' | 'properties'>): JSONSchema7 {
    return S.object(props ? {...props, title: props.title ?? this.name } : { title: this.name });
  }

  static object(props?: { title?: string; required?: Record<string, Schema>, optional?: Record<string, Schema> } & Omit<ObjectProps, 'required' | 'properties'>): JSONSchema7 {
    if(!props) return { type: 'object' };
    const {title, required, optional, ...rest} = props
    return {
      type: 'object',
      ...(title ? { title: title } : {} ),
      ...(required ? { required: Object.keys(required) } : {}),
      properties: { ...required, ...optional },
      ...rest,
      additionalProperties : rest.additionalProperties ?? false
    };
  }

  schema(schema: Schema | ((builder: JSONSchema7Builder<{}>) => JSONSchema7Builder)): Schema {
    if(typeof schema === 'function') {
      return schema(JSONSchema7Builder.create()).build();
    }
    return schema;
  }
}
