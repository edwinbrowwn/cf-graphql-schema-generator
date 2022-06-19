import {DMMF} from '@prisma/generator-helper';
import {getDMMF} from '@prisma/sdk';

export type Models = {[name: string]: DMMF.Model};
export type Enums = {[name: string]: DMMF.DatamodelEnum['values']};

export class DataModel {
  dataModel: DMMF.Datamodel;

  constructor(dataModel: DMMF.Datamodel) {
    this.dataModel = dataModel;
  }

  get names(): string[] {
    const {models} = this.dataModel;

    return models.map((model) => model.name);
  }

  get models(): Models {
    const {models} = this.dataModel;

    return models.reduce((acc, model) => {
      const {name} = model;

      return {...acc, [name]: model};
    }, {});
  }

  get enums(): Enums {
    const {enums} = this.dataModel;

    return enums.reduce((acc, cur) => {
      const {name, values} = cur;

      return {...acc, [name]: values};
    }, {});
  }
}

export type QueryArg = {
  field: string;
  type: string;
  name: string;
};

const parse = async (prismaSchema: string): Promise<DataModel> => {
  const dmmf = await getDMMF({datamodel: prismaSchema});
  return new DataModel(dmmf.datamodel);
};

export const parseQueryArgs = (prismaSchema: string): QueryArg[] => {
  const modelProperties = prismaSchema
    .split('model ')[1]
    .split(' {')[1]
    .split('}')[0]
    .split('\n')
    .filter((line) => line.includes('@Query'));

  if (modelProperties.length === 0) {
    return [];
  }

  const modelName = prismaSchema.split('model ')[1].split(' {')[0];

  const queryArgs = modelProperties
    .map((line) => {
      const words = line.split(' ').filter(Boolean);

      let fieldName: string = '';
      const schemaTypeName = (words[1] || '').replace(/[^a-zA-Z0-9]/g, '');

      if (
        schemaTypeName === 'String' ||
        schemaTypeName === 'Int' ||
        schemaTypeName === 'Boolean' ||
        schemaTypeName === 'Float' ||
        schemaTypeName === 'DateTime'
      ) {
        fieldName = words[0];
      }
      return {field: fieldName, type: schemaTypeName, name: modelName};
    })
    .filter((arg) => arg?.field !== '');

  return queryArgs;
};

export default parse;
