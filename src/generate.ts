import { SchemaToTsBuilder } from '@hexlabs/json-schema-to-ts';
import axios from 'axios';
import { mkdirSync, writeFileSync } from 'fs';
import prettier from 'prettier';
import { Printer } from '../../typescript-generator';

(async () => {
  const result = await axios.get('http://json-schema.org/draft-07/schema#');
  const updated = { ...result.data, title: 'JSONSchema7' };
  const builder = SchemaToTsBuilder.create(updated);
  const schemaFile = builder.modelFile('json-schema.ts');
  const schemaBuilder = builder.builderFile();
  schemaBuilder.forEach(it => schemaFile.append(`export ${(it as any).print(Printer.create())}`));
  const pretty = prettier.format(schemaFile.print(), { parser: 'typescript', semi: false});
  mkdirSync('generated', { recursive: true });
  writeFileSync('generated/json-schema.ts', pretty);
})();