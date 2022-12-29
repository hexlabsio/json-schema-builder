import { SchemaToTsBuilder } from '@hexlabs/json-schema-to-ts';
import axios from 'axios';

(async () => {
  const result = await axios.get('http://json-schema.org/draft-07/schema#');
  const updated = { ...result.data, title: 'JSONSchema7' };
  const builder = SchemaToTsBuilder.create(updated, 'generated', (name, location) => {
    if(name === 'JSONSchema7Enum') return { name: 'Enumeration', location };
    if(name === 'JSONSchema7_Type') return { name: 'Schema', location };
    if(name === 'JSONSchema7Type_1') return { name: 'JSONSchema7Array', location };
    if(name.startsWith('JSONSchema7') && name !== 'JSONSchema7') return { name: name.substring(11), location };
    return { name, location };
  });
  const schemaFile = builder.modelFiles();
  schemaFile.write()
})();