import { SchemaToTsBuilder } from '@hexlabs/json-schema-to-ts';
import axios from 'axios';

(async () => {
  const result = await axios.get('http://json-schema.org/draft-07/schema#');
  const updated = { ...result.data, title: 'JSONSchema7' };
  const builder = SchemaToTsBuilder.create(updated, 'generated');
    // .transformNames(ref => ref.name === 'JSONSchema7' ? {...ref, name: 'JSONSchema7Type'} : ref.name === 'JSONSchema7Type_0' ? {...ref, name: 'JSONSchema7'} : ref);
  const schemaFile = builder.modelFiles();
  schemaFile.write()
})();